import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkInfrastructureProps {
  readonly applicationName: string;
  readonly environment: string;
}

export class NetworkInfrastructureConstruct extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly privateSubnets: ec2.ISubnet[];
  public readonly publicSubnets: ec2.ISubnet[];
  public readonly vpcEndpoints: { [service: string]: ec2.VpcEndpoint };
  public readonly securityGroups: { [name: string]: ec2.SecurityGroup };

  constructor(scope: Construct, id: string, props: NetworkInfrastructureProps) {
    super(scope, id);

    // Create VPC with public and private subnets across multiple AZs
    this.vpc = new ec2.Vpc(this, 'RAGApplicationVPC', {
      vpcName: `${props.applicationName}-vpc-${props.environment}`,
      ipAddresses: ec2.IpAddresses.cidr('10.1.0.0/16'),
      maxAzs: 3, // Use 3 AZs for high availability
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24, // 10.1.1.0/24, 10.1.2.0/24, 10.1.3.0/24
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24, // 10.1.11.0/24, 10.1.12.0/24, 10.1.13.0/24
        },
        {
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24, // 10.1.21.0/24, 10.1.22.0/24, 10.1.23.0/24
        },
      ],
      natGateways: props.environment === 'prod' ? 3 : 1, // HA for prod, cost-optimized for dev
    });

    this.privateSubnets = this.vpc.privateSubnets;
    this.publicSubnets = this.vpc.publicSubnets;

    // Create VPC endpoints for AWS services to avoid internet routing
    this.vpcEndpoints = this.createVpcEndpoints();

    // Create security groups for different service tiers
    this.securityGroups = this.createSecurityGroups();
  }

  private createVpcEndpoints(): { [service: string]: ec2.VpcEndpoint } {
    const endpoints: { [service: string]: ec2.VpcEndpoint } = {};

    // S3 Gateway endpoint (no cost)
    endpoints.s3 = new ec2.GatewayVpcEndpoint(this, 'S3Endpoint', {
      vpc: this.vpc,
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
    });

    // DynamoDB Gateway endpoint (no cost)
    endpoints.dynamodb = new ec2.GatewayVpcEndpoint(this, 'DynamoDBEndpoint', {
      vpc: this.vpc,
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
    });

    // Bedrock Interface endpoint
    endpoints.bedrock = new ec2.InterfaceVpcEndpoint(this, 'BedrockEndpoint', {
      vpc: this.vpc,
      service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${cdk.Stack.of(this).region}.bedrock-runtime`),
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      privateDnsEnabled: true,
    });

    // Textract Interface endpoint
    endpoints.textract = new ec2.InterfaceVpcEndpoint(this, 'TextractEndpoint', {
      vpc: this.vpc,
      service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${cdk.Stack.of(this).region}.textract`),
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      privateDnsEnabled: true,
    });

    // Secrets Manager endpoint for Aurora credentials
    endpoints.secretsmanager = new ec2.InterfaceVpcEndpoint(this, 'SecretsManagerEndpoint', {
      vpc: this.vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      privateDnsEnabled: true,
    });

    return endpoints;
  }

  private createSecurityGroups(): { [name: string]: ec2.SecurityGroup } {
    const securityGroups: { [name: string]: ec2.SecurityGroup } = {};

    // Lambda security group
    securityGroups.lambda = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true, // Lambda needs outbound access to AWS services
    });

    // Aurora security group
    securityGroups.aurora = new ec2.SecurityGroup(this, 'AuroraSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Aurora Serverless cluster',
      allowAllOutbound: false,
    });

    // Allow Lambda to connect to Aurora on PostgreSQL port
    securityGroups.aurora.addIngressRule(
      securityGroups.lambda,
      ec2.Port.tcp(5432),
      'Allow Lambda access to Aurora PostgreSQL'
    );

    // OpenSearch Serverless security group (if using VPC mode)
    securityGroups.opensearch = new ec2.SecurityGroup(this, 'OpenSearchSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for OpenSearch Serverless',
      allowAllOutbound: false,
    });

    // Allow Lambda to connect to OpenSearch on HTTPS
    securityGroups.opensearch.addIngressRule(
      securityGroups.lambda,
      ec2.Port.tcp(443),
      'Allow Lambda access to OpenSearch'
    );

    // VPC Endpoint security group
    securityGroups.vpcEndpoints = new ec2.SecurityGroup(this, 'VPCEndpointsSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for VPC endpoints',
      allowAllOutbound: false,
    });

    // Allow Lambda to access VPC endpoints on HTTPS
    securityGroups.vpcEndpoints.addIngressRule(
      securityGroups.lambda,
      ec2.Port.tcp(443),
      'Allow Lambda access to VPC endpoints'
    );

    return securityGroups;
  }

  public getNetworkConfiguration() {
    return {
      vpcId: this.vpc.vpcId,
      privateSubnetIds: this.privateSubnets.map(subnet => subnet.subnetId),
      publicSubnetIds: this.publicSubnets.map(subnet => subnet.subnetId),
      securityGroupIds: {
        lambda: this.securityGroups.lambda.securityGroupId,
        aurora: this.securityGroups.aurora.securityGroupId,
        opensearch: this.securityGroups.opensearch.securityGroupId,
        vpcEndpoints: this.securityGroups.vpcEndpoints.securityGroupId,
      },
      vpcEndpoints: Object.keys(this.vpcEndpoints),
    };
  }
}
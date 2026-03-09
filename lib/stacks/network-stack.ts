import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkInfrastructureConstruct } from '../constructs/network-infrastructure';

export interface NetworkStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: cdk.aws_ec2.IVpc;
  public readonly vpcId: string;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { applicationName, environment } = props;

    // Network Infrastructure Foundation
    const networkInfrastructure = new NetworkInfrastructureConstruct(this, 'NetworkInfrastructure', {
      applicationName,
      environment,
    });

    this.vpc = networkInfrastructure.vpc;
    this.vpcId = networkInfrastructure.vpc.vpcId;

    // Stack Outputs
    new cdk.CfnOutput(this, 'VPCId', {
      value: this.vpcId,
      description: 'VPC ID for the RAG infrastructure',
      exportName: `${applicationName}-${environment}-vpc-id`,
    });

    new cdk.CfnOutput(this, 'VPCCidr', {
      value: networkInfrastructure.vpc.vpcCidrBlock,
      description: 'VPC CIDR block',
      exportName: `${applicationName}-${environment}-vpc-cidr`,
    });
  }
}

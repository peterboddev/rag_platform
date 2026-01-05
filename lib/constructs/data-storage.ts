import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface DataStorageProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly vpc: ec2.Vpc;
  readonly account: string;
  readonly region: string;
  readonly enableRDS?: boolean;
}

export class DataStorageConstruct extends Construct {
  public readonly dynamoDBRole: iam.Role;
  public readonly auroraCluster?: rds.DatabaseCluster;
  public readonly databaseEndpoints: { [key: string]: string };

  constructor(scope: Construct, id: string, props: DataStorageProps) {
    super(scope, id);

    // Create IAM role for DynamoDB access (application teams will create their own tables)
    this.dynamoDBRole = new iam.Role(this, 'DynamoDBRole', {
      roleName: `${props.applicationName}-dynamodb-role-${props.environment}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant DynamoDB permissions (application teams will specify table names)
    this.dynamoDBRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:BatchGetItem',
        'dynamodb:BatchWriteItem',
      ],
      resources: [
        `arn:aws:dynamodb:${props.region}:${props.account}:table/${props.applicationName}-*`,
      ],
    }));

    // Initialize database endpoints
    this.databaseEndpoints = {
      dynamoDBRegion: props.region,
    };

    // Optional Aurora PostgreSQL Serverless v2 for complex analytics
    if (props.enableRDS) {
      const dbSubnetGroup = new rds.SubnetGroup(this, 'DBSubnetGroup', {
        description: 'Subnet group for Aurora Serverless cluster',
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      });

      // Create Aurora PostgreSQL Serverless v2 cluster
      this.auroraCluster = new rds.DatabaseCluster(this, 'AuroraServerlessCluster', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_15_6,
        }),
        credentials: rds.Credentials.fromGeneratedSecret('dbadmin'),
        writer: rds.ClusterInstance.serverlessV2('writer', {
          scaleWithWriter: true,
        }),
        vpc: props.vpc,
        subnetGroup: dbSubnetGroup,
        serverlessV2MinCapacity: 0.5, // Minimum ACUs (Aurora Capacity Units)
        serverlessV2MaxCapacity: 16,  // Maximum ACUs
        defaultDatabaseName: 'analytics',
        storageEncrypted: true,
        backup: {
          retention: cdk.Duration.days(7),
        },
        deletionProtection: props.environment === 'prod',
        removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        cloudwatchLogsExports: ['postgresql'], // Enable CloudWatch logs
      });

      // Add a serverless v2 writer instance
      this.auroraCluster.addRotationSingleUser();

      // Create database access role
      const rdsRole = new iam.Role(this, 'AuroraRole', {
        roleName: `${props.applicationName}-aurora-role-${props.environment}`,
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
      });

      // Grant Aurora connect permissions
      rdsRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'rds-db:connect',
        ],
        resources: [
          `arn:aws:rds-db:${props.region}:${props.account}:dbuser:${this.auroraCluster.clusterIdentifier}/*`,
        ],
      }));

      // Update database endpoints
      this.databaseEndpoints = {
        ...this.databaseEndpoints,
        auroraEndpoint: this.auroraCluster.clusterEndpoint.hostname,
        auroraReaderEndpoint: this.auroraCluster.clusterReadEndpoint.hostname,
        auroraPort: this.auroraCluster.clusterEndpoint.port.toString(),
        auroraSecretArn: this.auroraCluster.secret?.secretArn || '',
      };
    }
  }

  public getDatabaseConfiguration() {
    return {
      dynamodb: {
        region: this.databaseEndpoints.dynamoDBRegion,
        roleArn: this.dynamoDBRole.roleArn,
        tablePrefix: `${this.node.tryGetContext('applicationName') || 'rag-app'}-`,
      },
      rds: this.auroraCluster ? {
        writerEndpoint: this.databaseEndpoints.auroraEndpoint!,
        readerEndpoint: this.databaseEndpoints.auroraReaderEndpoint!,
        port: parseInt(this.databaseEndpoints.auroraPort!),
        secretArn: this.databaseEndpoints.auroraSecretArn!,
        databaseName: 'analytics',
        serverless: true,
        minCapacity: 0.5,
        maxCapacity: 16,
      } : undefined,
    };
  }
}
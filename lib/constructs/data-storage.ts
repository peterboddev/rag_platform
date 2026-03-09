import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface DataStorageProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly vpc: ec2.IVpc;
  readonly account: string;
  readonly region: string;
  readonly enableRDS?: boolean;
}

export class DataStorageConstruct extends Construct {
  public readonly dynamoDBRole: iam.Role;
  public readonly customersTable: dynamodb.Table;
  public readonly documentsTable: dynamodb.Table;
  public readonly auroraCluster?: rds.DatabaseCluster;
  public readonly databaseEndpoints: { [key: string]: string };

  constructor(scope: Construct, id: string, props: DataStorageProps) {
    super(scope, id);

    // Create DynamoDB table for customers/tenants
    this.customersTable = new dynamodb.Table(this, 'CustomersTable', {
      tableName: `${props.applicationName}-customers-${props.environment}`,
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: props.environment === 'prod',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // Add GSI for querying by email
    this.customersTable.addGlobalSecondaryIndex({
      indexName: 'emailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    // Create DynamoDB table for document metadata
    this.documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
      tableName: `${props.applicationName}-documents-${props.environment}`,
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: props.environment === 'prod',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // Add GSI for querying documents by customer
    this.documentsTable.addGlobalSecondaryIndex({
      indexName: 'customerIdIndex',
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'uploadedAt', type: dynamodb.AttributeType.NUMBER },
    });

    // Add GSI for querying by status
    this.documentsTable.addGlobalSecondaryIndex({
      indexName: 'statusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'uploadedAt', type: dynamodb.AttributeType.NUMBER },
    });

    // Create IAM role for DynamoDB access (kept for backward compatibility)
    this.dynamoDBRole = new iam.Role(this, 'DynamoDBRole', {
      roleName: `${props.applicationName}-dynamodb-role-${props.environment}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant DynamoDB permissions to the role
    this.customersTable.grantReadWriteData(this.dynamoDBRole);
    this.documentsTable.grantReadWriteData(this.dynamoDBRole);

    // Initialize database endpoints
    this.databaseEndpoints = {
      dynamoDBRegion: props.region,
      customersTableName: this.customersTable.tableName,
      documentsTableName: this.documentsTable.tableName,
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
        customersTable: this.customersTable.tableName,
        documentsTable: this.documentsTable.tableName,
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

  // Grant read/write access to tables for application Lambda role
  public grantTableAccess(role: iam.IRole) {
    this.customersTable.grantReadWriteData(role);
    this.documentsTable.grantReadWriteData(role);
  }
}
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { DataStorageConstruct } from '../constructs/data-storage';

export interface DataStorageStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly vpc: ec2.IVpc;
}

export class DataStorageStack extends cdk.Stack {
  public readonly customersTable: cdk.aws_dynamodb.Table;
  public readonly documentsTable: cdk.aws_dynamodb.Table;
  public readonly dynamoDBRole: cdk.aws_iam.Role;

  constructor(scope: Construct, id: string, props: DataStorageStackProps) {
    super(scope, id, props);

    const { applicationName, environment, vpc } = props;

    // Data Storage (DynamoDB tables)
    const dataStorage = new DataStorageConstruct(this, 'DataStorage', {
      applicationName,
      environment,
      vpc,
      account: this.account,
      region: this.region,
      enableRDS: false, // Disable Aurora Serverless v2 for now
    });

    this.customersTable = dataStorage.customersTable;
    this.documentsTable = dataStorage.documentsTable;
    this.dynamoDBRole = dataStorage.dynamoDBRole;

    // Stack Outputs
    new cdk.CfnOutput(this, 'CustomersTableName', {
      value: this.customersTable.tableName,
      description: 'DynamoDB table for customer/tenant management',
      exportName: `${applicationName}-${environment}-customers-table`,
    });

    new cdk.CfnOutput(this, 'CustomersTableArn', {
      value: this.customersTable.tableArn,
      description: 'DynamoDB customers table ARN',
      exportName: `${applicationName}-${environment}-customers-table-arn`,
    });

    new cdk.CfnOutput(this, 'DocumentsTableName', {
      value: this.documentsTable.tableName,
      description: 'DynamoDB table for document metadata',
      exportName: `${applicationName}-${environment}-documents-table`,
    });

    new cdk.CfnOutput(this, 'DocumentsTableArn', {
      value: this.documentsTable.tableArn,
      description: 'DynamoDB documents table ARN',
      exportName: `${applicationName}-${environment}-documents-table-arn`,
    });
  }
}

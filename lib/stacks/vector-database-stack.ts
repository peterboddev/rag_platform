import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { VectorDatabaseConstruct } from '../constructs/vector-database';

export interface VectorDatabaseStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly vpc: ec2.IVpc;
}

export class VectorDatabaseStack extends cdk.Stack {
  public readonly collection: cdk.aws_opensearchserverless.CfnCollection;
  public readonly collectionArn: string;
  public readonly collectionEndpoint: string;
  public readonly collectionName: string;
  public readonly indexName: string;

  constructor(scope: Construct, id: string, props: VectorDatabaseStackProps) {
    super(scope, id, props);

    const { applicationName, environment, vpc } = props;

    // Create Knowledge Base service role (needed for vector database access policy)
    const knowledgeBaseServiceRole = new iam.Role(this, 'KnowledgeBaseServiceRole', {
      roleName: `${applicationName}-kb-service-role-${environment}`,
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    // Vector Database (with Knowledge Base service role access)
    const vectorDatabase = new VectorDatabaseConstruct(this, 'VectorDatabase', {
      applicationName,
      environment,
      vpc,
      accessRoles: [knowledgeBaseServiceRole],
    });

    this.collection = vectorDatabase.collection;
    this.collectionArn = vectorDatabase.collectionArn;
    this.collectionEndpoint = vectorDatabase.collectionEndpoint;
    this.collectionName = vectorDatabase.collectionName;
    this.indexName = vectorDatabase.indexName;

    // Stack Outputs
    new cdk.CfnOutput(this, 'VectorDatabaseEndpoint', {
      value: this.collectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint',
      exportName: `${applicationName}-${environment}-vector-db-endpoint`,
    });

    new cdk.CfnOutput(this, 'VectorDatabaseArn', {
      value: this.collectionArn,
      description: 'OpenSearch Serverless collection ARN',
      exportName: `${applicationName}-${environment}-vector-db-arn`,
    });

    new cdk.CfnOutput(this, 'VectorDatabaseCollectionName', {
      value: this.collectionName,
      description: 'OpenSearch Serverless collection name',
      exportName: `${applicationName}-${environment}-vector-db-collection-name`,
    });

    new cdk.CfnOutput(this, 'VectorDatabaseIndexName', {
      value: this.indexName,
      description: 'Vector index name',
      exportName: `${applicationName}-${environment}-vector-db-index-name`,
    });
  }
}

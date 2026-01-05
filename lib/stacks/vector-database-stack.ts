import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { VectorDatabaseConstruct } from '../constructs/vector-database';

export interface VectorDatabaseStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly vpcId: string;
}

export class VectorDatabaseStack extends cdk.Stack {
  public readonly vectorDatabase: VectorDatabaseConstruct;

  constructor(scope: Construct, id: string, props: VectorDatabaseStackProps) {
    super(scope, id, props);

    const { applicationName, environment, vpcId } = props;

    // Import the VPC from the foundation stack
    const vpc = ec2.Vpc.fromLookup(this, 'ImportedVPC', {
      vpcId: vpcId,
    });

    // Create the vector database (OpenSearch Serverless)
    this.vectorDatabase = new VectorDatabaseConstruct(this, 'VectorDatabase', {
      applicationName,
      environment,
      vpc: vpc,
      // No access roles initially - will be added by other stacks
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'VectorDatabaseEndpoint', {
      value: this.vectorDatabase.collectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint',
      exportName: `${applicationName}-${environment}-vector-db-endpoint`,
    });

    new cdk.CfnOutput(this, 'VectorDatabaseArn', {
      value: this.vectorDatabase.collectionArn,
      description: 'OpenSearch Serverless collection ARN',
      exportName: `${applicationName}-${environment}-vector-db-arn`,
    });

    new cdk.CfnOutput(this, 'VectorIndexName', {
      value: this.vectorDatabase.indexName,
      description: 'Vector index name',
      exportName: `${applicationName}-${environment}-vector-index-name`,
    });
  }
}
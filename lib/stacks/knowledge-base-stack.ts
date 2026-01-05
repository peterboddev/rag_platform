import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { KnowledgeBaseConstruct } from '../constructs/knowledge-base';

export interface KnowledgeBaseStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly vpcId: string;
  readonly vectorDatabaseEndpoint: string;
  readonly vectorDatabaseArn: string;
  readonly documentsBucketName: string;
}

export class KnowledgeBaseStack extends cdk.Stack {
  public readonly knowledgeBase: KnowledgeBaseConstruct;

  constructor(scope: Construct, id: string, props: KnowledgeBaseStackProps) {
    super(scope, id, props);

    const { applicationName, environment, vpcId, vectorDatabaseEndpoint, vectorDatabaseArn, documentsBucketName } = props;

    // Import the VPC from the foundation stack
    const vpc = ec2.Vpc.fromLookup(this, 'ImportedVPC', {
      vpcId: vpcId,
    });

    // Create Bedrock Knowledge Base
    this.knowledgeBase = new KnowledgeBaseConstruct(this, 'KnowledgeBase', {
      applicationName,
      environment,
      vpc: vpc,
      vectorDatabaseEndpoint,
      vectorDatabaseArn,
      documentsBucketName,
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: this.knowledgeBase.knowledgeBaseId,
      description: 'Bedrock Knowledge Base ID',
      exportName: `${applicationName}-${environment}-knowledge-base-id`,
    });

    new cdk.CfnOutput(this, 'KnowledgeBaseArn', {
      value: this.knowledgeBase.knowledgeBaseArn,
      description: 'Bedrock Knowledge Base ARN',
      exportName: `${applicationName}-${environment}-knowledge-base-arn`,
    });

    new cdk.CfnOutput(this, 'DataSourceId', {
      value: this.knowledgeBase.dataSourceId,
      description: 'Bedrock Knowledge Base Data Source ID',
      exportName: `${applicationName}-${environment}-data-source-id`,
    });
  }
}
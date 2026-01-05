import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { DocumentProcessingConstruct } from '../constructs/document-processing';

export interface DocumentProcessingStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly vpcId: string;
  readonly documentsBucketName: string;
  readonly vectorDatabaseEndpoint: string;
  readonly vectorDatabaseArn: string;
}

export class DocumentProcessingStack extends cdk.Stack {
  public readonly documentProcessing: DocumentProcessingConstruct;

  constructor(scope: Construct, id: string, props: DocumentProcessingStackProps) {
    super(scope, id, props);

    const { applicationName, environment, vpcId, documentsBucketName, vectorDatabaseEndpoint, vectorDatabaseArn } = props;

    // Import the VPC from the foundation stack
    const vpc = ec2.Vpc.fromLookup(this, 'ImportedVPC', {
      vpcId: vpcId,
    });

    // Create document processing pipeline
    this.documentProcessing = new DocumentProcessingConstruct(this, 'DocumentProcessing', {
      applicationName,
      environment,
      vpc: vpc,
      documentsBucketName,
      vectorDatabaseEndpoint,
      vectorDatabaseArn,
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'ProcessingQueueUrl', {
      value: this.documentProcessing.processingQueue.queueUrl,
      description: 'Document processing queue URL',
      exportName: `${applicationName}-${environment}-processing-queue-url`,
    });

    new cdk.CfnOutput(this, 'ProcessingFunctionArn', {
      value: this.documentProcessing.processingFunction.functionArn,
      description: 'Document processing Lambda function ARN',
      exportName: `${applicationName}-${environment}-processing-function-arn`,
    });

    new cdk.CfnOutput(this, 'EmbeddingFunctionArn', {
      value: this.documentProcessing.embeddingFunction.functionArn,
      description: 'Embedding generation Lambda function ARN',
      exportName: `${applicationName}-${environment}-embedding-function-arn`,
    });
  }
}
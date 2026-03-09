import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3StorageConstruct } from '../constructs/s3-storage';

export interface StorageStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
}

export class StorageStack extends cdk.Stack {
  public readonly documentBucket: cdk.aws_s3.Bucket;
  public readonly websiteBucket: cdk.aws_s3.Bucket;
  public readonly configurationBucket: cdk.aws_s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { applicationName, environment } = props;

    // S3 Storage Infrastructure
    const s3Storage = new S3StorageConstruct(this, 'S3Storage', {
      applicationName,
      environment,
      allowedOrigins: ['*'], // Configure based on your frontend domains
    });

    this.documentBucket = s3Storage.documentBucket;
    this.websiteBucket = s3Storage.websiteBucket;
    this.configurationBucket = s3Storage.configurationBucket;

    // Stack Outputs
    new cdk.CfnOutput(this, 'DocumentBucketName', {
      value: this.documentBucket.bucketName,
      description: 'S3 bucket for document storage',
      exportName: `${applicationName}-${environment}-document-bucket`,
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'S3 bucket for website hosting',
      exportName: `${applicationName}-${environment}-website-bucket`,
    });

    new cdk.CfnOutput(this, 'ConfigurationBucketName', {
      value: this.configurationBucket.bucketName,
      description: 'S3 bucket for configuration export',
      exportName: `${applicationName}-${environment}-config-bucket`,
    });
  }
}

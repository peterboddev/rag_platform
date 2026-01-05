import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3StorageConstruct } from '../constructs/s3-storage';

export interface StorageStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
}

export class StorageStack extends cdk.Stack {
  public readonly s3Storage: S3StorageConstruct;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { applicationName, environment } = props;

    // S3 Storage Infrastructure
    this.s3Storage = new S3StorageConstruct(this, 'S3Storage', {
      applicationName,
      environment,
      allowedOrigins: ['*'], // Configure based on your frontend domains
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'DocumentBucketName', {
      value: this.s3Storage.documentBucket.bucketName,
      description: 'S3 bucket for document storage',
      exportName: `${applicationName}-${environment}-document-bucket`,
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.s3Storage.websiteBucket.bucketName,
      description: 'S3 bucket for website hosting',
      exportName: `${applicationName}-${environment}-website-bucket`,
    });

    new cdk.CfnOutput(this, 'ConfigurationBucketName', {
      value: this.s3Storage.configurationBucket.bucketName,
      description: 'S3 bucket for configuration export',
      exportName: `${applicationName}-${environment}-config-bucket`,
    });

    new cdk.CfnOutput(this, 'BackupBucketName', {
      value: this.s3Storage.backupBucket.bucketName,
      description: 'S3 bucket for backups',
      exportName: `${applicationName}-${environment}-backup-bucket`,
    });
  }
}
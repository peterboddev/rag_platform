import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface S3StorageProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly allowedOrigins?: string[];
  readonly enableCrossRegionReplication?: boolean;
}

export class S3StorageConstruct extends Construct {
  public readonly websiteBucket: s3.Bucket;
  public readonly documentBucket: s3.Bucket;
  public readonly configurationBucket: s3.Bucket;
  public readonly backupBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3StorageProps) {
    super(scope, id);

    // Website hosting bucket for frontend application
    // Note: Public access is disabled due to account-level Block Public Access settings.
    // For production, consider using CloudFront distribution with OAI/OAC for secure access.
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `${props.applicationName}-website-${props.environment}-${cdk.Stack.of(this).account}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      publicReadAccess: false, // Disabled due to account-level Block Public Access
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Block all public access
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Document storage bucket with partitioning
    this.documentBucket = new s3.Bucket(this, 'DocumentBucket', {
      bucketName: `${props.applicationName}-documents-${props.environment}-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          expiration: cdk.Duration.days(90),
        },
        {
          id: 'TransitionToIA',
          transitions: [{
            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
            transitionAfter: cdk.Duration.days(30),
          }],
        },
        {
          id: 'ArchiveProcessedDocuments',
          prefix: 'processed/',
          transitions: [{
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(90),
          }],
        },
      ],
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
        allowedOrigins: props.allowedOrigins || ['*'],
        allowedHeaders: ['*'],
        maxAge: 3000,
      }],
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Configuration export bucket for development teams
    this.configurationBucket = new s3.Bucket(this, 'ConfigurationBucket', {
      bucketName: `${props.applicationName}-config-${props.environment}-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Backup bucket for disaster recovery
    this.backupBucket = new s3.Bucket(this, 'BackupBucket', {
      bucketName: `${props.applicationName}-backup-${props.environment}-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [{
        id: 'TransitionToGlacier',
        transitions: [{
          storageClass: s3.StorageClass.GLACIER,
          transitionAfter: cdk.Duration.days(30),
        }],
      }],
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Set up cross-region replication for backup bucket (if enabled)
    if (props.enableCrossRegionReplication) {
      const replicationRole = new iam.Role(this, 'ReplicationRole', {
        assumedBy: new iam.ServicePrincipal('s3.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSS3ReplicationServiceRolePolicy'),
        ],
      });

      // Grant permissions to read from source bucket and write to destination
      this.backupBucket.grantRead(replicationRole);
      this.backupBucket.grantWrite(replicationRole);
    }
  }

  public getDocumentPartitionPrefixes(): { [key: string]: string } {
    return {
      raw: 'raw/',
      processing: 'processing/',
      processed: 'processed/',
      failed: 'failed/',
      archive: 'archive/',
    };
  }
}
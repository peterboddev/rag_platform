import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { S3StorageConstruct } from './s3-storage';
import { BedrockAIServicesConstruct } from './bedrock-ai-services';
import { VectorDatabaseConstruct } from './vector-database';
import { KnowledgeBaseConstruct } from './knowledge-base';
import { CognitoAuthenticationConstruct } from './cognito-authentication';
import { ApplicationIntegrationConstruct } from './application-integration';
import { DataStorageConstruct } from './data-storage';
import { DocumentProcessingConstruct } from './document-processing';

export interface ConfigurationExportProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly region: string;
  readonly s3Storage: S3StorageConstruct;
  readonly bedrockServices: BedrockAIServicesConstruct;
  readonly vectorDatabase: VectorDatabaseConstruct;
  readonly knowledgeBase: KnowledgeBaseConstruct;
  readonly cognitoAuth: CognitoAuthenticationConstruct;
  readonly applicationIntegration: ApplicationIntegrationConstruct;
  readonly dataStorage: DataStorageConstruct;
  readonly documentProcessing: DocumentProcessingConstruct;
}

export class ConfigurationExportConstruct extends Construct {
  public readonly exportFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ConfigurationExportProps) {
    super(scope, id);

    // Create Lambda function to generate configuration
    this.exportFunction = new lambda.Function(this, 'ConfigurationExportFunction', {
      functionName: `${props.applicationName}-config-export-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import os
from datetime import datetime

def handler(event, context):
    """
    Configuration export Lambda function
    Generates configuration files for development teams
    """
    s3 = boto3.client('s3')
    
    # Generate configuration
    config = {
        "applicationName": os.environ['APPLICATION_NAME'],
        "environment": os.environ['ENVIRONMENT'],
        "region": os.environ['AWS_REGION'],
        "deploymentTimestamp": datetime.utcnow().isoformat() + "Z",
        "services": {
            "bedrock": {
                "novaProModelId": os.environ['BEDROCK_NOVA_PRO_MODEL_ID'],
                "embeddingModelId": os.environ['BEDROCK_EMBEDDING_MODEL_ID'],
                "region": os.environ['AWS_REGION']
            },
            "knowledgeBase": {
                "knowledgeBaseId": os.environ['KNOWLEDGE_BASE_ID'],
                "region": os.environ['AWS_REGION']
            },
            "vectorDatabase": {
                "endpoint": os.environ['VECTOR_DATABASE_ENDPOINT'],
                "indexName": os.environ['VECTOR_INDEX_NAME']
            },
            "storage": {
                "websiteBucket": os.environ['WEBSITE_BUCKET_NAME'],
                "documentBucket": os.environ['DOCUMENT_BUCKET_NAME'],
                "configurationBucket": os.environ['CONFIGURATION_BUCKET_NAME'],
                "backupBucket": os.environ['BACKUP_BUCKET_NAME'],
                "documentPartitions": {
                    "raw": "raw/",
                    "processing": "processing/",
                    "processed": "processed/",
                    "failed": "failed/",
                    "archive": "archive/"
                },
                "region": os.environ['AWS_REGION']
            },
            "textract": {
                "region": os.environ['AWS_REGION']
            },
            "authentication": {
                "userPoolId": os.environ['COGNITO_USER_POOL_ID'],
                "clientId": os.environ['COGNITO_CLIENT_ID'],
                "identityPoolId": os.environ['COGNITO_IDENTITY_POOL_ID'],
                "region": os.environ['AWS_REGION']
            },
            "database": {
                "dynamoDBRoleArn": os.environ['DYNAMODB_ROLE_ARN'],
                "dynamoDBRegion": os.environ['AWS_REGION'],
                "tablePrefix": f"{os.environ['APPLICATION_NAME']}-"
            },
            "iam": {
                "applicationRoleArn": os.environ['APPLICATION_ROLE_ARN']
            }
        },
        "endpoints": {
            "websiteUrl": f"https://{os.environ['WEBSITE_BUCKET_NAME']}.s3-website-{os.environ['AWS_REGION']}.amazonaws.com"
        },
        "monitoring": {
            "metricsNamespace": f"RAG/{os.environ['APPLICATION_NAME']}"
        }
    }
    
    # Upload configuration to S3
    config_json = json.dumps(config, indent=2)
    config_key = f"config/{os.environ['ENVIRONMENT']}/rag-infrastructure-config.json"
    
    s3.put_object(
        Bucket=os.environ['CONFIG_BUCKET'],
        Key=config_key,
        Body=config_json,
        ContentType='application/json'
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Configuration exported successfully',
            'configLocation': f"s3://{os.environ['CONFIG_BUCKET']}/{config_key}"
        })
    }
      `),
      timeout: cdk.Duration.minutes(5),
      environment: {
        CONFIG_BUCKET: props.s3Storage.configurationBucket.bucketName,
        APPLICATION_NAME: props.applicationName,
        ENVIRONMENT: props.environment,
        BEDROCK_NOVA_PRO_MODEL_ID: props.bedrockServices.novaProModelId,
        BEDROCK_EMBEDDING_MODEL_ID: props.bedrockServices.embeddingModelId,
        KNOWLEDGE_BASE_ID: props.knowledgeBase.knowledgeBaseId,
        VECTOR_DATABASE_ENDPOINT: props.vectorDatabase.collectionEndpoint,
        VECTOR_INDEX_NAME: props.vectorDatabase.indexName,
        WEBSITE_BUCKET_NAME: props.s3Storage.websiteBucket.bucketName,
        DOCUMENT_BUCKET_NAME: props.s3Storage.documentBucket.bucketName,
        CONFIGURATION_BUCKET_NAME: props.s3Storage.configurationBucket.bucketName,
        BACKUP_BUCKET_NAME: props.s3Storage.backupBucket.bucketName,
        COGNITO_USER_POOL_ID: props.cognitoAuth.userPool.userPoolId,
        COGNITO_CLIENT_ID: props.cognitoAuth.userPoolClient.userPoolClientId,
        COGNITO_IDENTITY_POOL_ID: props.cognitoAuth.identityPool.ref,
        DYNAMODB_ROLE_ARN: props.dataStorage.dynamoDBRole.roleArn,
        APPLICATION_ROLE_ARN: props.applicationIntegration.applicationRole.roleArn,
      },
    });

    // Grant S3 write access to Lambda
    props.s3Storage.configurationBucket.grantWrite(this.exportFunction);

    // Create custom resource to trigger configuration export on deployment
    const customResource = new cdk.CustomResource(this, 'ConfigurationExportTrigger', {
      serviceToken: this.exportFunction.functionArn,
      properties: {
        timestamp: Date.now(), // Force update on each deployment
      },
    });

    // Output configuration export information
    new cdk.CfnOutput(this, 'ConfigurationExportFunctionArn', {
      value: this.exportFunction.functionArn,
      description: 'Configuration export Lambda function ARN',
    });

    new cdk.CfnOutput(this, 'ConfigurationLocation', {
      value: `s3://${props.s3Storage.configurationBucket.bucketName}/config/${props.environment}/rag-infrastructure-config.json`,
      description: 'Location of the exported configuration file',
    });
  }
}
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { S3StorageConstruct } from './s3-storage';
import { VectorDatabaseConstruct } from './vector-database';
import { KnowledgeBaseConstruct } from './knowledge-base';

export interface DocumentProcessingProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly s3Storage: S3StorageConstruct;
  readonly vectorDatabase: VectorDatabaseConstruct;
  readonly knowledgeBase: KnowledgeBaseConstruct;
  readonly embeddingModelId: string;
  readonly vpc: ec2.Vpc;
  readonly securityGroups: { [name: string]: ec2.SecurityGroup };
}

export class DocumentProcessingConstruct extends Construct {
  public readonly processingFunction: lambda.Function;
  public readonly embeddingFunction: lambda.Function;
  public readonly processingQueue: sqs.Queue;
  public readonly textractRole: iam.Role;

  constructor(scope: Construct, id: string, props: DocumentProcessingProps) {
    super(scope, id);

    const partitionPrefixes = props.s3Storage.getDocumentPartitionPrefixes();

    // Create processing queue
    this.processingQueue = new sqs.Queue(this, 'ProcessingQueue', {
      queueName: `${props.applicationName}-processing-${props.environment}`,
      visibilityTimeout: cdk.Duration.minutes(15),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'ProcessingDLQ', {
          queueName: `${props.applicationName}-processing-dlq-${props.environment}`,
        }),
        maxReceiveCount: 3,
      },
    });

    // Create IAM role for document processing Lambda
    this.textractRole = new iam.Role(this, 'DocumentProcessingRole', {
      roleName: `${props.applicationName}-doc-processing-${props.environment}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Grant Textract permissions
    this.textractRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'textract:DetectDocumentText',
        'textract:AnalyzeDocument',
        'textract:StartDocumentTextDetection',
        'textract:GetDocumentTextDetection',
      ],
      resources: ['*'],
    }));

    // Grant Bedrock permissions for embeddings
    this.textractRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
      ],
      resources: [
        `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/${props.embeddingModelId}`,
      ],
    }));

    // Grant OpenSearch Serverless permissions
    this.textractRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:APIAccessAll',
      ],
      resources: [props.vectorDatabase.collectionArn],
    }));

    // Grant Knowledge Base permissions
    this.textractRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:StartIngestionJob',
        'bedrock:GetIngestionJob',
        'bedrock:ListIngestionJobs',
      ],
      resources: [props.knowledgeBase.knowledgeBase.attrKnowledgeBaseArn],
    }));

    // Create document processing Lambda function
    this.processingFunction = new lambda.Function(this, 'ProcessingFunction', {
      functionName: `${props.applicationName}-doc-processing-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import os
import logging
from typing import Dict, Any

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Document processing Lambda function
    Processes documents uploaded to S3 using Textract and generates embeddings
    """
    logger.info(f"Processing event: {json.dumps(event)}")
    
    # Initialize AWS clients
    textract = boto3.client('textract')
    bedrock = boto3.client('bedrock-runtime')
    s3 = boto3.client('s3')
    
    try:
        # Process SQS messages
        for record in event.get('Records', []):
            if 'body' in record:
                # Parse S3 event from SQS message
                s3_event = json.loads(record['body'])
                
                for s3_record in s3_event.get('Records', []):
                    bucket = s3_record['s3']['bucket']['name']
                    key = s3_record['s3']['object']['key']
                    
                    logger.info(f"Processing document: s3://{bucket}/{key}")
                    
                    # Extract text using Textract
                    response = textract.detect_document_text(
                        Document={
                            'S3Object': {
                                'Bucket': bucket,
                                'Name': key
                            }
                        }
                    )
                    
                    # Extract text content
                    text_content = ""
                    for block in response.get('Blocks', []):
                        if block['BlockType'] == 'LINE':
                            text_content += block['Text'] + "\\n"
                    
                    logger.info(f"Extracted {len(text_content)} characters of text")
                    
                    # Move document to processed folder
                    processed_key = key.replace('raw/', 'processed/')
                    s3.copy_object(
                        CopySource={'Bucket': bucket, 'Key': key},
                        Bucket=bucket,
                        Key=processed_key
                    )
                    
                    # Delete original from raw folder
                    s3.delete_object(Bucket=bucket, Key=key)
                    
                    logger.info(f"Document processed successfully: {processed_key}")
        
        return {
            'statusCode': 200,
            'body': json.dumps('Documents processed successfully')
        }
        
    except Exception as e:
        logger.error(f"Error processing documents: {str(e)}")
        raise e
      `),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      role: this.textractRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.securityGroups.lambda],
      environment: {
        BEDROCK_EMBEDDING_MODEL_ID: props.embeddingModelId,
        VECTOR_COLLECTION_ENDPOINT: props.vectorDatabase.collectionEndpoint,
        KNOWLEDGE_BASE_ID: props.knowledgeBase.knowledgeBaseId,
        DOCUMENT_BUCKET: props.s3Storage.documentBucket.bucketName,
        RAW_PREFIX: partitionPrefixes.raw,
        PROCESSING_PREFIX: partitionPrefixes.processing,
        PROCESSED_PREFIX: partitionPrefixes.processed,
        FAILED_PREFIX: partitionPrefixes.failed,
      },
    });

    // Grant S3 access to Lambda for all partitions
    props.s3Storage.documentBucket.grantReadWrite(this.processingFunction);

    // Grant SQS access to Lambda
    this.processingQueue.grantConsumeMessages(this.processingFunction);

    // Configure S3 event trigger only for raw documents
    props.s3Storage.documentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SqsDestination(this.processingQueue),
      { prefix: partitionPrefixes.raw }
    );

    // Configure SQS trigger for Lambda
    this.processingFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.processingQueue, {
        batchSize: 1,
      })
    );

    // Create embedding generation Lambda function
    this.embeddingFunction = new lambda.Function(this, 'EmbeddingFunction', {
      functionName: `${props.applicationName}-embedding-generator-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Generate embeddings for processed documents and store in vector database.
    """
    print(f"Processing embedding event: {json.dumps(event)}")
    
    bedrock = boto3.client('bedrock-runtime')
    
    try:
        # Process SQS messages
        for record in event.get('Records', []):
            if record.get('eventSource') == 'aws:sqs':
                message = json.loads(record['body'])
                
                print(f"Generating embeddings for document")
                
                # Generate embeddings using Bedrock Titan
                embedding_response = bedrock.invoke_model(
                    modelId='${props.embeddingModelId}',
                    body=json.dumps({
                        'inputText': message.get('text', '')[:8000]  # Limit text length
                    })
                )
                
                embedding_data = json.loads(embedding_response['body'].read())
                embedding_vector = embedding_data['embedding']
                
                print(f"Generated embedding vector of length: {len(embedding_vector)}")
                
                # TODO: Store embedding in OpenSearch Serverless
                print(f"Embedding generated (storage not implemented)")
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Embeddings generated successfully'})
        }
        
    except Exception as e:
        print(f"Error generating embeddings: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
      `),
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      role: this.textractRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.securityGroups.lambda],
      environment: {
        BEDROCK_EMBEDDING_MODEL_ID: props.embeddingModelId,
        VECTOR_COLLECTION_ENDPOINT: props.vectorDatabase.collectionEndpoint,
        KNOWLEDGE_BASE_ID: props.knowledgeBase.knowledgeBaseId,
      },
    });

    // Grant S3 access to embedding function
    props.s3Storage.documentBucket.grantReadWrite(this.embeddingFunction);

    // Output processing function information
    new cdk.CfnOutput(this, 'ProcessingFunctionArn', {
      value: this.processingFunction.functionArn,
      description: 'Document processing Lambda function ARN',
    });

    new cdk.CfnOutput(this, 'ProcessingQueueUrl', {
      value: this.processingQueue.queueUrl,
      description: 'Document processing SQS queue URL',
    });
  }
}
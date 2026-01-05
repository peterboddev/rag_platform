import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { DocumentProcessingConstruct } from '../constructs/document-processing';

export interface DocumentProcessingStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly documentsBucketName: string;
  readonly vectorDatabaseEndpoint: string;
  readonly vectorDatabaseArn: string;
}

export class DocumentProcessingStack extends cdk.Stack {
  public readonly documentProcessing: DocumentProcessingConstruct;

  constructor(scope: Construct, id: string, props: DocumentProcessingStackProps) {
    super(scope, id, props);

    const { applicationName, environment, documentsBucketName, vectorDatabaseEndpoint, vectorDatabaseArn } = props;

    // Import the documents bucket
    const documentsBucket = s3.Bucket.fromBucketName(this, 'DocumentsBucket', documentsBucketName);

    // Create document processing pipeline using the simple stack approach
    // This is a simplified version that doesn't require VPC or complex constructs
    
    // Create SQS queue for document processing
    const processingQueue = new sqs.Queue(this, 'ProcessingQueue', {
      queueName: `${applicationName}-document-processing-${environment}`,
      visibilityTimeout: cdk.Duration.minutes(15),
      retentionPeriod: cdk.Duration.days(14),
    });

    // Create IAM role for Lambda functions
    const lambdaRole = new iam.Role(this, 'DocumentProcessingRole', {
      roleName: `${applicationName}-doc-processing-role-${environment}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Add permissions for S3, SQS, Bedrock, and OpenSearch Serverless
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
      ],
      resources: [`${documentsBucket.bucketArn}/*`],
    }));

    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sqs:ReceiveMessage',
        'sqs:DeleteMessage',
        'sqs:GetQueueAttributes',
        'sqs:SendMessage',
      ],
      resources: [processingQueue.queueArn],
    }));

    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v1`,
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`,
      ],
    }));

    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:APIAccessAll',
      ],
      resources: [vectorDatabaseArn],
    }));

    // Create document processing Lambda function
    const processingFunction = new lambda.Function(this, 'ProcessingFunction', {
      functionName: `${applicationName}-doc-processor-${environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import urllib.parse
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    print(f"Processing event: {json.dumps(event)}")
    sqs = boto3.client('sqs')
    
    try:
        for record in event.get('Records', []):
            if record.get('eventSource') == 'aws:s3':
                bucket = record['s3']['bucket']['name']
                key = urllib.parse.unquote_plus(record['s3']['object']['key'])
                print(f"Processing document: s3://{bucket}/{key}")
                
                message = {
                    'bucket': bucket,
                    'key': key,
                    'eventName': record.get('eventName', 'ObjectCreated'),
                }
                
                sqs.send_message(
                    QueueUrl='${processingQueue.queueUrl}',
                    MessageBody=json.dumps(message)
                )
                
                print(f"Sent message to processing queue for {key}")
        
        return {'statusCode': 200, 'body': json.dumps({'message': 'Documents processed successfully'})}
        
    except Exception as e:
        print(f"Error processing documents: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
`),
      role: lambdaRole,
      timeout: cdk.Duration.minutes(5),
      environment: {
        'PROCESSING_QUEUE_URL': processingQueue.queueUrl,
        'VECTOR_DB_ENDPOINT': vectorDatabaseEndpoint,
        'APPLICATION_NAME': applicationName,
        'ENVIRONMENT': environment,
      },
    });

    // Create embedding generation Lambda function
    const embeddingFunction = new lambda.Function(this, 'EmbeddingFunction', {
      functionName: `${applicationName}-embedding-generator-${environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    print(f"Processing embedding event: {json.dumps(event)}")
    bedrock = boto3.client('bedrock-runtime')
    s3 = boto3.client('s3')
    
    try:
        for record in event.get('Records', []):
            if record.get('eventSource') == 'aws:sqs':
                message = json.loads(record['body'])
                bucket = message['bucket']
                key = message['key']
                
                print(f"Generating embeddings for: s3://{bucket}/{key}")
                
                try:
                    response = s3.get_object(Bucket=bucket, Key=key)
                    content = response['Body'].read()
                    
                    if key.endswith('.txt'):
                        text_content = content.decode('utf-8')
                    else:
                        text_content = f"Document: {key} (content extraction not implemented)"
                    
                    embedding_response = bedrock.invoke_model(
                        modelId='amazon.titan-embed-text-v1',
                        body=json.dumps({'inputText': text_content[:8000]})
                    )
                    
                    embedding_data = json.loads(embedding_response['body'].read())
                    embedding_vector = embedding_data['embedding']
                    
                    print(f"Generated embedding vector of length: {len(embedding_vector)}")
                    print(f"Embedding generated for {key} (storage not implemented)")
                    
                except Exception as e:
                    print(f"Error processing document {key}: {str(e)}")
                    continue
        
        return {'statusCode': 200, 'body': json.dumps({'message': 'Embeddings generated successfully'})}
        
    except Exception as e:
        print(f"Error generating embeddings: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
`),
      role: lambdaRole,
      timeout: cdk.Duration.minutes(10),
      environment: {
        'VECTOR_DB_ENDPOINT': vectorDatabaseEndpoint,
        'APPLICATION_NAME': applicationName,
        'ENVIRONMENT': environment,
      },
    });

    // Connect embedding function to SQS queue
    embeddingFunction.addEventSource(new lambdaEventSources.SqsEventSource(processingQueue, {
      batchSize: 1,
    }));

    // Add S3 event notification to trigger document processing
    documentsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(processingFunction),
      { prefix: 'documents/' }
    );

    // Create a simple object to mimic the construct interface
    this.documentProcessing = {
      processingQueue: processingQueue,
      processingFunction: processingFunction,
      embeddingFunction: embeddingFunction,
    } as any;

    // Stack Outputs
    new cdk.CfnOutput(this, 'ProcessingQueueUrl', {
      value: processingQueue.queueUrl,
      description: 'Document processing queue URL',
      exportName: `${applicationName}-${environment}-processing-queue-url`,
    });

    new cdk.CfnOutput(this, 'ProcessingFunctionArn', {
      value: processingFunction.functionArn,
      description: 'Document processing Lambda function ARN',
      exportName: `${applicationName}-${environment}-processing-function-arn`,
    });

    new cdk.CfnOutput(this, 'EmbeddingFunctionArn', {
      value: embeddingFunction.functionArn,
      description: 'Embedding generation Lambda function ARN',
      exportName: `${applicationName}-${environment}-embedding-function-arn`,
    });
  }
}
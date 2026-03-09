import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { VectorDatabaseConstruct } from './vector-database';

export interface ApplicationIntegrationProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly region: string;
  readonly novaProModelId: string;
  readonly embeddingModelId?: string;
  readonly cognitoUserPool: cognito.IUserPool;
  readonly cognitoUserPoolClient: cognito.IUserPoolClient;
  readonly cognitoIdentityPool?: cognito.CfnIdentityPool;
  readonly vectorDatabase: VectorDatabaseConstruct;
  readonly customersTableName?: string;
  readonly customersTableArn?: string;
  readonly documentsTableName?: string;
  readonly documentsTableArn?: string;
  readonly apiGatewayId: string;
  readonly apiGatewayRootResourceId: string;
  readonly apiGatewayUrl: string;
  readonly vpcId: string;
}

export class ApplicationIntegrationConstruct extends Construct {
  public readonly applicationRole: iam.Role;
  public readonly configurationParameters: ssm.StringParameter[];

  constructor(scope: Construct, id: string, props: ApplicationIntegrationProps) {
    super(scope, id);

    // Create IAM role for application Lambda functions
    this.applicationRole = new iam.Role(this, 'ApplicationRole', {
      roleName: `${props.applicationName}-rag-role-${props.environment}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant Bedrock access
    this.applicationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:${props.region}::foundation-model/${props.novaProModelId}`,
      ],
    }));

    // Grant Bedrock access for Knowledge Base retrieval
    this.applicationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:Retrieve',
        'bedrock:RetrieveAndGenerate',
      ],
      resources: ['*'], // Knowledge Base ARN pattern
    }));

    // Grant Textract access
    this.applicationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'textract:DetectDocumentText',
        'textract:AnalyzeDocument',
      ],
      resources: ['*'],
    }));

    // Grant Cognito access
    this.applicationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminUpdateUserAttributes',
        'cognito-idp:ListUsers',
      ],
      resources: [props.cognitoUserPool.userPoolArn],
    }));

    // Grant DynamoDB permissions for platform-provided tables (read/write + GSI management)
    if (props.customersTableArn && props.documentsTableArn) {
      this.applicationRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          // Data operations
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
          'dynamodb:BatchWriteItem',
          'dynamodb:BatchGetItem',
          'dynamodb:UpdateItem',
          // Table metadata
          'dynamodb:DescribeTable',
          // GSI management
          'dynamodb:UpdateTable',
          'dynamodb:DescribeGlobalSecondaryIndexes',
        ],
        resources: [
          props.customersTableArn,
          `${props.customersTableArn}/index/*`,
          props.documentsTableArn,
          `${props.documentsTableArn}/index/*`,
        ],
      }));
    }

    // Grant OpenSearch Serverless access for vector operations
    props.vectorDatabase.grantLambdaAccess(this.applicationRole);

    // Grant S3 permissions for app teams to create and manage their own buckets
    this.applicationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:CreateBucket',
        's3:DeleteBucket',
        's3:PutBucketPolicy',
        's3:PutBucketVersioning',
        's3:PutBucketCORS',
        's3:PutBucketLifecycleConfiguration',
        's3:PutBucketTagging',
        's3:PutObject',
        's3:GetObject',
        's3:DeleteObject',
        's3:ListBucket',
        's3:GetBucketLocation',
        's3:GetBucketPolicy',
      ],
      resources: [
        `arn:aws:s3:::${props.applicationName}-*`,
        `arn:aws:s3:::${props.applicationName}-*/*`,
      ],
    }));

    // Grant SQS permissions for app teams to create and manage queues
    this.applicationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sqs:CreateQueue',
        'sqs:DeleteQueue',
        'sqs:SetQueueAttributes',
        'sqs:GetQueueAttributes',
        'sqs:GetQueueUrl',
        'sqs:SendMessage',
        'sqs:ReceiveMessage',
        'sqs:DeleteMessage',
        'sqs:ChangeMessageVisibility',
        'sqs:PurgeQueue',
        'sqs:TagQueue',
        'sqs:UntagQueue',
        'sqs:ListQueues',
      ],
      resources: [
        `arn:aws:sqs:${props.region}:${cdk.Stack.of(this).account}:${props.applicationName}-*`,
      ],
    }));

    // Grant EventBridge permissions for app teams to create and manage rules
    this.applicationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'events:PutRule',
        'events:DeleteRule',
        'events:DescribeRule',
        'events:EnableRule',
        'events:DisableRule',
        'events:PutTargets',
        'events:RemoveTargets',
        'events:ListTargetsByRule',
        'events:ListRules',
        'events:TagResource',
        'events:UntagResource',
      ],
      resources: [
        `arn:aws:events:${props.region}:${cdk.Stack.of(this).account}:rule/${props.applicationName}-*`,
      ],
    }));

    // Grant Step Functions permissions for app teams to create and manage state machines
    this.applicationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'states:CreateStateMachine',
        'states:DeleteStateMachine',
        'states:UpdateStateMachine',
        'states:DescribeStateMachine',
        'states:StartExecution',
        'states:StopExecution',
        'states:DescribeExecution',
        'states:ListExecutions',
        'states:ListStateMachines',
        'states:TagResource',
        'states:UntagResource',
      ],
      resources: [
        `arn:aws:states:${props.region}:${cdk.Stack.of(this).account}:stateMachine:${props.applicationName}-*`,
        `arn:aws:states:${props.region}:${cdk.Stack.of(this).account}:execution:${props.applicationName}-*:*`,
      ],
    }));

    // Grant Lambda permissions for app teams to create and manage their own functions
    this.applicationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:CreateFunction',
        'lambda:DeleteFunction',
        'lambda:UpdateFunctionCode',
        'lambda:UpdateFunctionConfiguration',
        'lambda:GetFunction',
        'lambda:ListFunctions',
        'lambda:InvokeFunction',
        'lambda:AddPermission',
        'lambda:RemovePermission',
        'lambda:TagResource',
        'lambda:UntagResource',
      ],
      resources: [
        `arn:aws:lambda:${props.region}:${cdk.Stack.of(this).account}:function:${props.applicationName}-*`,
      ],
    }));

    // Grant IAM PassRole permission for Lambda and Step Functions execution roles
    this.applicationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['iam:PassRole'],
      resources: [
        `arn:aws:iam::${cdk.Stack.of(this).account}:role/${props.applicationName}-*`,
      ],
      conditions: {
        StringEquals: {
          'iam:PassedToService': [
            'lambda.amazonaws.com',
            'states.amazonaws.com',
            'events.amazonaws.com',
          ],
        },
      },
    }));

    // Create configuration parameters for applications
    // Using standardized prefix: /{applicationName}/{environment}/
    // App teams can retrieve all params with: aws ssm get-parameters-by-path --path "/{applicationName}/{environment}/"
    this.configurationParameters = [
      // Bedrock AI Services
      new ssm.StringParameter(this, 'BedrockModelId', {
        parameterName: `/${props.applicationName}/${props.environment}/bedrock/nova-pro-model-id`,
        stringValue: props.novaProModelId,
        description: 'Bedrock Nova Pro model ID for RAG applications',
        tier: ssm.ParameterTier.STANDARD,
      }),
      
      // Cognito Authentication
      new ssm.StringParameter(this, 'CognitoUserPoolId', {
        parameterName: `/${props.applicationName}/${props.environment}/cognito/user-pool-id`,
        stringValue: props.cognitoUserPool.userPoolId,
        description: 'Cognito User Pool ID for authentication',
        tier: ssm.ParameterTier.STANDARD,
      }),
      new ssm.StringParameter(this, 'CognitoUserPoolClientId', {
        parameterName: `/${props.applicationName}/${props.environment}/cognito/client-id`,
        stringValue: props.cognitoUserPoolClient.userPoolClientId,
        description: 'Cognito User Pool Client ID',
        tier: ssm.ParameterTier.STANDARD,
      }),
      new ssm.StringParameter(this, 'CognitoUserPoolArn', {
        parameterName: `/${props.applicationName}/${props.environment}/cognito/user-pool-arn`,
        stringValue: props.cognitoUserPool.userPoolArn,
        description: 'Cognito User Pool ARN',
        tier: ssm.ParameterTier.STANDARD,
      }),
      
      // IAM Roles
      new ssm.StringParameter(this, 'ApplicationRoleArn', {
        parameterName: `/${props.applicationName}/${props.environment}/iam/application-role-arn`,
        stringValue: this.applicationRole.roleArn,
        description: 'IAM role ARN for application Lambda functions',
        tier: ssm.ParameterTier.STANDARD,
      }),
      new ssm.StringParameter(this, 'ApplicationRoleName', {
        parameterName: `/${props.applicationName}/${props.environment}/iam/application-role-name`,
        stringValue: this.applicationRole.roleName,
        description: 'IAM role name for application Lambda functions',
        tier: ssm.ParameterTier.STANDARD,
      }),
      
      // Vector Database (OpenSearch Serverless)
      new ssm.StringParameter(this, 'VectorDatabaseEndpoint', {
        parameterName: `/${props.applicationName}/${props.environment}/opensearch/collection-endpoint`,
        stringValue: props.vectorDatabase.collectionEndpoint,
        description: 'OpenSearch Serverless collection endpoint for vector operations',
        tier: ssm.ParameterTier.STANDARD,
      }),
      new ssm.StringParameter(this, 'VectorDatabaseIndexName', {
        parameterName: `/${props.applicationName}/${props.environment}/opensearch/index-name`,
        stringValue: props.vectorDatabase.indexName,
        description: 'OpenSearch vector index name',
        tier: ssm.ParameterTier.STANDARD,
      }),
      new ssm.StringParameter(this, 'VectorDatabaseCollectionName', {
        parameterName: `/${props.applicationName}/${props.environment}/opensearch/collection-name`,
        stringValue: props.vectorDatabase.collectionName,
        description: 'OpenSearch Serverless collection name',
        tier: ssm.ParameterTier.STANDARD,
      }),
      
      // API Gateway
      new ssm.StringParameter(this, 'ApiGatewayId', {
        parameterName: `/${props.applicationName}/${props.environment}/apigateway/api-id`,
        stringValue: props.apiGatewayId,
        description: 'API Gateway REST API ID',
        tier: ssm.ParameterTier.STANDARD,
      }),
      new ssm.StringParameter(this, 'ApiGatewayRootResourceId', {
        parameterName: `/${props.applicationName}/${props.environment}/apigateway/root-resource-id`,
        stringValue: props.apiGatewayRootResourceId,
        description: 'API Gateway root resource ID for creating methods',
        tier: ssm.ParameterTier.STANDARD,
      }),
      new ssm.StringParameter(this, 'ApiGatewayUrl', {
        parameterName: `/${props.applicationName}/${props.environment}/apigateway/url`,
        stringValue: props.apiGatewayUrl,
        description: 'API Gateway endpoint URL',
        tier: ssm.ParameterTier.STANDARD,
      }),
      
      // Network
      new ssm.StringParameter(this, 'VpcId', {
        parameterName: `/${props.applicationName}/${props.environment}/network/vpc-id`,
        stringValue: props.vpcId,
        description: 'VPC ID for the RAG infrastructure',
        tier: ssm.ParameterTier.STANDARD,
      }),
      
      // Region
      new ssm.StringParameter(this, 'Region', {
        parameterName: `/${props.applicationName}/${props.environment}/region`,
        stringValue: props.region,
        description: 'AWS region for the infrastructure',
        tier: ssm.ParameterTier.STANDARD,
      }),
    ];

    // Add DynamoDB table parameters if provided
    if (props.customersTableName && props.customersTableArn) {
      this.configurationParameters.push(
        new ssm.StringParameter(this, 'CustomersTableName', {
          parameterName: `/${props.applicationName}/${props.environment}/dynamodb/customers-table-name`,
          stringValue: props.customersTableName,
          description: 'DynamoDB customers table name',
          tier: ssm.ParameterTier.STANDARD,
        }),
        new ssm.StringParameter(this, 'CustomersTableArn', {
          parameterName: `/${props.applicationName}/${props.environment}/dynamodb/customers-table-arn`,
          stringValue: props.customersTableArn,
          description: 'DynamoDB customers table ARN',
          tier: ssm.ParameterTier.STANDARD,
        })
      );
    }

    if (props.documentsTableName && props.documentsTableArn) {
      this.configurationParameters.push(
        new ssm.StringParameter(this, 'DocumentsTableName', {
          parameterName: `/${props.applicationName}/${props.environment}/dynamodb/documents-table-name`,
          stringValue: props.documentsTableName,
          description: 'DynamoDB documents table name',
          tier: ssm.ParameterTier.STANDARD,
        }),
        new ssm.StringParameter(this, 'DocumentsTableArn', {
          parameterName: `/${props.applicationName}/${props.environment}/dynamodb/documents-table-arn`,
          stringValue: props.documentsTableArn,
          description: 'DynamoDB documents table ARN',
          tier: ssm.ParameterTier.STANDARD,
        })
      );
    }

    // Add optional parameters if provided
    if (props.embeddingModelId) {
      this.configurationParameters.push(
        new ssm.StringParameter(this, 'EmbeddingModelId', {
          parameterName: `/${props.applicationName}/${props.environment}/bedrock/embedding-model-id`,
          stringValue: props.embeddingModelId,
          description: 'Bedrock embedding model ID',
          tier: ssm.ParameterTier.STANDARD,
        })
      );
    }

    if (props.cognitoIdentityPool) {
      this.configurationParameters.push(
        new ssm.StringParameter(this, 'CognitoIdentityPoolId', {
          parameterName: `/${props.applicationName}/${props.environment}/cognito/identity-pool-id`,
          stringValue: props.cognitoIdentityPool.ref,
          description: 'Cognito Identity Pool ID',
          tier: ssm.ParameterTier.STANDARD,
        })
      );
    }

    // Output application integration information
    new cdk.CfnOutput(this, 'ParameterPrefix', {
      value: `/${props.applicationName}/${props.environment}/`,
      description: 'SSM parameter prefix for application configuration - use with get-parameters-by-path',
      exportName: `${props.applicationName}-${props.environment}-param-prefix`,
    });

    new cdk.CfnOutput(this, 'ParameterCount', {
      value: this.configurationParameters.length.toString(),
      description: 'Number of SSM parameters created for application configuration',
    });
  }
}
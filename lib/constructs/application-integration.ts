import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { KnowledgeBaseConstruct } from './knowledge-base';
import { DataStorageConstruct } from './data-storage';
import { VectorDatabaseConstruct } from './vector-database';

export interface ApplicationIntegrationProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly region: string;
  readonly novaProModelId: string;
  readonly knowledgeBase: KnowledgeBaseConstruct;
  readonly cognitoUserPool: cognito.UserPool;
  readonly dataStorage: DataStorageConstruct;
  readonly vectorDatabase: VectorDatabaseConstruct;
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

    // Grant Knowledge Base access
    this.applicationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:Retrieve',
        'bedrock:RetrieveAndGenerate',
      ],
      resources: [props.knowledgeBase.knowledgeBase.attrKnowledgeBaseArn],
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

    // Grant DynamoDB access (using the data storage role permissions)
    this.applicationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:BatchGetItem',
        'dynamodb:BatchWriteItem',
      ],
      resources: [
        `arn:aws:dynamodb:${props.region}:${cdk.Stack.of(this).account}:table/${props.applicationName}-*`,
      ],
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

    // Grant OpenSearch Serverless access for vector operations
    props.vectorDatabase.grantLambdaAccess(this.applicationRole);

    // Create configuration parameters for applications
    this.configurationParameters = [
      new ssm.StringParameter(this, 'BedrockModelId', {
        parameterName: `/${props.applicationName}/${props.environment}/bedrock/nova-pro-model-id`,
        stringValue: props.novaProModelId,
        description: 'Bedrock Nova Pro model ID for RAG applications',
      }),
      new ssm.StringParameter(this, 'KnowledgeBaseId', {
        parameterName: `/${props.applicationName}/${props.environment}/bedrock/knowledge-base-id`,
        stringValue: props.knowledgeBase.knowledgeBaseId,
        description: 'Bedrock Knowledge Base ID for RAG applications',
      }),
      new ssm.StringParameter(this, 'CognitoUserPoolId', {
        parameterName: `/${props.applicationName}/${props.environment}/cognito/user-pool-id`,
        stringValue: props.cognitoUserPool.userPoolId,
        description: 'Cognito User Pool ID for authentication',
      }),
      new ssm.StringParameter(this, 'ApplicationRoleArn', {
        parameterName: `/${props.applicationName}/${props.environment}/iam/application-role-arn`,
        stringValue: this.applicationRole.roleArn,
        description: 'IAM role ARN for application Lambda functions',
      }),
      new ssm.StringParameter(this, 'VectorDatabaseEndpoint', {
        parameterName: `/${props.applicationName}/${props.environment}/opensearch/collection-endpoint`,
        stringValue: props.vectorDatabase.collectionEndpoint,
        description: 'OpenSearch Serverless collection endpoint for vector operations',
      }),
      new ssm.StringParameter(this, 'VectorDatabaseIndexName', {
        parameterName: `/${props.applicationName}/${props.environment}/opensearch/index-name`,
        stringValue: props.vectorDatabase.indexName,
        description: 'OpenSearch vector index name',
      }),
    ];

    // Output application integration information
    new cdk.CfnOutput(this, 'ParameterPrefix', {
      value: `/${props.applicationName}/${props.environment}/`,
      description: 'SSM parameter prefix for application configuration',
    });
  }
}
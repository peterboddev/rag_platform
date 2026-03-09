import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NetworkInfrastructureConstruct } from './constructs/network-infrastructure';
import { BedrockAIServicesConstruct } from './constructs/bedrock-ai-services';
import { VectorDatabaseConstruct } from './constructs/vector-database';
import { S3StorageConstruct } from './constructs/s3-storage';
import { DataStorageConstruct } from './constructs/data-storage';
import { CognitoAuthenticationConstruct } from './constructs/cognito-authentication';
import { ApplicationIntegrationConstruct } from './constructs/application-integration';
import { ApiGatewayConstruct } from './constructs/api-gateway';

export interface RAGInfrastructureStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
}

export class RAGInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RAGInfrastructureStackProps) {
    super(scope, id, props);

    const { applicationName, environment } = props;

    // 1. Network Infrastructure Foundation
    const networkInfrastructure = new NetworkInfrastructureConstruct(this, 'NetworkInfrastructure', {
      applicationName,
      environment,
    });

    // 2. S3 Storage Infrastructure
    const s3Storage = new S3StorageConstruct(this, 'S3Storage', {
      applicationName,
      environment,
      allowedOrigins: ['*'], // Configure based on your frontend domains
    });

    // 3. Bedrock AI Services
    const bedrockServices = new BedrockAIServicesConstruct(this, 'BedrockAIServices', {
      applicationName,
      environment,
    });

    // 4. Create Knowledge Base service role first (needed for vector database access policy)
    const knowledgeBaseServiceRole = new iam.Role(this, 'KnowledgeBaseServiceRole', {
      roleName: `${applicationName}-kb-service-role-${environment}`,
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    // 5. Vector Database (with Knowledge Base service role access)
    const vectorDatabase = new VectorDatabaseConstruct(this, 'VectorDatabase', {
      applicationName,
      environment,
      vpc: networkInfrastructure.vpc,
      accessRoles: [knowledgeBaseServiceRole], // Grant access during creation
    });

    // 6. Data Storage (DynamoDB and Aurora)
    const dataStorage = new DataStorageConstruct(this, 'DataStorage', {
      applicationName,
      environment,
      vpc: networkInfrastructure.vpc,
      account: this.account,
      region: this.region,
      enableRDS: false, // Disable Aurora Serverless v2 for now
    });

    // 7. Knowledge Base Management (using pre-created service role)
    // const knowledgeBase = new KnowledgeBaseConstruct(this, 'KnowledgeBase', {
    //   applicationName,
    //   environment,
    //   vectorDatabase: vectorDatabase,
    //   embeddingModelId: bedrockServices.embeddingModelId,
    //   serviceRole: knowledgeBaseServiceRole, // Use pre-created role
    // });

    // 8. Document Processing Pipeline
    // const documentProcessing = new DocumentProcessingConstruct(this, 'DocumentProcessing', {
    //   applicationName,
    //   environment,
    //   s3Storage: s3Storage,
    //   vectorDatabase: vectorDatabase,
    //   knowledgeBase: knowledgeBase,
    //   embeddingModelId: bedrockServices.embeddingModelId,
    //   vpc: networkInfrastructure.vpc,
    //   securityGroups: networkInfrastructure.securityGroups,
    // });

    // 9. Cognito Authentication
    const cognitoAuth = new CognitoAuthenticationConstruct(this, 'CognitoAuthentication', {
      applicationName,
      environment,
      callbackUrls: [`https://${s3Storage.websiteBucket.bucketName}.s3-website-${this.region}.amazonaws.com`],
      logoutUrls: [`https://${s3Storage.websiteBucket.bucketName}.s3-website-${this.region}.amazonaws.com`],
    });

    // 10. API Gateway (Platform-provided for application teams)
    const apiGateway = new ApiGatewayConstruct(this, 'ApiGateway', {
      applicationName,
      environment,
      userPool: cognitoAuth.userPool,
      userPoolClient: cognitoAuth.userPoolClient,
    });

    // 11. Application Integration Layer (IAM roles and SSM parameters)
    const applicationIntegration = new ApplicationIntegrationConstruct(this, 'ApplicationIntegration', {
      applicationName,
      environment,
      region: this.region,
      novaProModelId: bedrockServices.novaProModelId,
      embeddingModelId: bedrockServices.embeddingModelId,
      cognitoUserPool: cognitoAuth.userPool,
      cognitoUserPoolClient: cognitoAuth.userPoolClient,
      cognitoIdentityPool: cognitoAuth.identityPool,
      vectorDatabase: vectorDatabase,
      apiGatewayId: apiGateway.api.restApiId,
      apiGatewayRootResourceId: apiGateway.api.root.resourceId,
      apiGatewayUrl: apiGateway.api.url,
      vpcId: networkInfrastructure.vpc.vpcId,
      customersTableName: dataStorage.customersTable.tableName, // Now using correct property name
      customersTableArn: dataStorage.customersTable.tableArn,
      documentsTableName: dataStorage.documentsTable.tableName,
      documentsTableArn: dataStorage.documentsTable.tableArn,
    });

    // Add application role to vector database access policy
    vectorDatabase.addAccessRoles([applicationIntegration.applicationRole]);

    // 11. Configuration Export Service
    // const configurationExport = new ConfigurationExportConstruct(this, 'ConfigurationExport', {
    //   applicationName,
    //   environment,
    //   region: this.region,
    //   s3Storage: s3Storage,
    //   bedrockServices: bedrockServices,
    //   vectorDatabase: vectorDatabase,
    //   knowledgeBase: knowledgeBase,
    //   cognitoAuth: cognitoAuth,
    //   applicationIntegration: applicationIntegration,
    //   dataStorage: dataStorage,
    //   documentProcessing: documentProcessing,
    // });

    // 11. Monitoring and Observability
    // const monitoring = new MonitoringConstruct(this, 'Monitoring', {
    //   applicationName,
    //   environment,
    //   knowledgeBase: knowledgeBase,
    //   documentProcessing: documentProcessing,
    //   vectorDatabase: vectorDatabase,
    //   dataStorage: dataStorage,
    // });

    // Stack Outputs
    new cdk.CfnOutput(this, 'VPCId', {
      value: networkInfrastructure.vpc.vpcId,
      description: 'VPC ID for the RAG infrastructure',
      exportName: `${applicationName}-${environment}-vpc-id`,
    });

    new cdk.CfnOutput(this, 'BedrockNovaProModelId', {
      value: bedrockServices.novaProModelId,
      description: 'Bedrock Nova Pro model ID',
      exportName: `${applicationName}-${environment}-bedrock-nova-pro-model-id`,
    });

    // new cdk.CfnOutput(this, 'KnowledgeBaseId', {
    //   value: knowledgeBase.knowledgeBaseId,
    //   description: 'Bedrock Knowledge Base ID',
    //   exportName: `${applicationName}-${environment}-knowledge-base-id`,
    // });

    new cdk.CfnOutput(this, 'VectorDatabaseEndpoint', {
      value: vectorDatabase.collectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint',
      exportName: `${applicationName}-${environment}-vector-db-endpoint`,
    });

    new cdk.CfnOutput(this, 'DocumentBucketName', {
      value: s3Storage.documentBucket.bucketName,
      description: 'S3 bucket for document storage',
      exportName: `${applicationName}-${environment}-document-bucket`,
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: s3Storage.websiteBucket.bucketName,
      description: 'S3 bucket for website hosting',
      exportName: `${applicationName}-${environment}-website-bucket`,
    });

    new cdk.CfnOutput(this, 'ConfigurationBucketName', {
      value: s3Storage.configurationBucket.bucketName,
      description: 'S3 bucket for configuration export',
      exportName: `${applicationName}-${environment}-config-bucket`,
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: cognitoAuth.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${applicationName}-${environment}-cognito-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'CognitoClientId', {
      value: cognitoAuth.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${applicationName}-${environment}-cognito-client-id`,
    });

    new cdk.CfnOutput(this, 'ApplicationRoleArn', {
      value: applicationIntegration.applicationRole.roleArn,
      description: 'IAM role ARN for application Lambda functions',
      exportName: `${applicationName}-${environment}-application-role-arn`,
    });

    new cdk.CfnOutput(this, 'CustomersTableName', {
      value: dataStorage.customersTable.tableName,
      description: 'DynamoDB table for customer/tenant management',
      exportName: `${applicationName}-${environment}-customers-table`,
    });

    new cdk.CfnOutput(this, 'DocumentsTableName', {
      value: dataStorage.documentsTable.tableName,
      description: 'DynamoDB table for document metadata',
      exportName: `${applicationName}-${environment}-documents-table`,
    });
  }
}
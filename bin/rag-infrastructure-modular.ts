#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { AuthenticationStack } from '../lib/stacks/authentication-stack';
import { VectorDatabaseStack } from '../lib/stacks/vector-database-stack';
import { DataStorageStack } from '../lib/stacks/data-storage-stack';
import { ApiGatewayStack } from '../lib/stacks/api-gateway-stack';
import { ApplicationIntegrationStack } from '../lib/stacks/application-integration-stack';

/**
 * RAG Application Infrastructure - Modular Stack Architecture
 * 
 * This application creates the foundational AI/ML infrastructure for RAG applications
 * using separate stacks for each major component:
 * 
 * 1. NetworkStack - VPC and networking infrastructure
 * 2. AuthenticationStack - Cognito user pools and identity pools
 * 3. VectorDatabaseStack - OpenSearch Serverless for vector storage
 * 4. DataStorageStack - DynamoDB tables (customers and documents)
 * 5. ApiGatewayStack - API Gateway for application endpoints
 * 6. ApplicationIntegrationStack - IAM roles and SSM parameters
 * 
 * App teams are responsible for creating:
 * - S3 buckets (documents, website, configuration, etc.)
 * - SQS queues for async processing
 * - EventBridge rules for event-driven workflows
 * - Step Functions for orchestration
 * - Lambda functions for business logic
 * 
 * Benefits of modular architecture:
 * - Independent deployment and updates
 * - Better isolation and troubleshooting
 * - Easier rollback of individual components
 * - Clearer dependency management
 */
const app = new cdk.App();

// Environment configuration
const account = process.env.CDK_DEFAULT_ACCOUNT || '450683699755';
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Application configuration
const applicationName = 'rag-app';
const environment = 'dev'; // Start with dev environment

console.log('🚀 Deploying RAG Infrastructure (Modular):');
console.log(`   Application: ${applicationName}`);
console.log(`   Environment: ${environment}`);
console.log(`   Account: ${account}`);
console.log(`   Region: ${region}`);
console.log('');

const stackProps = {
  env: { account, region },
  tags: {
    'Project': 'RAGInfrastructure',
    'Component': 'AIServices',
    'ManagedBy': 'PlatformTeam',
    'Environment': environment,
    'Application': applicationName,
  },
};

// 1. Network Stack (Foundation - no dependencies)
console.log('📦 Creating Network Stack...');
const networkStack = new NetworkStack(app, `${applicationName}-network-${environment}`, {
  ...stackProps,
  description: 'Network infrastructure (VPC, subnets, security groups)',
  applicationName,
  environment,
});

// 2. Authentication Stack (No dependencies - can be deployed early)
console.log('📦 Creating Authentication Stack...');
const authenticationStack = new AuthenticationStack(app, `${applicationName}-authentication-${environment}`, {
  ...stackProps,
  description: 'Cognito user pools and identity pools',
  applicationName,
  environment,
  websiteBucketName: `${applicationName}-website-${environment}`, // Placeholder - app teams create actual bucket
});

// 3. Vector Database Stack (Depends on Network)
console.log('📦 Creating Vector Database Stack...');
const vectorDatabaseStack = new VectorDatabaseStack(app, `${applicationName}-vector-db-${environment}`, {
  ...stackProps,
  description: 'OpenSearch Serverless collection for vector storage',
  applicationName,
  environment,
  vpc: networkStack.vpc,
});
vectorDatabaseStack.addDependency(networkStack);

// 4. Data Storage Stack (Depends on Network)
console.log('📦 Creating Data Storage Stack...');
const dataStorageStack = new DataStorageStack(app, `${applicationName}-data-storage-${environment}`, {
  ...stackProps,
  description: 'DynamoDB tables for customers and documents',
  applicationName,
  environment,
  vpc: networkStack.vpc,
});
dataStorageStack.addDependency(networkStack);

// 5. API Gateway Stack (Depends on Authentication)
console.log('📦 Creating API Gateway Stack...');
const apiGatewayStack = new ApiGatewayStack(app, `${applicationName}-api-gateway-${environment}`, {
  ...stackProps,
  description: 'API Gateway for application endpoints',
  applicationName,
  environment,
  userPoolId: authenticationStack.userPool.userPoolId,
  userPoolClientId: authenticationStack.userPoolClient.userPoolClientId,
});
apiGatewayStack.addDependency(authenticationStack);

// 6. Application Integration Stack (Depends on all other stacks)
console.log('📦 Creating Application Integration Stack...');
const applicationIntegrationStack = new ApplicationIntegrationStack(
  app,
  `${applicationName}-integration-${environment}`,
  {
    ...stackProps,
    description: 'IAM roles, SSM parameters, and application integration',
    applicationName,
    environment,
    userPoolId: authenticationStack.userPool.userPoolId,
    userPoolArn: authenticationStack.userPool.userPoolArn,
    userPoolClientId: authenticationStack.userPoolClient.userPoolClientId,
    identityPoolId: authenticationStack.identityPool?.ref,
    vectorDatabaseEndpoint: vectorDatabaseStack.collectionEndpoint,
    vectorDatabaseArn: vectorDatabaseStack.collectionArn,
    vectorDatabaseCollectionName: vectorDatabaseStack.collectionName,
    vectorDatabaseIndexName: vectorDatabaseStack.indexName,
    customersTableName: dataStorageStack.customersTable.tableName,
    customersTableArn: dataStorageStack.customersTable.tableArn,
    documentsTableName: dataStorageStack.documentsTable.tableName,
    documentsTableArn: dataStorageStack.documentsTable.tableArn,
    apiGatewayId: apiGatewayStack.apiId,
    apiGatewayRootResourceId: apiGatewayStack.rootResourceId,
    apiGatewayUrl: apiGatewayStack.apiUrl,
    vpcId: networkStack.vpc.vpcId,
  }
);
applicationIntegrationStack.addDependency(networkStack);
applicationIntegrationStack.addDependency(authenticationStack);
applicationIntegrationStack.addDependency(vectorDatabaseStack);
applicationIntegrationStack.addDependency(dataStorageStack);
applicationIntegrationStack.addDependency(apiGatewayStack);

// Add global tags to all resources
cdk.Tags.of(app).add('Project', 'RAGInfrastructure');
cdk.Tags.of(app).add('ManagedBy', 'PlatformTeam');
cdk.Tags.of(app).add('DeployedBy', 'CDK');
cdk.Tags.of(app).add('Architecture', 'Modular');

console.log('');
console.log('✅ All stacks configured');
console.log('');
console.log('Stack Deployment Order:');
console.log('  1. Network Stack (foundation)');
console.log('  2. Authentication Stack (independent)');
console.log('  3. Vector Database Stack (depends on Network)');
console.log('  4. Data Storage Stack (depends on Network)');
console.log('  5. API Gateway Stack (depends on Authentication)');
console.log('  6. Application Integration Stack (depends on all)');
console.log('');
console.log('Platform provides: VPC, Cognito, OpenSearch, DynamoDB tables (customers + documents), API Gateway, IAM roles');
console.log('App teams create: S3 buckets, SQS queues, EventBridge rules, Step Functions, Lambda functions');
console.log('');
console.log('Deploy all stacks:');
console.log(`  npx cdk deploy --all --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts"`);
console.log('');
console.log('Deploy specific stack:');
console.log(`  npx cdk deploy ${applicationName}-vector-db-${environment} --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts"`);

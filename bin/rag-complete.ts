#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthenticationStack } from '../lib/stacks/authentication-stack';
import { KnowledgeBaseStack } from '../lib/stacks/knowledge-base-stack';
import { DocumentProcessingStack } from '../lib/stacks/document-processing-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';

/**
 * RAG Application Complete Infrastructure
 * 
 * This deploys the remaining RAG application components:
 * 1. Authentication Stack - Cognito user pools and identity pools
 * 2. Knowledge Base Stack - Bedrock Knowledge Base service
 * 3. Document Processing Stack - Lambda pipeline for document processing
 * 4. Monitoring Stack - CloudWatch dashboards and alarms
 * 
 * Prerequisites: Foundation, Storage, AI Services, and Vector Database stacks must be deployed first
 */
const app = new cdk.App();

// Environment configuration
const account = process.env.CDK_DEFAULT_ACCOUNT || '450683699755';
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Application configuration
const applicationName = 'rag-app-v2';
const environment = 'dev';

console.log('🚀 Deploying RAG Complete Infrastructure:');
console.log(`   Application: ${applicationName}`);
console.log(`   Environment: ${environment}`);
console.log(`   Account: ${account}`);
console.log(`   Region: ${region}`);

const commonProps = {
  env: { account, region },
  applicationName,
  environment,
  tags: {
    'Project': 'RAGInfrastructure',
    'Component': 'Complete',
    'ManagedBy': 'PlatformTeam',
    'Environment': environment,
    'Application': applicationName,
  },
};

// Import values from existing stacks (these should be available as CloudFormation exports)
const vpcId = cdk.Fn.importValue(`${applicationName}-${environment}-vpc-id`);
const documentsBucketName = cdk.Fn.importValue(`${applicationName}-${environment}-document-bucket`);
const vectorDatabaseEndpoint = cdk.Fn.importValue(`${applicationName}-${environment}-vector-db-endpoint`);
const vectorDatabaseArn = cdk.Fn.importValue(`${applicationName}-${environment}-vector-db-arn`);

// 1. Authentication Stack - Cognito
const authenticationStack = new AuthenticationStack(app, `${applicationName}-authentication-${environment}`, {
  ...commonProps,
  description: 'RAG application authentication - Cognito user pools and identity pools',
});

// 2. Knowledge Base Stack - Bedrock Knowledge Base
const knowledgeBaseStack = new KnowledgeBaseStack(app, `${applicationName}-knowledge-base-${environment}`, {
  ...commonProps,
  vpcId: vpcId,
  vectorDatabaseEndpoint: vectorDatabaseEndpoint,
  vectorDatabaseArn: vectorDatabaseArn,
  documentsBucketName: documentsBucketName,
  description: 'RAG application knowledge base - Bedrock Knowledge Base service',
});

// 3. Document Processing Stack - Lambda pipeline
const documentProcessingStack = new DocumentProcessingStack(app, `${applicationName}-document-processing-${environment}`, {
  ...commonProps,
  vpcId: vpcId,
  documentsBucketName: documentsBucketName,
  vectorDatabaseEndpoint: vectorDatabaseEndpoint,
  vectorDatabaseArn: vectorDatabaseArn,
  description: 'RAG application document processing - Lambda pipeline for document ingestion',
});

// 4. Monitoring Stack - CloudWatch
const monitoringStack = new MonitoringStack(app, `${applicationName}-monitoring-${environment}`, {
  ...commonProps,
  vpcId: vpcId,
  vectorDatabaseArn: vectorDatabaseArn,
  knowledgeBaseId: knowledgeBaseStack.knowledgeBase.knowledgeBaseId,
  processingFunctionArns: [
    documentProcessingStack.documentProcessing.processingFunction.functionArn,
    documentProcessingStack.documentProcessing.embeddingFunction.functionArn,
  ],
  description: 'RAG application monitoring - CloudWatch dashboards and alarms',
});

// Add dependencies
knowledgeBaseStack.addDependency(authenticationStack);
documentProcessingStack.addDependency(knowledgeBaseStack);
monitoringStack.addDependency(documentProcessingStack);

// Add global tags to all resources
cdk.Tags.of(app).add('Project', 'RAGInfrastructure');
cdk.Tags.of(app).add('ManagedBy', 'PlatformTeam');
cdk.Tags.of(app).add('DeployedBy', 'CDK');
cdk.Tags.of(app).add('DeploymentTimestamp', new Date().toISOString());

console.log('✅ RAG complete infrastructure components configured');
console.log('📋 Stacks to deploy:');
console.log('   1. Authentication Stack - Cognito user pools and identity pools');
console.log('   2. Knowledge Base Stack - Bedrock Knowledge Base service');
console.log('   3. Document Processing Stack - Lambda pipeline for document processing');
console.log('   4. Monitoring Stack - CloudWatch dashboards and alarms');
console.log('');
console.log('📋 Prerequisites (must be deployed first):');
console.log('   ✅ Foundation Stack - VPC and networking');
console.log('   ✅ Storage Stack - S3 buckets');
console.log('   ✅ AI Services Stack - Bedrock models');
console.log('   ✅ Vector Database Stack - OpenSearch Serverless');
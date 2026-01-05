#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VectorDatabaseMinimalStack } from '../lib/stacks/vector-database-minimal-stack';
import { AIServicesStack } from '../lib/stacks/ai-services-stack';

/**
 * RAG Application Services Infrastructure
 * 
 * This deploys the core AI/ML services:
 * 1. Vector Database Stack - OpenSearch Serverless collection (minimal)
 * 2. AI Services Stack - Bedrock models configuration
 */
const app = new cdk.App();

// Environment configuration
const account = process.env.CDK_DEFAULT_ACCOUNT || '450683699755';
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Application configuration
const applicationName = 'rag-app-v2';
const environment = 'dev';

console.log('🚀 Deploying RAG Services Infrastructure:');
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
    'Component': 'Services',
    'ManagedBy': 'PlatformTeam',
    'Environment': environment,
    'Application': applicationName,
  },
};

// 1. Vector Database Stack - OpenSearch Serverless (minimal)
const vectorDatabaseStack = new VectorDatabaseMinimalStack(app, `${applicationName}-vector-db-${environment}`, {
  ...commonProps,
  description: 'RAG application vector database - OpenSearch Serverless collection for embeddings',
});

// 2. AI Services Stack - Bedrock models
const aiServicesStack = new AIServicesStack(app, `${applicationName}-ai-services-${environment}`, {
  ...commonProps,
  description: 'RAG application AI services - Bedrock Nova Pro and embedding models',
});

// Add global tags to all resources
cdk.Tags.of(app).add('Project', 'RAGInfrastructure');
cdk.Tags.of(app).add('ManagedBy', 'PlatformTeam');
cdk.Tags.of(app).add('DeployedBy', 'CDK');
cdk.Tags.of(app).add('DeploymentTimestamp', new Date().toISOString());

console.log('✅ RAG services infrastructure components configured');
console.log('📋 Stacks to deploy:');
console.log('   1. Vector Database Stack - OpenSearch Serverless (minimal)');
console.log('   2. AI Services Stack - Bedrock models');
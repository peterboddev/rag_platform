#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RAGInfrastructureStack } from '../lib/rag-infrastructure-stack';

/**
 * RAG Application Infrastructure CDK Application
 * 
 * This application creates the foundational AI/ML infrastructure for RAG applications
 * including AWS Bedrock Nova Pro, vector databases, document processing, and supporting services.
 */
const app = new cdk.App();

// Environment configuration
const account = process.env.CDK_DEFAULT_ACCOUNT || '450683699755';
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Application configuration
const applicationName = 'rag-app-v2';
const environment = 'dev'; // Start with dev environment

console.log('🚀 Deploying RAG Infrastructure:');
console.log(`   Application: ${applicationName}`);
console.log(`   Environment: ${environment}`);
console.log(`   Account: ${account}`);
console.log(`   Region: ${region}`);

// Create the RAG infrastructure stack with unique name to avoid conflicts
const timestamp = Date.now();
const ragInfrastructureStack = new RAGInfrastructureStack(app, `RAGInfrastructureStack-v2-${timestamp}`, {
  env: {
    account: account,
    region: region,
  },
  description: 'RAG application infrastructure with Bedrock Nova Pro, vector database, and supporting services',
  applicationName: applicationName,
  environment: environment,
  tags: {
    'Project': 'RAGInfrastructure',
    'Component': 'AIServices',
    'ManagedBy': 'PlatformTeam',
    'Environment': environment,
    'Application': applicationName,
  },
});

// Add global tags to all resources
cdk.Tags.of(app).add('Project', 'RAGInfrastructure');
cdk.Tags.of(app).add('ManagedBy', 'PlatformTeam');
cdk.Tags.of(app).add('DeployedBy', 'CDK');
cdk.Tags.of(app).add('DeploymentTimestamp', new Date().toISOString());

console.log('✅ RAG infrastructure components configured');
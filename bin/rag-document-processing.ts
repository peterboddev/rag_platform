#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DocumentProcessingSimpleStack } from '../lib/stacks/document-processing-simple-stack';

/**
 * RAG Application Document Processing
 * 
 * This deploys the document processing pipeline
 */
const app = new cdk.App();

// Environment configuration
const account = process.env.CDK_DEFAULT_ACCOUNT || '450683699755';
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Application configuration
const applicationName = 'rag-app-v2';
const environment = 'dev';

console.log('🚀 Deploying RAG Document Processing Infrastructure:');
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
    'Component': 'DocumentProcessing',
    'ManagedBy': 'PlatformTeam',
    'Environment': environment,
    'Application': applicationName,
  },
};

// Import values from existing stacks
const documentsBucketName = cdk.Fn.importValue(`${applicationName}-${environment}-document-bucket`);
const vectorDatabaseEndpoint = cdk.Fn.importValue(`${applicationName}-${environment}-vector-db-endpoint`);
const vectorDatabaseArn = cdk.Fn.importValue(`${applicationName}-${environment}-vector-db-arn`);

// Document Processing Stack
const documentProcessingStack = new DocumentProcessingSimpleStack(app, `${applicationName}-document-processing-${environment}`, {
  ...commonProps,
  documentsBucketName: documentsBucketName,
  vectorDatabaseEndpoint: vectorDatabaseEndpoint,
  vectorDatabaseArn: vectorDatabaseArn,
  description: 'RAG application document processing - Lambda pipeline for document ingestion',
});

// Add global tags to all resources
cdk.Tags.of(app).add('Project', 'RAGInfrastructure');
cdk.Tags.of(app).add('ManagedBy', 'PlatformTeam');
cdk.Tags.of(app).add('DeployedBy', 'CDK');
cdk.Tags.of(app).add('DeploymentTimestamp', new Date().toISOString());

console.log('✅ RAG document processing infrastructure configured');
console.log('📋 Stack to deploy:');
console.log('   1. Document Processing Stack - Lambda pipeline for document processing');
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from '../lib/stacks/foundation-stack';
import { StorageStack } from '../lib/stacks/storage-stack';

/**
 * RAG Application Foundation Infrastructure
 * 
 * This deploys the foundational components step by step:
 * 1. Foundation Stack - VPC, networking, security groups
 * 2. Storage Stack - S3 buckets for documents, website, config, backups
 */
const app = new cdk.App();

// Environment configuration
const account = process.env.CDK_DEFAULT_ACCOUNT || '450683699755';
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Application configuration
const applicationName = 'rag-app-v2';
const environment = 'dev';

console.log('🚀 Deploying RAG Foundation Infrastructure:');
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
    'Component': 'Foundation',
    'ManagedBy': 'PlatformTeam',
    'Environment': environment,
    'Application': applicationName,
  },
};

// 1. Foundation Stack - VPC and networking
const foundationStack = new FoundationStack(app, `${applicationName}-foundation-${environment}`, {
  ...commonProps,
  description: 'RAG application foundation infrastructure - VPC, networking, security groups',
});

// 2. Storage Stack - S3 buckets
const storageStack = new StorageStack(app, `${applicationName}-storage-${environment}`, {
  ...commonProps,
  description: 'RAG application storage infrastructure - S3 buckets for documents, website, config',
});

// Add global tags to all resources
cdk.Tags.of(app).add('Project', 'RAGInfrastructure');
cdk.Tags.of(app).add('ManagedBy', 'PlatformTeam');
cdk.Tags.of(app).add('DeployedBy', 'CDK');
cdk.Tags.of(app).add('DeploymentTimestamp', new Date().toISOString());

console.log('✅ RAG foundation infrastructure components configured');
console.log('📋 Stacks to deploy:');
console.log('   1. Foundation Stack - VPC, networking');
console.log('   2. Storage Stack - S3 buckets');
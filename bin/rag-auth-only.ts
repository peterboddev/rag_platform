#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthenticationStack } from '../lib/stacks/authentication-stack';

/**
 * RAG Application Authentication Only
 * 
 * This deploys just the authentication component to test it independently
 */
const app = new cdk.App();

// Environment configuration
const account = process.env.CDK_DEFAULT_ACCOUNT || '450683699755';
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Application configuration
const applicationName = 'rag-app-v2';
const environment = 'dev';

console.log('🚀 Deploying RAG Authentication Infrastructure:');
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
    'Component': 'Authentication',
    'ManagedBy': 'PlatformTeam',
    'Environment': environment,
    'Application': applicationName,
  },
};

// Authentication Stack - Cognito
const authenticationStack = new AuthenticationStack(app, `${applicationName}-authentication-${environment}`, {
  ...commonProps,
  description: 'RAG application authentication - Cognito user pools and identity pools',
  websiteBucketName: `${applicationName}-website-${environment}`, // Placeholder - not actually used in this standalone deployment
});

// Add global tags to all resources
cdk.Tags.of(app).add('Project', 'RAGInfrastructure');
cdk.Tags.of(app).add('ManagedBy', 'PlatformTeam');
cdk.Tags.of(app).add('DeployedBy', 'CDK');
cdk.Tags.of(app).add('DeploymentTimestamp', new Date().toISOString());

console.log('✅ RAG authentication infrastructure configured');
console.log('📋 Stack to deploy:');
console.log('   1. Authentication Stack - Cognito user pools and identity pools');
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MonitoringSimpleStack } from '../lib/stacks/monitoring-simple-stack';

/**
 * RAG Application Monitoring
 * 
 * This deploys the monitoring and observability components
 */
const app = new cdk.App();

// Environment configuration
const account = process.env.CDK_DEFAULT_ACCOUNT || '450683699755';
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Application configuration
const applicationName = 'rag-app-v2';
const environment = 'dev';

console.log('🚀 Deploying RAG Monitoring Infrastructure:');
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
    'Component': 'Monitoring',
    'ManagedBy': 'PlatformTeam',
    'Environment': environment,
    'Application': applicationName,
  },
};

// Import values from existing stacks
const vectorDatabaseArn = cdk.Fn.importValue(`${applicationName}-${environment}-vector-db-arn`);
const processingFunctionArn = cdk.Fn.importValue(`${applicationName}-${environment}-processing-function-arn`);
const embeddingFunctionArn = cdk.Fn.importValue(`${applicationName}-${environment}-embedding-function-arn`);

// Monitoring Stack
const monitoringStack = new MonitoringSimpleStack(app, `${applicationName}-monitoring-${environment}`, {
  ...commonProps,
  vectorDatabaseArn: vectorDatabaseArn,
  processingFunctionArns: [processingFunctionArn, embeddingFunctionArn],
  alertEmail: 'admin@example.com', // Replace with actual email
  description: 'RAG application monitoring - CloudWatch dashboards and alarms',
});

// Add global tags to all resources
cdk.Tags.of(app).add('Project', 'RAGInfrastructure');
cdk.Tags.of(app).add('ManagedBy', 'PlatformTeam');
cdk.Tags.of(app).add('DeployedBy', 'CDK');
cdk.Tags.of(app).add('DeploymentTimestamp', new Date().toISOString());

console.log('✅ RAG monitoring infrastructure configured');
console.log('📋 Stack to deploy:');
console.log('   1. Monitoring Stack - CloudWatch dashboards and alarms');
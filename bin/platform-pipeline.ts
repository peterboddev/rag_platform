#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PlatformPipelineStack } from '../lib/platform-pipeline-stack';
import { SecurityStack } from '../lib/security-stack';
import { ConfigurationManager } from '../lib/config/platform-config';

/**
 * Main CDK application that wires together all platform pipeline components
 * 
 * This application creates a complete two-tier pipeline architecture where:
 * 1. Platform engineers manage a self-mutating platform pipeline
 * 2. The platform pipeline creates and manages application pipelines
 * 3. Cross-stack dependencies ensure proper deployment order
 * 4. Environment promotion stages enable controlled deployments
 */
const app = new cdk.App();

// Create a temporary construct for configuration management
const tempConstruct = new Construct(app, 'TempConfig');
const configManager = new ConfigurationManager(tempConstruct);

// Validate configuration before proceeding
try {
  configManager.validateOrThrow();
  console.log('✅ Configuration validation passed');
} catch (error) {
  console.error('❌ Configuration validation failed:', error);
  process.exit(1);
}

// Get platform configuration
const platformConfig = configManager.getPlatformConfig();
const environments = configManager.getEnvironments();
const applications = configManager.getEnabledApplications();

// Environment configuration with fallbacks
const account = platformConfig.account || process.env.CDK_DEFAULT_ACCOUNT;
const region = platformConfig.region || process.env.CDK_DEFAULT_REGION;

// Validate required configuration
if (!account || !region) {
  console.error('❌ Account and region must be specified in configuration or environment variables');
  process.exit(1);
}

// Note: connectionArn will be created by CDK if not provided
if (!platformConfig.connectionArn) {
  console.log('ℹ️  CodeConnections connection will be created by CDK during deployment');
}

// Extract cross-account configuration for multi-account deployments
const crossAccountRoleArns: string[] = [];
const applicationAccounts: string[] = [];

// Collect unique accounts from environment configurations
Object.values(environments).forEach(env => {
  if (env.account !== account && !applicationAccounts.includes(env.account)) {
    applicationAccounts.push(env.account);
    // Generate cross-account role ARN for each target account
    crossAccountRoleArns.push(
      `arn:aws:iam::${env.account}:role/PlatformCrossAccountDeploymentRole`
    );
  }
});

// Platform pipeline configuration from context and config
const platformRepo = app.node.tryGetContext('platformRepository');
const githubOrg = platformRepo?.owner || 'platform-team';
const githubRepo = platformRepo?.repo || 'platform-pipeline';
const branch = platformRepo?.branch || 'main';

// Log deployment summary
console.log('🚀 Deploying Platform Pipeline System:');
console.log(`   Account: ${account}`);
console.log(`   Region: ${region}`);
console.log(`   GitHub: ${githubOrg}/${githubRepo}@${branch}`);
console.log(`   Applications: ${Object.keys(applications).length} configured`);
console.log(`   Environments: ${Object.keys(environments).length} configured`);
console.log(`   Cross-account deployments: ${applicationAccounts.length > 0 ? 'Yes' : 'No'}`);

if (applicationAccounts.length > 0) {
  console.log(`   Target accounts: ${applicationAccounts.join(', ')}`);
}

// Create the security stack first as other stacks depend on it
const securityStack = new SecurityStack(app, 'PlatformSecurityStack', {
  env: {
    account: account,
    region: region,
  },
  description: 'Security and IAM infrastructure for platform pipeline system',
  crossAccountRoleArns: crossAccountRoleArns,
  applicationAccounts: applicationAccounts,
  tags: {
    'Project': 'PlatformPipeline',
    'Component': 'Security',
    'ManagedBy': 'PlatformTeam',
    'Environment': 'Platform',
  },
});

// Create the platform pipeline stack with cross-stack dependencies
const platformPipelineStack = new PlatformPipelineStack(app, 'PlatformPipelineStack', {
  env: {
    account: account,
    region: region,
  },
  description: 'Platform-owned CI/CD pipeline system for managing application pipelines',
  githubOrg: githubOrg,
  githubRepo: githubRepo,
  branch: branch,
  // connectionArn will be created by CDK construct, not passed from config
  securityStack: securityStack,
  tags: {
    'Project': 'PlatformPipeline',
    'Component': 'PlatformPipeline',
    'ManagedBy': 'PlatformTeam',
    'Environment': 'Platform',
  },
});

// Configure cross-stack dependencies to ensure proper deployment order
// The platform pipeline depends on the security stack for IAM roles
platformPipelineStack.addDependency(securityStack);

// Export security role ARNs for use by application teams or external systems
new cdk.CfnOutput(platformPipelineStack, 'PlatformSecurityRoleArns', {
  value: JSON.stringify({
    platformPipelineRole: securityStack.platformPipelineRole.roleArn,
    applicationPipelineRole: securityStack.applicationPipelineRole.roleArn,
    codeBuildServiceRole: securityStack.codeBuildServiceRole.roleArn,
    crossAccountDeploymentRole: securityStack.crossAccountDeploymentRole.roleArn,
  }),
  description: 'ARNs of all security roles created by the platform pipeline system',
  exportName: 'PlatformPipelineSystem-SecurityRoleArns',
});

// Export configuration summary for external monitoring and management systems
new cdk.CfnOutput(platformPipelineStack, 'PlatformConfigurationSummary', {
  value: JSON.stringify({
    applicationCount: Object.keys(applications).length,
    environmentCount: Object.keys(environments).length,
    crossAccountEnabled: applicationAccounts.length > 0,
    targetAccounts: applicationAccounts,
    deploymentRegions: [...new Set(Object.values(environments).map(env => env.region))],
    lastDeployed: new Date().toISOString(),
  }),
  description: 'Summary of platform pipeline configuration and deployment metadata',
  exportName: 'PlatformPipelineSystem-ConfigurationSummary',
});

// Environment promotion configuration
// This enables controlled promotion of changes through environments
const environmentPromotionOrder = ['dev', 'staging', 'prod'];
const configuredPromotionOrder = environmentPromotionOrder.filter(env => environments[env]);

if (configuredPromotionOrder.length > 1) {
  new cdk.CfnOutput(platformPipelineStack, 'EnvironmentPromotionOrder', {
    value: JSON.stringify(configuredPromotionOrder),
    description: 'Order of environment promotion for application deployments',
    exportName: 'PlatformPipelineSystem-EnvironmentPromotionOrder',
  });

  console.log(`📋 Environment promotion order: ${configuredPromotionOrder.join(' → ')}`);
}

// Add application-specific outputs for monitoring and management
Object.entries(applications).forEach(([appName, appConfig]) => {
  // Export application metadata for external systems
  new cdk.CfnOutput(platformPipelineStack, `Application-${appName}-Metadata`, {
    value: JSON.stringify({
      applicationName: appConfig.applicationName,
      team: appConfig.team,
      sourceRepository: `${appConfig.sourceRepo.owner}/${appConfig.sourceRepo.repo}`,
      branch: appConfig.sourceRepo.branch,
      deploymentTargets: appConfig.deploymentTargets,
      enabled: appConfig.enabled !== false,
    }),
    description: `Metadata for application ${appName}`,
    exportName: `PlatformPipelineSystem-Application-${appName}-Metadata`,
  });
});

// Add global tags to all resources in the application
cdk.Tags.of(app).add('Project', 'PlatformPipeline');
cdk.Tags.of(app).add('ManagedBy', 'PlatformTeam');
cdk.Tags.of(app).add('DeployedBy', 'CDK');
cdk.Tags.of(app).add('DeploymentTimestamp', new Date().toISOString());

// Log successful wiring completion
console.log('✅ Platform pipeline components successfully wired together');
console.log('🔗 Cross-stack dependencies configured');
console.log('📤 CloudFormation outputs configured for external integration');
console.log('🏷️  Resource tagging applied');

// Clean up temporary construct
tempConstruct.node.tryRemoveChild('TempConfig');
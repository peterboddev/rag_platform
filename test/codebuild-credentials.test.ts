/**
 * Tests for CodeBuild Credentials Management
 * 
 * This test suite validates the secure credential access functionality
 * for CodeBuild projects in the platform pipeline system.
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CodeBuildCredentialsManager } from '../lib/config/codebuild-credentials';

describe('CodeBuildCredentialsManager', () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
  });

  test('creates credentials manager with default configuration', () => {
    // GIVEN
    const credentialsManager = new CodeBuildCredentialsManager(stack, 'CredentialsManager', {
      githubTokenSecretName: 'test-github-token',
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN - Should create secrets and parameters
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'platform-pipeline/github-token',
      Description: 'GitHub personal access token for platform pipeline repository access',
    });

    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/platform-pipeline/github-org',
      Value: 'platform-team',
      Description: 'GitHub organization name for repository access',
    });
  });

  test('creates credentials manager with custom configuration', () => {
    // GIVEN
    const config = {
      githubTokenSecretName: 'custom-github-token',
      connectionArn: 'arn:aws:codestar-connections:us-east-1:123456789012:connection/test',
      enableCredentialRotation: true,
      credentialValidationEnabled: true,
      secretsPrefix: 'custom-prefix',
    };

    const credentialsManager = new CodeBuildCredentialsManager(stack, 'CredentialsManager', config);

    // WHEN
    const template = Template.fromStack(stack);

    // THEN - Should create secrets with custom prefix
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'custom-prefix/github-token',
    });

    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/custom-prefix/connection-arn',
      Value: 'arn:aws:codestar-connections:us-east-1:123456789012:connection/test',
    });
  });

  test('creates environment variables for CodeBuild', () => {
    // GIVEN
    const credentialsManager = new CodeBuildCredentialsManager(stack, 'CredentialsManager', {
      githubTokenSecretName: 'test-token',
      connectionArn: 'arn:aws:codestar-connections:us-east-1:123456789012:connection/test',
      credentialValidationEnabled: true,
    });

    // WHEN
    const environmentVariables = credentialsManager.createCodeBuildEnvironmentVariables();

    // THEN - Should include all required environment variables
    expect(environmentVariables).toHaveProperty('GITHUB_TOKEN');
    expect(environmentVariables).toHaveProperty('CONNECTION_ARN');
    expect(environmentVariables).toHaveProperty('CREDENTIAL_VALIDATION_ENABLED');
    expect(environmentVariables).toHaveProperty('SECRETS_PREFIX');

    // Verify environment variable types
    expect(environmentVariables['GITHUB_TOKEN'].type).toBe('SECRETS_MANAGER');
    expect(environmentVariables['CONNECTION_ARN'].type).toBe('PARAMETER_STORE');
    expect(environmentVariables['CREDENTIAL_VALIDATION_ENABLED'].type).toBe('PLAINTEXT');
    expect(environmentVariables['CREDENTIAL_VALIDATION_ENABLED'].value).toBe('true');
  });

  test('creates IAM policy statements for credential access', () => {
    // GIVEN
    const credentialsManager = new CodeBuildCredentialsManager(stack, 'CredentialsManager', {
      githubTokenSecretName: 'test-token',
    });

    // WHEN
    const policyStatements = credentialsManager.createCredentialAccessPolicyStatements();

    // THEN - Should create appropriate policy statements
    expect(policyStatements).toHaveLength(3); // Secrets Manager, Parameter Store, and KMS

    // Check Secrets Manager policy
    const secretsPolicy = policyStatements.find(stmt => 
      stmt.toStatementJson().Action.includes('secretsmanager:GetSecretValue')
    );
    expect(secretsPolicy).toBeDefined();
    expect(secretsPolicy!.toStatementJson().Effect).toBe('Allow');

    // Check Parameter Store policy
    const parameterPolicy = policyStatements.find(stmt => 
      stmt.toStatementJson().Action.includes('ssm:GetParameter')
    );
    expect(parameterPolicy).toBeDefined();
    expect(parameterPolicy!.toStatementJson().Effect).toBe('Allow');

    // Check KMS policy
    const kmsPolicy = policyStatements.find(stmt => 
      stmt.toStatementJson().Action.includes('kms:Decrypt')
    );
    expect(kmsPolicy).toBeDefined();
    expect(kmsPolicy!.toStatementJson().Effect).toBe('Allow');
  });

  test('creates credential validation script', () => {
    // GIVEN
    const credentialsManager = new CodeBuildCredentialsManager(stack, 'CredentialsManager');

    // WHEN
    const validationScript = credentialsManager.createCredentialValidationScript();

    // THEN - Should create a valid bash script
    expect(validationScript).toContain('#!/bin/bash');
    expect(validationScript).toContain('validate_github_token');
    expect(validationScript).toContain('validate_aws_credentials');
    expect(validationScript).toContain('CREDENTIAL_VALIDATION_ENABLED');
    expect(validationScript).toContain('aws sts get-caller-identity');
    expect(validationScript).toContain('curl -s -H "Authorization: token $GITHUB_TOKEN"');
  });

  test('retrieves secrets and parameters', () => {
    // GIVEN
    const credentialsManager = new CodeBuildCredentialsManager(stack, 'CredentialsManager', {
      githubTokenSecretName: 'test-token',
      connectionArn: 'arn:aws:codestar-connections:us-east-1:123456789012:connection/test',
    });

    // WHEN & THEN - Should be able to retrieve created secrets and parameters
    const githubSecret = credentialsManager.getSecret('github-token');
    expect(githubSecret).toBeDefined();

    const connectionParam = credentialsManager.getParameter('connection-arn');
    expect(connectionParam).toBeDefined();

    const allSecrets = credentialsManager.getAllSecrets();
    expect(allSecrets.size).toBeGreaterThan(0);

    const allParameters = credentialsManager.getAllParameters();
    expect(allParameters.size).toBeGreaterThan(0);
  });

  test('handles credential rotation configuration', () => {
    // GIVEN
    const credentialsManager = new CodeBuildCredentialsManager(stack, 'CredentialsManager', {
      githubTokenSecretName: 'test-github-token',
      enableCredentialRotation: true,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN - Should create rotation Lambda functions
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'python3.9',
    });

    // Should create rotation schedules (GitHub token and AWS credentials get rotation, deployment keys don't)
    template.resourceCountIs('AWS::SecretsManager::RotationSchedule', 2);
  });

  test('validates environment variable names mapping', () => {
    // GIVEN
    const credentialsManager = new CodeBuildCredentialsManager(stack, 'CredentialsManager', {
      githubTokenSecretName: 'test-github-token',
    });

    // WHEN
    const environmentVariables = credentialsManager.createCodeBuildEnvironmentVariables();

    // THEN - Should map credential keys to proper environment variable names
    const expectedMappings = {
      'GITHUB_TOKEN': 'SECRETS_MANAGER',
      'GITHUB_ORG': 'PARAMETER_STORE',
      'GITHUB_REPO': 'PARAMETER_STORE',
      'BRANCH': 'PARAMETER_STORE',
    };

    Object.entries(expectedMappings).forEach(([envVar, expectedType]) => {
      expect(environmentVariables).toHaveProperty(envVar);
      expect(environmentVariables[envVar].type).toBe(expectedType);
    });
  });
});
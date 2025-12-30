# Credential Management for Platform Pipeline

This document provides comprehensive guidance on secure credential handling for local development and CI/CD execution of the platform pipeline CDK system.

## Overview

The platform pipeline requires secure access to GitHub repositories and AWS services. This document outlines the security requirements and best practices for credential management in both local development and automated CI/CD environments.

**Requirements Addressed:** 4.1, 4.2, 4.3

## CodeBuild Secure Credential Access

### AWS Secrets Manager Integration

The platform pipeline uses AWS Secrets Manager for secure credential storage in CI/CD environments. This provides:

- **Encrypted Storage**: All credentials are encrypted at rest using AWS KMS
- **Automatic Rotation**: Credentials can be automatically rotated on a schedule
- **Audit Logging**: All credential access is logged via CloudTrail
- **Fine-grained Access Control**: IAM policies control which services can access specific secrets

#### Supported Credential Types

1. **GitHub Personal Access Tokens**
   - Stored in: `platform-pipeline/github-token`
   - Used for: Repository access and API operations
   - Rotation: Manual (90-day schedule with notifications)

2. **AWS Cross-Account Credentials**
   - Stored in: `platform-pipeline/aws-credentials`
   - Used for: Cross-account deployments
   - Rotation: Automated via IAM API

3. **SSH Deployment Keys**
   - Stored in: `platform-pipeline/deployment-keys`
   - Used for: Secure deployment operations
   - Rotation: Manual (requires key regeneration)

#### Environment Variable Mapping

CodeBuild projects automatically receive credentials as environment variables:

```yaml
# Environment variables populated from Secrets Manager
GITHUB_TOKEN: # From platform-pipeline/github-token:token
AWS_ACCESS_KEY_ID: # From platform-pipeline/aws-credentials:accessKeyId
AWS_SECRET_ACCESS_KEY: # From platform-pipeline/aws-credentials:secretAccessKey
DEPLOYMENT_PRIVATE_KEY: # From platform-pipeline/deployment-keys:privateKey

# Configuration from Parameter Store
CONNECTION_ARN: # From /platform-pipeline/connection-arn
GITHUB_ORG: # From /platform-pipeline/github-org
GITHUB_REPO: # From /platform-pipeline/github-repo
BRANCH: # From /platform-pipeline/default-branch
```

### Credential Validation

The platform pipeline includes comprehensive credential validation:

#### Pre-Build Validation

```bash
# Automatic validation in buildspec.yml
if [ "$CREDENTIAL_VALIDATION_ENABLED" = "true" ]; then
  # Validate GitHub token
  if [ -n "$GITHUB_TOKEN" ]; then
    curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
  fi
  
  # Validate AWS credentials
  aws sts get-caller-identity
  
  # Validate CodeStar connection
  if [ -n "$CONNECTION_ARN" ]; then
    echo "Using CodeStar connection: $CONNECTION_ARN"
  fi
fi
```

#### Validation Features

- **Token Validity**: Verifies GitHub tokens can access required repositories
- **AWS Identity**: Confirms AWS credentials have necessary permissions
- **Connection Status**: Validates CodeStar connections are active
- **Audit Logging**: Records all validation attempts for security monitoring

### Credential Rotation

#### Automatic Rotation Schedule

```typescript
// 90-day rotation schedule for all secrets
secret.addRotationSchedule('RotationSchedule', {
  rotationLambda: rotationLambda,
  automaticallyAfter: cdk.Duration.days(90),
});
```

#### Rotation Process

1. **GitHub Tokens**: Manual rotation with notification
   - Platform engineers receive alerts 7 days before expiration
   - New tokens must be generated manually and updated in Secrets Manager
   - Old tokens are revoked after successful validation

2. **AWS Credentials**: Automated rotation via IAM
   - New access keys are created automatically
   - Credentials are tested before old keys are deleted
   - Rollback capability in case of issues

3. **SSH Keys**: Manual rotation with validation
   - New key pairs are generated on secure systems
   - Public keys are deployed to target systems
   - Private keys are updated in Secrets Manager

#### Rotation Management Script

```bash
# Check rotation status
npm run credential-rotation status

# Rotate credentials due for rotation
npm run credential-rotation rotate

# Validate all credentials
npm run credential-rotation validate

# Set up initial credentials
npm run credential-rotation setup
```

## Local Development Credentials

### .git_credentials File

For local development, GitHub credentials are stored in a `.git_credentials` file in the project root. This file is automatically excluded from version control.

#### File Location
```
platform-pipeline/
├── .git_credentials          # GitHub credentials (excluded from git)
├── .gitignore               # Contains .git_credentials exclusion
└── ...
```

#### File Format

The `.git_credentials` file supports two authentication methods:

**Option 1: GitHub Personal Access Token (Recommended for Development)**
```bash
# GitHub Personal Access Token Authentication
GITHUB_TOKEN=ghp_your_personal_access_token_here
GITHUB_USERNAME=your_github_username
GITHUB_ORG=your_organization_name
GITHUB_REPO=platform-pipeline-repo-name
BRANCH=main
```

**Option 2: AWS CodeStar Connection ARN (Recommended for Production)**
```bash
# AWS CodeStar Connection Authentication
CONNECTION_ARN=arn:aws:codestar-connections:region:account:connection/connection-id
GITHUB_ORG=your_organization_name
GITHUB_REPO=platform-pipeline-repo-name
BRANCH=main
```

#### GitHub Personal Access Token Setup

1. **Create Token:**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Click "Generate new token (classic)"
   - Set expiration (recommend 90 days for security)

2. **Required Scopes:**
   ```
   ✅ repo (Full control of private repositories)
   ✅ workflow (Update GitHub Action workflows)
   ✅ admin:repo_hook (Full control of repository hooks)
   ```

3. **Add to .git_credentials:**
   ```bash
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   GITHUB_USERNAME=your_username
   ```

#### AWS CodeStar Connection Setup

1. **Create Connection in AWS Console:**
   - Navigate to Developer Tools → Connections
   - Click "Create connection"
   - Choose "GitHub" as provider
   - Follow OAuth flow to authorize AWS access

2. **Add ARN to .git_credentials:**
   ```bash
   CONNECTION_ARN=arn:aws:codestar-connections:us-east-1:123456789012:connection/12345678-1234-1234-1234-123456789012
   ```

### File Security

#### Automatic .gitignore Protection

The `.gitignore` file automatically excludes credential files:

```gitignore
# AWS credentials and sensitive files
.git_credentials
*.pem
*.key

# Environment files
.env
.env.test
.env.local
```

#### File Permissions

The credential setup script automatically sets secure permissions:

```bash
# Automatically set by credential-setup script
chmod 600 .git_credentials  # Owner read/write only
```

#### Manual Permission Check

```bash
# Check current permissions
ls -la .git_credentials

# Should show: -rw------- (600 permissions)
# If not, fix with: chmod 600 .git_credentials
```

## AWS Credentials

### Local Development

AWS credentials for local development should be configured using the AWS CLI:

```bash
# Configure AWS credentials
aws configure

# Or use AWS SSO
aws configure sso
```

**Credential Files Location:**
```
~/.aws/
├── credentials    # AWS access keys (if using long-term credentials)
├── config        # AWS configuration and profiles
└── sso/          # SSO cache (if using AWS SSO)
```

### Recommended AWS Authentication Methods

1. **AWS SSO (Recommended)**
   ```bash
   aws configure sso
   aws sso login --profile your-profile
   ```

2. **IAM Roles (Production)**
   - Use IAM roles for EC2 instances
   - Use IAM roles for CodeBuild projects
   - Avoid long-term access keys

3. **Temporary Credentials**
   ```bash
   aws sts assume-role --role-arn arn:aws:iam::account:role/role-name --role-session-name session-name
   ```

## CI/CD Environment Credentials

### CodeBuild Credential Access

For automated CI/CD execution, CodeBuild uses environment variables or AWS Secrets Manager:

#### Environment Variables (Basic)
```yaml
# buildspec.yml
env:
  variables:
    GITHUB_ORG: "your-organization"
    GITHUB_REPO: "platform-pipeline"
    BRANCH: "main"
  secrets-manager:
    GITHUB_TOKEN: "platform-pipeline/github:token"
```

#### AWS Secrets Manager (Recommended)
```typescript
// CDK Configuration
const githubSecret = secretsmanager.Secret.fromSecretNameV2(
  this, 
  'GitHubSecret', 
  'platform-pipeline/github'
);

const codeBuildProject = new codebuild.Project(this, 'PlatformBuild', {
  environment: {
    environmentVariables: {
      GITHUB_TOKEN: {
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
        value: githubSecret.secretArn + ':token'
      }
    }
  }
});
```

### IAM Roles and Permissions

#### Platform Pipeline Execution Role
```typescript
const platformPipelineRole = new iam.Role(this, 'PlatformPipelineRole', {
  assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodePipelineFullAccess')
  ],
  inlinePolicies: {
    CDKDeploymentPolicy: new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'cloudformation:*',
            'iam:*',
            's3:*',
            'codebuild:*'
          ],
          resources: ['*']
        })
      ]
    })
  }
});
```

#### CodeBuild Service Role
```typescript
const codeBuildRole = new iam.Role(this, 'CodeBuildRole', {
  assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess')
  ],
  inlinePolicies: {
    SecretsManagerAccess: new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'secretsmanager:GetSecretValue'
          ],
          resources: [
            'arn:aws:secretsmanager:*:*:secret:platform-pipeline/*'
          ]
        })
      ]
    })
  }
});
```

## Credential Setup and Validation

### Automated Setup Script

Use the credential setup script for easy configuration:

```bash
# Validate current credential configuration
npm run credential-setup validate

# Interactive setup process
npm run credential-setup setup

# Check .gitignore configuration only
npm run credential-setup check-gitignore

# Show help
npm run credential-setup help
```

### Manual Validation Checklist

#### Local Development Checklist
- [ ] `.git_credentials` file exists and contains valid credentials
- [ ] `.git_credentials` has secure permissions (600)
- [ ] `.git_credentials` is excluded from version control
- [ ] AWS CLI is installed and configured
- [ ] CDK CLI is installed globally
- [ ] Can run `aws sts get-caller-identity` successfully
- [ ] Can run `cdk --version` successfully

#### CI/CD Environment Checklist
- [ ] GitHub credentials stored in AWS Secrets Manager
- [ ] CodeBuild has appropriate IAM role
- [ ] IAM role has minimum required permissions
- [ ] No hardcoded credentials in buildspec.yml
- [ ] Environment variables properly configured
- [ ] Cross-account roles configured (if needed)

### Troubleshooting

#### Common Issues

**1. .git_credentials not found**
```bash
# Solution: Run setup script
npm run credential-setup setup
```

**2. Invalid GitHub token**
```bash
# Check token validity
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user

# If invalid, generate new token at:
# https://github.com/settings/tokens
```

**3. AWS credentials not configured**
```bash
# Configure AWS credentials
aws configure

# Or check current configuration
aws configure list
```

**4. Permission denied on .git_credentials**
```bash
# Fix file permissions
chmod 600 .git_credentials
```

**5. CDK bootstrap required**
```bash
# Bootstrap CDK environment
npm run bootstrap:all-envs
```

#### Security Incident Response

**If credentials are accidentally committed:**

1. **Immediate Actions:**
   ```bash
   # Revoke the compromised credentials immediately
   # For GitHub: Go to Settings → Developer settings → Personal access tokens
   # For AWS: Disable/delete the access keys in IAM console
   ```

2. **Clean Git History:**
   ```bash
   # Remove from git history (use with caution)
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch .git_credentials' \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push (coordinate with team)
   git push origin --force --all
   ```

3. **Generate New Credentials:**
   ```bash
   # Generate new credentials
   # Update .git_credentials file
   # Test with credential-setup script
   npm run credential-setup validate
   ```

## Best Practices Summary

### Security Best Practices
1. **Never commit credentials to version control**
2. **Use short-lived tokens when possible**
3. **Rotate credentials regularly (90 days recommended)**
4. **Use IAM roles instead of long-term keys in production**
5. **Set restrictive file permissions (600) on credential files**
6. **Monitor credential usage and access patterns**

### Development Best Practices
1. **Use the credential-setup script for validation**
2. **Test credential configuration before committing code**
3. **Use separate credentials for different environments**
4. **Document credential requirements in team runbooks**
5. **Automate credential validation in pre-commit hooks**

### Operational Best Practices
1. **Store production credentials in AWS Secrets Manager**
2. **Use AWS SSO for human access**
3. **Implement credential rotation automation**
4. **Monitor and alert on credential usage**
5. **Regular security audits of credential access**

## Related Documentation

- [AWS CDK Security Best Practices](https://docs.aws.amazon.com/cdk/v2/guide/security.html)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [AWS CodeStar Connections](https://docs.aws.amazon.com/codepipeline/latest/userguide/connections.html)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)

## Support

For credential-related issues:
1. Run the credential validation script: `npm run credential-setup validate`
2. Check the troubleshooting section above
3. Review AWS CloudTrail logs for permission issues
4. Contact the platform team for assistance

---

**Security Notice:** This document contains guidance for handling sensitive credentials. Ensure this documentation is only accessible to authorized platform engineers and is stored in a secure location.
# Credential Management for Platform Pipeline

This document provides comprehensive guidance on secure credential handling for the platform pipeline CDK system using AWS CodeConnections.

## Overview

The platform pipeline uses **AWS CodeConnections** exclusively for secure GitHub integration, eliminating the need for stored credentials, tokens, or credential rotation. This document outlines the simplified security model and best practices.

**Requirements Addressed:** 4.1, 4.2, 4.3

## CodeConnections-Based Authentication

### AWS CodeConnections Integration

The platform pipeline uses AWS CodeConnections for secure GitHub access. This provides:

- **OAuth-Based Authentication**: No stored tokens or credentials required
- **Native Pipeline Integration**: Direct integration with CodePipeline V2
- **Automatic Authorization**: Handles authentication automatically after initial setup
- **Audit Logging**: All access is logged via CloudTrail
- **Fine-grained Access Control**: IAM policies control connection usage
- **No Credential Rotation**: OAuth tokens are managed automatically by AWS

#### Connection Configuration

```typescript
// CDK Configuration for CodeConnections
const codeConnection = new CodeConnectionsConstruct(this, 'CodeConnection', {
  connectionName: 'platform-pipeline-github',
  providerType: 'GitHub',
});

// Pipeline source using CodeConnections
CodePipelineSource.connection(
  `${githubOrg}/${githubRepo}`,
  branch,
  {
    connectionArn: codeConnection.getConnectionArn(),
    triggerOnPush: true,
  }
)
```

#### Environment Variables

CodeBuild projects receive minimal configuration via environment variables:

```yaml
# Environment variables for CodeBuild
NODE_ENV: production
CDK_DEFAULT_REGION: us-east-1
CDK_DEFAULT_ACCOUNT: 123456789012
```

### Connection Authorization Process

1. **Deploy CDK Stack**: Connection is created in PENDING status
2. **Authorize in Console**:
   - Go to AWS Console → CodePipeline → Settings → Connections
   - Find the connection (will show as PENDING)
   - Click "Update pending connection"
   - Complete GitHub OAuth flow in browser
   - Verify status changes to "Available"
3. **Pipeline Triggers**: Once authorized, pipelines trigger automatically on push

## Local Development Credentials

### GitHub Authentication for Local Development

For local development, GitHub authentication is handled through standard Git credential helpers and the AWS CLI for CodeConnections authorization. No stored credential files are required.

#### Local Development Setup

1. **Configure Git Credentials:**
   ```bash
   # Use Git credential helper (recommended)
   git config --global credential.helper store
   
   # Or use SSH keys (most secure)
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # Add to GitHub: Settings → SSH and GPG keys
   ```

2. **AWS CLI Configuration:**
   ```bash
   # Configure AWS credentials for CodeConnections
   aws configure
   
   # Or use AWS SSO (recommended)
   aws configure sso
   ```

#### Repository Access

Local development requires:
- **Git Access**: Standard Git authentication (HTTPS with tokens or SSH keys)
- **AWS Access**: AWS CLI configured for CodeConnections management
- **No Stored Files**: No credential files needed in the project directory

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

**Note**: `.git_credentials` remains in `.gitignore` for security, even though it's no longer used by the platform.

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

For automated CI/CD execution, CodeBuild uses CodeConnections and IAM roles exclusively:

#### Environment Variables (CodeConnections Only)
```yaml
# buildspec.yml
env:
  variables:
    GITHUB_ORG: "your-organization"
    GITHUB_REPO: "platform-pipeline"
    BRANCH: "main"
    NODE_ENV: "production"
```

**No Secrets Manager Required**: CodeConnections handles all GitHub authentication automatically.

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
  // No Secrets Manager permissions needed with CodeConnections
});
```

## Validation and Troubleshooting

### Manual Validation Checklist

#### Local Development Checklist
- [ ] Git credentials configured (credential helper or SSH keys)
- [ ] AWS CLI is installed and configured
- [ ] CDK CLI is installed globally
- [ ] Can run `aws sts get-caller-identity` successfully
- [ ] Can run `cdk --version` successfully
- [ ] Can run `git push` to repository successfully

#### CI/CD Environment Checklist
- [ ] CodeConnections connection is authorized and shows "Available" status
- [ ] CodeBuild has appropriate IAM role
- [ ] IAM role has minimum required permissions
- [ ] No hardcoded credentials in buildspec.yml
- [ ] Environment variables properly configured
- [ ] Cross-account roles configured (if needed)

### Troubleshooting

#### Common Issues

**1. CodeConnections connection shows PENDING**
```bash
# Solution: Authorize in AWS Console
# Go to CodePipeline → Settings → Connections
# Click "Update pending connection" and complete OAuth flow
```

**2. Git authentication issues (local development)**
```bash
# Check Git credential configuration
git config --list | grep credential

# Test repository access
git ls-remote origin

# If using HTTPS, ensure token has correct permissions
# If using SSH, ensure key is added to ssh-agent
```

**3. AWS credentials not configured**
```bash
# Configure AWS credentials
aws configure

# Or check current configuration
aws configure list
```

**4. Git repository access denied**
```bash
# Check Git configuration
git config --list | grep credential

# Test repository access
git ls-remote origin

# Ensure proper authentication method is configured
```

**5. CDK bootstrap required**
```bash
# Bootstrap CDK environment
cdk bootstrap
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
     'git rm --cached --ignore-unmatch .git_credentials .env' \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push (coordinate with team)
   git push origin --force --all
   ```

3. **Generate New Credentials:**
   ```bash
   # Generate new GitHub token or SSH key
   # Update local Git configuration
   # Test with Git commands
   ```

## Best Practices Summary

### Security Best Practices
1. **Never commit credentials to version control**
2. **Use CodeConnections for all CI/CD GitHub access**
3. **Use standard Git authentication for local development**
4. **Use IAM roles instead of long-term keys in production**
5. **Monitor credential usage and access patterns**

### Development Best Practices
1. **Use CodeConnections for all pipeline GitHub integration**
2. **Test Git access before committing code**
3. **Use separate credentials for different environments**
4. **Document credential requirements in team runbooks**

### Operational Best Practices
1. **Use CodeConnections exclusively for production pipelines**
2. **Use AWS SSO for human access**
3. **Monitor and alert on connection usage**
4. **Regular security audits of connection access**
5. **No credential rotation needed with CodeConnections**

## Related Documentation

- [AWS CodeConnections](https://docs.aws.amazon.com/codepipeline/latest/userguide/connections.html)
- [AWS CDK Security Best Practices](https://docs.aws.amazon.com/cdk/v2/guide/security.html)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)

## Support

For credential-related issues:
1. Check CodeConnections status in AWS Console (CodePipeline → Settings → Connections)
2. Check the troubleshooting section above
3. Review AWS CloudTrail logs for permission issues
4. Contact the platform team for assistance

---

**Security Notice:** This document contains guidance for handling sensitive credentials. Ensure this documentation is only accessible to authorized platform engineers and is stored in a secure location.
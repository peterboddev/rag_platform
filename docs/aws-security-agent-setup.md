# AWS Security Agent Setup Guide

## Overview

This guide walks through setting up AWS Security Agent for the platform pipeline infrastructure. AWS Security Agent provides automated security scanning, code review, and penetration testing capabilities that will be integrated into application pipelines.

## Prerequisites

Before beginning setup, ensure you have:

- AWS account with administrative access
- Access to AWS Security Agent console (US East N. Virginia region)
- IAM permissions to create roles and policies
- Understanding of your application architecture and security requirements

## Architecture Overview

The setup creates:
- **Agent Space**: Dedicated workspace for each application/project
- **IAM Roles**: Permissions for Security Agent to access AWS resources
- **Web Application**: Interface for design reviews and penetration testing
- **Security Requirements**: Organizational security policies and standards

## Step 1: Access AWS Security Agent Console

1. Sign in to AWS Management Console
2. Navigate to AWS Security Agent service
3. Ensure you're in **US East (N. Virginia)** region
4. Click "Get started with AWS Security Agent"

## Step 2: Create Your First Agent Space

### 2.1 Define Agent Space Properties

An Agent Space is a dedicated workspace for securing a specific application or project.

**Naming Convention**: Use format `{applicationName}-{environment}`
- Example: `rag-app-dev`, `rag-app-prod`, `platform-pipeline-prod`

**Steps**:
1. Click "Create Agent Space"
2. Enter **Agent Space name**: `platform-pipeline-prod`
3. Enter **Description**: "Platform pipeline infrastructure - production security scanning"
4. Click "Next"

### 2.2 Choose Access Method

Select how users will access the Security Agent Web Application:

**Option 1: IAM Identity Center (SSO) - Recommended for Teams**
- Enables team-wide SSO access
- Centralized user management
- Better for multiple users

**Option 2: IAM-only Access - Quick Setup**
- Only IAM principals can access
- Access through AWS Console
- Simpler for initial setup

**Recommendation**: Start with IAM-only access for initial setup, migrate to SSO later if needed.

**Steps**:
1. Select "IAM-only access"
2. Click "Next"

## Step 3: Configure IAM Permissions

### 3.1 Create IAM Role for Security Agent

The Security Agent needs permissions to:
- Access AWS Security Agent API
- Read source code from repositories
- Write scan results to S3
- Publish metrics to CloudWatch

**Steps**:
1. In "Configure permissions" section, select "Create a new IAM role"
2. Role name will be auto-generated: `AWSSecurityAgent-{AgentSpaceId}-Role`
3. Review the permissions policy (will be created automatically)
4. Click "Next"


### 3.2 Required IAM Permissions

The IAM role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "securityagent:StartCodeReview",
        "securityagent:StartDesignReview",
        "securityagent:StartPenetrationTest",
        "securityagent:GetScanStatus",
        "securityagent:GetScanFindings",
        "securityagent:ListScans"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::security-scan-results-*",
        "arn:aws:s3:::security-scan-results-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "cloudwatch:namespace": "SecurityAgent"
        }
      }
    }
  ]
}
```

## Step 4: Complete Setup

1. Review all configuration settings
2. Click "Create Agent Space"
3. Wait for agent space creation (takes 2-3 minutes)
4. Note the **Agent Space ID** - you'll need this for API calls

## Step 5: Configure Security Requirements

Security requirements define the policies that code and designs must follow.

### 5.1 Enable AWS Managed Requirements

1. Navigate to "Security requirements" in left sidebar
2. Enable these AWS managed requirements:
   - ✅ **OWASP Top 10** - Common web vulnerabilities
   - ✅ **CWE Top 25** - Most dangerous software weaknesses
   - ✅ **Secrets Detection** - Hardcoded credentials
   - ✅ **Dependency Vulnerabilities** - Third-party package issues

### 5.2 Create Custom Requirements

Create organization-specific security requirements:

**Example 1: Network Segmentation**
- **Name**: Network Segmentation Strategy Defined
- **Description**: Designs must define clear network segmentation separating workload components into logical layers based on data sensitivity
- **Category**: Network Security
- **Severity**: High

**Example 2: Encryption Keys**
- **Name**: Customer-Managed Encryption Keys Required
- **Description**: Designs must specify customer-managed AWS KMS keys rather than AWS managed keys for encrypting sensitive data at rest
- **Category**: Data Protection
- **Severity**: High

**Example 3: Session Timeouts**
- **Name**: Short Session Timeouts for Privileged Access
- **Description**: Administrative and PII access must have session timeouts of 15 minutes or less
- **Category**: Authentication
- **Severity**: Medium

**Steps to Create Custom Requirement**:
1. Click "Create custom requirement"
2. Fill in name, description, category, severity
3. Click "Save"
4. Enable the requirement

## Step 6: Configure for Pipeline Integration

### 6.1 Create Service Account for CodeBuild

CodeBuild needs credentials to call Security Agent API:

1. Go to IAM Console
2. Create new IAM user: `security-agent-codebuild`
3. Attach policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "securityagent:StartCodeReview",
        "securityagent:GetScanStatus",
        "securityagent:GetScanFindings"
      ],
      "Resource": "arn:aws:securityagent:us-east-1:*:agent-space/*"
    }
  ]
}
```

4. Create access key for programmatic access
5. Store credentials in AWS Secrets Manager:
   - Secret name: `/platform-pipeline/security-agent/credentials`
   - Secret value: `{"accessKeyId": "...", "secretAccessKey": "..."}`

### 6.2 Store Agent Space Configuration

Store agent space details in SSM Parameter Store for easy access:

```bash
# Store Agent Space ID
aws ssm put-parameter \
  --name "/platform-pipeline/security-agent/agent-space-id" \
  --value "agent-space-12345" \
  --type "String" \
  --description "AWS Security Agent space ID for platform pipeline"

# Store region
aws ssm put-parameter \
  --name "/platform-pipeline/security-agent/region" \
  --value "us-east-1" \
  --type "String" \
  --description "AWS Security Agent region"
```

## Step 7: Test the Setup

### 7.1 Test API Access

Create a test script to verify API access:

```typescript
// test-security-agent.ts
import { SecurityAgentClient } from '@aws-sdk/client-security-agent';

const client = new SecurityAgentClient({ region: 'us-east-1' });

async function testConnection() {
  try {
    const response = await client.listAgentSpaces({});
    console.log('✅ Successfully connected to AWS Security Agent');
    console.log('Agent Spaces:', response.agentSpaces);
  } catch (error) {
    console.error('❌ Failed to connect:', error);
  }
}

testConnection();
```

Run the test:
```bash
npx ts-node test-security-agent.ts
```

### 7.2 Verify Security Requirements

1. Navigate to Security requirements page
2. Verify all enabled requirements show "Active" status
3. Test a requirement by creating a test design review

## Step 8: Document Configuration

Create a configuration file for reference:

```json
{
  "agentSpace": {
    "id": "agent-space-12345",
    "name": "platform-pipeline-prod",
    "region": "us-east-1",
    "webAppUrl": "https://security-agent.aws.amazon.com/spaces/agent-space-12345"
  },
  "iamRole": {
    "arn": "arn:aws:iam::123456789012:role/AWSSecurityAgent-agent-space-12345-Role",
    "name": "AWSSecurityAgent-agent-space-12345-Role"
  },
  "securityRequirements": {
    "managed": [
      "owasp-top-10",
      "cwe-top-25",
      "secrets-detection",
      "dependency-vulnerabilities"
    ],
    "custom": [
      "network-segmentation",
      "customer-managed-keys",
      "session-timeouts"
    ]
  },
  "credentials": {
    "secretArn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:/platform-pipeline/security-agent/credentials"
  }
}
```

Save this as `config/security-agent-config.json`

## Next Steps

After completing setup:

1. ✅ **Task 1 Complete**: AWS Security Agent infrastructure is set up
2. ➡️ **Task 2**: Implement SecurityScanConstruct (CDK)
3. ➡️ **Task 3**: Implement SecurityPolicyManager
4. ➡️ **Task 5**: Implement SecurityAgentClient

## Troubleshooting

### Issue: Cannot access Security Agent console

**Solution**: Ensure you're in US East (N. Virginia) region. Security Agent is only available in this region during preview.

### Issue: IAM permission errors

**Solution**: Verify your IAM user/role has these permissions:
- `securityagent:*`
- `iam:CreateRole`
- `iam:AttachRolePolicy`

### Issue: Agent Space creation fails

**Solution**: 
- Check AWS service health dashboard
- Verify account limits haven't been reached
- Try again after a few minutes

### Issue: Cannot enable security requirements

**Solution**: Ensure agent space is fully created (status: Active) before configuring requirements.

## Additional Resources

- [AWS Security Agent Documentation](https://docs.aws.amazon.com/securityagent/latest/userguide/)
- [AWS Security Agent FAQs](https://aws.amazon.com/security-agent/faqs/)
- [AWS Security Agent Blog Post](https://aws.amazon.com/blogs/aws/new-aws-security-agent-secures-applications-proactively-from-design-to-deployment-preview/)

## Cost Considerations

During preview period:
- ✅ AWS Security Agent is **free to use**
- ✅ No charges for scans, reviews, or penetration tests
- ⚠️ Standard AWS charges apply for:
  - S3 storage for scan results
  - CloudWatch metrics and logs
  - Data transfer

Estimated monthly costs for typical usage:
- S3 storage: $1-5
- CloudWatch: $2-10
- Total: **$3-15/month**

# RAG Application Team Guide

## Overview

This guide explains how to build and deploy your RAG application using the platform-provided pipeline and infrastructure.

**Important**: The platform team has already deployed the foundational infrastructure. You only need to deploy your application code that uses these services.

## Architecture

### What Platform Provides (Already Deployed)

The platform team has deployed foundational infrastructure that your application consumes:

✅ **Networking**: VPC, subnets, security groups  
✅ **AI Services**: AWS Bedrock Nova Pro, embedding models  
✅ **Vector Database**: OpenSearch Serverless collection  
✅ **Storage**: S3 buckets (documents, configuration, website)  
✅ **Authentication**: Cognito user pools, identity pools, and user pool clients  
✅ **API Gateway**: REST API with Cognito authorizer (you add your methods and integrations)  
✅ **IAM Roles**: Pre-configured Lambda execution role with permissions for all platform services  
✅ **DynamoDB Tables**: Conversations and documents tables (you have read/write access)  
✅ **Monitoring**: CloudWatch dashboards and logging  

### What You Build

Your application code in the `peterboddev/rag` repository:

✅ **Lambda Functions**: Your business logic (chat, search, upload, etc.)  
✅ **API Gateway Methods**: Add methods and integrations to the platform-provided API Gateway  
✅ **Frontend**: React/Vue/Angular web applications (optional)  
✅ **Application Resources**: Any additional resources your application needs  

**Note**: You do NOT create DynamoDB tables - the platform provides them. You only read/write data.  

### Deployment Method

You can use **any tool** that generates a CloudFormation template:
- **AWS CDK** (TypeScript, Python, Java, etc.)
- **AWS SAM** (Serverless Application Model)
- **Serverless Framework**
- **Raw CloudFormation**
- **Terraform** (with CloudFormation output)

## Pipeline Configuration

The platform team has configured your pipeline:

```json
{
  "applicationName": "rag-app",
  "sourceRepo": {
    "owner": "peterboddev",
    "repo": "rag",
    "branch": "main"
  },
  "templatePath": "cdk.out/RAGApplicationStack.template.json",
  "deploymentTargets": ["dev", "staging", "prod"]
}
```

**Key Points:**
- Pipeline watches `peterboddev/rag` repository
- Expects CloudFormation template at `cdk.out/RAGApplicationStack.template.json`
- Automatically deploys to dev, staging, and prod environments

## Option 1: Using AWS CDK (Recommended)

### Repository Structure

```
peterboddev/rag/
├── bin/
│   └── app.ts                    # CDK app entry point
├── lib/
│   └── rag-application-stack.ts  # Your application stack
├── src/
│   └── handlers/                 # Lambda function code
│       ├── chat.ts
│       ├── search.ts
│       └── upload.ts
├── package.json
├── tsconfig.json
├── cdk.json
└── README.md
```

### CDK Application Stack

**File: `lib/rag-application-stack.ts`**

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface RAGApplicationStackProps extends cdk.StackProps {
  readonly environment: string;
}

export class RAGApplicationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RAGApplicationStackProps) {
    super(scope, id, props);

    const { environment } = props;
    const appName = 'rag-app';

    // Import platform-provided API Gateway
    const apiId = cdk.Fn.importValue(`${appName}-${environment}-api-id`);
    const apiRootId = cdk.Fn.importValue(`${appName}-${environment}-api-root-id`);
    const api = apigateway.RestApi.fromRestApiAttributes(this, 'Api', {
      restApiId: apiId,
      rootResourceId: apiRootId,
    });

    // Import platform-provided IAM role
    const roleArn = cdk.Fn.importValue(`${appName}-${environment}-application-role-arn`);
    const lambdaRole = iam.Role.fromRoleArn(this, 'LambdaRole', roleArn);

    // Import platform-provided DynamoDB table names
    const conversationsTable = cdk.Fn.importValue(`${appName}-${environment}-conversations-table`);
    const documentsTable = cdk.Fn.importValue(`${appName}-${environment}-documents-table`);

    // Lambda function for chat
    const chatFn = new lambda.Function(this, 'ChatFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'chat.handler',
      code: lambda.Code.fromAsset('src/handlers'),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      environment: {
        CONVERSATIONS_TABLE: conversationsTable,
        DOCUMENTS_TABLE: documentsTable,
      },
    });

    // Add method to platform API Gateway
    const chatResource = api.root.addResource('chat');
    chatResource.addMethod('POST', new apigateway.LambdaIntegration(chatFn));

    // Add more Lambda functions and API methods as needed...
  }
}
```

**File: `bin/app.ts`**

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RAGApplicationStack } from '../lib/rag-application-stack';

const app = new cdk.App();

const env = process.env.ENVIRONMENT || 'dev';

// CRITICAL: Stack ID must match templatePath in pipeline config
new RAGApplicationStack(app, 'RAGApplicationStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  environment: env,
});
```

**File: `cdk.json`**

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts"
}
```

**File: `package.json`**

```json
{
  "name": "rag-application",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "synth": "cdk synth"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.120.0",
    "constructs": "^10.0.0",
    "@aws-sdk/client-bedrock-runtime": "^3.x.x",
    "@aws-sdk/client-textract": "^3.x.x"
  },
  "devDependencies": {
    "@types/node": "^20.x.x",
    "typescript": "^5.x.x",
    "aws-cdk": "^2.120.0"
  }
}
```

### Lambda Function Example

**File: `src/handlers/chat.ts`**

```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

export const handler = async (event: any) => {
  const { question } = JSON.parse(event.body || '{}');

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: "amazon.nova-pro-v1:0",
    body: JSON.stringify({
      messages: [{ role: "user", content: [{ text: question }] }],
      inferenceConfig: { max_new_tokens: 1000, temperature: 0.7 }
    })
  }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: response.body })
  };
};
```

## Option 2: Using AWS SAM

### Repository Structure

```
peterboddev/rag/
├── template.yaml              # SAM template
├── src/
│   └── handlers/
│       ├── chat.js
│       └── search.js
└── package.json
```

### SAM Template

**File: `template.yaml`**

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Parameters:
  Environment:
    Type: String
    Default: dev

Resources:
  ChatFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/handlers/
      Handler: chat.handler
      Runtime: nodejs20.x
      Role: !Sub '{{resolve:ssm:/rag-app/${Environment}/iam/application-role-arn}}'
      Events:
        ChatApi:
          Type: Api
          Properties:
            RestApiId: !Sub '{{resolve:ssm:/rag-app/${Environment}/api-gateway-id}}'
            Path: /chat
            Method: POST
```

**Pipeline Configuration for SAM:**

```json
{
  "templatePath": "template.yaml"
}
```

## Getting Started: Retrieve Platform Configuration

**FIRST STEP**: Before writing any code, retrieve the platform configuration to understand what's available.

The platform team has deployed infrastructure and stored all configuration in SSM Parameter Store using prefix: `/rag-app/{environment}/`

### Quick Configuration Check

Run this command to see all available platform services:

```bash
# Get all platform configuration for dev environment
aws ssm get-parameters-by-path \
  --path "/rag-app/dev/" \
  --recursive \
  --query 'Parameters[*].[Name,Value]' \
  --output table
```

**Expected output**: ~18-20 parameters organized by service (bedrock, cognito, iam, opensearch, apigateway, s3, network)

If you see parameters, the platform infrastructure is ready. If not, contact the platform team.

## Accessing Platform Services

The platform stores all configuration in SSM Parameter Store using a standardized prefix pattern: `/rag-app/{environment}/`

### Method 1: Retrieve All Parameters (Recommended)

Get all platform configuration with a single command:

```bash
# Get all parameters for dev environment
aws ssm get-parameters-by-path \
  --path "/rag-app/dev/" \
  --recursive \
  --query 'Parameters[*].[Name,Value]' \
  --output table

# Get all parameters as JSON
aws ssm get-parameters-by-path \
  --path "/rag-app/dev/" \
  --recursive \
  --output json
```

This returns all configuration values organized by service category.

### Method 2: Individual Parameter Retrieval

```bash
# Get specific parameter
aws ssm get-parameter \
  --name "/rag-app/dev/opensearch/collection-endpoint" \
  --query 'Parameter.Value' \
  --output text
```

### Method 3: CloudFormation Imports

```typescript
// Import platform-provided resources
const apiId = cdk.Fn.importValue(`rag-app-${environment}-api-id`);
const roleArn = cdk.Fn.importValue(`rag-app-${environment}-application-role-arn`);
```

### Method 4: Runtime SSM Access (Lambda Functions)

```typescript
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
const vectorDbEndpoint = await ssm.send(new GetParameterCommand({
  Name: '/rag-app/dev/opensearch/collection-endpoint'
}));
```

### Method 5: CDK Lookup (Build-Time)

Pass configuration to Lambda functions as environment variables:

```typescript
environment: {
  VECTOR_DB_ENDPOINT: ssm.StringParameter.valueFromLookup(
    this,
    '/rag-app/dev/opensearch/collection-endpoint'
  ),
}
```

## Available Platform Resources

### SSM Parameter Organization

All parameters use prefix: `/rag-app/{environment}/`

**Bedrock AI Services:**
- `/rag-app/{env}/bedrock/nova-pro-model-id` - Nova Pro model ID
- `/rag-app/{env}/bedrock/embedding-model-id` - Embedding model ID

**Cognito Authentication:**
- `/rag-app/{env}/cognito/user-pool-id` - User Pool ID
- `/rag-app/{env}/cognito/client-id` - User Pool Client ID
- `/rag-app/{env}/cognito/user-pool-arn` - User Pool ARN
- `/rag-app/{env}/cognito/identity-pool-id` - Identity Pool ID

**IAM Roles:**
- `/rag-app/{env}/iam/application-role-arn` - Lambda execution role ARN
- `/rag-app/{env}/iam/application-role-name` - Lambda execution role name

**OpenSearch Vector Database:**
- `/rag-app/{env}/opensearch/collection-endpoint` - Collection endpoint URL
- `/rag-app/{env}/opensearch/index-name` - Vector index name
- `/rag-app/{env}/opensearch/collection-name` - Collection name

**API Gateway:**
- `/rag-app/{env}/apigateway/api-id` - REST API ID
- `/rag-app/{env}/apigateway/root-resource-id` - Root resource ID
- `/rag-app/{env}/apigateway/url` - API endpoint URL

**S3 Storage:**
- `/rag-app/{env}/s3/document-bucket` - Document storage bucket
- `/rag-app/{env}/s3/website-bucket` - Website hosting bucket
- `/rag-app/{env}/s3/config-bucket` - Configuration bucket

**Network:**
- `/rag-app/{env}/network/vpc-id` - VPC ID

**DynamoDB Tables:**
- `/rag-app/{env}/dynamodb/conversations-table` - Conversations table name
- `/rag-app/{env}/dynamodb/documents-table` - Documents metadata table name

**Region:**
- `/rag-app/{env}/region` - AWS region

### CloudFormation Exports (Alternative Access)

- `rag-app-{env}-api-id` - API Gateway REST API ID
- `rag-app-{env}-api-root-id` - API Gateway root resource ID
- `rag-app-{env}-api-url` - API Gateway endpoint URL
- `rag-app-{env}-application-role-arn` - Lambda execution role ARN
- `rag-app-{env}-cognito-user-pool-id` - Cognito User Pool ID
- `rag-app-{env}-cognito-client-id` - Cognito Client ID
- `rag-app-{env}-vector-db-endpoint` - OpenSearch endpoint
- `rag-app-{env}-conversations-table` - Conversations DynamoDB table name
- `rag-app-{env}-documents-table` - Documents DynamoDB table name

## DynamoDB Tables: Platform-Provided

### What Platform Provides

The platform team creates and manages DynamoDB tables for your application. You have **read/write access** to these tables but **cannot create or delete** them.

**Platform-Created Tables:**
1. **Conversations Table** (`rag-app-conversations-{env}`)
   - Partition Key: `userId` (String)
   - Sort Key: `timestamp` (Number)
   - Use for: Storing user chat conversations and history

2. **Documents Table** (`rag-app-documents-{env}`)
   - Partition Key: `documentId` (String)
   - Global Secondary Index: `userIdIndex` (userId + uploadedAt)
   - Use for: Storing document metadata and processing status

### Accessing Table Names

**Method 1: SSM Parameter Store (Recommended)**

```typescript
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});

const conversationsTable = await ssm.send(new GetParameterCommand({
  Name: '/rag-app/dev/dynamodb/conversations-table'
}));

const documentsTable = await ssm.send(new GetParameterCommand({
  Name: '/rag-app/dev/dynamodb/documents-table'
}));
```

**Method 2: CloudFormation Imports (CDK)**

```typescript
const conversationsTableName = cdk.Fn.importValue(`rag-app-${environment}-conversations-table`);
const documentsTableName = cdk.Fn.importValue(`rag-app-${environment}-documents-table`);

// Pass to Lambda as environment variables
const chatFn = new lambda.Function(this, 'ChatFunction', {
  // ... other config
  environment: {
    CONVERSATIONS_TABLE: conversationsTableName,
    DOCUMENTS_TABLE: documentsTableName,
  },
});
```

**Method 3: Direct Lookup (Build-Time)**

```typescript
environment: {
  CONVERSATIONS_TABLE: ssm.StringParameter.valueFromLookup(
    this,
    '/rag-app/dev/dynamodb/conversations-table'
  ),
  DOCUMENTS_TABLE: ssm.StringParameter.valueFromLookup(
    this,
    '/rag-app/dev/dynamodb/documents-table'
  ),
}
```

### Using DynamoDB Tables in Lambda Functions

**Conversations Table Example:**

```typescript
import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamodb = new DynamoDBClient({});
const conversationsTable = process.env.CONVERSATIONS_TABLE!;

// Save conversation
await dynamodb.send(new PutItemCommand({
  TableName: conversationsTable,
  Item: {
    userId: { S: userId },
    timestamp: { N: Date.now().toString() },
    message: { S: userMessage },
    response: { S: aiResponse },
    sessionId: { S: sessionId },
  },
}));

// Query user's conversation history
const result = await dynamodb.send(new QueryCommand({
  TableName: conversationsTable,
  KeyConditionExpression: 'userId = :userId',
  ExpressionAttributeValues: {
    ':userId': { S: userId },
  },
  Limit: 20,
  ScanIndexForward: false, // Most recent first
}));
```

**Documents Table Example:**

```typescript
import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamodb = new DynamoDBClient({});
const documentsTable = process.env.DOCUMENTS_TABLE!;

// Save document metadata
await dynamodb.send(new PutItemCommand({
  TableName: documentsTable,
  Item: {
    documentId: { S: documentId },
    userId: { S: userId },
    filename: { S: filename },
    s3Key: { S: s3Key },
    uploadedAt: { N: Date.now().toString() },
    status: { S: 'processing' },
    fileSize: { N: fileSize.toString() },
  },
}));

// Get document by ID
const doc = await dynamodb.send(new GetItemCommand({
  TableName: documentsTable,
  Key: {
    documentId: { S: documentId },
  },
}));

// Query user's documents using GSI
const userDocs = await dynamodb.send(new QueryCommand({
  TableName: documentsTable,
  IndexName: 'userIdIndex',
  KeyConditionExpression: 'userId = :userId',
  ExpressionAttributeValues: {
    ':userId': { S: userId },
  },
  ScanIndexForward: false, // Most recent first
}));
```

### Table Schema Details

**Conversations Table:**
```
Partition Key: userId (String)
Sort Key: timestamp (Number)

Attributes (examples):
- userId: User identifier
- timestamp: Unix timestamp in milliseconds
- message: User's message
- response: AI's response
- sessionId: Conversation session ID
- model: AI model used
- tokens: Token count
```

**Documents Table:**
```
Partition Key: documentId (String)

Global Secondary Index: userIdIndex
- Partition Key: userId (String)
- Sort Key: uploadedAt (Number)

Attributes (examples):
- documentId: Unique document identifier
- userId: User who uploaded the document
- filename: Original filename
- s3Key: S3 object key
- uploadedAt: Unix timestamp in milliseconds
- status: processing | completed | failed
- fileSize: File size in bytes
- contentType: MIME type
- vectorized: Boolean indicating if embeddings created
```

### Important Notes

1. **Platform-Managed**: Tables are created and deleted by the platform team
2. **Read/Write Access**: You have full read/write permissions via the platform-provided IAM role
3. **No Schema Changes**: You cannot modify table schema (keys, indexes, etc.)
4. **Billing Mode**: Tables use PAY_PER_REQUEST (on-demand) billing
5. **Backup**: Point-in-time recovery enabled for production tables
6. **Encryption**: AWS-managed encryption enabled by default

### Need Additional Tables?

If you need additional DynamoDB tables or schema changes:
1. Contact the platform team with your requirements
2. Platform team will create the table and add SSM parameters
3. Platform team will grant your application role access to the new table

## Deployment Process

### Prerequisites

Before deploying your application:

1. **Verify platform infrastructure is deployed**:
   ```bash
   # Check if platform parameters exist
   aws ssm get-parameters-by-path --path "/rag-app/dev/" --recursive --query 'Parameters[*].Name' --output table
   ```
   
   If no parameters are returned, contact the platform team to deploy the infrastructure first.

2. **Verify CloudFormation exports exist**:
   ```bash
   # Check if platform exports are available
   aws cloudformation list-exports --query 'Exports[?starts_with(Name, `rag-app-dev`)].Name' --output table
   ```
   
   You should see exports like `rag-app-dev-api-id`, `rag-app-dev-application-role-arn`, etc.

### Deployment Steps

1. **Push code** to `peterboddev/rag` repository
2. **Pipeline automatically**:
   - Runs `npm ci`
   - Runs `npm run test` (if present)
   - Runs `npm run build` (if present)
   - Runs `npx cdk synth` (for CDK) or `sam build` (for SAM)
   - Deploys CloudFormation template to dev/staging/prod

3. **Your resources** are deployed with access to platform services

### First Deployment Checklist

- [ ] Platform infrastructure is deployed (verify SSM parameters exist)
- [ ] CloudFormation exports are available
- [ ] Your repository structure matches the guide
- [ ] Stack ID is static: `'RAGApplicationStack'`
- [ ] Local `npx cdk synth` generates template successfully
- [ ] Template imports platform resources correctly
- [ ] Lambda functions use platform-provided IAM role
- [ ] Code is pushed to `peterboddev/rag` on `main` branch

## Critical Requirements

### Stack ID Must Match Template Path

**For CDK applications:**

```typescript
// In bin/app.ts
// ✅ CORRECT - Static stack ID
new RAGApplicationStack(app, 'RAGApplicationStack', { ... });

// ❌ WRONG - Dynamic stack ID
new RAGApplicationStack(app, `RAGApplicationStack-${Date.now()}`, { ... });
```

The stack ID determines the template filename:
- Stack ID: `'RAGApplicationStack'`
- Generates: `cdk.out/RAGApplicationStack.template.json`
- Pipeline expects: `cdk.out/RAGApplicationStack.template.json` ✅

### Build Commands

Your repository should support these npm scripts:

```json
{
  "scripts": {
    "test": "jest",           // Optional - runs tests
    "build": "tsc",           // Optional - compiles TypeScript
    "synth": "cdk synth"      // Required for CDK apps
  }
}
```

## Testing Locally

Before pushing to repository:

```bash
# Install dependencies
npm ci

# Run tests
npm run test

# Build application
npm run build

# Synthesize CDK (for CDK apps)
npx cdk synth

# Verify template exists
ls cdk.out/RAGApplicationStack.template.json
```

## What NOT to Create

❌ **DO NOT create these** (platform provides them):
- VPC or networking resources
- OpenSearch Serverless collections
- Cognito user pools
- S3 buckets for platform services (documents, website, config)
- API Gateway REST API (you only add methods)
- IAM roles for Lambda (use platform-provided role)
- DynamoDB tables (platform creates and manages them)

✅ **YOU SHOULD create these**:
- Lambda functions
- API Gateway methods and integrations
- Application-specific resources (if needed)

## Troubleshooting

### "Platform Infrastructure Not Found" Error

**Symptoms**: 
- CloudFormation import fails with "Export not found"
- SSM parameter lookup returns empty
- Lambda deployment fails with "Role not found"

**Cause**: Platform infrastructure hasn't been deployed yet

**Solution**:
1. Verify platform deployment:
   ```bash
   aws ssm get-parameters-by-path --path "/rag-app/dev/" --recursive --query 'Parameters[*].Name'
   ```
2. If empty, contact platform team to deploy RAG infrastructure stack
3. Platform team should run:
   ```bash
   cdk deploy RAGInfrastructureStack --context applicationName=rag-app --context environment=dev
   ```

### "Template file not found" Error

**Cause**: Stack ID doesn't match `templatePath` in pipeline config

**Solution**:
1. Check your stack ID in `bin/app.ts`
2. Run `npx cdk synth` locally
3. Verify file exists: `ls cdk.out/RAGApplicationStack.template.json`
4. Ensure stack ID is static (no timestamps or variables)

### "Permission Denied" Errors

**Cause**: Lambda function needs additional permissions

**Solution**: Contact platform team to add permissions to the platform-provided IAM role

### "Resource Not Found" Errors

**Cause**: Trying to import non-existent CloudFormation export

**Solution**:
1. Verify platform infrastructure is deployed:
   ```bash
   aws cloudformation list-exports --query 'Exports[?starts_with(Name, `rag-app-dev`)].Name'
   ```
2. Check export name matches: `rag-app-{env}-{resource}`
3. Ensure you're in the correct AWS region (us-east-1)
4. If exports don't exist, contact platform team

## Support

- **Platform Infrastructure**: Contact platform team
- **Pipeline Issues**: Contact platform team
- **Application Code**: Your team's responsibility

## Summary Checklist

### Before You Start
- [ ] Platform infrastructure is deployed (verify with SSM parameter check)
- [ ] CloudFormation exports are available
- [ ] You have AWS CLI access to the target account/region

### Repository Setup
- [ ] Repository structure matches guide
- [ ] Stack ID is `'RAGApplicationStack'` (static, no variables)
- [ ] `cdk.json` or `template.yaml` configured correctly
- [ ] Lambda functions use platform-provided IAM role (imported via CloudFormation)
- [ ] API methods added to platform-provided API Gateway (imported via CloudFormation)
- [ ] No infrastructure resources (VPC, databases, etc.) in your stack

### Testing & Deployment
- [ ] Local `npx cdk synth` generates correct template file
- [ ] Template imports match platform exports: `rag-app-{env}-{resource}`
- [ ] Code pushed to `peterboddev/rag` repository on `main` branch
- [ ] Pipeline executes successfully

## Platform Team Contact

If you encounter issues with:
- **Missing SSM parameters**: Platform infrastructure not deployed
- **Missing CloudFormation exports**: Platform infrastructure not deployed
- **IAM permission errors**: Platform role needs additional permissions
- **Infrastructure questions**: Contact platform team for guidance

The platform team is responsible for:
- Deploying and maintaining the RAG infrastructure stack
- Managing SSM parameters and CloudFormation exports
- Updating IAM roles with required permissions
- Providing infrastructure support and troubleshooting

# Repository Architecture and Hardcoded Values

## Repository Purpose

This repository serves a **dual purpose**:

1. **Platform Pipeline Infrastructure** - Manages CI/CD pipelines for application teams
2. **RAG Platform Infrastructure** - Provides foundational AI/ML services that application teams consume

## Critical Architecture Distinction

### Platform-Provided Infrastructure (This Repository)

The RAG infrastructure code in this repository (`lib/rag-infrastructure-stack.ts`) is **platform-owned** and provides foundational services:

- **Networking**: VPC, subnets, security groups
- **AI Services**: AWS Bedrock Nova Pro, embeddings
- **Vector Database**: OpenSearch Serverless
- **Storage**: S3 buckets for documents, configuration, website
- **Authentication**: Cognito user pools and identity pools
- **Document Processing**: Textract integration, processing pipelines
- **Knowledge Base**: AWS Bedrock Knowledge Base
- **Monitoring**: CloudWatch dashboards and alarms

**Deployment**: Platform team deploys this infrastructure directly (not through application pipeline)

### Application Team Responsibilities

Application teams (like the RAG app team) should **only** create:

- **Lambda Functions**: API endpoints and business logic
- **API Gateway**: REST/HTTP APIs with methods and integrations
- **Frontend Code**: React/Vue/Angular applications
- **Integration Logic**: Code that calls platform-provided services

**What App Teams Should NOT Create**:
- ❌ VPC or networking infrastructure
- ❌ Vector databases or OpenSearch collections
- ❌ Cognito user pools
- ❌ S3 buckets for platform services
- ❌ Bedrock Knowledge Bases
- ❌ Document processing pipelines

**Deployment**: Application code is deployed through the application pipeline

## Configuration Clarification

### Current Configuration Issue

The `config/applications/rag-app.json` currently points to:
```json
"templatePath": "cdk.out/RAGInfrastructureStack.template.json"
```

This is **incorrect** if the app team repository (`peterboddev/rag`) is supposed to only contain application code.

### Correct Architecture

**Option 1: Separate Repositories (Recommended)**

1. **Platform Repository** (this repo: `peterboddev/rag_platform`):
   - Contains `RAGInfrastructureStack`
   - Deployed directly by platform team
   - No application pipeline needed for this

2. **Application Repository** (`peterboddev/rag`):
   - Contains Lambda functions, API Gateway, frontend
   - Deployed via application pipeline
   - Configuration should point to application stack:
   ```json
   "templatePath": "cdk.out/RAGApplicationStack.template.json"
   ```

**Option 2: Monorepo with Clear Separation**

If keeping both in one repository:
- Platform infrastructure: Deployed via `cdk deploy RAGInfrastructureStack` (manual/separate pipeline)
- Application code: Deployed via application pipeline pointing to application stack

## How Application Teams Use Platform Services

Application teams consume platform services by:

1. **Retrieving Configuration**: Get service endpoints from SSM Parameter Store or S3
   ```bash
   aws ssm get-parameter --name "/rag-app-v2/dev/opensearch/collection-endpoint"
   ```

2. **Using SDK in Lambda Functions**: Call platform services directly
   ```typescript
   // Lambda function calling Bedrock Nova Pro
   const response = await bedrockClient.send(new InvokeModelCommand({
     modelId: "amazon.nova-pro-v1:0",
     body: JSON.stringify({ messages: [...] })
   }));
   ```

3. **IAM Permissions**: Platform team grants necessary permissions to application roles

See `.kiro/steering/rag-platform-integration.md` for complete integration guide.

## Hardcoded Values Analysis

### Platform Code (Intentionally Hardcoded - Correct)

These stack names are hardcoded in the platform pipeline code and are **correct**:

**File**: `bin/platform-pipeline.ts`
- `PlatformSecurityStack` - Security and IAM infrastructure for the platform
- `PlatformPipelineStack` - The platform pipeline that manages application pipelines

**Why hardcoded?** These are platform-owned infrastructure components that should have consistent, predictable names. They are not application-specific.

### Application Code (Dynamic - Configurable)

Application stack names are **dynamic** and configured per application:

**File**: `lib/constructs/application-pipeline-construct.ts`
```typescript
stackName: target.stackName  // From config: "rag-app-dev", "my-app-prod", etc.
```

**Configuration**: `config/applications/*.json`
```json
{
  "deploymentTargets": [
    {
      "name": "dev",
      "stackName": "rag-app-dev"  // Application team chooses this
    }
  ]
}
```

**Why dynamic?** Each application team chooses their own stack names based on their naming conventions.

## RAG Application Code in This Repository

### The Issue

The RAG application infrastructure code (`lib/rag-infrastructure-stack.ts`) is included in this repository as an **example** but was causing confusion:

**Original Problem** (FIXED):
```typescript
// bin/rag-infrastructure.ts - BEFORE FIX
const timestamp = Date.now();
new RAGInfrastructureStack(app, `RAGInfrastructureStack-v2-${timestamp}`, { ... });
// Creates: RAGInfrastructureStack-v2-1709740123456.template.json
```

**Config Expected**:
```json
"templatePath": "cdk.out/RAGInfrastructureStack.template.json"
```

**Result**: Mismatch - pipeline looks for `RAGInfrastructureStack.template.json` but CDK creates `RAGInfrastructureStack-v2-{timestamp}.template.json`

### The Fix

**File**: `bin/rag-infrastructure.ts` - AFTER FIX
```typescript
// Removed timestamp to create consistent stack ID
new RAGInfrastructureStack(app, 'RAGInfrastructureStack', { ... });
// Creates: RAGInfrastructureStack.template.json
```

Now the stack ID matches the templatePath configuration.

## Critical Rule: Stack ID Must Match Template Path

For CDK applications, the stack ID in your CDK app determines the template filename:

```typescript
// CDK App (bin/app.ts)
new MyStack(app, 'MyStackName', { ... });
// Generates: cdk.out/MyStackName.template.json

// Pipeline Config (config/applications/app.json)
{
  "templatePath": "cdk.out/MyStackName.template.json"  // Must match!
}
```

**Common Mistakes**:
- ❌ Using dynamic stack IDs with timestamps or random suffixes
- ❌ Using different stack IDs in different environments
- ❌ Forgetting to update templatePath after renaming stack

**Best Practice**:
- ✅ Use static, descriptive stack IDs
- ✅ Keep stack ID consistent across all environments
- ✅ Run `cdk synth` locally first to verify template filename
- ✅ Update templatePath in config to match actual template filename

## Repository Structure

```
platform-pipeline/
├── bin/
│   ├── platform-pipeline.ts       # Platform pipeline entry point (PLATFORM CODE)
│   ├── rag-infrastructure.ts      # RAG app entry point (EXAMPLE APP CODE)
│   └── rag-*.ts                   # Other RAG variations (EXAMPLE APP CODE)
├── lib/
│   ├── platform-pipeline-stack.ts # Platform pipeline stack (PLATFORM CODE)
│   ├── security-stack.ts          # Platform security stack (PLATFORM CODE)
│   ├── rag-infrastructure-stack.ts # RAG app stack (EXAMPLE APP CODE)
│   ├── constructs/
│   │   ├── application-pipeline-construct.ts  # Platform construct (PLATFORM CODE)
│   │   ├── codeconnections-construct.ts       # Platform construct (PLATFORM CODE)
│   │   ├── monitoring-construct.ts            # Platform construct (PLATFORM CODE)
│   │   └── [rag-specific constructs]          # RAG app constructs (EXAMPLE APP CODE)
│   └── config/                    # Configuration management (PLATFORM CODE)
└── config/
    └── applications/
        └── rag-app.json           # RAG app configuration (EXAMPLE APP CONFIG)
```

## Separation of Concerns

### Platform Code (What Platform Team Maintains)
- Pipeline infrastructure (`PlatformPipelineStack`, `PlatformSecurityStack`)
- Application pipeline construct (`ApplicationPipelineConstruct`)
- Configuration management (`ConfigurationManager`)
- CodeConnections integration
- Security and IAM roles

### Application Code (What Application Teams Maintain)
- Application infrastructure stacks (like `RAGInfrastructureStack`)
- Application-specific constructs
- Application configuration files
- Application source code repositories

### Current State

This repository currently contains **both** platform and application code. This is acceptable for:
- Demonstration purposes
- Platform team testing
- Monorepo architectures

However, for production use, consider:
- Moving RAG application code to separate repository (`peterboddev/rag`)
- Keeping only platform pipeline code in this repository
- Using the application pipeline to deploy from the separate repository

## Configuration Best Practices

### For Platform Team

1. **Platform stack names are hardcoded** - This is correct and intentional
2. **Application configurations are dynamic** - Each app team configures their own
3. **Security roles are centralized** - Managed by platform team
4. **Pipeline patterns are standardized** - Enforced through constructs

### For Application Teams

1. **Choose static stack IDs** - No timestamps or random suffixes
2. **Match templatePath to stack ID** - Run `cdk synth` locally to verify
3. **Don't set NODE_ENV=production** - If your build runs tests
4. **Include cdk synth in build** - Required for CDK applications
5. **Test locally first** - Run `npm run build && npx cdk synth` before pushing

## Summary

**Hardcoded Values**: Only platform stack names (`PlatformSecurityStack`, `PlatformPipelineStack`) are hardcoded, which is correct.

**Application Values**: All application-specific values (stack names, template paths, etc.) are configurable and dynamic.

**The Primary Fix**: Removed timestamp from RAG application stack ID to match the templatePath configuration, ensuring consistent template filenames.

**NODE_ENV=production**: Can be used in application builds if:
- The application doesn't run tests during build (uses `--if-present` flags)
- OR the application explicitly installs devDependencies with `npm ci --include=dev`
- The RAG app uses `--if-present` for tests, so NODE_ENV=production is acceptable

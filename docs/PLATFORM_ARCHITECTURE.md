# Platform Architecture Guide

## Overview

This repository serves a **dual purpose** as both a pipeline management system and a platform infrastructure provider. It enables platform engineers to manage CI/CD pipelines for application teams while also providing foundational AWS infrastructure services that applications can consume.

## Dual-Purpose Architecture

### Purpose 1: Pipeline Management System

**What it does**: Creates and manages CI/CD pipelines for application teams

**Key Components**:
- **Platform Pipeline** (`PlatformPipelineStack`) - Self-managing pipeline that deploys application pipelines
- **Application Pipeline Factory** (`ApplicationPipelineConstruct`) - Creates standardized pipelines for each app team
- **Configuration Management** - Hybrid loader supporting both file-based and CDK context configs
- **CodeConnections Integration** - Secure GitHub integration with immediate triggering

**How it works**:
1. Platform team maintains this repository with pipeline infrastructure code
2. Platform pipeline deploys/updates application pipelines using CDK
3. Each application team gets their own pipeline configured via `config/applications/*.json`
4. Application pipelines build and deploy application code from app team repositories

### Purpose 2: Platform Infrastructure Provider

**What it does**: Provides foundational AWS services that application teams consume

**Key Components**:
- **Network Infrastructure** - VPC, subnets, security groups, VPC endpoints
- **AI Services** - AWS Bedrock Nova Pro, embedding models
- **Vector Database** - OpenSearch Serverless for document embeddings
- **Authentication** - Cognito user pools and identity management
- **Storage** - S3 buckets for documents, configuration, and website hosting
- **Data Storage** - DynamoDB IAM roles (Aurora optional)
- **API Gateway** - Platform-provided REST API with Cognito authorizer
- **Application Integration** - IAM roles with permissions for Bedrock, Textract, OpenSearch, S3, DynamoDB
- **Monitoring** - CloudWatch dashboards and alerting

**How it works**:
1. Platform team deploys RAG infrastructure stack (`RAGInfrastructureStack`)
2. Infrastructure provides foundational services (VPC, Bedrock, Vector DB, Cognito, API Gateway)
3. Application teams write Lambda functions and API Gateway methods/integrations
4. Application teams deploy through platform-provided pipelines
5. Applications automatically get IAM roles with access to platform services

## Repository Structure

```
rag_platform/
├── bin/
│   ├── platform-pipeline.ts          # Platform pipeline CDK app entry point
│   └── rag-infrastructure.ts         # RAG infrastructure CDK app entry point
├── lib/
│   ├── platform-pipeline-stack.ts    # Platform pipeline infrastructure
│   ├── rag-infrastructure-stack.ts   # RAG platform infrastructure
│   ├── security-stack.ts             # Shared security infrastructure
│   ├── config/                       # Configuration management
│   │   ├── platform-config.ts        # Configuration manager
│   │   ├── configuration-loaders.ts  # Hybrid config loader
│   │   └── schemas/                  # JSON schemas for validation
│   └── constructs/                   # Reusable CDK constructs
│       ├── application-pipeline-construct.ts    # App pipeline factory
│       ├── application-pipeline-stage.ts        # App pipeline deployment stage
│       ├── codeconnections-construct.ts         # GitHub integration
│       ├── monitoring-construct.ts              # Pipeline monitoring
│       ├── network-infrastructure.ts            # VPC and networking
│       ├── bedrock-ai-services.ts               # Bedrock integration
│       ├── vector-database.ts                   # OpenSearch Serverless
│       ├── s3-storage.ts                        # S3 buckets
│       ├── data-storage.ts                      # DynamoDB and Aurora
│       ├── cognito-authentication.ts            # User authentication
│       ├── api-gateway.ts                       # Platform API Gateway
│       └── application-integration.ts           # IAM roles for apps
├── config/
│   └── applications/                 # Application pipeline configurations
│       ├── rag-app.json             # RAG application config
│       ├── example-cdk-app.json     # CDK app example
│       └── example-sam-app.json     # SAM app example
├── docs/                             # Documentation
│   ├── PLATFORM_ARCHITECTURE.md     # This file - architecture overview
│   ├── rag-app-team-guide.md        # Guide for application teams
│   ├── application-pipeline-configuration.md  # Pipeline config guide
│   └── repository-architecture.md   # Detailed architecture docs
├── .kiro/
│   ├── specs/                        # Feature specifications
│   └── steering/                     # Development guidelines
├── cdk.json                          # Platform configuration
├── buildspec.yml                     # Platform pipeline build spec
└── package.json                      # Dependencies
```

## Architecture Patterns

### Two-Tier Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Platform Repository                       │
│                  (peterboddev/rag_platform)                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Platform Pipeline (CodePipeline)            │    │
│  │  - Triggered by platform team commits              │    │
│  │  - Deploys application pipeline infrastructure     │    │
│  │  - Uses CDK to manage pipelines                    │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          │ Deploys/Manages                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │    Application Pipelines (Multiple CodePipelines)  │    │
│  │  - One per application team                        │    │
│  │  - Configured via config/applications/*.json       │    │
│  │  - Standardized build and deployment stages        │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Builds/Deploys
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Application Repositories                        │
│           (e.g., peterboddev/rag)                           │
│                                                              │
│  - Application code (Lambda functions, frontend, etc.)      │
│  - Can use CDK, SAM, or any tool that generates            │
│    CloudFormation templates                                 │
│  - Deployed through platform-provided pipelines             │
└─────────────────────────────────────────────────────────────┘
```

### Platform Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              RAG Platform Infrastructure                     │
│           (Deployed by Platform Team)                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Network    │  │  AI Services │  │    Vector    │     │
│  │     VPC      │  │   Bedrock    │  │   Database   │     │
│  │   Subnets    │  │  Nova Pro    │  │  OpenSearch  │     │
│  │  Security    │  │  Embeddings  │  │  Serverless  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │     Auth     │  │   Storage    │  │  API Gateway │     │
│  │   Cognito    │  │  S3 Buckets  │  │  (Platform)  │     │
│  │  User Pools  │  │   DynamoDB   │  │  + Cognito   │     │
│  │ Identity Pool│  │              │  │  Authorizer  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │        Application Integration Layer              │      │
│  │  - IAM roles for Lambda functions                │      │
│  │  - Permissions: Bedrock, Textract, OpenSearch    │      │
│  │  - SSM parameters for configuration              │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Consumed by
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Application Team Code                           │
│                                                              │
│  - Lambda functions (business logic)                        │
│  - API Gateway methods and integrations                     │
│  - Frontend applications (React, Vue, etc.)                 │
│  - Uses platform-provided infrastructure                    │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Platform Team Responsibilities

**Pipeline Management**:
- Maintain platform pipeline infrastructure code
- Create and configure application pipelines
- Enforce standardized patterns and security policies
- Monitor pipeline health and performance

**Infrastructure Provisioning**:
- Deploy and maintain foundational AWS services
- Provide VPC, networking, and security infrastructure
- Manage AI services (Bedrock, OpenSearch)
- Provide authentication and storage services
- Create API Gateway with Cognito authorizer
- Configure IAM roles with appropriate permissions

### Application Team Responsibilities

**Application Development**:
- Write application code (Lambda functions, frontend)
- Create API Gateway methods and integrations (using platform-provided API Gateway)
- Implement business logic and user interfaces
- Use platform-provided infrastructure services

**Deployment**:
- Push code to application repository
- Application pipeline automatically builds and deploys
- Can use CDK, SAM, or any tool that generates CloudFormation templates
- Configure deployment via `config/applications/{app-name}.json`

### What Platform Provides vs What App Teams Build

| Component | Platform Provides | App Teams Build |
|-----------|-------------------|-----------------|
| **Pipelines** | Pipeline infrastructure, CodeBuild configs | Application code |
| **Networking** | VPC, subnets, security groups, VPC endpoints | Nothing (uses platform VPC) |
| **AI Services** | Bedrock Nova Pro, embedding models | Lambda functions that call Bedrock |
| **Vector DB** | OpenSearch Serverless collection | Code to store/query embeddings |
| **Authentication** | Cognito user pools, identity pools | Login UI, auth integration |
| **Storage** | S3 buckets, DynamoDB IAM roles | Application data models |
| **API Gateway** | REST API with Cognito authorizer | Methods, integrations, Lambda functions |
| **IAM Roles** | Lambda execution roles with permissions | Nothing (automatically provided) |
| **Monitoring** | CloudWatch dashboards, alarms | Application-specific metrics |

## Configuration Architecture

### Hybrid Configuration Loading

The platform uses a hybrid configuration approach:

**Platform Configuration** (`cdk.json`):
- Platform-level settings (region, account, defaults)
- Environment definitions (dev, staging, prod)
- Platform repository configuration

**Application Configurations** (`config/applications/*.json`):
- Application-specific settings (source repo, build config)
- Deployment targets and environment mappings
- Template paths for CDK/SAM applications
- Fallback to CDK context if files don't exist

**Example Application Config**:
```json
{
  "applicationName": "rag-app",
  "team": "ai-team",
  "sourceRepo": {
    "owner": "peterboddev",
    "repo": "rag",
    "branch": "main"
  },
  "buildConfig": {
    "runtime": "20",
    "commands": [
      "npm ci",
      "npm run test --if-present",
      "npm run build --if-present",
      "npx cdk synth --if-present"
    ],
    "environment": {
      "NPM_CONFIG_CACHE": "/tmp/.npm"
    }
  },
  "templatePath": "cdk.out/RAGApplicationStack.template.json",
  "deploymentTargets": ["dev", "staging", "prod"],
  "enabled": true
}
```

## Technical Standards

### Runtime Environment

- **Node.js**: Version 20 (LTS)
- **npm**: Version 11.6.2+
- **TypeScript**: Version 5.2.2+
- **CDK**: Version 2.233.0+

### CodeBuild Configuration

- **Build Image**: `AMAZON_LINUX_2_STANDARD_3_0` (ARM-based)
- **Architecture**: ARM64 for better price/performance
- **Compute Type**: `X_LARGE` (32 vCPUs, 64 GiB memory)
- **Runtime**: Node.js 20 pre-installed

### Pipeline Configuration

- **Pipeline Type**: V2 (required for CodeConnections)
- **Self-Mutation**: Disabled (prevents infinite loops)
- **Triggers**: Native CodeConnections (no EventBridge needed)
- **Connection Type**: CodeConnections (aws.codeconnections)

### Security Standards

- **Credentials**: CodeConnections for GitHub, IAM roles for AWS
- **Encryption**: KMS encryption for data at rest and in transit
- **IAM**: Least-privilege roles for all services
- **Network**: VPC endpoints for private AWS service access

## Development Workflows

### Platform Team Workflow

1. **Make Infrastructure Changes**:
   - Modify CDK code in `lib/` directory
   - Update configurations in `cdk.json` or `config/applications/`
   - Test locally with `npm run build && npm test`

2. **Preview Changes**:
   ```bash
   cdk diff PlatformPipelineStack
   cdk diff RAGInfrastructureStack-dev
   ```

3. **Deploy Changes**:
   ```bash
   # Deploy platform pipeline changes
   cdk deploy PlatformPipelineStack
   
   # Deploy infrastructure changes
   cdk deploy RAGInfrastructureStack-dev
   ```

4. **Monitor Deployment**:
   - Check CloudWatch logs: `/aws/codebuild/PlatformPipeline-Synth`
   - Monitor pipeline: AWS Console → CodePipeline → PlatformPipeline

### Application Team Workflow

1. **Get Platform Configuration**:
   ```bash
   # Download configuration from S3
   aws s3 cp s3://rag-app-config-dev/config/dev/rag-infrastructure-config.json ./config.json
   
   # Or retrieve from SSM Parameter Store
   aws ssm get-parameter --name "/rag-app/dev/opensearch/collection-endpoint"
   aws ssm get-parameter --name "/rag-app/dev/cognito/user-pool-id"
   ```

2. **Develop Application**:
   - Write Lambda functions using platform-provided IAM roles
   - Create API Gateway methods/integrations (using platform API Gateway)
   - Build frontend using platform-provided Cognito and API Gateway
   - Use CDK, SAM, or any tool that generates CloudFormation templates

3. **Configure Pipeline**:
   - Platform team creates `config/applications/{app-name}.json`
   - Specify source repository, build commands, template path
   - Configure deployment targets (dev, staging, prod)

4. **Deploy Application**:
   - Push code to application repository
   - Application pipeline automatically triggers
   - Pipeline builds and deploys to configured environments

## Completed Features

### ✅ CDK Template Deployment Support
- **Issue**: Pipeline only supported SAM `template.yaml`, not CDK `.template.json`
- **Solution**: Added `templatePath` configuration field
- **Status**: Implemented and tested
- **Spec**: `.kiro/specs/cdk-template-deployment-fix/` (archived)

### ✅ Pipeline Loop Prevention
- **Issue**: Self-mutating pipeline with explicit triggers caused infinite loops
- **Solution**: Disabled self-mutation, use default CodeConnections triggers
- **Status**: Resolved
- **Spec**: `.kiro/specs/pipeline-loop-fix/` (archived)

### ✅ Configuration Separation
- **Issue**: Single `cdk.json` mixed platform and application configs
- **Solution**: Hybrid loader with file-based application configs
- **Status**: Implemented
- **Spec**: `.kiro/specs/pipeline-configuration-separation/` (archived)

### ✅ Pipeline Validation Fixes
- **Issue**: CodeBuild image and config loading mismatches
- **Solution**: ARM images, hybrid config loader in validation scripts
- **Status**: Mostly complete
- **Spec**: `.kiro/specs/pipeline-validation-fixes/`

## Active Development

### 🔄 RAG Platform Infrastructure
- **Status**: Core infrastructure deployed and operational
- **Completed**: VPC, Bedrock, Vector DB, Cognito, S3, API Gateway, IAM roles
- **Remaining**: Knowledge Base, Document Processing, Configuration Export, Monitoring
- **Spec**: `.kiro/specs/rag-platform-infrastructure/`

### 📋 Planned Features

**Dynamic Integration Guide**:
- Tool for retrieving configuration values from deployed stacks
- Multiple output formats (JSON, .env, shell exports)
- Automated template generation with real values
- **Spec**: `.kiro/specs/dynamic-integration-guide/`

**AWS Security Agent Integration**:
- Automated security scanning in pipelines
- Local IDE scanning support
- Secrets detection and vulnerability scanning
- **Spec**: `.kiro/specs/aws-security-agent-integration/`

## Common Patterns

### Adding a New Application

1. **Create Configuration File**:
   ```bash
   # Create config/applications/my-app.json
   {
     "applicationName": "my-app",
     "team": "my-team",
     "sourceRepo": {
       "owner": "my-org",
       "repo": "my-app-repo",
       "branch": "main"
     },
     "buildConfig": {
       "runtime": "20",
       "commands": [
         "npm ci",
         "npm run test --if-present",
         "npm run build --if-present",
         "npx cdk synth --if-present"
       ]
     },
     "templatePath": "cdk.out/MyAppStack.template.json",
     "deploymentTargets": ["dev", "staging"],
     "enabled": true
   }
   ```

2. **Deploy Platform Pipeline**:
   ```bash
   cdk deploy PlatformPipelineStack
   ```

3. **Authorize CodeConnections**:
   - Go to AWS Console → CodePipeline → Settings → Connections
   - Find `my-app-github` connection (PENDING status)
   - Click "Update pending connection" and authorize

4. **Application Team Pushes Code**:
   - Application pipeline automatically triggers
   - Builds and deploys to configured environments

### Deploying Platform Infrastructure

1. **Initial Bootstrap** (first time only):
   ```bash
   cdk deploy RAGInfrastructureStack-dev
   ```

2. **Future Updates** (via platform pipeline):
   - Modify infrastructure code in `lib/rag-infrastructure-stack.ts`
   - Push to platform repository
   - Platform pipeline automatically deploys changes

### Accessing Platform Services from Applications

**Lambda Function Example**:
```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export const handler = async (event) => {
  // IAM role automatically provided by platform
  const client = new BedrockRuntimeClient({ region: "us-east-1" });
  
  const response = await client.send(new InvokeModelCommand({
    modelId: "amazon.nova-pro-v1:0",
    body: JSON.stringify({
      messages: [{ role: "user", content: [{ text: "Hello" }] }],
      inferenceConfig: { max_new_tokens: 1000 }
    })
  }));
  
  return { statusCode: 200, body: response.body };
};
```

## Troubleshooting

### Pipeline Issues

**Pipeline not triggering**:
- Check CodeConnections status (must be "Available", not "PENDING")
- Verify repository and branch configuration
- Check CloudTrail for connection events

**Build failures**:
- Check CodeBuild logs: `/aws/codebuild/PlatformPipeline-Synth`
- Verify Node.js 20 and npm 11+ are being used
- Ensure `NODE_ENV` is NOT set in build/test stages (let npm use default behavior)
- Verify repository contains all necessary files

**Template not found errors**:
- Verify `templatePath` in application config matches actual template name
- Check build artifacts include template files
- Ensure CDK synthesis completed successfully

### Infrastructure Issues

**Permission denied errors**:
- Verify Lambda functions deployed via application pipeline
- Check IAM roles have required permissions
- Contact platform team for infrastructure access issues

**Vector database connection issues**:
- Verify OpenSearch endpoint from CloudFormation exports
- Check VPC configuration for Lambda functions
- Ensure proper AWS SDK configuration

## Key Decisions and Trade-offs

### Self-Mutation Disabled
- **Decision**: Disabled self-mutation in platform pipeline
- **Reason**: Prevents infinite loop issues
- **Trade-off**: Platform changes require manual CDK deployment
- **Benefit**: Simpler, more predictable pipeline behavior

### Hybrid Configuration Loading
- **Decision**: Support both file-based and CDK context configs
- **Reason**: Smooth migration path, backward compatibility
- **Trade-off**: Slightly more complex configuration loading logic
- **Benefit**: Flexibility and easier application onboarding

### ARM-based CodeBuild Images
- **Decision**: Use ARM64 architecture for all builds
- **Reason**: Better price/performance ratio, native Node.js 20 support
- **Trade-off**: Some legacy packages may not support ARM
- **Benefit**: 20% cost savings, faster builds, future-proof

### Platform-Provided API Gateway
- **Decision**: Platform creates API Gateway, app teams add methods
- **Reason**: Centralized authentication, consistent patterns
- **Trade-off**: Less flexibility for app teams
- **Benefit**: Standardized security, easier integration

## References

- **Application Team Guide**: `docs/rag-app-team-guide.md`
- **Pipeline Configuration**: `docs/application-pipeline-configuration.md`
- **Repository Architecture**: `docs/repository-architecture.md`
- **Node.js Environment**: `.kiro/steering/nodejs-environment-ci-cd.md`
- **Platform Architecture**: `.kiro/steering/platform-pipeline-architecture.md`

## Getting Started

### For Platform Engineers
1. Review this architecture guide
2. Understand dual-purpose nature of repository
3. Read steering documents in `.kiro/steering/`
4. Review active specs in `.kiro/specs/`

### For Application Teams
1. Read `docs/rag-app-team-guide.md`
2. Retrieve platform configuration values
3. Review example applications in `config/applications/`
4. Contact platform team for pipeline configuration

---

**Last Updated**: March 6, 2026  
**Repository**: peterboddev/rag_platform  
**Platform Team**: Platform Engineering

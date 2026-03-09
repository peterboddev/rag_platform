# Platform Pipeline and Infrastructure System

This repository serves a **dual purpose**: it provides both a CI/CD pipeline management system for application teams AND foundational AWS infrastructure services that applications consume.

**See `docs/PLATFORM_ARCHITECTURE.md` for comprehensive architecture documentation.**

## What This Repository Provides

### 1. Pipeline Management System
- **Platform Pipeline**: Self-managing pipeline that deploys application pipelines
- **Application Pipelines**: Standardized CI/CD pipelines for each application team
- **Configuration Management**: Hybrid loader supporting file-based and CDK context configs
- **CodeConnections Integration**: Immediate triggering on push events
- **Monitoring**: CloudWatch integration with failure notifications

### 2. Platform Infrastructure Services
- **Network Infrastructure**: VPC, subnets, security groups, VPC endpoints
- **AI Services**: AWS Bedrock Nova Pro, embedding models
- **Vector Database**: OpenSearch Serverless for document embeddings
- **Authentication**: Cognito user pools and identity management
- **Storage**: S3 buckets, DynamoDB IAM roles
- **API Gateway**: Platform-provided REST API with Cognito authorizer
- **Application Integration**: IAM roles with Bedrock, Textract, OpenSearch, S3, DynamoDB access

### Architecture Overview

**Two-Tier Pipeline System**:
1. **Platform Pipeline** → Manages application pipeline infrastructure
2. **Application Pipelines** → Build and deploy application code

**Platform Infrastructure**:
- Platform team deploys foundational services (VPC, Bedrock, Vector DB, Cognito, API Gateway)
- Application teams write Lambda functions and API Gateway methods
- Applications automatically get IAM roles with access to platform services

**See `docs/PLATFORM_ARCHITECTURE.md` for detailed architecture diagrams and patterns.**

## Prerequisites

- Node.js 20 or later (LTS recommended)
- npm 10.8+ (comes with Node.js 20)
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed globally (`npm install -g aws-cdk`)

## Getting Started

### Initial Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure GitHub Integration** (Required):
   
   Create a CodeConnections connection in AWS Console:
   - Go to AWS CodePipeline → Settings → Connections
   - Create a new connection to GitHub
   - Copy the connection ARN
   
   Set the connection ARN in CDK context:
   ```bash
   # Option 1: Set in cdk.json context
   # Add "connectionArn": "arn:aws:codeconnections:region:account:connection/connection-id" to cdk.json
   
   # Option 2: Pass as context parameter
   npx cdk deploy --context connectionArn=arn:aws:codeconnections:region:account:connection/connection-id
   ```

3. **Bootstrap your AWS environment** (first time only):
   ```bash
   npm run bootstrap
   ```

4. **Deploy the platform pipeline** (creates EventBridge integration):
   ```bash
   npm run deploy
   ```

   This automatically sets up immediate pipeline triggering - no additional configuration needed!

### Development Workflow

1. **Make changes** to CDK infrastructure code

2. **Preview changes** before deployment:
   ```bash
   npm run diff
   ```

3. **Test locally**:
   ```bash
   npm test
   ```

4. **Push changes** (triggers pipeline immediately):
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```
   
   The EventBridge rule will trigger the pipeline immediately!

### Pipeline Triggering

This project includes **direct EventBridge integration** for immediate pipeline triggering:

- **Native CodeConnections Triggers**: Direct integration, no EventBridge needed
- **No Configuration Required**: Works automatically with existing CodeConnections connection
- **Immediate Execution**: No polling delay
- **Minimal Infrastructure**: Uses native CodePipeline triggers
- **Monitored**: CodePipeline metrics and CloudTrail logs

### Available Scripts

- `npm run build` - Compile TypeScript code
- `npm run watch` - Watch for changes and compile automatically
- `npm test` - Run unit tests
- `npm run diff` - Show differences between deployed stack and current code
- `npm run synth` - Synthesize CloudFormation templates
- `npm run deploy` - Deploy the platform pipeline (includes webhook infrastructure)
- `npm run bootstrap` - Bootstrap CDK in your AWS environment

## Project Structure

```
├── bin/                    # CDK app entry points
├── lib/                    # CDK stack definitions
├── config/                 # Application configurations
│   └── applications/       # Application pipeline configurations
├── docs/                   # Documentation
├── test/                   # Unit tests
├── buildspec.yml          # CodeBuild specification
├── cdk.json               # CDK configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Node.js dependencies
```

## Application Configuration

Application pipelines are configured using JSON files in `config/applications/`. The platform supports both SAM and CDK-based applications:

### SAM Applications

SAM applications use the default `template.yaml` convention and don't require additional configuration:

```json
{
  "applicationName": "my-sam-app",
  "sourceRepo": { "owner": "org", "repo": "app", "branch": "main" },
  "buildConfig": { "runtime": "20", "commands": ["npm ci", "sam build"] },
  "deploymentTargets": ["dev", "staging", "prod"]
}
```

### CDK Applications

CDK applications must specify the `templatePath` to their synthesized CloudFormation template:

```json
{
  "applicationName": "my-cdk-app",
  "sourceRepo": { "owner": "org", "repo": "app", "branch": "main" },
  "buildConfig": { 
    "runtime": "20", 
    "commands": ["npm ci", "npm run build", "npx cdk synth"] 
  },
  "templatePath": "cdk.out/MyStack.template.json",
  "deploymentTargets": ["dev", "staging", "prod"]
}
```

**See `docs/application-pipeline-configuration.md` for detailed configuration guide.**

## Security

- GitHub credentials are stored locally in `.git_credentials` file (excluded from version control)
- IAM roles follow least-privilege principles
- All sensitive data is encrypted in transit and at rest

## Contributing

1. Make changes to CDK infrastructure code
2. Test locally using `npm run diff` and `npm test`
3. Commit and push changes:
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```
4. **Pipeline triggers immediately** - no waiting for polling!
5. Platform pipeline automatically deploys application pipeline updates

## Immediate Pipeline Triggering

This project uses **native CodeConnections triggers** to eliminate polling delays:

- **Native Pipeline Triggers**: CodeConnections triggers CodePipeline directly on push events
- **No EventBridge Required**: Uses built-in CodePipeline trigger functionality
- **No GitHub Configuration**: Works automatically with existing CodeConnections connection
- **Minimal Infrastructure**: No additional compute resources needed
- **CloudTrail Monitoring**: Full observability of trigger events via AWS CloudTrail

**Zero configuration required** - immediate triggering works automatically after deployment!

## Documentation

### For Platform Engineers

- **📖 Platform Architecture**: `docs/PLATFORM_ARCHITECTURE.md` - **START HERE** - Comprehensive architecture guide
- **🔧 Platform Pipeline Architecture**: `.kiro/steering/platform-pipeline-architecture.md` - Detailed implementation guidance
- **⚙️ Node.js Environment**: `.kiro/steering/nodejs-environment-ci-cd.md` - Critical NODE_ENV guidance
- **📋 Active Specs**: `.kiro/specs/README.md` - Current and planned specifications
- **🗄️ Archived Specs**: `.kiro/specs/_archive/README.md` - Completed specifications

### For Application Teams

- **🚀 Application Team Guide**: `docs/rag-app-team-guide.md` - Complete guide for building RAG applications
- **🔌 RAG Platform Integration**: `.kiro/steering/rag-platform-integration.md` - Integration patterns and examples
- **⚙️ Pipeline Configuration**: `docs/application-pipeline-configuration.md` - Configure SAM and CDK applications

### Additional Resources

- **🔐 Credential Management**: `docs/credential-management.md` - Security and credential handling
- **📊 Monitoring**: `docs/monitoring-implementation.md` - CloudWatch integration
- **🧪 Integration Testing**: `docs/integration-testing-guide.md` - Testing strategies
- **🏗️ Repository Architecture**: `docs/repository-architecture.md` - Detailed architecture documentation
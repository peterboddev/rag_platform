# Platform Pipeline CDK System

This project implements a platform-owned CI/CD pipeline system using AWS CDK with TypeScript. The system follows a two-tier pipeline architecture where platform engineers manage a self-mutating platform pipeline that creates and controls application pipelines for various application teams.

## Key Features

- **Immediate Pipeline Triggering**: Native CodeConnections triggers automatically eliminate polling delays
- **Self-Mutating Pipeline**: Platform pipeline updates itself automatically
- **Two-Tier Architecture**: Platform pipeline manages application pipelines
- **Comprehensive Monitoring**: CloudWatch integration with failure notifications
- **Secure Credential Management**: Local development and CI/CD credential handling

## Architecture

The system implements a two-tier pipeline structure:

1. **Platform Pipeline** - Managed by platform engineers, controls application pipeline infrastructure
2. **Application Pipelines** - Created and managed by the platform pipeline, used by application teams

## Prerequisites

- Node.js 18 or later
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
├── test/                   # Unit tests
├── buildspec.yml          # CodeBuild specification
├── cdk.json               # CDK configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Node.js dependencies
```

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

For detailed architecture and implementation guidance, see the platform pipeline architecture documentation in `.kiro/steering/platform-pipeline-architecture.md`.
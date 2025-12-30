# Platform Pipeline CDK System

This project implements a platform-owned CI/CD pipeline system using AWS CDK with TypeScript. The system follows a two-tier pipeline architecture where platform engineers manage a self-mutating platform pipeline that creates and controls application pipelines for various application teams.

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

1. Install dependencies:
   ```bash
   npm install
   ```

2. **Configure GitHub Integration** (Required):
   
   Create a CodeStar connection in AWS Console:
   - Go to AWS CodePipeline → Settings → Connections
   - Create a new connection to GitHub
   - Copy the connection ARN
   
   Set the connection ARN in CDK context:
   ```bash
   # Option 1: Set in cdk.json context
   # Add "connectionArn": "arn:aws:codestar-connections:region:account:connection/connection-id" to cdk.json
   
   # Option 2: Pass as context parameter
   npx cdk deploy --context connectionArn=arn:aws:codestar-connections:region:account:connection/connection-id
   ```

3. Bootstrap your AWS environment (first time only):
   ```bash
   npm run bootstrap
   ```

4. Build the TypeScript code:
   ```bash
   npm run build
   ```

### Development Workflow

1. **Preview changes** before deployment:
   ```bash
   npm run diff
   ```

2. **Synthesize CloudFormation templates** locally:
   ```bash
   npm run synth
   ```

3. **Deploy the platform pipeline**:
   ```bash
   npm run deploy
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

### Available Scripts

- `npm run build` - Compile TypeScript code
- `npm run watch` - Watch for changes and compile automatically
- `npm test` - Run unit tests
- `npm run diff` - Show differences between deployed stack and current code
- `npm run synth` - Synthesize CloudFormation templates
- `npm run deploy` - Deploy the platform pipeline
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
2. Test locally using `npm run diff` and `npm run synth`
3. Run unit tests with `npm test`
4. Commit changes to trigger platform pipeline execution
5. Platform pipeline will automatically deploy application pipeline updates

## Documentation

For detailed architecture and implementation guidance, see the platform pipeline architecture documentation in `.kiro/steering/platform-pipeline-architecture.md`.
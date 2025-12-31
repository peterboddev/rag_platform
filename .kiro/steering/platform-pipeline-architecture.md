# Platform Pipeline Architecture Guide

## Overview

This project implements a platform-owned CI/CD pipeline architecture using AWS CodePipeline and CodeBuild. The platform team maintains control over both the platform pipeline (this repository) and dynamically manages application pipelines for various application teams.

## Architecture Pattern

### Two-Tier Pipeline Structure

1. **Platform Pipeline** (This Repository)
   - Triggered by platform team commits to this repo
   - Builds and modifies application pipeline infrastructure
   - Uses Infrastructure as Code to manage application pipelines
   - Controls pipeline configurations, build specifications, and deployment stages

2. **Application Pipeline** (Managed by Platform Pipeline)
   - Source repository is parameterized and configurable
   - Triggered by application team commits to their respective repos
   - Built and controlled by the platform pipeline
   - Follows standardized patterns enforced by the platform team

### Key Principles

- **Separation of Concerns**: Platform team manages pipeline infrastructure, application teams focus on application code
- **Parameterized Configuration**: Application source repositories are configurable parameters
- **Centralized Control**: Platform pipeline maintains governance and standards across all application pipelines
- **Self-Managing**: Platform pipeline can create, modify, and update application pipelines

## Implementation Guidelines

### CDK-Based Implementation

This project uses AWS CDK (Cloud Development Kit) with TypeScript for Infrastructure as Code:

1. **Local Development**: CDK CLI deploys the platform CodePipeline from platform engineer workstations
2. **Platform Pipeline Execution**: CodeBuild within the platform pipeline uses CDK to deploy/update application pipelines
3. **Infrastructure as Code**: All pipeline infrastructure defined in CDK TypeScript code

### Runtime Environment Standards

**Node.js and npm Versions:**
- **Node.js**: Version 20 (LTS) - provides optimal performance and security
- **npm**: Version 11.6.2+ - fully compatible with Node.js 20
- **TypeScript**: Version 5.2.2+ - for type-safe infrastructure code

**CodeBuild Environment:**
- **Build Image**: `AMAZON_LINUX_2_STANDARD_3_0` (ARM-based)
- **Architecture**: ARM64 (AArch64) for better price/performance ratio
- **Compute Type**: `BUILD_GENERAL1_SMALL` (default) or larger as needed
- **Runtime**: Amazon Linux 2023 with Node.js 20 pre-installed

**Benefits of ARM-based Images:**
- Better price/performance ratio compared to x86 instances
- Native Node.js 20 support eliminates npm compatibility warnings
- Consistent runtime environment across all CodeBuild projects
- Future-proof architecture aligned with AWS recommendations

### Platform Pipeline Responsibilities
- Define and maintain CDK TypeScript stacks for CodePipeline infrastructure
- Manage CodeBuild project configurations through CDK constructs
- Handle IAM roles and permissions for application pipelines via CDK
- Implement security and compliance standards in CDK TypeScript code
- Provide standardized deployment patterns using CDK constructs

### Application Pipeline Configuration
- Source repository URLs should be parameterized
- Build specifications should follow platform standards
- Deployment stages should use platform-approved patterns
- Monitoring and logging should be consistent across all pipelines

### Repository Structure Recommendations
```
platform-pipeline/
├── cdk/                    # CDK TypeScript application code
│   ├── lib/               # CDK stack definitions (.ts files)
│   ├── bin/               # CDK app entry points (.ts files)
│   ├── test/              # CDK unit tests (.test.ts files)
│   ├── package.json       # Node.js dependencies
│   ├── tsconfig.json      # TypeScript configuration
│   └── cdk.json           # CDK configuration
├── infrastructure/         # Additional infrastructure code
├── templates/             # CodePipeline and CodeBuild templates (CDK-generated)
├── configurations/        # Application-specific configurations
├── scripts/              # Automation and utility scripts
├── buildspec.yml         # CodeBuild specification for platform pipeline
└── docs/                 # Documentation and runbooks
```

### Best Practices

1. **Version Control**: All pipeline changes go through the platform pipeline
2. **CDK Best Practices**: 
   - Use CDK constructs for reusable pipeline patterns
   - Implement proper CDK stack organization and naming
   - Use CDK context and feature flags for environment-specific behavior
3. **Parameterization**: Use CDK context values and CloudFormation parameters for application-specific values
4. **Standardization**: Enforce consistent patterns across all application pipelines through CDK constructs
5. **Security**: Implement least-privilege access and secure credential management via CDK IAM constructs
6. **Monitoring**: Include comprehensive logging and monitoring for both platform and application pipelines using CDK constructs
7. **ARM Architecture**: Use ARM-based CodeBuild images for better price/performance ratio and Node.js 20 compatibility

### ARM Migration Benefits

**Performance and Cost:**
- ARM-based instances typically provide 20% better price/performance ratio
- Native Node.js 20 support eliminates compatibility issues
- Faster build times due to optimized ARM architecture

**Compatibility:**
- Node.js 20 + npm 11+ fully supported out of the box
- No more npm version compatibility warnings
- Future-proof architecture aligned with AWS recommendations

**Migration Considerations:**
- Ensure all dependencies support ARM64 architecture
- Test thoroughly in development environment before production deployment
- Some legacy packages may require ARM-compatible alternatives

## Development Workflow

1. Platform team makes changes to CDK infrastructure code
2. Local testing using `cdk diff` and `cdk synth` commands by platform engineers
3. Commit triggers platform pipeline execution
4. Platform pipeline CodeBuild runs `cdk deploy` to update application pipelines
5. Application pipelines are updated automatically with new infrastructure
6. Application teams continue using their existing repositories with updated pipeline behavior

## CDK-Specific Considerations

### Local Development
- Platform engineers use `cdk bootstrap` to prepare AWS environments
- Platform engineers run `cdk diff` to preview changes before deployment
- Platform engineers use `cdk synth` to generate CloudFormation templates locally
- Platform engineers test CDK code with unit tests before committing
- **Node.js 20** and **npm 11+** required for local development consistency

### Platform Pipeline CodeBuild
- **Runtime Environment**: Amazon Linux 2023 with Node.js 20 pre-installed
- **Build Image**: `AMAZON_LINUX_2_STANDARD_3_0` (ARM-based) for optimal performance
- **Architecture**: ARM64 (AArch64) provides better price/performance ratio
- Install CDK CLI and TypeScript runtime in CodeBuild environment
- Use appropriate IAM roles for CDK deployment permissions
- Cache Node.js dependencies (`node_modules`) for faster builds
- Include TypeScript compilation and CDK deployment commands in buildspec.yml

### CodeBuild Configuration Standards
```typescript
// Example CDK configuration for ARM-based CodeBuild
buildEnvironment: {
  buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
  computeType: codebuild.ComputeType.SMALL,
  // Node.js 20 is pre-installed in this image
}
```

### Runtime Versions in buildspec.yml
```yaml
phases:
  install:
    runtime-versions:
      nodejs: 20  # Use Node.js 20 for npm 11+ compatibility
```

### Security and Credentials Management

#### Repository Configuration Requirements

**CRITICAL**: The platform pipeline must be configured to point to the correct source repository containing the platform pipeline code.

1. **Repository Identification**:
   - The platform pipeline source repository is configured in `cdk.json` under the `githubOrg` and `githubRepo` context values
   - This repository MUST contain all platform pipeline infrastructure code (CDK stacks, buildspec.yml, package.json, etc.)
   - Verify the repository contains the complete codebase before deployment

2. **Common Repository Configuration Mistakes**:
   - ❌ Pointing to an empty or different repository
   - ❌ Using placeholder repository names that don't exist
   - ❌ Mixing up application repositories with platform pipeline repository
   - ✅ Ensure `cdk.json` points to the repository containing THIS platform pipeline code

3. **Repository Validation Checklist**:
   - [ ] Repository exists and is accessible
   - [ ] Repository contains `package.json`, `buildspec.yml`, and CDK code
   - [ ] Repository is not just a LICENSE file or empty
   - [ ] `githubOrg` and `githubRepo` in `cdk.json` match the actual repository
   - [ ] All platform pipeline code has been committed and pushed

#### Git Credentials File (.git_credentials)

**PURPOSE**: The `.git_credentials` file stores GitHub authentication credentials for local development workstations.

**CRITICAL SECURITY REQUIREMENTS**:
- **NEVER commit `.git_credentials` to any repository**
- **ALWAYS add `.git_credentials` to `.gitignore` file**
- This file contains sensitive authentication tokens/credentials
- Used only for local platform engineer workstation authentication
- CodeBuild uses AWS Secrets Manager and CodeConnections, NOT this file

**File Location and Usage**:
```
# Local workstation only - NEVER in repository
.git_credentials

# Must be in .gitignore
echo ".git_credentials" >> .gitignore
```

**What NOT to do**:
- ❌ Commit `.git_credentials` to repository
- ❌ Share `.git_credentials` between team members
- ❌ Use `.git_credentials` for CodeBuild authentication
- ❌ Store `.git_credentials` in shared locations

**What TO do**:
- ✅ Keep `.git_credentials` local to each engineer's workstation
- ✅ Add `.git_credentials` to `.gitignore`
- ✅ Use AWS Secrets Manager for CodeBuild credential access
- ✅ Use CodeConnections for pipeline GitHub integration

#### CodeBuild Credential Access
- CodeBuild uses AWS Secrets Manager to store GitHub tokens securely
- CodeConnections provide secure GitHub integration for pipelines
- Environment variables pass credentials to CodeBuild without exposing them
- Never use local credential files for automated pipeline authentication

### CodeConnections Integration (REQUIRED)

**CRITICAL**: This project uses AWS CodeConnections exclusively.

#### CodeConnections Implementation

**Use CodeConnections (✅ REQUIRED)**:
- **Service**: `aws.codeconnections` 
- **CDK Resource**: `aws_codeconnections.CfnConnection`
- **CDK Action**: `CodeStarConnectionsSourceAction` (same action, works with CodeConnections ARN format)
- **Console Location**: CodePipeline → Settings → Connections
- **Connection Type**: Shows as "codeconnections" in AWS CLI/API
- **ARN Format**: `arn:aws:codeconnections:region:account:connection/connection-id`
- **Configuration**: `connectionArn` is OPTIONAL in platform config - created automatically by CDK
- **Advantages**: 
  - Native pipeline triggers (no EventBridge needed)
  - Better reliability and performance
  - Immediate triggering on push events
  - No polling delays (eliminates 1-5 minute delays)
  - Future-proof service
  - Automatic CDK creation and management

#### Repository Architecture

**Platform Repository** (`platformRepository` in `cdk.json`):
- **Purpose**: Contains platform pipeline infrastructure code (CDK stacks, buildspec.yml, etc.)
- **Repository**: Platform team's infrastructure repository (e.g., `peterboddev/rag_platform`)
- **Connection**: Created by CDK construct in `PlatformPipelineStack`
- **Connection Name**: `platform-pipeline-github`
- **Used By**: Platform pipeline to deploy and manage application pipelines

**Application Repositories** (`applications.*.sourceRepo` in `cdk.json`):
- **Purpose**: Contains application code that gets deployed by application pipelines
- **Repository**: Each application team's code repository (e.g., `peterboddev/rag`)
- **Connection**: Created by CDK construct in each `ApplicationPipelineConstruct`
- **Connection Name**: `{applicationName}-github` (e.g., `rag-app-github`)
- **Used By**: Application pipelines to deploy application code

#### CDK Implementation

**Platform Pipeline Connection**:
```typescript
// In PlatformPipelineStack - automatically creates connection
this.codeConnection = new CodeConnectionsConstruct(this, 'CodeConnection', {
  connectionName: 'platform-pipeline-github',
  providerType: 'GitHub',
});

// connectionArn is automatically available via this.codeConnection.getConnectionArn()
// No need to specify connectionArn in platform configuration
```

**Application Pipeline Connections**:
```typescript
// In ApplicationPipelineConstruct (for each application)
this.codeConnection = new CodeConnectionsConstruct(this, 'CodeConnection', {
  connectionName: `${applicationName}-github`,
  providerType: 'GitHub',
});
```

#### Configuration in cdk.json

```json
{
  "context": {
    "platformRepository": {
      "owner": "peterboddev",
      "repo": "rag_platform", 
      "branch": "main",
      "description": "Platform pipeline infrastructure repository"
    },
    "platform": {
      "region": "us-east-1",
      "account": "450683699755",
      "artifactBucketPrefix": "platform-pipeline"
      // connectionArn is OPTIONAL - created automatically by CDK
    },
    "applications": {
      "rag-app": {
        "applicationName": "rag-app",
        "team": "ai-team",
        "sourceRepo": {
          "owner": "peterboddev",
          "repo": "rag",
          "branch": "main"
        },
        "deploymentTargets": ["dev", "staging", "prod"],
        "enabled": true
      }
    }
  }
}
```

#### Connection Authorization Process

1. **Deploy CDK Stack**: Connection is created in PENDING status
2. **Authorize in Console**:
   - Go to AWS Console → CodePipeline → Settings → Connections
   - Find the connection (will show as PENDING)
   - Click "Update pending connection"
   - Complete GitHub OAuth flow in browser
   - Verify status changes to "Available"
3. **Pipeline Triggers**: Once authorized, pipelines trigger immediately on push

#### Troubleshooting CodeConnections

**Connection Shows as PENDING**:
- Normal initial state after CDK deployment
- Requires manual authorization in AWS Console
- Follow authorization process above

**Pipeline Not Triggering**:
- Verify connection status is "Available" (not PENDING)
- Check repository permissions in GitHub
- Verify branch name matches configuration
- Check CloudTrail for connection events

**Multiple Connections**:
- Each repository needs its own connection
- Platform pipeline: connects to platform repo
- Application pipelines: each connects to its own app repo
- Do NOT share connections between different repositories

#### Connection Authorization Process

1. **Deploy CDK Stack**: Connection is created in PENDING status
2. **Authorize in Console**:
   - Go to AWS Console → CodePipeline → Settings → Connections
   - Find the connection (will show as PENDING)
   - Click "Update pending connection"
   - Complete GitHub OAuth flow in browser
   - Verify status changes to "Available"
3. **Pipeline Triggers**: Once authorized, pipelines trigger immediately on push

#### Troubleshooting CodeConnections

**Connection Shows as PENDING**:
- Normal initial state after CDK deployment
- Requires manual authorization in AWS Console
- Follow authorization process above

**Pipeline Not Triggering**:
- Verify connection status is "Available" (not PENDING)
- Check repository permissions in GitHub
- Verify branch name matches configuration
- Check CloudTrail for connection events

### Repository Configuration Verification

Before deploying the platform pipeline, verify your configuration:

1. **Verify Platform Repository Contents**:
   ```bash
   # Check current repository
   git remote -v
   
   # Verify all platform code is committed
   git status
   
   # Ensure no untracked files remain
   git add . && git commit -m "Platform pipeline code"
   git push origin main
   ```

2. **Validate CDK Configuration**:
   - Open `cdk.json`
   - Verify `platformRepository.owner` matches your GitHub organization
   - Verify `platformRepository.repo` matches the repository containing THIS code
   - Verify `platformRepository.branch` matches your main branch (usually "main")
   - Verify each `applications.*.sourceRepo` points to the correct application repository

3. **Test Repository Access**:
   - Ensure CodeConnections will be authorized for all repositories
   - Verify repositories are not empty (contain more than just LICENSE)
   - Confirm all necessary files are present in platform repo: `package.json`, `buildspec.yml`, CDK code
   - Confirm application repositories contain application code

#### Common Configuration Errors
- **Wrong Repository**: Pipeline points to different/empty repository
- **Missing Code**: Repository exists but doesn't contain platform pipeline code
- **Untracked Files**: Code exists locally but wasn't committed/pushed
- **Branch Mismatch**: Pipeline monitors different branch than where code was pushed

### Application Repository Management
- Application repository URLs stored as CDK context values or parameters
- Pipeline configurations managed through CDK stacks and constructs
- Environment-specific settings handled through CDK context files
- Rollback capabilities through CloudFormation stack rollback
- CDK asset management for build artifacts and dependencies

This architecture enables the platform team to maintain control and consistency while allowing application teams to focus on their core development work. The use of CDK provides type-safe infrastructure definitions and powerful abstraction capabilities for managing complex pipeline architectures.

## Troubleshooting Common Issues

### Pipeline Build Failures

#### "package.json not found" Error
**Symptoms**: CodeBuild logs show `npm error enoent Could not read package.json`

**Root Cause**: Repository is empty or doesn't contain platform pipeline code

**Solution**:
1. Verify repository contents: `git ls-remote origin`
2. Check if code was committed: `git status`
3. Push missing code: `git add . && git commit -m "Add platform code" && git push`
4. Verify `cdk.json` points to correct repository

#### "npm: not found" Error
**Symptoms**: CodeBuild logs show `npm: not found` or `exit status 127`

**Root Cause**: Incorrect CodeBuild image or Node.js runtime configuration

**Solution**:
1. Verify CodeBuild image is ARM-based Amazon Linux 2023 (`AMAZON_LINUX_2_STANDARD_3_0`)
2. Check `buildspec.yml` has `nodejs: 20` in runtime-versions
3. Ensure buildspec.yml is properly formatted YAML
4. Confirm ARM architecture is supported in your AWS region

#### npm Version Compatibility Issues
**Symptoms**: CodeBuild logs show `npm warn cli npm v11.6.2 does not support Node.js v18.20.8`

**Root Cause**: Node.js 18 is incompatible with npm 11+

**Solution**:
1. Update `buildspec.yml` to use `nodejs: 20` instead of `nodejs: 18`
2. Use ARM-based CodeBuild image (`AMAZON_LINUX_2_STANDARD_3_0`) which includes Node.js 20
3. Update CDK configuration to use `LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0`
4. Node.js 20 is fully compatible with npm 11.6.2+

#### CodeConnections Integration
**Symptoms**: Source stage fails with connection errors

**Root Cause**: CodeConnections connection not authorized or misconfigured

**Solution**:
1. Go to AWS Console → CodePipeline → Settings → Connections
2. Find your connection and click "Update pending connection"
3. Complete GitHub authorization in browser
4. Verify connection status shows "Available"
5. Verify connection ARN format is `arn:aws:codeconnections:...`

### Repository Configuration Issues

#### Wrong Repository Referenced
**Symptoms**: Pipeline builds but uses wrong source code

**Root Cause**: `cdk.json` points to different repository

**Solution**:
1. Check `git remote -v` to see current repository
2. Update `cdk.json` with correct `githubOrg` and `githubRepo`
3. Redeploy pipeline: `cdk deploy PlatformPipelineStack`

#### Empty Repository
**Symptoms**: CodeBuild shows only LICENSE file or minimal content

**Root Cause**: Platform code not pushed to repository

**Solution**:
1. Commit all platform code: `git add . && git commit -m "Platform pipeline"`
2. Push to repository: `git push origin main`
3. Wait for automatic pipeline trigger or manually start execution

### Security and Credentials

#### .git_credentials Accidentally Committed
**Symptoms**: Security scan flags or credential exposure

**Root Cause**: `.git_credentials` file was committed to repository

**Solution**:
1. Remove from repository: `git rm .git_credentials`
2. Add to .gitignore: `echo ".git_credentials" >> .gitignore`
3. Commit changes: `git commit -m "Remove credentials and update gitignore"`
4. Rotate any exposed credentials immediately
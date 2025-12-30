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

### Platform Pipeline CodeBuild
- Install CDK CLI and Node.js/TypeScript runtime in CodeBuild environment
- Use appropriate IAM roles for CDK deployment permissions
- Cache Node.js dependencies (`node_modules`) for faster builds
- Include TypeScript compilation and CDK deployment commands in buildspec.yml

### Security and Credentials Management

#### Git Ignore Requirements
- **CRITICAL**: Add `.git_credentials` to `.gitignore` file
- GitHub credentials must be stored locally in `.git_credentials` file for platform engineer workstations
- Never commit credential files to the repository
- Use environment variables or AWS Secrets Manager for CodeBuild credential access

## Configuration Management

- Application repository URLs stored as CDK context values or parameters
- Pipeline configurations managed through CDK stacks and constructs
- Environment-specific settings handled through CDK context files
- Rollback capabilities through CloudFormation stack rollback
- CDK asset management for build artifacts and dependencies

This architecture enables the platform team to maintain control and consistency while allowing application teams to focus on their core development work. The use of CDK provides type-safe infrastructure definitions and powerful abstraction capabilities for managing complex pipeline architectures.
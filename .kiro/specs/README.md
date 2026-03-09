# Active Specifications

This directory contains active and planned specifications for the platform pipeline and infrastructure system.

## Active Specs

### rag-platform 🔄
- **Type**: Feature
- **Status**: Core implementation complete, optional tests remain
- **Summary**: Platform-owned CI/CD pipeline system that creates and manages application pipelines
- **Key Features**:
  - Two-tier pipeline architecture (platform pipeline → application pipelines)
  - CDK-based infrastructure management
  - CodeConnections integration with immediate triggering
  - Hybrid configuration loading (file-based + CDK context)
  - Comprehensive monitoring and observability
- **Completed Tasks**: 11/12 main tasks (optional test tasks remain)
- **Next Steps**: Optional property-based tests for additional validation

### rag-platform-infrastructure 🔄
- **Type**: Feature
- **Status**: Core infrastructure deployed, additional features in progress
- **Summary**: Foundational AWS infrastructure services for RAG applications
- **Key Features**:
  - Network infrastructure (VPC, subnets, security groups)
  - AI services (Bedrock Nova Pro, embedding models)
  - Vector database (OpenSearch Serverless)
  - Authentication (Cognito user pools)
  - Storage (S3 buckets, DynamoDB)
  - API Gateway with Cognito authorizer
  - Application integration (IAM roles with Bedrock, Textract, OpenSearch access)
- **Completed Components**: Network, Bedrock, Vector DB, Cognito, S3, API Gateway, Application Integration
- **Remaining Components**: Knowledge Base, Document Processing, Configuration Export, Monitoring
- **Next Steps**: Complete remaining infrastructure components

### pipeline-validation-fixes 🔧
- **Type**: Bugfix
- **Status**: Partially complete
- **Summary**: Fix CodeBuild image configuration and configuration validation script
- **Issues**:
  1. Pipeline using wrong CodeBuild image (x86 instead of ARM)
  2. Validation script expects old config format
- **Remaining Tasks**:
  - Update validation script to use `HybridConfigurationLoader`
  - Verify ARM images in all CodeBuild steps
  - Test configuration loading in CI/CD
- **Next Steps**: Complete validation script updates and test in pipeline

## Planned Specs

### dynamic-integration-guide 📋
- **Type**: Feature
- **Status**: Not started
- **Summary**: Tool for retrieving configuration values from deployed CloudFormation stacks
- **Purpose**: Simplify configuration retrieval for application teams
- **Key Features**:
  - Single command to retrieve all config values
  - Multiple output formats (JSON, .env, shell exports)
  - Environment detection and validation
  - Template generation with real values
- **Priority**: Medium
- **Dependencies**: RAG infrastructure must be deployed

### aws-security-agent-integration 📋
- **Type**: Feature
- **Status**: Not started
- **Summary**: Integrate AWS Security Agent for automated security scanning
- **Purpose**: Shift-left security with automated vulnerability detection
- **Key Features**:
  - Pipeline security scanning stage
  - Local IDE scanning support
  - Configurable severity thresholds
  - Security reporting and dashboards
- **Priority**: Low
- **Dependencies**: Platform and application pipelines must be operational

## Spec Status Legend

- ✅ **Completed**: All tasks done, feature fully implemented
- 🔄 **Active**: Core implementation complete, additional work in progress
- 🔧 **In Progress**: Currently being worked on
- 📋 **Planned**: Not started, requirements defined
- 🗄️ **Archived**: Completed and moved to `_archive/` directory

## Understanding the Dual-Purpose Architecture

This repository serves two purposes:

1. **Pipeline Management**: Creates and manages CI/CD pipelines for application teams
2. **Infrastructure Provider**: Provides foundational AWS services (VPC, Bedrock, Vector DB, etc.)

See `docs/PLATFORM_ARCHITECTURE.md` for comprehensive architecture documentation.

## Spec Workflow

### Creating New Specs
1. Use Kiro's spec workflow to create requirements, design, and tasks
2. Choose between Requirements-First or Design-First approach
3. Implement tasks incrementally with validation checkpoints

### Updating Existing Specs
1. Review current requirements and design documents
2. Add new requirements or modify existing ones
3. Update tasks.md with new implementation tasks
4. Execute tasks using Kiro's task execution workflow

### Completing Specs
1. Ensure all required tasks are completed
2. Verify optional tasks are marked appropriately
3. Update spec status in this README
4. Move to archive if fully complete and no future work planned

## Quick Reference

### Active Work
- **rag-platform**: Optional tests remain
- **rag-platform-infrastructure**: Knowledge Base, Document Processing, Config Export, Monitoring
- **pipeline-validation-fixes**: Validation script updates

### Completed Work (Archived)
- **cdk-template-deployment-fix**: CDK template support
- **pipeline-loop-fix**: Infinite loop resolution
- **pipeline-configuration-separation**: Hybrid config loader

### Future Work
- **dynamic-integration-guide**: Config retrieval tool
- **aws-security-agent-integration**: Security scanning

---

**Last Updated**: March 6, 2026  
**Active Specs**: 3  
**Archived Specs**: 3  
**Planned Specs**: 2

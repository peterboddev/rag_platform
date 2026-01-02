# Pipeline Validation Fixes - Requirements

## Overview
Fix critical pipeline validation failures caused by CodeBuild image configuration and configuration loading architecture changes.

## Problem Statement
The platform pipeline is failing with two critical issues:

1. **CodeBuild Image Issue**: Pipeline is using `aws/codebuild/standard:7.0` instead of the ARM-based `AMAZON_LINUX_2_STANDARD_3_0` specified in the steering document
2. **Configuration Loading Issue**: `validate-configs.ts` script expects 'applications' key in CDK context, but applications are now stored in separate files under `config/applications/`

## User Stories

### Story 1: Fix CodeBuild Image Configuration
**As a** platform engineer  
**I want** the pipeline to use the correct ARM-based CodeBuild image  
**So that** builds run with Node.js 20 compatibility and optimal performance  

**Acceptance Criteria:**
- [ ] Platform pipeline uses `AMAZON_LINUX_2_STANDARD_3_0` ARM-based image
- [ ] Application pipeline validation step uses `AMAZON_LINUX_2_STANDARD_3_0` ARM-based image  
- [ ] All CodeBuild steps specify `nodejs: 20` in runtime-versions
- [ ] Pipeline builds successfully without image compatibility issues

### Story 2: Update Configuration Validation Script
**As a** platform engineer  
**I want** the configuration validation script to work with the new hybrid configuration architecture  
**So that** pipeline validation passes and applications can be deployed  

**Acceptance Criteria:**
- [ ] `validate-configs.ts` uses `HybridConfigurationLoader` instead of expecting 'applications' in CDK context
- [ ] Script successfully loads platform config from `cdk.json`
- [ ] Script successfully loads application configs from `config/applications/*.json` files
- [ ] Script falls back to CDK context if no application files exist
- [ ] Validation passes for the current `rag-app.json` configuration
- [ ] Pipeline validation step completes successfully

### Story 3: Ensure Configuration Architecture Consistency
**As a** platform engineer  
**I want** all configuration loading to use the same hybrid approach  
**So that** the system is consistent and maintainable  

**Acceptance Criteria:**
- [ ] All scripts use the same configuration loading pattern
- [ ] Configuration Manager uses `HybridConfigurationLoader` by default
- [ ] Documentation reflects the new configuration architecture
- [ ] Error messages are clear when configuration files are missing or invalid

## Technical Requirements

### CodeBuild Image Configuration
- **Platform Pipeline**: Must use `codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0`
- **Application Validation Step**: Must use `codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0`
- **Runtime Version**: Must specify `nodejs: 20` in all buildspec configurations
- **Compute Type**: Can remain `codebuild.ComputeType.SMALL` for cost efficiency

### Configuration Loading Architecture
- **Platform Config**: Loaded from `cdk.json` context
- **Application Configs**: Loaded from `config/applications/*.json` files with fallback to CDK context
- **Validation**: Must validate both platform and application configurations
- **Error Handling**: Clear error messages for missing or invalid configurations

### Backward Compatibility
- **CDK Context**: Still supported as fallback for applications
- **Existing Scripts**: Should continue to work with minimal changes
- **Migration Path**: Clear path for moving from CDK context to file-based configs

## Dependencies
- CDK 2.233.0 with Node.js 20 compatibility
- ARM-based CodeBuild image support in target AWS region
- Existing `HybridConfigurationLoader` implementation
- Current application configuration in `config/applications/rag-app.json`

## Success Criteria
1. Pipeline builds successfully without CodeBuild image errors
2. Configuration validation passes in pipeline
3. `validate-configs.ts` script works with hybrid configuration loading
4. All CodeBuild steps use ARM-based images with Node.js 20
5. No regression in existing functionality

## Out of Scope
- Changing the overall configuration architecture (already implemented)
- Adding new configuration validation rules
- Modifying application configuration schema
- Performance optimizations beyond ARM image benefits

## Risk Assessment
- **Low Risk**: CodeBuild image change (well-tested ARM images)
- **Medium Risk**: Configuration loading changes (existing implementation needs integration)
- **Mitigation**: Thorough testing of configuration loading in both file-based and CDK context scenarios
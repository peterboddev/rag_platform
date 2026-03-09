# Archived Specifications

This directory contains completed specifications that have been fully implemented and are kept for historical reference.

## Archived Specs

### cdk-template-deployment-fix ✅
- **Type**: Bugfix
- **Status**: Completed
- **Date**: March 2026
- **Summary**: Fixed application pipeline to support both SAM (`template.yaml`) and CDK (`.template.json`) templates
- **Implementation**: Added `templatePath` configuration field to `ApplicationPipelineConfig`
- **Result**: Both CDK and SAM applications now deploy successfully through platform pipelines

### pipeline-loop-fix ✅
- **Type**: Bugfix
- **Status**: Completed
- **Date**: January 2026
- **Summary**: Resolved infinite loop issue in self-mutating platform pipeline
- **Implementation**: Disabled self-mutation (`selfMutation: false`) and removed explicit trigger configuration
- **Result**: Pipeline executes once per commit without cascading triggers

### pipeline-configuration-separation ✅
- **Type**: Feature
- **Status**: Completed
- **Date**: March 2026
- **Summary**: Separated platform and application configurations into distinct files
- **Implementation**: Created hybrid configuration loader supporting both file-based and CDK context configs
- **Result**: Platform config in `cdk.json`, application configs in `config/applications/*.json`

## Why Archive?

Completed specs are archived to:
- Reduce confusion when viewing active work
- Maintain historical record of decisions and implementations
- Keep codebase documentation focused on current and future work
- Provide reference for similar issues in the future

## Accessing Archived Specs

All archived specs remain accessible in this directory. If you need to reference implementation details, design decisions, or requirements from completed work, you can find them here.

---

**Archive Created**: March 6, 2026  
**Active Specs Location**: `.kiro/specs/`

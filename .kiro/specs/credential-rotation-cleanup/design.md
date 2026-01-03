# Design Document

## Overview

This design outlines the systematic removal of unused credential rotation functionality from the platform pipeline system. The cleanup focuses on removing legacy code, documentation references, and configuration options that are no longer needed due to the adoption of AWS CodeConnections for secure GitHub integration.

## Architecture

### Current State Analysis

The platform pipeline currently contains:
- **Active**: CodeConnections-based GitHub integration (no manual credential management needed)
- **Legacy**: Credential rotation scripts and configuration options (unused)
- **Mixed**: Documentation that references both current and legacy approaches

### Target State

After cleanup:
- **Clean Codebase**: Only CodeConnections-related credential management code
- **Simplified Configuration**: No unused credential rotation options
- **Accurate Documentation**: Clear explanation of CodeConnections approach without legacy references

## Components and Interfaces

### Files to Remove

#### Compiled JavaScript Files
- `lib/scripts/credential-rotation.js` - Complete credential rotation script (unused)
- `lib/scripts/credential-rotation.d.ts` - TypeScript definitions (unused)

#### Configuration Cleanup
- Remove `enableCredentialRotation` property from `CodeBuildCredentialsConfig` interface
- Remove `setupCredentialRotation()` method from `CodeBuildCredentialsManager` class
- Remove Lambda function creation code for credential rotation

### Documentation Updates

#### Task Documentation
- `.kiro/specs/rag-platform/tasks.md` - Remove completed credential rotation task references
- `.kiro/specs/rag-platform/design.md` - Remove credential rotation from error handling section

#### Preserve Important Documentation
- `docs/credential-management.md` - Keep explanation that CodeConnections eliminates rotation need

## Data Models

### Configuration Interface Changes

**Before:**
```typescript
interface CodeBuildCredentialsConfig {
  readonly githubTokenSecretName?: string;
  readonly connectionArn?: string;
  readonly enableCredentialRotation?: boolean; // REMOVE
  readonly credentialValidationEnabled?: boolean;
  readonly secretsPrefix?: string;
}
```

**After:**
```typescript
interface CodeBuildCredentialsConfig {
  readonly githubTokenSecretName?: string;
  readonly connectionArn?: string;
  readonly credentialValidationEnabled?: boolean;
  readonly secretsPrefix?: string;
}
```

### Method Removal

**Remove from CodeBuildCredentialsManager:**
- `setupCredentialRotation(secret, secretType)` method
- Lambda function creation code within the method
- Rotation schedule setup code

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

<function_calls>
<invoke name="prework">
<parameter name="featureName">credential-rotation-cleanup

### Property 1: No credential rotation files in compiled output
*For any* build output directory, no files with "credential-rotation" in their name should exist after cleanup
**Validates: Requirements 1.3**

### Property 2: No misleading credential rotation references in documentation
*For any* documentation file, no misleading references to credential rotation functionality should remain after cleanup
**Validates: Requirements 2.4**

### Property 3: Only CodeConnections configuration remains
*For any* configuration interface or class, only CodeConnections-related credential management options should exist after cleanup
**Validates: Requirements 3.4**

### Property 4: No active credential rotation code references
*For any* search of the codebase using patterns "credential.*rotation" or "rotation.*credential", no active code references should be found
**Validates: Requirements 4.1, 4.2**

### Property 5: System functions without credential rotation dependencies
*For any* pipeline execution, the system should function completely without any credential rotation dependencies
**Validates: Requirements 4.4**

## Error Handling

### Cleanup Validation Errors
- File deletion failures should be reported with specific file paths
- Documentation update failures should specify which files couldn't be modified
- Build failures after cleanup should indicate missing dependencies

### Rollback Considerations
- Keep backup of removed files until cleanup validation is complete
- Maintain git history for easy rollback if issues are discovered
- Test build process after each major cleanup step

## Testing Strategy

### Dual Testing Approach
- **Unit tests**: Verify specific file deletions and content changes
- **Property tests**: Verify universal cleanup properties across the entire codebase
- Both approaches ensure comprehensive validation of the cleanup process

### Unit Testing Focus
- Verify specific files are deleted (credential-rotation.js, credential-rotation.d.ts)
- Verify specific documentation content is updated correctly
- Verify specific configuration options are removed
- Verify CodeConnections functionality remains intact

### Property Testing Focus
- Verify no credential rotation files exist anywhere in build output (100+ iterations across different build scenarios)
- Verify no misleading documentation references remain (comprehensive text search validation)
- Verify codebase search patterns return no active references (pattern matching across all source files)
- Verify system functionality without credential rotation dependencies (end-to-end pipeline testing)

### Property Test Configuration
- Minimum 100 iterations per property test
- Each property test references its design document property
- Tag format: **Feature: credential-rotation-cleanup, Property {number}: {property_text}**

### Validation Scripts
- Create cleanup validation script to verify all requirements are met
- Include automated search for credential rotation references
- Verify build process completes successfully after cleanup
- Test CodeConnections functionality remains unaffected
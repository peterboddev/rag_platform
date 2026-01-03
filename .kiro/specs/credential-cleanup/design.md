# Design Document

## Overview

This design outlines the systematic removal of unused credential management components from the platform pipeline codebase. The cleanup focuses on removing `.git_credentials` files, credential-setup scripts, and related validation code while preserving the functional CodeConnections-based authentication system.

## Architecture

### Current State Analysis

The codebase currently contains two authentication systems:
1. **Active System**: CodeConnections-based GitHub integration (used by CDK)
2. **Unused System**: .git_credentials file-based credential management (legacy)

### Target Architecture

After cleanup, the system will have:
- **Single Authentication Method**: CodeConnections only
- **Clean Codebase**: No unused credential management code
- **Preserved Security**: Maintained .gitignore protection against credential commits
- **Updated Documentation**: Reflects actual system architecture

## Components and Interfaces

### Files to Remove

**Credential Files:**
- `.git_credentials` - Contains unused GitHub token
- `lib/scripts/credential-setup.js` - Compiled credential setup script
- `lib/scripts/credential-setup.d.ts` - TypeScript definitions
- `lib/scripts/sync-credentials.d.ts` - Credential sync definitions

**Validation to Remove:**
- Pre-commit validation of .git_credentials
- Buildspec.yml GITHUB_TOKEN validation
- Credential-setup script references

### Files to Modify

**Scripts to Update:**
- `scripts/pre-commit-validation.ts` - Remove .git_credentials checks
- `buildspec.yml` - Remove GITHUB_TOKEN validation logic
- `docs/credential-management.md` - Update to CodeConnections only
- `.kiro/steering/platform-pipeline-architecture.md` - Remove .git_credentials references

**Files to Preserve:**
- All CodeConnections-related code
- AWS credential validation
- Connection ARN management
- .gitignore entries for .git_credentials

## Data Models

### Cleanup Scope Matrix

| Component | Action | Reason |
|-----------|--------|---------|
| `.git_credentials` | DELETE | Unused by CDK |
| `credential-setup.*` | DELETE | No longer needed |
| `sync-credentials.*` | DELETE | No longer needed |
| Pre-commit .git_credentials validation | REMOVE | Validates unused file |
| Buildspec GITHUB_TOKEN validation | REMOVE | Token not used |
| CodeConnections code | PRESERVE | Active system |
| AWS credential validation | PRESERVE | Still needed |
| .gitignore .git_credentials entry | PRESERVE | Security protection |

## Error Handling

### Cleanup Validation

1. **Pre-cleanup Verification**:
   - Confirm no active usage of .git_credentials
   - Verify CodeConnections functionality is intact
   - Backup files before deletion

2. **Post-cleanup Validation**:
   - Ensure buildspec.yml still validates AWS credentials
   - Verify pre-commit hooks still function
   - Confirm CodeConnections integration works

3. **Rollback Strategy**:
   - Keep deleted files in git history
   - Document restoration process if needed
   - Maintain backup of removed validation logic

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing the acceptance criteria, several properties can be consolidated:
- Properties 2.4, 4.3, 5.1, and 5.4 all relate to preserving CodeConnections functionality and can be combined
- Properties 4.4 and 5.3 both relate to preserving functional code while removing unused code
- Most criteria are specific file operations that are better tested as examples rather than properties

### Core Properties

**Property 1: CodeConnections Functionality Preservation**
*For any* CodeConnections-related file or construct in the codebase, after cleanup operations, all CodeConnections functionality should remain intact and operational
**Validates: Requirements 2.4, 4.3, 5.1, 5.4**

**Property 2: Functional Code Preservation**
*For any* functional credential management or validation code, cleanup operations should preserve all actively used validation and configuration management while removing only unused components
**Validates: Requirements 4.4, 5.3**

## Testing Strategy

### Dual Testing Approach

**Unit Tests:**
- Verify specific file deletions and content modifications
- Test that pre-commit validation works without .git_credentials checks
- Confirm buildspec.yml AWS credential validation remains functional
- Validate documentation updates are complete

**Property Tests:**
- Test CodeConnections functionality preservation across all related files
- Verify functional code preservation while unused code is removed
- Run minimum 100 iterations per property test

### Test Configuration

Each property test must reference its design document property:
- **Feature: credential-cleanup, Property 1**: CodeConnections functionality preservation
- **Feature: credential-cleanup, Property 2**: Functional code preservation

### Validation Strategy

**Pre-cleanup Verification:**
- Inventory all CodeConnections-related files and functionality
- Document all functional credential validation code
- Create baseline of working system

**Post-cleanup Validation:**
- Verify all CodeConnections functionality still works
- Confirm AWS credential validation remains in buildspec.yml
- Test that no functional code was accidentally removed
- Validate documentation accuracy
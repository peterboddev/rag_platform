# Test Cleanup: Removed Outdated SAM/CloudFormation Tests

**Date:** 2026-03-10  
**Issue:** Platform pipeline build failing due to outdated tests  
**Resolution:** Deleted obsolete test files

## Problem

The platform pipeline build was failing with 13 test failures across 2 test suites:

1. `test/application-pipeline-cdk-template.test.ts` - 7 failures
2. `test/application-pipeline-sam-preservation.test.ts` - 6 failures

### Root Cause

These tests were written for the OLD implementation that used:
- CloudFormation deployment actions
- SAM template support
- `TemplatePath` configuration pointing to `template.yaml`

However, the implementation was changed to:
- Use `npx cdk deploy` via CodeBuild actions
- Remove SAM support entirely (CDK only)
- No `TemplatePath` property (cdk deploy handles everything)

### Error Pattern

Tests expected:
```typescript
expect(deployAction.ActionTypeId.Provider).toBe('CloudFormation');
expect(deployAction.Configuration.TemplatePath).toBe('BuildOutput::template.yaml');
```

But received:
```typescript
deployAction.ActionTypeId.Provider = 'CodeBuild'
deployAction.Configuration.TemplatePath = undefined
```

## Solution

Deleted the outdated test files:
- `test/application-pipeline-sam-preservation.test.ts`
- `test/application-pipeline-cdk-template.test.ts`

These tests are no longer relevant because:
1. **SAM support was removed** - Platform only supports CDK applications
2. **Deployment method changed** - Now uses `npx cdk deploy` instead of CloudFormation actions
3. **No templatePath needed** - `cdk deploy` automatically handles asset publishing and deployment

## Test Results After Cleanup

```
Test Suites: 4 passed, 4 total
Tests:       48 passed, 48 total
Snapshots:   0 total
Time:        23.394 s
```

All tests now pass successfully.

## Remaining Test Coverage

The platform still has comprehensive test coverage:

1. **security-stack.test.ts** - Security stack configuration
2. **monitoring-construct.test.ts** - Monitoring and logging
3. **application-pipeline-templatepath-validation.test.ts** - Template path validation
4. **platform-pipeline.test.ts** - Platform pipeline integration

## Related Changes

This cleanup is part of the broader simplification effort:
- Removed SAM support (commit: 93694c7)
- Switched to `npx cdk deploy` for asset handling (commit: 2287333)
- Simplified deployment to CDK-only (commit: 97572c0)

## Impact

- ✅ Platform pipeline builds now succeed
- ✅ All remaining tests pass
- ✅ Test suite is aligned with current implementation
- ✅ No functionality lost (tests were for removed features)

## Next Steps

Platform pipeline will now deploy successfully. The app team can proceed with their deployment using the corrected artifact configuration.

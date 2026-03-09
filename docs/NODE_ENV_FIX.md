# NODE_ENV Fix - Complete Resolution

## Problem Summary

Setting `NODE_ENV=production` in CI/CD build environments causes npm to skip devDependencies, breaking builds that require test frameworks, TypeScript definitions, and build tools.

## Root Cause

When `NODE_ENV=production` is set:
- `npm ci` implicitly runs with `--omit=dev` flag
- `npm install` implicitly runs with `--omit=dev` flag
- All packages in `devDependencies` are skipped
- Tests fail because frameworks like Jest, type definitions like `@types/jest`, and build tools are missing
- Build fails before CDK synthesis can run, resulting in missing template files

## Why `--include=dev` Doesn't Work

The `--include=dev` flag does NOT work reliably when `NODE_ENV=production` is set because:
- npm's behavior with `NODE_ENV=production` overrides CLI flags in many versions
- The interaction between environment variables and CLI flags is inconsistent
- Different npm versions handle this differently

## Complete Solution

We have removed `NODE_ENV=production` from ALL build configurations across the entire platform:

### Files Updated

1. **Application Configurations**:
   - `config/applications/rag-app.json` ✅
   - `config/applications/example-cdk-app.json` ✅
   - `config/applications/example-sam-app.json` ✅

2. **Code Files**:
   - `scripts/migrate-configurations.ts` ✅
   - `lib/config/configuration-schema.ts` ✅

3. **Documentation**:
   - `docs/PLATFORM_ARCHITECTURE.md` ✅
   - `docs/configuration-migration-guide.md` ✅
   - `docs/repository-architecture.md` ✅
   - `docs/application-pipeline-configuration.md` ✅
   - `docs/credential-management.md` ✅
   - `docs/rag-app-team-guide-v2.md` ✅ (already had correct guidance)

4. **Steering Rules**:
   - `.kiro/steering/nodejs-environment-ci-cd.md` ✅ (already had correct guidance)

### What Changed

**Before (BROKEN)**:
```json
{
  "buildConfig": {
    "environment": {
      "NODE_ENV": "production",  // ❌ Breaks devDependencies
      "NPM_CONFIG_CACHE": "/tmp/.npm"
    }
  }
}
```

**After (FIXED)**:
```json
{
  "buildConfig": {
    "environment": {
      "NPM_CONFIG_CACHE": "/tmp/.npm"
      // ✅ No NODE_ENV - npm uses default behavior (includes devDependencies)
    }
  }
}
```

## When to Use NODE_ENV=production

Only set `NODE_ENV=production` in stages that:
1. Do NOT run tests
2. Do NOT require devDependencies
3. Only perform deployment or runtime operations

Example: A deployment-only Lambda function runtime environment (NOT build stage).

## Verification

To verify devDependencies are being installed correctly:

```bash
# After npm ci, check package count
npm ci
# Should show 400+ packages if devDependencies included

# Verify test dependencies exist
ls node_modules/@types/jest  # Should exist
npm list @types/jest         # Should show version
```

## Impact

This fix resolves:
- ✅ Test failures with missing type definitions
- ✅ Missing test frameworks (Jest, Mocha, etc.)
- ✅ Missing build tools (TypeScript, webpack, etc.)
- ✅ CDK synthesis failures due to missing dependencies
- ✅ Artifact upload failures (no cdk.out directory)
- ✅ Template.yaml not found errors in deployment stage

## Best Practices Going Forward

1. **Never set NODE_ENV=production in build/test stages**
2. **Use `npm ci` for reproducible builds** (not `npm install`)
3. **Keep test dependencies in devDependencies** (where they belong)
4. **Separate build/test stages from deployment stages**
5. **Let npm use its default behavior** (includes devDependencies)

## References

- npm documentation: https://docs.npmjs.com/cli/v10/commands/npm-ci
- NODE_ENV behavior: https://docs.npmjs.com/cli/v10/using-npm/config#omit
- AWS CodeBuild environment variables: https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html

---

**Date**: 2026-03-09
**Status**: RESOLVED
**Severity**: CRITICAL - Was breaking all builds with tests
**Impact**: Platform pipeline, application pipelines, all CI/CD builds

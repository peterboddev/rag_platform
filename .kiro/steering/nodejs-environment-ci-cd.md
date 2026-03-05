# Node.js Environment Configuration in CI/CD Pipelines

## Critical Issue: NODE_ENV=production and devDependencies

### Problem Summary

Setting `NODE_ENV=production` in CI/CD build environments causes `npm ci` and `npm install` to **skip devDependencies** by default. This breaks builds that require test frameworks, type definitions, or other development tools.

### Symptoms

When `NODE_ENV=production` is set in CodeBuild or CI/CD environments:

1. **Test failures with missing types**:
   ```
   error TS2593: Cannot find name 'describe'. Do you need to install type definitions for a test runner?
   error TS2304: Cannot find name 'expect'.
   ```

2. **Missing test dependencies**:
   - `@types/jest` not found
   - `fast-check` not found
   - Other devDependencies missing

3. **Build log indicators**:
   ```
   npm ci
   added 200 packages  # Should be 400+ if devDependencies included
   ```

4. **Artifact upload failures**:
   ```
   Phase complete: UPLOAD_ARTIFACTS State: FAILED
   Message: no matching base directory path found for cdk.out
   ```
   This happens because tests fail, preventing `cdk synth` from running, so `cdk.out` is never created.

### Root Cause

When `NODE_ENV=production`:
- `npm ci` runs with `--omit=dev` flag implicitly
- `npm install` runs with `--omit=dev` flag implicitly
- All packages in `devDependencies` are skipped
- Tests fail because test frameworks and type definitions aren't installed
- Build fails before CDK synthesis can run

### Solution

**DO NOT set `NODE_ENV=production` in CI/CD builds that run tests.**

#### Platform Pipeline (lib/platform-pipeline-stack.ts)

```typescript
// ❌ WRONG - Breaks tests
buildEnvironment: {
  environmentVariables: {
    'NODE_ENV': {
      value: 'production',
      type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
    },
  },
}

// ✅ CORRECT - Allows devDependencies
buildEnvironment: {
  environmentVariables: {
    // Do not set NODE_ENV for builds that run tests
    'CDK_DEFAULT_REGION': {
      value: cdk.Aws.REGION,
      type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
    },
  },
}
```

#### Application Pipeline (lib/constructs/application-pipeline-construct.ts)

```typescript
// ❌ WRONG - Breaks tests
environment: {
  buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
  environmentVariables: {
    'NODE_ENV': { value: 'production' },
  },
}

// ✅ CORRECT - Allows devDependencies
environment: {
  buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
  environmentVariables: {
    // Do not set NODE_ENV if tests are run in this stage
  },
}
```

#### Buildspec Files (buildspec.yml)

```yaml
# ❌ WRONG - Breaks tests
env:
  variables:
    NODE_ENV: production
    CDK_NEW_BOOTSTRAP: 1

# ✅ CORRECT - Allows devDependencies
env:
  variables:
    CDK_NEW_BOOTSTRAP: 1
    # Do not set NODE_ENV for builds that run tests
```

### When to Use NODE_ENV=production

Only set `NODE_ENV=production` in stages that:
1. Do NOT run tests
2. Do NOT require devDependencies
3. Only perform deployment or runtime operations

Example: A deployment-only stage that doesn't build or test:
```typescript
// Deployment stage - no tests, no build
environment: {
  environmentVariables: {
    'NODE_ENV': { value: 'production' }, // OK here
  },
}
```

### Alternative: Explicit devDependencies Installation

If you must use `NODE_ENV=production` but need devDependencies:

```bash
# Force installation of devDependencies
npm ci --include=dev

# Or
npm install --include=dev
```

However, this is NOT recommended. It's better to not set `NODE_ENV=production` in test/build stages.

### Verification Checklist

When debugging CI/CD build failures:

- [ ] Check if `NODE_ENV=production` is set in environment variables
- [ ] Verify devDependencies are being installed:
  ```bash
  # Should show 400+ packages if devDependencies included
  npm ci
  added XXX packages
  ```
- [ ] Check CodeBuild logs for phase structure:
  ```
  INSTALL: X commands
  BUILD: Y commands
  ```
- [ ] Verify test dependencies exist after npm ci:
  ```bash
  ls node_modules/@types/jest  # Should exist
  npm list @types/jest         # Should show version
  ```

### Best Practices

1. **Never set NODE_ENV=production in stages that run tests**
2. **Use `npm ci` for reproducible builds** (not `npm install`)
3. **Keep test dependencies in devDependencies** (where they belong)
4. **Separate build/test stages from deployment stages**
5. **Document environment variables** and their impact

### Related Issues

- TypeScript type resolution failures
- Jest/testing framework not found
- Missing build tools (webpack, rollup, etc.)
- CDK synthesis failures due to missing dependencies
- Artifact upload failures (no cdk.out directory)

### References

- npm documentation: https://docs.npmjs.com/cli/v10/commands/npm-ci
- NODE_ENV behavior: https://docs.npmjs.com/cli/v10/using-npm/config#omit
- AWS CodeBuild environment variables: https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html

---

**Last Updated**: 2026-03-05  
**Severity**: CRITICAL - Breaks all builds with tests  
**Impact**: Platform pipeline, application pipelines, all CI/CD builds

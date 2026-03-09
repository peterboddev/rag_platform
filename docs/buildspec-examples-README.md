# Buildspec Examples for Application Teams

## Overview

This directory contains working buildspec.yml examples that have been tested with the RAG platform pipeline. Use these as templates for your application's build process.

## Available Examples

### 1. buildspec-example-cdk.yml
For CDK (Cloud Development Kit) applications that use TypeScript/JavaScript infrastructure as code.

**Use this if:**
- Your application uses AWS CDK
- You have a `cdk.json` file in your repository
- You run `npx cdk synth` to generate CloudFormation templates

**Key features:**
- Node.js 20 runtime
- npm ci for reproducible builds
- Test execution before build
- CDK synthesis
- Proper artifact configuration (no base-directory)

### 2. buildspec-example-sam.yml
For SAM (Serverless Application Model) applications that use template.yaml.

**Use this if:**
- Your application uses AWS SAM
- You have a `template.yaml` file in your repository
- You run `sam build` to build your application

**Key features:**
- Node.js 20 + Python 3.11 runtimes
- SAM CLI installation
- npm ci for reproducible builds
- Test execution before build
- SAM build and package
- Proper artifact configuration for SAM

## How to Use

1. **Copy the appropriate example** to your repository root as `buildspec.yml`:
   ```bash
   # For CDK applications
   cp docs/buildspec-example-cdk.yml buildspec.yml
   
   # For SAM applications
   cp docs/buildspec-example-sam.yml buildspec.yml
   ```

2. **Customize for your application**:
   - Update test commands if you use different test frameworks
   - Add custom build steps if needed
   - Add environment variables specific to your application
   - Modify artifact files if you have additional files to include

3. **Commit to your repository**:
   ```bash
   git add buildspec.yml
   git commit -m "Add buildspec.yml for platform pipeline"
   git push origin main
   ```

4. **Trigger the pipeline**:
   - The platform pipeline will automatically use your buildspec.yml
   - Check CodeBuild logs if the build fails
   - See troubleshooting guide: `docs/APP_TEAM_TROUBLESHOOTING.md`

## Critical Rules

### ❌ DO NOT:
1. **Set NODE_ENV=production** in env variables - breaks devDependencies installation
2. **Use base-directory: cdk.out** in artifacts - causes double-nested paths
3. **Use npm install** - use `npm ci` for reproducible builds
4. **Skip tests** - tests should run before build to catch issues early

### ✅ DO:
1. **Use nodejs: 20** runtime version (compatible with npm 11+)
2. **Use npm ci** for dependency installation
3. **Run tests** in pre_build phase
4. **Include all necessary files** in artifacts section
5. **Cache node_modules** for faster builds

## Common Issues

### Issue 1: "buildspec.yml does not exist"
**Solution**: Ensure buildspec.yml is at the root of your repository, not in a subdirectory.

### Issue 2: "devDependencies not found"
**Solution**: Remove NODE_ENV=production from env variables section.

### Issue 3: "template.yaml does not exist in artifact"
**Solution**: 
- For CDK apps: Ensure `npx cdk synth` runs successfully
- For SAM apps: Ensure `sam build` runs successfully
- Check CodeBuild logs for actual error

### Issue 4: "cdk.out directory not found"
**Solution**: 
- Ensure CDK synthesis runs: `npx cdk synth`
- Do NOT use `base-directory: cdk.out` in artifacts section
- Check that cdk.json exists in your repository

## Testing Locally

Before committing your buildspec.yml, test the commands locally:

```bash
# Install dependencies
npm ci

# Run tests
npm run test

# Build application
npm run build

# For CDK apps: Synthesize
npx cdk synth

# For SAM apps: Build
sam build
```

If these commands work locally, they should work in the pipeline.

## Environment Variables

The platform pipeline automatically provides these environment variables:

- `APPLICATION_NAME`: Your application name (e.g., "rag-app")
- `AWS_DEFAULT_REGION`: AWS region (e.g., "us-east-1")
- `AWS_ACCOUNT_ID`: AWS account ID
- `ARTIFACT_BUCKET`: S3 bucket for artifacts (SAM apps only)

You can reference these in your buildspec.yml:
```yaml
build:
  commands:
    - echo "Building $APPLICATION_NAME in $AWS_DEFAULT_REGION"
```

## Additional Resources

- **App Team Guide**: `docs/rag-app-team-guide-v2.md`
- **Troubleshooting Guide**: `docs/APP_TEAM_TROUBLESHOOTING.md`
- **NODE_ENV Fix Documentation**: `docs/NODE_ENV_FIX.md`
- **Pipeline Configuration**: `docs/application-pipeline-configuration.md`

## Support

If you encounter issues:

1. Check CodeBuild logs in AWS Console
2. Review troubleshooting guide: `docs/APP_TEAM_TROUBLESHOOTING.md`
3. Verify your buildspec.yml matches the examples
4. Contact platform team if infrastructure issues persist

## Version History

- **2026-03-09**: Initial working examples created
  - CDK example with Node.js 20
  - SAM example with Node.js 20 + Python 3.11
  - No NODE_ENV=production
  - No base-directory in artifacts

# App Team Troubleshooting: "template.yaml does not exist"

## Error Message

```
File [template.yaml] does not exist in artifact [BuildOutput]
```

## What This Means

This error appears in the **Deploy stage**, but the actual problem is in the **Build stage**. The build failed before creating the CloudFormation template, so there's nothing to deploy.

## Root Cause

Your pipeline is configured to use CDK (not SAM), and the template path is set to:
```
cdk.out/RAGApplicationStack.template.json
```

But this file doesn't exist because `cdk synth` either:
1. Didn't run (build failed earlier)
2. Ran but failed (CDK synthesis error)
3. Ran but created a different file name

## How to Debug

### Step 1: Check CodeBuild Logs

Go to AWS Console → CodeBuild → Build History → Click on the failed build

Look for the **actual error** in the build logs. Common errors:

#### Error 1: SSM Permission Denied
```
User is not authorized to perform: ssm:GetParameter on resource: 
arn:aws:ssm:us-east-1:450683699755:parameter/rag-app/dev/*
```

**Solution**: Platform team needs to deploy the updated pipeline with SSM permissions (already fixed in platform code, waiting for deployment)

#### Error 2: CDK Synthesis Fails
```
Error: SSM parameter /rag-app/dev/iam/application-role-arn not found
```

**Solution**: You're reading SSM parameters at synthesis time. Use `ssm.StringParameter.valueFromLookup()` instead of AWS SDK calls.

See: `docs/rag-app-team-guide-v2.md` → "Quick Start: CDK Application Setup"

#### Error 3: Tests Failing
```
npm run test
FAIL src/handlers/chat.test.ts
```

**Solution**: Fix your failing tests or use `npm run test --if-present` to skip if no tests exist

#### Error 4: Missing devDependencies
```
error TS2593: Cannot find name 'describe'
npm ci
added 200 packages  # Should be 400+ if devDependencies included
```

**Solution**: Remove `NODE_ENV=production` from your build configuration (already removed from platform config)

#### Error 5: Wrong Stack Name
```
cdk synth
Successfully synthesized to cdk.out/MyAppStack.template.json
```

But your `templatePath` is set to `cdk.out/RAGApplicationStack.template.json`

**Solution**: Update `templatePath` in `config/applications/rag-app.json` to match your actual stack name

### Step 2: Test Locally

Before pushing to the pipeline, test your build locally:

```bash
# Install dependencies
npm ci

# Run tests
npm run test

# Synthesize CDK
npx cdk synth

# Check what was created
ls cdk.out/
```

You should see:
```
cdk.out/
├── RAGApplicationStack.template.json  # Your CloudFormation template
├── manifest.json
├── tree.json
└── assembly-RAGApplicationStack/
```

If `cdk synth` fails locally, fix it before pushing.

### Step 3: Verify Template Path

Check your CDK stack name matches the templatePath:

**In your CDK code** (`lib/rag-application-stack.ts` or similar):
```typescript
export class RAGApplicationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // ...
  }
}
```

**In your CDK app** (`bin/app.ts` or similar):
```typescript
new RAGApplicationStack(app, 'RAGApplicationStack', {
  // ...
});
```

The stack ID (`'RAGApplicationStack'`) determines the template filename.

**In your pipeline config** (`config/applications/rag-app.json`):
```json
{
  "templatePath": "cdk.out/RAGApplicationStack.template.json"
}
```

These must match!

### Step 4: Check Build Commands

Your build commands should include `cdk synth`:

```json
{
  "buildConfig": {
    "commands": [
      "npm ci",
      "npm run test --if-present",
      "npm run build --if-present",
      "npx cdk synth",  // ← This creates the template
      "echo 'Build completed'"
    ]
  }
}
```

## Common Mistakes

### ❌ Wrong: Using SAM template path for CDK app
```json
{
  "templatePath": "template.yaml"  // This is for SAM, not CDK
}
```

### ✅ Correct: Using CDK output path
```json
{
  "templatePath": "cdk.out/RAGApplicationStack.template.json"
}
```

### ❌ Wrong: Reading SSM at synthesis time
```typescript
const roleArn = await ssmClient.send(new GetParameterCommand({...}));
```

### ✅ Correct: Using CDK's valueFromLookup
```typescript
const roleArn = ssm.StringParameter.valueFromLookup(
  this,
  '/rag-app/dev/iam/application-role-arn'
);
```

### ❌ Wrong: Setting NODE_ENV=production in build
```json
{
  "buildConfig": {
    "environment": {
      "NODE_ENV": "production"  // Breaks devDependencies
    }
  }
}
```

### ✅ Correct: No NODE_ENV in build stage
```json
{
  "buildConfig": {
    "environment": {
      "NPM_CONFIG_CACHE": "/tmp/.npm"
    }
  }
}
```

## Quick Checklist

- [ ] CodeBuild logs show the actual error (not just "template.yaml not found")
- [ ] `cdk synth` command is in your build commands
- [ ] `templatePath` matches your actual CDK stack name
- [ ] Using `ssm.StringParameter.valueFromLookup()` for platform parameters
- [ ] No `NODE_ENV=production` in build configuration
- [ ] Tests pass locally with `npm run test`
- [ ] `cdk synth` works locally
- [ ] Platform team has deployed SSM permissions fix

## Special Case: Build Succeeds But Template Not Found

If your build shows **SUCCESS** but you still get "template.yaml does not exist", the template is being created with a **different name** than expected.

### Diagnosis Steps

1. **Check CodeBuild artifacts**:
   - Go to CodeBuild → Build History → Successful build
   - Click "Artifacts" tab
   - Download the BuildOutput artifact
   - Unzip and look at what files exist

2. **Check `cdk synth` output in logs**:
   ```
   [Container] Running command npx cdk synth
   Successfully synthesized to cdk.out/MyActualStackName.template.json
   ```
   
   The actual filename is shown here!

3. **Common mismatches**:
   ```
   Pipeline expects: cdk.out/RAGApplicationStack.template.json
   CDK creates:      cdk.out/RagAppStack.template.json
   ```

### Solution: Update templatePath

**Option 1: Update pipeline configuration** (Recommended)

Edit `config/applications/rag-app.json`:
```json
{
  "templatePath": "cdk.out/YourActualStackName.template.json"
}
```

Ask platform team to redeploy the pipeline.

**Option 2: Update CDK stack name**

In your CDK app code:
```typescript
// Make sure this matches the templatePath
new RAGApplicationStack(app, 'RAGApplicationStack', {
  // ...
});
```

### Quick Fix: List All Templates

If you have multiple stacks, you can use a wildcard pattern or specify the exact stack:

```bash
# In your cdk.out directory after synth
ls *.template.json
```

Then update `templatePath` to match the actual filename.

## Still Stuck?

1. **Share CodeBuild logs** - Look for the `cdk synth` output showing actual filename
2. **Download build artifacts** - Check what files actually exist in BuildOutput
3. **Check stack name** - Verify CDK stack ID matches templatePath
4. **Review the guide** - See `docs/rag-app-team-guide-v2.md` for complete examples

## Platform Team Status

**SSM Permissions Fix**: ✅ Code updated, ⏳ Waiting for deployment

Once the platform team deploys the updated pipeline construct, your CodeBuild role will automatically have SSM read permissions.

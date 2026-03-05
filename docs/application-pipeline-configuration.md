# Application Pipeline Configuration Guide

## Overview

This guide explains how to configure application pipelines for both SAM and CDK-based applications, with a focus on the `templatePath` configuration option that enables CDK application deployments.

## Configuration File Structure

Application pipeline configurations are stored in `config/applications/` directory as JSON files. Each configuration defines how the platform pipeline should build and deploy your application.

## Template Path Configuration

### What is templatePath?

The `templatePath` field specifies the location of the CloudFormation template file within the build artifacts. This field is crucial for CDK applications, which generate templates with different naming conventions than SAM applications.

### Default Behavior (SAM Applications)

**For SAM applications, you can omit the `templatePath` field entirely.**

SAM applications follow the convention of generating a `template.yaml` file at the root of the build output. The platform pipeline defaults to this convention, so no additional configuration is needed.

**Example SAM Configuration:**
```json
{
  "applicationName": "my-sam-app",
  "sourceRepo": {
    "owner": "my-org",
    "repo": "my-sam-app",
    "branch": "main"
  },
  "buildConfig": {
    "runtime": "20",
    "commands": [
      "npm ci",
      "sam build"
    ]
  },
  "deploymentTargets": ["dev", "staging", "prod"]
}
```

### CDK Applications

**For CDK applications, you MUST specify the `templatePath` field.**

CDK applications synthesize CloudFormation templates with the naming pattern `<StackName>.template.json` in the `cdk.out/` directory. You need to tell the pipeline where to find your specific stack's template.

**Example CDK Configuration:**
```json
{
  "applicationName": "my-cdk-app",
  "sourceRepo": {
    "owner": "my-org",
    "repo": "my-cdk-app",
    "branch": "main"
  },
  "buildConfig": {
    "runtime": "20",
    "commands": [
      "npm ci",
      "npm run build",
      "npx cdk synth"
    ]
  },
  "templatePath": "cdk.out/MyApplicationStack.template.json",
  "deploymentTargets": ["dev", "staging", "prod"]
}
```

### How to Determine Your Template Path

For CDK applications, follow these steps:

1. **Run CDK synthesis locally:**
   ```bash
   npx cdk synth
   ```

2. **Check the `cdk.out/` directory:**
   ```bash
   ls cdk.out/*.template.json
   ```

3. **Identify your stack's template file:**
   - The file will be named `<YourStackName>.template.json`
   - For example: `MyApplicationStack.template.json`

4. **Set the templatePath in your configuration:**
   ```json
   "templatePath": "cdk.out/MyApplicationStack.template.json"
   ```

### Multiple CDK Stacks

If your CDK application defines multiple stacks, you need to specify which stack should be deployed by the pipeline. Each application pipeline configuration can only deploy one stack.

**Options:**

1. **Deploy a single stack:**
   ```json
   "templatePath": "cdk.out/MainApplicationStack.template.json"
   ```

2. **Create separate pipeline configurations for each stack:**
   - `config/applications/my-app-frontend.json` → deploys `FrontendStack.template.json`
   - `config/applications/my-app-backend.json` → deploys `BackendStack.template.json`

3. **Use a parent stack that includes all child stacks:**
   - Create a parent CDK stack that includes all other stacks as nested stacks
   - Deploy only the parent stack through the pipeline

## Build Configuration for CDK Applications

### Required Build Commands

Your CDK application's build configuration must include the `cdk synth` command to generate the CloudFormation templates:

```json
"buildConfig": {
  "runtime": "20",
  "commands": [
    "echo 'Installing dependencies...'",
    "npm ci",
    "echo 'Running tests...'",
    "npm run test --if-present",
    "echo 'Building application...'",
    "npm run build",
    "echo 'Synthesizing CDK stacks...'",
    "npx cdk synth",
    "echo 'Build completed successfully'"
  ]
}
```

### Build Artifacts

The platform pipeline automatically includes the following patterns in build artifacts:
- `**/*.template.json` (CDK templates)
- `**/*.template.yaml` (alternative template format)
- `template.yaml` (SAM default)
- All files in `cdk.out/` directory

This ensures that both SAM and CDK templates are captured in the build output.

## Validation and Error Handling

### Configuration Validation

The platform pipeline validates the `templatePath` configuration:

- **Path must be relative:** Absolute paths are not allowed
- **Path format:** Must be a valid file path without invalid characters
- **File existence:** The deployment will fail if the specified template file doesn't exist in the build artifacts

### Common Errors

**Error: "File [template.yaml] does not exist in artifact [BuildOutput]"**
- **Cause:** CDK application without `templatePath` specified
- **Solution:** Add `"templatePath": "cdk.out/YourStack.template.json"` to your configuration

**Error: "File [cdk.out/MyStack.template.json] does not exist in artifact [BuildOutput]"**
- **Cause:** Incorrect stack name or missing `cdk synth` command
- **Solution:** 
  1. Verify the stack name matches your CDK code
  2. Ensure `npx cdk synth` is in your build commands
  3. Check that the build completes successfully

**Error: "Invalid templatePath: must be relative path"**
- **Cause:** Using an absolute path like `/cdk.out/MyStack.template.json`
- **Solution:** Use a relative path: `"templatePath": "cdk.out/MyStack.template.json"`

## Complete Examples

### Example 1: Simple SAM Application

```json
{
  "applicationName": "simple-sam-app",
  "team": "backend-team",
  "sourceRepo": {
    "owner": "my-company",
    "repo": "simple-sam-app",
    "branch": "main"
  },
  "buildConfig": {
    "runtime": "20",
    "commands": [
      "npm ci",
      "npm test",
      "sam build"
    ]
  },
  "deploymentTargets": [
    {
      "name": "dev",
      "account": "123456789012",
      "region": "us-east-1",
      "stackName": "simple-sam-app-dev",
      "requiresApproval": false
    }
  ],
  "enabled": true
}
```

### Example 2: CDK Application with TypeScript

```json
{
  "applicationName": "typescript-cdk-app",
  "team": "platform-team",
  "sourceRepo": {
    "owner": "my-company",
    "repo": "typescript-cdk-app",
    "branch": "main"
  },
  "buildConfig": {
    "runtime": "20",
    "commands": [
      "npm ci",
      "npm run test",
      "npm run build",
      "npx cdk synth"
    ],
    "environment": {
      "NODE_ENV": "production"
    }
  },
  "templatePath": "cdk.out/TypeScriptApplicationStack.template.json",
  "deploymentTargets": [
    {
      "name": "dev",
      "account": "123456789012",
      "region": "us-east-1",
      "stackName": "typescript-cdk-app-dev",
      "requiresApproval": false
    },
    {
      "name": "prod",
      "account": "123456789012",
      "region": "us-east-1",
      "stackName": "typescript-cdk-app-prod",
      "requiresApproval": true
    }
  ],
  "enabled": true
}
```

### Example 3: Multi-Stack CDK Application

```json
{
  "applicationName": "multi-stack-frontend",
  "team": "frontend-team",
  "sourceRepo": {
    "owner": "my-company",
    "repo": "multi-stack-app",
    "branch": "main"
  },
  "buildConfig": {
    "runtime": "20",
    "commands": [
      "npm ci",
      "npm run build",
      "npx cdk synth"
    ]
  },
  "templatePath": "cdk.out/FrontendStack.template.json",
  "deploymentTargets": ["dev", "staging", "prod"],
  "enabled": true
}
```

```json
{
  "applicationName": "multi-stack-backend",
  "team": "backend-team",
  "sourceRepo": {
    "owner": "my-company",
    "repo": "multi-stack-app",
    "branch": "main"
  },
  "buildConfig": {
    "runtime": "20",
    "commands": [
      "npm ci",
      "npm run build",
      "npx cdk synth"
    ]
  },
  "templatePath": "cdk.out/BackendStack.template.json",
  "deploymentTargets": ["dev", "staging", "prod"],
  "enabled": true
}
```

## Best Practices

1. **Always run `cdk synth` locally first** to verify your template path before configuring the pipeline

2. **Use descriptive stack names** that clearly indicate the purpose of the stack

3. **Keep stack names consistent** across environments (e.g., `MyApp-dev`, `MyApp-staging`, `MyApp-prod`)

4. **Test in dev environment first** before enabling staging and production deployments

5. **Use manual approval** for production deployments to prevent accidental changes

6. **Document your template path** in your application's README for other team members

## Troubleshooting

### Pipeline fails at deployment stage

1. Check CodeBuild logs to verify `cdk synth` completed successfully
2. Verify the template file exists in the build artifacts
3. Confirm the `templatePath` matches the actual file name (case-sensitive)
4. Ensure the `cdk.out/` directory is included in build artifacts

### Template file not found

1. Run `cdk synth` locally and check the output directory
2. Verify your CDK stack name matches the template file name
3. Check that your buildspec includes the `cdk synth` command
4. Ensure the build phase completes without errors

### Multiple templates generated

1. Identify which stack you want to deploy
2. Create separate pipeline configurations for each stack if needed
3. Consider using a parent stack pattern for related stacks

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [CloudFormation Template Reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-reference.html)
- Platform Pipeline Architecture Guide: `.kiro/steering/platform-pipeline-architecture.md`

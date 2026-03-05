# CDK Template Deployment Fix - Bugfix Design

## Overview

The application pipeline deployment stage currently hardcodes the CloudFormation template path to `template.yaml`, which is the SAM convention. However, CDK applications generate templates with the naming pattern `<StackName>.template.json` in the `cdk.out/` directory. This causes deployment failures for CDK-based applications even though the build phase completes successfully.

The fix will make the deployment stage flexible enough to accept both SAM-style `template.yaml` files and CDK-style `.template.json` files by adding a configurable `templatePath` parameter to the application configuration and implementing intelligent template detection in the build artifacts.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a CDK application generates a `.template.json` file but the deployment stage expects `template.yaml`
- **Property (P)**: The desired behavior - deployment stage successfully locates and uses the correct template file regardless of format (SAM or CDK)
- **Preservation**: Existing SAM-based applications must continue to deploy successfully with `template.yaml` files
- **ApplicationPipelineConstruct**: The CDK construct in `lib/constructs/application-pipeline-construct.ts` that creates application pipelines
- **CloudFormationCreateUpdateStackAction**: The CodePipeline action that deploys CloudFormation stacks
- **BuildOutput**: The CodePipeline artifact containing build results from the CodeBuild stage
- **templatePath**: The path to the CloudFormation template file within the build artifacts
- **SAM Template**: AWS Serverless Application Model template, conventionally named `template.yaml`
- **CDK Template**: AWS CDK-generated CloudFormation template, named `<StackName>.template.json`

## Bug Details

### Fault Condition

The bug manifests when a CDK application completes the build phase and generates a CloudFormation template with the `.template.json` extension in the `cdk.out/` directory. The deployment stage fails because it's hardcoded to look for `template.yaml` in the build artifacts.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BuildArtifact
  OUTPUT: boolean
  
  RETURN input.containsFile('*.template.json')
         AND input.isCDKApplication()
         AND NOT input.containsFile('template.yaml')
         AND deploymentAction.templatePath == 'template.yaml'
END FUNCTION
```

### Examples

- **CDK Application with Single Stack**: Build generates `MultiTenantDocumentManagerStack.template.json` in `cdk.out/` directory, deployment fails with "File [template.yaml] does not exist in artifact [BuildOutput]"

- **CDK Application with Multiple Stacks**: Build generates multiple `.template.json` files (e.g., `NetworkStack.template.json`, `ApplicationStack.template.json`), deployment fails because it cannot find `template.yaml`

- **SAM Application**: Build generates `template.yaml`, deployment succeeds (current working behavior)

- **Edge Case - CDK with Custom Output**: CDK application configured to output template to custom location, deployment fails if not at root level with name `template.yaml`

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- SAM-based applications that generate `template.yaml` must continue to deploy successfully
- Build phase must continue to execute with all tests passing
- Multiple deployment targets (dev, staging, prod) must continue to deploy in sequence
- Manual approval gates must continue to function for environments that require approval

**Scope:**
All inputs that do NOT involve CDK-generated `.template.json` files should be completely unaffected by this fix. This includes:
- SAM applications using `template.yaml`
- Build artifact structure and content
- CodeBuild project configuration
- Pipeline stage ordering and execution
- IAM roles and permissions

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Hardcoded Template Path**: The `CloudFormationCreateUpdateStackAction` in `ApplicationPipelineConstruct.createPipeline()` method (line 388) hardcodes `templatePath: buildOutput.atPath('template.yaml')`, which assumes all applications use SAM conventions

2. **No Template Path Configuration**: The `ApplicationPipelineConfig` interface and application configuration files (e.g., `config/applications/rag-app.json`) do not include a `templatePath` parameter, making it impossible for applications to specify their template location

3. **Build Artifact Assumptions**: The default buildspec in `createBuildProject()` method includes all files in artifacts but doesn't handle CDK-specific output directory structure (`cdk.out/`)

4. **Lack of Template Detection**: There's no logic to automatically detect which template file to use based on the build artifacts content

## Correctness Properties

Property 1: Fault Condition - CDK Template Deployment

_For any_ build artifact where a CDK application generates a `.template.json` file and the application configuration specifies a `templatePath`, the fixed deployment stage SHALL successfully locate and use the CDK-generated template file, causing the CloudFormation stack to deploy correctly.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - SAM Template Deployment

_For any_ build artifact where a SAM application generates a `template.yaml` file and no custom `templatePath` is specified, the fixed deployment stage SHALL produce exactly the same behavior as the original code, preserving successful deployment using the default `template.yaml` file.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `lib/constructs/application-pipeline-construct.ts`

**Interface**: `ApplicationPipelineConfig`

**Specific Changes**:

1. **Add Template Path Configuration**: Add optional `templatePath` field to `ApplicationPipelineConfig` interface
   - Type: `string | undefined`
   - Default value: `'template.yaml'` (maintains backward compatibility)
   - Description: Path to CloudFormation template within build artifacts

2. **Update Deployment Action**: Modify `CloudFormationCreateUpdateStackAction` in `createPipeline()` method
   - Replace hardcoded `templatePath: buildOutput.atPath('template.yaml')`
   - Use configurable path: `templatePath: buildOutput.atPath(config.templatePath || 'template.yaml')`
   - Applies to all deployment targets in the loop

3. **Update Build Artifacts Configuration**: Modify default buildspec in `createBuildProject()` method
   - Ensure CDK output directory (`cdk.out/`) is included in artifacts
   - Add artifact files pattern that captures both SAM and CDK templates
   - Update artifacts section to include: `'**/*.template.json'`, `'**/*.template.yaml'`, `'template.yaml'`

4. **Add Configuration Validation**: Update `validateConfiguration()` method
   - Add optional validation for `templatePath` format
   - Warn if `templatePath` contains invalid characters or paths
   - Ensure path is relative (not absolute)

5. **Update Documentation**: Add JSDoc comments explaining the `templatePath` configuration option
   - Document default behavior (SAM convention)
   - Provide examples for CDK applications
   - Explain how to specify custom template paths

**File**: `config/applications/rag-app.json` (example)

**Specific Changes**:

1. **Add Template Path Field**: Add `templatePath` configuration for CDK applications
   - Example: `"templatePath": "cdk.out/MultiTenantDocumentManagerStack.template.json"`
   - Optional field - omit for SAM applications using default `template.yaml`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Create a minimal CDK application that generates a `.template.json` file, configure it in the application pipeline, and observe the deployment failure on the UNFIXED code. This will confirm the hardcoded `template.yaml` path is the root cause.

**Test Cases**:
1. **CDK Single Stack Test**: Deploy a CDK app with one stack generating `TestStack.template.json` (will fail on unfixed code)
2. **CDK Multiple Stacks Test**: Deploy a CDK app with multiple stacks (will fail on unfixed code, may reveal additional issues)
3. **CDK Custom Output Test**: Deploy a CDK app with custom output directory (will fail on unfixed code)
4. **Missing Template Test**: Deploy with invalid `templatePath` configuration (should fail gracefully on both unfixed and fixed code)

**Expected Counterexamples**:
- Deployment stage fails with error message: "File [template.yaml] does not exist in artifact [BuildOutput]"
- Possible causes: hardcoded template path, missing template path configuration, incorrect artifact structure

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL buildArtifact WHERE isBugCondition(buildArtifact) DO
  config := createApplicationConfig(templatePath = detectCDKTemplate(buildArtifact))
  result := deploymentStage_fixed(buildArtifact, config)
  ASSERT result.status == 'SUCCESS'
  ASSERT result.stackDeployed == true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL buildArtifact WHERE NOT isBugCondition(buildArtifact) DO
  ASSERT deploymentStage_original(buildArtifact) = deploymentStage_fixed(buildArtifact)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for SAM applications, then write property-based tests capturing that behavior.

**Test Cases**:
1. **SAM Template Preservation**: Observe that SAM apps with `template.yaml` deploy successfully on unfixed code, then verify this continues after fix
2. **Build Phase Preservation**: Observe that build phase completes successfully on unfixed code, then verify this continues after fix
3. **Multi-Environment Preservation**: Observe that deployments to dev/staging/prod work on unfixed code, then verify this continues after fix
4. **Manual Approval Preservation**: Observe that manual approval gates function correctly on unfixed code, then verify this continues after fix

### Unit Tests

- Test `ApplicationPipelineConfig` interface with and without `templatePath` field
- Test default `templatePath` value is `'template.yaml'` when not specified
- Test custom `templatePath` values are correctly passed to deployment action
- Test configuration validation for invalid `templatePath` values
- Test build artifact structure includes both SAM and CDK template patterns

### Property-Based Tests

- Generate random application configurations with various `templatePath` values and verify deployment stage uses correct path
- Generate random build artifacts with different template file names and verify correct template is selected
- Test that all SAM applications (without `templatePath` specified) continue to work across many scenarios

### Integration Tests

- Test full pipeline flow with CDK application from source to deployment
- Test full pipeline flow with SAM application to ensure no regression
- Test switching between CDK and SAM applications in the same pipeline infrastructure
- Test deployment to multiple environments (dev, staging, prod) with CDK templates
- Test manual approval gates work correctly with CDK deployments

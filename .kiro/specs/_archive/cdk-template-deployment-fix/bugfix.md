# Bugfix Requirements Document

## Introduction

The application pipeline deployment stage is failing for CDK-based applications because it expects a SAM-style `template.yaml` file, but CDK applications generate CloudFormation templates with the naming convention `<StackName>.template.json` (e.g., `MultiTenantDocumentManagerStack.template.json`). This prevents CDK applications from being deployed through the platform's application pipeline infrastructure, even though the build phase completes successfully.

The bug affects the `ApplicationPipelineConstruct` in `lib/constructs/application-pipeline-construct.ts`, specifically the CloudFormation deployment action that hardcodes the template path to `template.yaml`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a CDK application completes the build phase and generates a `.template.json` file in the `cdk.out/` directory THEN the deployment stage fails with error "File [template.yaml] does not exist in artifact [BuildOutput]"

1.2 WHEN the application's buildspec.yml attempts to copy the CDK template to `template.yaml` THEN the deployment stage still reports the file is missing because the platform pipeline may be using its own buildspec configuration

1.3 WHEN the `CloudFormationCreateUpdateStackAction` is configured with `templatePath: buildOutput.atPath('template.yaml')` THEN it cannot find CDK-generated templates that follow the `<StackName>.template.json` naming convention

### Expected Behavior (Correct)

2.1 WHEN a CDK application completes the build phase and generates a `.template.json` file THEN the deployment stage SHALL successfully locate and use the CDK-generated template file

2.2 WHEN the application's buildspec.yml specifies artifact files THEN the deployment stage SHALL use the artifacts produced by the application's build configuration

2.3 WHEN the `CloudFormationCreateUpdateStackAction` is configured THEN it SHALL accept both SAM-style `template.yaml` files and CDK-style `.template.json` files

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a SAM-based application generates a `template.yaml` file THEN the deployment stage SHALL CONTINUE TO deploy successfully using the `template.yaml` file

3.2 WHEN the build phase completes successfully with all tests passing THEN the deployment stage SHALL CONTINUE TO receive the build artifacts

3.3 WHEN multiple deployment targets are configured (dev, staging, prod) THEN the deployment stage SHALL CONTINUE TO deploy to each environment in sequence

3.4 WHEN manual approval is required for an environment THEN the deployment stage SHALL CONTINUE TO wait for approval before deploying

/**
 * CDK CLI Version Mismatch Bugfix Tests
 *
 * Tests verifying the fix for the CDK CLI version mismatch bug where
 * `npx cdk deploy` resolved to an incompatible local CLI version.
 *
 * The fix:
 * 1. Added `npm install -g aws-cdk@latest` to deploy buildspec install commands
 * 2. Changed `npx cdk deploy` to `cdk deploy` in deploy buildspec build commands
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Template } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import {
  ApplicationPipelineConstruct,
  ApplicationPipelineConfig,
  DeploymentTarget,
} from '../../lib/constructs/application-pipeline-construct';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal config that satisfies the construct's validation. */
function buildConfig(targets: DeploymentTarget[]): ApplicationPipelineConfig {
  return {
    applicationName: 'test-app',
    sourceRepo: { owner: 'test-owner', repo: 'test-repo', branch: 'main' },
    deploymentTargets: targets,
  };
}

/** Default single-target config for simple tests. */
function defaultTarget(): DeploymentTarget {
  return {
    name: 'Development',
    account: '111111111111',
    region: 'us-east-1',
    stackName: 'MyAppStack',
  };
}

/**
 * Synthesise the construct and return the CloudFormation Template wrapper.
 */
function synthesize(targets: DeploymentTarget[]): Template {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
  new ApplicationPipelineConstruct(stack, 'Pipeline', {
    config: buildConfig(targets),
  });
  return Template.fromStack(stack);
}

/**
 * Extract the BuildSpec object for a deploy CodeBuild project whose
 * logical-id-friendly project name contains the given target name.
 *
 * The buildspec is stored as a JSON string inside the CloudFormation
 * template's `Source.BuildSpec` property of `AWS::CodeBuild::Project`.
 */
function extractDeployBuildSpec(
  template: Template,
  targetName: string,
): { install: { commands: string[] }; build: { commands: string[] }; [k: string]: unknown } {
  const projects = template.findResources('AWS::CodeBuild::Project');
  for (const [logicalId, resource] of Object.entries(projects)) {
    const props = (resource as any).Properties;
    const projectName: string | undefined = props?.Name;
    // Deploy projects are named `{appName}-cdk-deploy-{targetName}`
    if (projectName && projectName.includes(`cdk-deploy-${targetName}`)) {
      const raw = props.Source?.BuildSpec;
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        return {
          ...parsed.phases,
          _raw: parsed,
        };
      }
    }
  }
  throw new Error(`No deploy CodeBuild project found for target "${targetName}"`);
}

/**
 * Extract full CodeBuild project properties for a deploy target.
 */
function extractDeployProjectProps(template: Template, targetName: string): any {
  const projects = template.findResources('AWS::CodeBuild::Project');
  for (const [, resource] of Object.entries(projects)) {
    const props = (resource as any).Properties;
    const projectName: string | undefined = props?.Name;
    if (projectName && projectName.includes(`cdk-deploy-${targetName}`)) {
      return props;
    }
  }
  throw new Error(`No deploy CodeBuild project found for target "${targetName}"`);
}


// ===========================================================================
// Task 2 – Exploratory bug condition tests (code is already fixed)
// ===========================================================================

describe('Task 2: Exploratory bug condition tests (verify bug is fixed)', () => {
  let template: Template;

  beforeAll(() => {
    template = synthesize([defaultTarget()]);
  });

  /**
   * 2.1 – The deploy buildspec should NOT use `npx cdk deploy`.
   * On unfixed code this would have been `npx cdk deploy …`.
   * Since the fix is in place, we confirm the bug no longer exists.
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  test('2.1 deploy buildspec does NOT use npx cdk deploy (bug is fixed)', () => {
    const spec = extractDeployBuildSpec(template, 'Development');
    const buildCommands: string[] = spec.build.commands;
    const usesNpx = buildCommands.some((cmd: string) => cmd.includes('npx cdk'));
    expect(usesNpx).toBe(false);
  });

  /**
   * 2.2 – The deploy buildspec DOES install CDK CLI globally.
   * On unfixed code this install command would be absent.
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  test('2.2 deploy buildspec installs CDK CLI globally (bug is fixed)', () => {
    const spec = extractDeployBuildSpec(template, 'Development');
    const installCommands: string[] = spec.install.commands;
    const installsGlobalCdk = installCommands.some((cmd: string) =>
      cmd.includes('npm install -g aws-cdk@latest'),
    );
    expect(installsGlobalCdk).toBe(true);
  });
});

// ===========================================================================
// Task 3 – Fix checking tests
// ===========================================================================

describe('Task 3: Fix checking tests', () => {
  let template: Template;

  beforeAll(() => {
    template = synthesize([defaultTarget()]);
  });

  /**
   * 3.1 – Deploy buildspec includes `npm install -g aws-cdk@latest` in install phase.
   *
   * **Validates: Requirements 2.1**
   */
  test('3.1 deploy buildspec includes npm install -g aws-cdk@latest in install phase', () => {
    const spec = extractDeployBuildSpec(template, 'Development');
    expect(spec.install.commands).toContain('npm install -g aws-cdk@latest');
  });

  /**
   * 3.2 – Deploy buildspec uses `cdk deploy` without `npx` prefix.
   *
   * **Validates: Requirements 2.1**
   */
  test('3.2 deploy buildspec uses cdk deploy without npx prefix', () => {
    const spec = extractDeployBuildSpec(template, 'Development');
    const deployCmd = spec.build.commands.find((cmd: string) => cmd.includes('cdk deploy'));
    expect(deployCmd).toBeDefined();
    expect(deployCmd).not.toMatch(/npx\s+cdk/);
    // Must start with `cdk deploy` (possibly after echo commands)
    expect(deployCmd).toMatch(/^cdk deploy/);
  });

  /**
   * 3.3 – Property-based test: for random deployment targets, all deploy
   * buildspecs include global CDK CLI install and use `cdk deploy`.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  test('3.3 PBT: all deploy buildspecs include global CDK CLI install and use cdk deploy', () => {
    const targetArb = fc
      .record({
        name: fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,9}$/),
        account: fc.stringMatching(/^[0-9]{12}$/),
        region: fc.constantFrom('us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'),
        stackName: fc.stringMatching(/^[A-Za-z][A-Za-z0-9-]{0,19}$/),
      })
      .filter((t) => t.name.length > 0 && t.stackName.length > 0);

    fc.assert(
      fc.property(targetArb, (target) => {
        const tpl = synthesize([target as DeploymentTarget]);
        const spec = extractDeployBuildSpec(tpl, target.name);

        // Install phase must contain global CDK install
        const hasGlobalInstall = spec.install.commands.some((c: string) =>
          c.includes('npm install -g aws-cdk@latest'),
        );
        expect(hasGlobalInstall).toBe(true);

        // Build phase must use `cdk deploy` without `npx`
        const deployCmd = spec.build.commands.find((c: string) => c.includes('cdk deploy'));
        expect(deployCmd).toBeDefined();
        expect(deployCmd).not.toMatch(/npx\s+cdk/);
      }),
      { numRuns: 15 },
    );
  });
});


// ===========================================================================
// Task 4 – Preservation checking tests
// ===========================================================================

describe('Task 4: Preservation checking tests', () => {
  let template: Template;

  beforeAll(() => {
    template = synthesize([defaultTarget()]);
  });

  /**
   * 4.1 – `npm ci` is preserved in install commands.
   *
   * **Validates: Requirements 3.1**
   */
  test('4.1 npm ci is preserved in install commands', () => {
    const spec = extractDeployBuildSpec(template, 'Development');
    expect(spec.install.commands).toContain('npm ci');
  });

  /**
   * 4.2 – `--require-approval never --verbose` flags are preserved.
   *
   * **Validates: Requirements 3.2**
   */
  test('4.2 --require-approval never --verbose flags are preserved', () => {
    const spec = extractDeployBuildSpec(template, 'Development');
    const deployCmd = spec.build.commands.find((cmd: string) => cmd.includes('cdk deploy'));
    expect(deployCmd).toBeDefined();
    expect(deployCmd).toContain('--require-approval never');
    expect(deployCmd).toContain('--verbose');
  });

  /**
   * 4.3 – Stack name is correctly included in deploy command.
   *
   * **Validates: Requirements 3.2**
   */
  test('4.3 stack name is correctly included in deploy command', () => {
    const spec = extractDeployBuildSpec(template, 'Development');
    const deployCmd = spec.build.commands.find((cmd: string) => cmd.includes('cdk deploy'));
    expect(deployCmd).toBeDefined();
    expect(deployCmd).toContain('MyAppStack');
  });

  /**
   * 4.4 – Property-based test: for random deployment targets, all environment
   * config (build image, compute type, env vars) is preserved.
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  test('4.4 PBT: environment config is preserved for random deployment targets', () => {
    const targetArb = fc
      .record({
        name: fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,9}$/),
        account: fc.stringMatching(/^[0-9]{12}$/),
        region: fc.constantFrom('us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'),
        stackName: fc.stringMatching(/^[A-Za-z][A-Za-z0-9-]{0,19}$/),
      })
      .filter((t) => t.name.length > 0 && t.stackName.length > 0);

    fc.assert(
      fc.property(targetArb, (target) => {
        const tpl = synthesize([target as DeploymentTarget]);
        const props = extractDeployProjectProps(tpl, target.name);

        // Build image must be ARM Amazon Linux 2 Standard 3.0
        const image = props.Environment?.Image;
        expect(image).toMatch(/aws\/codebuild\/amazonlinux2-aarch64-standard:3\.0/);

        // Compute type must be SMALL (BUILD_GENERAL1_SMALL)
        expect(props.Environment?.ComputeType).toBe('BUILD_GENERAL1_SMALL');

        // Environment variables must include AWS_DEFAULT_REGION = target.region
        const envVars: Array<{ Name: string; Value: string }> =
          props.Environment?.EnvironmentVariables ?? [];
        const regionVar = envVars.find((v) => v.Name === 'AWS_DEFAULT_REGION');
        expect(regionVar).toBeDefined();
        expect(regionVar!.Value).toBe(target.region);

        // Environment variables must include AWS_ACCOUNT_ID = target.account
        const accountVar = envVars.find((v) => v.Name === 'AWS_ACCOUNT_ID');
        expect(accountVar).toBeDefined();
        expect(accountVar!.Value).toBe(target.account);

        // Buildspec must still contain npm ci
        const spec = extractDeployBuildSpec(tpl, target.name);
        expect(spec.install.commands).toContain('npm ci');

        // Deploy command must contain the correct stack name and flags
        const deployCmd = spec.build.commands.find((c: string) => c.includes('cdk deploy'));
        expect(deployCmd).toContain(target.stackName);
        expect(deployCmd).toContain('--require-approval never');
        expect(deployCmd).toContain('--verbose');
      }),
      { numRuns: 15 },
    );
  });
});

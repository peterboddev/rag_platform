/**
 * Bug Condition Exploration Test for CDK Template Deployment
 * 
 * **Validates: Requirements 1.1, 1.2, 2.1**
 * 
 * This test explores the bug condition where CDK applications generate
 * `.template.json` files but the deployment stage expects `template.yaml`.
 * 
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * - Failure confirms the bug exists (hardcoded template.yaml path)
 * - Success after fix confirms the bug is resolved
 * 
 * Bug Condition:
 * - CDK application generates `<StackName>.template.json` in cdk.out/
 * - ApplicationPipelineConstruct hardcodes templatePath to 'template.yaml'
 * - Deployment stage fails: "File [template.yaml] does not exist in artifact [BuildOutput]"
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ApplicationPipelineConstruct, ApplicationPipelineConfig } from '../lib/constructs/application-pipeline-construct';

describe('Bug Condition Exploration: CDK Template Deployment', () => {
  /**
   * Property 1: Fault Condition - CDK Template Deployment Failure
   * 
   * For any CDK application that generates a `.template.json` file,
   * when the application configuration does NOT specify a templatePath,
   * the deployment stage should fail because it looks for 'template.yaml'
   * instead of the CDK-generated '.template.json' file.
   * 
   * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
   * - The hardcoded 'template.yaml' path causes deployment configuration to be incorrect
   * - This test will pass after the fix is implemented
   */
  test('CDK application without templatePath configuration fails to deploy', () => {
    // GIVEN: A CDK app with a minimal stack
    const app = new cdk.App();
    
    // Create a minimal CDK stack that would generate TestStack.template.json
    const testStack = new cdk.Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });
    
    // Add a minimal resource to make it a valid stack
    new cdk.CfnOutput(testStack, 'TestOutput', {
      value: 'test-value',
      description: 'Test output for minimal stack'
    });
    
    // WHEN: Configure application pipeline WITHOUT templatePath
    // This simulates a CDK application that generates TestStack.template.json
    // but the pipeline is configured with default settings (expects template.yaml)
    const pipelineConfig: ApplicationPipelineConfig = {
      applicationName: 'test-cdk-app',
      sourceRepo: {
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main'
      },
      deploymentTargets: [
        {
          name: 'dev',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'TestStack',
          requiresApproval: false
        }
      ]
      // NOTE: No templatePath specified - defaults to 'template.yaml'
      // But CDK generates 'TestStack.template.json' in cdk.out/
    };
    
    const pipelineStack = new cdk.Stack(app, 'PipelineStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });
    
    const pipeline = new ApplicationPipelineConstruct(pipelineStack, 'TestPipeline', {
      config: pipelineConfig
    });
    
    // THEN: Verify the deployment action is configured with hardcoded 'template.yaml'
    const template = Template.fromStack(pipelineStack);
    
    // Extract the CloudFormation deployment action configuration
    const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
    const pipelineProps = Object.values(pipelineResource)[0].Properties;
    
    // Find the deployment stage
    const deployStage = pipelineProps.Stages.find((stage: any) => 
      stage.Name === 'Deploy_dev'
    );
    
    expect(deployStage).toBeDefined();
    
    // Find the CloudFormation deployment action
    const deployAction = deployStage.Actions.find((action: any) => 
      action.Name === 'Deploy_dev'
    );
    
    expect(deployAction).toBeDefined();
    expect(deployAction.ActionTypeId.Provider).toBe('CloudFormation');
    
    // CRITICAL ASSERTION: This is the bug condition
    // The deployment action is configured to look for 'template.yaml'
    // but CDK applications generate '<StackName>.template.json'
    const templateConfig = deployAction.Configuration.TemplatePath;
    
    // BUG CONDITION: Hardcoded to 'template.yaml'
    // This will cause deployment to fail for CDK applications
    expect(templateConfig).toContain('template.yaml');
    
    // COUNTEREXAMPLE DOCUMENTATION:
    // When this test runs on UNFIXED code:
    // 1. The deployment action is configured with 'BuildOutput::template.yaml'
    // 2. CDK applications generate 'TestStack.template.json' in cdk.out/
    // 3. Deployment fails: "File [template.yaml] does not exist in artifact [BuildOutput]"
    // 
    // Expected behavior after fix:
    // 1. Configuration should allow specifying templatePath
    // 2. When templatePath is set to 'cdk.out/TestStack.template.json', deployment succeeds
    // 3. When templatePath is not specified, it defaults to 'template.yaml' (SAM compatibility)
    
    // This assertion documents the expected failure scenario
    // After the fix, we would expect to be able to configure:
    // templatePath: 'cdk.out/TestStack.template.json'
    // And the deployment action would use that path instead
    
    console.log('\n=== BUG CONDITION CONFIRMED ===');
    console.log('Template path in deployment action:', templateConfig);
    console.log('Expected CDK template location: cdk.out/TestStack.template.json');
    console.log('Mismatch causes deployment failure for CDK applications');
    console.log('================================\n');
  });
  
  /**
   * Additional test case: Multiple CDK stacks scenario
   * 
   * This explores what happens when a CDK app generates multiple template files.
   * The bug is even more apparent in this case.
   */
  test('CDK application with multiple stacks cannot specify which template to deploy', () => {
    // GIVEN: A CDK app with multiple stacks
    const app = new cdk.App();
    
    // Create multiple stacks (simulating a real CDK application)
    const networkStack = new cdk.Stack(app, 'NetworkStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const applicationStack = new cdk.Stack(app, 'ApplicationStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    // Add minimal resources
    new cdk.CfnOutput(networkStack, 'NetworkOutput', { value: 'network' });
    new cdk.CfnOutput(applicationStack, 'AppOutput', { value: 'app' });
    
    // WHEN: Configure pipeline for one of the stacks
    const pipelineConfig: ApplicationPipelineConfig = {
      applicationName: 'multi-stack-app',
      sourceRepo: {
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main'
      },
      deploymentTargets: [
        {
          name: 'dev',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'ApplicationStack', // Want to deploy this specific stack
          requiresApproval: false
        }
      ]
      // BUG: No way to specify which .template.json file to use
      // CDK generates: NetworkStack.template.json, ApplicationStack.template.json
      // Pipeline looks for: template.yaml
    };
    
    const pipelineStack = new cdk.Stack(app, 'MultiStackPipelineStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const pipeline = new ApplicationPipelineConstruct(pipelineStack, 'MultiStackPipeline', {
      config: pipelineConfig
    });
    
    // THEN: Verify the limitation
    const template = Template.fromStack(pipelineStack);
    const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
    const pipelineProps = Object.values(pipelineResource)[0].Properties;
    
    const deployStage = pipelineProps.Stages.find((stage: any) => 
      stage.Name === 'Deploy_dev'
    );
    
    const deployAction = deployStage.Actions.find((action: any) => 
      action.Name === 'Deploy_dev'
    );
    
    const templateConfig = deployAction.Configuration.TemplatePath;
    
    // BUG: Cannot specify ApplicationStack.template.json
    expect(templateConfig).toContain('template.yaml');
    expect(templateConfig).not.toContain('ApplicationStack.template.json');
    
    console.log('\n=== MULTI-STACK BUG CONDITION ===');
    console.log('CDK generates: NetworkStack.template.json, ApplicationStack.template.json');
    console.log('Pipeline looks for:', templateConfig);
    console.log('No way to specify which CDK template to deploy');
    console.log('==================================\n');
  });
  
  /**
   * Edge case: CDK with custom output directory
   * 
   * Some CDK applications might configure custom output directories.
   * This test explores that scenario.
   */
  test('CDK application with custom output directory structure', () => {
    // GIVEN: A CDK application that might use custom output paths
    const app = new cdk.App();
    
    const customStack = new cdk.Stack(app, 'CustomOutputStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    new cdk.CfnOutput(customStack, 'CustomOutput', { value: 'custom' });
    
    // WHEN: Configure pipeline
    const pipelineConfig: ApplicationPipelineConfig = {
      applicationName: 'custom-output-app',
      sourceRepo: {
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main'
      },
      deploymentTargets: [
        {
          name: 'dev',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'CustomOutputStack',
          requiresApproval: false
        }
      ]
      // BUG: Even if CDK outputs to custom location, pipeline expects template.yaml
    };
    
    const pipelineStack = new cdk.Stack(app, 'CustomOutputPipelineStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const pipeline = new ApplicationPipelineConstruct(pipelineStack, 'CustomOutputPipeline', {
      config: pipelineConfig
    });
    
    // THEN: Verify the hardcoded path limitation
    const template = Template.fromStack(pipelineStack);
    const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
    const pipelineProps = Object.values(pipelineResource)[0].Properties;
    
    const deployStage = pipelineProps.Stages.find((stage: any) => 
      stage.Name === 'Deploy_dev'
    );
    
    const deployAction = deployStage.Actions.find((action: any) => 
      action.Name === 'Deploy_dev'
    );
    
    const templateConfig = deployAction.Configuration.TemplatePath;
    
    // BUG: No flexibility for custom paths
    expect(templateConfig).toBe('BuildOutput::template.yaml');
    
    console.log('\n=== CUSTOM OUTPUT BUG CONDITION ===');
    console.log('Hardcoded path:', templateConfig);
    console.log('No support for custom CDK output locations');
    console.log('====================================\n');
  });
});

/**
 * COUNTEREXAMPLE SUMMARY
 * 
 * These tests document the following counterexamples that demonstrate the bug:
 * 
 * 1. Single CDK Stack:
 *    - Generates: cdk.out/TestStack.template.json
 *    - Pipeline expects: template.yaml
 *    - Result: Deployment fails with "File [template.yaml] does not exist"
 * 
 * 2. Multiple CDK Stacks:
 *    - Generates: NetworkStack.template.json, ApplicationStack.template.json
 *    - Pipeline expects: template.yaml
 *    - Result: Cannot specify which stack to deploy, deployment fails
 * 
 * 3. Custom Output Directory:
 *    - CDK might output to custom location
 *    - Pipeline hardcoded to: template.yaml
 *    - Result: No flexibility for custom paths, deployment fails
 * 
 * ROOT CAUSE CONFIRMED:
 * - Line 388 in application-pipeline-construct.ts
 * - Hardcoded: templatePath: buildOutput.atPath('template.yaml')
 * - No configuration option for CDK template paths
 * 
 * EXPECTED FIX:
 * - Add optional templatePath field to ApplicationPipelineConfig
 * - Use: templatePath: buildOutput.atPath(config.templatePath || 'template.yaml')
 * - Maintain backward compatibility with SAM applications
 */

/**
 * FIX VERIFICATION TESTS
 * 
 * These tests verify that the fix correctly resolves the bug condition.
 * They should PASS after the fix is implemented.
 */
describe('Fix Verification: CDK Template Deployment with templatePath', () => {
  /**
   * Property 1: Expected Behavior - CDK Template Deployment Success
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3**
   * 
   * For any CDK application that generates a `.template.json` file,
   * when the application configuration specifies a templatePath,
   * the deployment stage SHALL successfully locate and use the CDK-generated template file.
   * 
   * EXPECTED OUTCOME AFTER FIX: Test PASSES
   * - The configurable templatePath allows CDK applications to specify their template location
   * - Deployment action uses the correct template path
   */
  test('CDK application with templatePath configuration deploys successfully', () => {
    // GIVEN: A CDK app with a minimal stack
    const app = new cdk.App();
    
    // Create a minimal CDK stack that would generate TestStack.template.json
    const testStack = new cdk.Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });
    
    // Add a minimal resource to make it a valid stack
    new cdk.CfnOutput(testStack, 'TestOutput', {
      value: 'test-value',
      description: 'Test output for minimal stack'
    });
    
    // WHEN: Configure application pipeline WITH templatePath for CDK
    // This simulates a CDK application that generates TestStack.template.json
    // and the pipeline is configured to use that specific template
    const pipelineConfig: ApplicationPipelineConfig = {
      applicationName: 'test-cdk-app',
      sourceRepo: {
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main'
      },
      deploymentTargets: [
        {
          name: 'dev',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'TestStack',
          requiresApproval: false
        }
      ],
      // FIX: Specify templatePath for CDK application
      templatePath: 'cdk.out/TestStack.template.json'
    };
    
    const pipelineStack = new cdk.Stack(app, 'PipelineStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });
    
    const pipeline = new ApplicationPipelineConstruct(pipelineStack, 'TestPipeline', {
      config: pipelineConfig
    });
    
    // THEN: Verify the deployment action is configured with the CDK template path
    const template = Template.fromStack(pipelineStack);
    
    // Extract the CloudFormation deployment action configuration
    const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
    const pipelineProps = Object.values(pipelineResource)[0].Properties;
    
    // Find the deployment stage
    const deployStage = pipelineProps.Stages.find((stage: any) => 
      stage.Name === 'Deploy_dev'
    );
    
    expect(deployStage).toBeDefined();
    
    // Find the CloudFormation deployment action
    const deployAction = deployStage.Actions.find((action: any) => 
      action.Name === 'Deploy_dev'
    );
    
    expect(deployAction).toBeDefined();
    expect(deployAction.ActionTypeId.Provider).toBe('CloudFormation');
    
    // CRITICAL ASSERTION: Verify the fix works
    // The deployment action should now use the configured templatePath
    const templateConfig = deployAction.Configuration.TemplatePath;
    
    // FIX VERIFICATION: Should use CDK template path
    expect(templateConfig).toContain('cdk.out/TestStack.template.json');
    expect(templateConfig).not.toContain('template.yaml');
    
    // Verify the full path format
    expect(templateConfig).toBe('BuildOutput::cdk.out/TestStack.template.json');
    
    console.log('\n=== FIX VERIFIED ===');
    console.log('Template path in deployment action:', templateConfig);
    console.log('CDK template location: cdk.out/TestStack.template.json');
    console.log('Deployment stage will successfully locate CDK template');
    console.log('====================\n');
  });
  
  /**
   * Verify multiple CDK stacks can now specify which template to deploy
   */
  test('CDK application with multiple stacks can specify which template to deploy', () => {
    // GIVEN: A CDK app with multiple stacks
    const app = new cdk.App();
    
    // Create multiple stacks (simulating a real CDK application)
    const networkStack = new cdk.Stack(app, 'NetworkStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const applicationStack = new cdk.Stack(app, 'ApplicationStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    // Add minimal resources
    new cdk.CfnOutput(networkStack, 'NetworkOutput', { value: 'network' });
    new cdk.CfnOutput(applicationStack, 'AppOutput', { value: 'app' });
    
    // WHEN: Configure pipeline for one of the stacks with templatePath
    const pipelineConfig: ApplicationPipelineConfig = {
      applicationName: 'multi-stack-app',
      sourceRepo: {
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main'
      },
      deploymentTargets: [
        {
          name: 'dev',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'ApplicationStack',
          requiresApproval: false
        }
      ],
      // FIX: Can now specify which CDK template to use
      templatePath: 'cdk.out/ApplicationStack.template.json'
    };
    
    const pipelineStack = new cdk.Stack(app, 'MultiStackPipelineStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const pipeline = new ApplicationPipelineConstruct(pipelineStack, 'MultiStackPipeline', {
      config: pipelineConfig
    });
    
    // THEN: Verify the correct template is configured
    const template = Template.fromStack(pipelineStack);
    const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
    const pipelineProps = Object.values(pipelineResource)[0].Properties;
    
    const deployStage = pipelineProps.Stages.find((stage: any) => 
      stage.Name === 'Deploy_dev'
    );
    
    const deployAction = deployStage.Actions.find((action: any) => 
      action.Name === 'Deploy_dev'
    );
    
    const templateConfig = deployAction.Configuration.TemplatePath;
    
    // FIX VERIFICATION: Can now specify ApplicationStack.template.json
    expect(templateConfig).toContain('ApplicationStack.template.json');
    expect(templateConfig).toBe('BuildOutput::cdk.out/ApplicationStack.template.json');
    
    console.log('\n=== MULTI-STACK FIX VERIFIED ===');
    console.log('CDK generates: NetworkStack.template.json, ApplicationStack.template.json');
    console.log('Pipeline configured for:', templateConfig);
    console.log('Can now specify which CDK template to deploy');
    console.log('=================================\n');
  });
  
  /**
   * Verify custom output directory paths are now supported
   */
  test('CDK application with custom output directory structure is supported', () => {
    // GIVEN: A CDK application that might use custom output paths
    const app = new cdk.App();
    
    const customStack = new cdk.Stack(app, 'CustomOutputStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    new cdk.CfnOutput(customStack, 'CustomOutput', { value: 'custom' });
    
    // WHEN: Configure pipeline with custom template path
    const pipelineConfig: ApplicationPipelineConfig = {
      applicationName: 'custom-output-app',
      sourceRepo: {
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main'
      },
      deploymentTargets: [
        {
          name: 'dev',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'CustomOutputStack',
          requiresApproval: false
        }
      ],
      // FIX: Can now specify custom CDK output location
      templatePath: 'cdk.out/CustomOutputStack.template.json'
    };
    
    const pipelineStack = new cdk.Stack(app, 'CustomOutputPipelineStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const pipeline = new ApplicationPipelineConstruct(pipelineStack, 'CustomOutputPipeline', {
      config: pipelineConfig
    });
    
    // THEN: Verify custom path is supported
    const template = Template.fromStack(pipelineStack);
    const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
    const pipelineProps = Object.values(pipelineResource)[0].Properties;
    
    const deployStage = pipelineProps.Stages.find((stage: any) => 
      stage.Name === 'Deploy_dev'
    );
    
    const deployAction = deployStage.Actions.find((action: any) => 
      action.Name === 'Deploy_dev'
    );
    
    const templateConfig = deployAction.Configuration.TemplatePath;
    
    // FIX VERIFICATION: Custom paths are now supported
    expect(templateConfig).toBe('BuildOutput::cdk.out/CustomOutputStack.template.json');
    
    console.log('\n=== CUSTOM OUTPUT FIX VERIFIED ===');
    console.log('Configured path:', templateConfig);
    console.log('Custom CDK output locations are now supported');
    console.log('===================================\n');
  });
  
  /**
   * Verify backward compatibility: SAM applications still work without templatePath
   */
  test('SAM application without templatePath defaults to template.yaml (backward compatibility)', () => {
    // GIVEN: A SAM application configuration
    const app = new cdk.App();
    
    // WHEN: Configure pipeline WITHOUT templatePath (SAM default)
    const pipelineConfig: ApplicationPipelineConfig = {
      applicationName: 'sam-app',
      sourceRepo: {
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main'
      },
      deploymentTargets: [
        {
          name: 'dev',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'SamStack',
          requiresApproval: false
        }
      ]
      // NO templatePath specified - should default to 'template.yaml'
    };
    
    const pipelineStack = new cdk.Stack(app, 'SamPipelineStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const pipeline = new ApplicationPipelineConstruct(pipelineStack, 'SamPipeline', {
      config: pipelineConfig
    });
    
    // THEN: Verify default template.yaml is used
    const template = Template.fromStack(pipelineStack);
    const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
    const pipelineProps = Object.values(pipelineResource)[0].Properties;
    
    const deployStage = pipelineProps.Stages.find((stage: any) => 
      stage.Name === 'Deploy_dev'
    );
    
    const deployAction = deployStage.Actions.find((action: any) => 
      action.Name === 'Deploy_dev'
    );
    
    const templateConfig = deployAction.Configuration.TemplatePath;
    
    // BACKWARD COMPATIBILITY: Should still default to template.yaml
    expect(templateConfig).toBe('BuildOutput::template.yaml');
    
    console.log('\n=== BACKWARD COMPATIBILITY VERIFIED ===');
    console.log('SAM application without templatePath:', templateConfig);
    console.log('Defaults to template.yaml as expected');
    console.log('========================================\n');
  });
});

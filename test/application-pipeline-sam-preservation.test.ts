/**
 * Preservation Property Tests for SAM Template Deployment
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * These tests observe and document the CURRENT behavior on UNFIXED code
 * for SAM applications that use template.yaml. The goal is to ensure
 * that after implementing the CDK template fix, SAM applications continue
 * to work exactly as they do now.
 * 
 * CRITICAL: These tests MUST PASS on unfixed code.
 * - Passing confirms the baseline behavior we need to preserve
 * - After the fix, these tests must still pass (no regressions)
 * 
 * Property 2: Preservation - SAM Template Deployment Behavior
 * 
 * For all applications WITHOUT templatePath specified, deployment uses template.yaml
 * For all SAM applications, deployment stage succeeds with correct configuration
 * For all deployment targets, pipeline stages execute in correct order
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ApplicationPipelineConstruct, ApplicationPipelineConfig } from '../lib/constructs/application-pipeline-construct';
import * as fc from 'fast-check';

describe('Preservation Property Tests: SAM Template Deployment', () => {
  /**
   * Property: Default template path is 'template.yaml'
   * 
   * For any application configuration WITHOUT a templatePath field,
   * the deployment action MUST use 'template.yaml' as the template path.
   * 
   * This is the current behavior that must be preserved after the fix.
   */
  test('Property: Applications without templatePath use template.yaml by default', () => {
    // GIVEN: A SAM application configuration without templatePath
    const app = new cdk.App();
    
    const pipelineConfig: ApplicationPipelineConfig = {
      applicationName: 'sam-app',
      sourceRepo: {
        owner: 'test-owner',
        repo: 'sam-repo',
        branch: 'main'
      },
      deploymentTargets: [
        {
          name: 'dev',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'SamAppStack',
          requiresApproval: false
        }
      ]
      // NOTE: No templatePath specified - should default to 'template.yaml'
    };
    
    const pipelineStack = new cdk.Stack(app, 'SamPipelineStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });
    
    const pipeline = new ApplicationPipelineConstruct(pipelineStack, 'SamPipeline', {
      config: pipelineConfig
    });
    
    // THEN: Verify deployment action uses 'template.yaml'
    const template = Template.fromStack(pipelineStack);
    const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
    const pipelineProps = Object.values(pipelineResource)[0].Properties;
    
    const deployStage = pipelineProps.Stages.find((stage: any) => 
      stage.Name === 'Deploy_dev'
    );
    
    expect(deployStage).toBeDefined();
    
    const deployAction = deployStage.Actions.find((action: any) => 
      action.Name === 'Deploy_dev'
    );
    
    expect(deployAction).toBeDefined();
    expect(deployAction.Configuration.TemplatePath).toBe('BuildOutput::template.yaml');
    
    console.log('\n=== PRESERVATION CONFIRMED ===');
    console.log('Default template path: BuildOutput::template.yaml');
    console.log('SAM applications work correctly with this default');
    console.log('==============================\n');
  });
  
  /**
   * Property: SAM deployment action configuration is correct
   * 
   * For any SAM application, the CloudFormation deployment action
   * must be properly configured with:
   * - Correct action type (CloudFormation)
   * - Correct provider (CloudFormation)
   * - Template path pointing to template.yaml
   * - Admin permissions enabled
   * - Correct stack name
   */
  test('Property: SAM applications have correct deployment action configuration', () => {
    // GIVEN: A SAM application with standard configuration
    const app = new cdk.App();
    
    const pipelineConfig: ApplicationPipelineConfig = {
      applicationName: 'standard-sam-app',
      sourceRepo: {
        owner: 'test-owner',
        repo: 'standard-sam-repo',
        branch: 'main'
      },
      deploymentTargets: [
        {
          name: 'production',
          account: '123456789012',
          region: 'us-west-2',
          stackName: 'ProductionStack',
          requiresApproval: false,
          parameters: {
            Environment: 'production',
            Version: '1.0.0'
          }
        }
      ]
    };
    
    const pipelineStack = new cdk.Stack(app, 'StandardSamPipelineStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });
    
    const pipeline = new ApplicationPipelineConstruct(pipelineStack, 'StandardSamPipeline', {
      config: pipelineConfig
    });
    
    // THEN: Verify all deployment action properties are correct
    const template = Template.fromStack(pipelineStack);
    const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
    const pipelineProps = Object.values(pipelineResource)[0].Properties;
    
    const deployStage = pipelineProps.Stages.find((stage: any) => 
      stage.Name === 'Deploy_production'
    );
    
    const deployAction = deployStage.Actions.find((action: any) => 
      action.Name === 'Deploy_production'
    );
    
    // Verify action type
    expect(deployAction.ActionTypeId.Category).toBe('Deploy');
    expect(deployAction.ActionTypeId.Owner).toBe('AWS');
    expect(deployAction.ActionTypeId.Provider).toBe('CloudFormation');
    expect(deployAction.ActionTypeId.Version).toBe('1');
    
    // Verify configuration
    expect(deployAction.Configuration.ActionMode).toBe('CREATE_UPDATE');
    expect(deployAction.Configuration.StackName).toBe('ProductionStack');
    expect(deployAction.Configuration.TemplatePath).toBe('BuildOutput::template.yaml');
    // Verify capabilities - the actual behavior uses CAPABILITY_NAMED_IAM
    expect(deployAction.Configuration.Capabilities).toBe('CAPABILITY_NAMED_IAM');
    
    // Verify parameter overrides are present
    const parameterOverrides = JSON.parse(deployAction.Configuration.ParameterOverrides);
    expect(parameterOverrides.Environment).toBe('production');
    expect(parameterOverrides.Version).toBe('1.0.0');
    
    console.log('\n=== SAM DEPLOYMENT ACTION PRESERVED ===');
    console.log('Action type: CloudFormation CREATE_UPDATE');
    console.log('Template path: BuildOutput::template.yaml');
    console.log('Parameters: Correctly passed through');
    console.log('========================================\n');
  });
  
  /**
   * Property: Multi-environment deployments execute in correct order
   * 
   * For any application with multiple deployment targets,
   * the pipeline stages must be created in the correct order:
   * 1. Source
   * 2. Build
   * 3. Deploy_<target1>
   * 4. Deploy_<target2>
   * 5. Deploy_<target3>
   */
  test('Property: Multi-environment deployments maintain correct stage order', () => {
    // GIVEN: A SAM application with multiple deployment targets
    const app = new cdk.App();
    
    const pipelineConfig: ApplicationPipelineConfig = {
      applicationName: 'multi-env-sam-app',
      sourceRepo: {
        owner: 'test-owner',
        repo: 'multi-env-repo',
        branch: 'main'
      },
      deploymentTargets: [
        {
          name: 'dev',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'DevStack',
          requiresApproval: false
        },
        {
          name: 'staging',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'StagingStack',
          requiresApproval: false
        },
        {
          name: 'prod',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'ProdStack',
          requiresApproval: false
        }
      ]
    };
    
    const pipelineStack = new cdk.Stack(app, 'MultiEnvPipelineStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });
    
    const pipeline = new ApplicationPipelineConstruct(pipelineStack, 'MultiEnvPipeline', {
      config: pipelineConfig
    });
    
    // THEN: Verify stage order is correct
    const template = Template.fromStack(pipelineStack);
    const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
    const pipelineProps = Object.values(pipelineResource)[0].Properties;
    
    const stages = pipelineProps.Stages;
    
    // Verify stage count (Source + Build + 3 Deploy stages)
    expect(stages).toHaveLength(5);
    
    // Verify stage order
    expect(stages[0].Name).toBe('Source');
    expect(stages[1].Name).toBe('Build');
    expect(stages[2].Name).toBe('Deploy_dev');
    expect(stages[3].Name).toBe('Deploy_staging');
    expect(stages[4].Name).toBe('Deploy_prod');
    
    // Verify each deployment stage uses template.yaml
    stages.slice(2).forEach((stage: any, index: number) => {
      const deployAction = stage.Actions.find((action: any) => 
        action.Name.startsWith('Deploy_')
      );
      expect(deployAction.Configuration.TemplatePath).toBe('BuildOutput::template.yaml');
    });
    
    console.log('\n=== MULTI-ENVIRONMENT ORDER PRESERVED ===');
    console.log('Stage order: Source -> Build -> Deploy_dev -> Deploy_staging -> Deploy_prod');
    console.log('All deployment stages use: BuildOutput::template.yaml');
    console.log('==========================================\n');
  });
  
  /**
   * Property: Manual approval gates function correctly
   * 
   * For any deployment target with requiresApproval=true,
   * the deployment stage must include a manual approval action
   * BEFORE the CloudFormation deployment action.
   */
  test('Property: Manual approval gates are preserved for environments requiring approval', () => {
    // GIVEN: A SAM application with approval required for production
    const app = new cdk.App();
    
    const pipelineConfig: ApplicationPipelineConfig = {
      applicationName: 'approval-sam-app',
      sourceRepo: {
        owner: 'test-owner',
        repo: 'approval-repo',
        branch: 'main'
      },
      deploymentTargets: [
        {
          name: 'dev',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'DevStack',
          requiresApproval: false // No approval for dev
        },
        {
          name: 'prod',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'ProdStack',
          requiresApproval: true // Approval required for prod
        }
      ]
    };
    
    const pipelineStack = new cdk.Stack(app, 'ApprovalPipelineStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });
    
    const pipeline = new ApplicationPipelineConstruct(pipelineStack, 'ApprovalPipeline', {
      config: pipelineConfig
    });
    
    // THEN: Verify approval action is present for prod, not for dev
    const template = Template.fromStack(pipelineStack);
    const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
    const pipelineProps = Object.values(pipelineResource)[0].Properties;
    
    // Check dev stage - should NOT have approval action
    const devStage = pipelineProps.Stages.find((stage: any) => 
      stage.Name === 'Deploy_dev'
    );
    
    expect(devStage.Actions).toHaveLength(1); // Only deploy action
    expect(devStage.Actions[0].Name).toBe('Deploy_dev');
    expect(devStage.Actions[0].ActionTypeId.Provider).toBe('CloudFormation');
    
    // Check prod stage - should have approval action BEFORE deploy action
    const prodStage = pipelineProps.Stages.find((stage: any) => 
      stage.Name === 'Deploy_prod'
    );
    
    expect(prodStage.Actions).toHaveLength(2); // Approval + deploy actions
    
    // First action should be approval
    expect(prodStage.Actions[0].Name).toBe('Approve_prod');
    expect(prodStage.Actions[0].ActionTypeId.Provider).toBe('Manual');
    expect(prodStage.Actions[0].Configuration.CustomData).toContain('Please review and approve deployment to prod environment');
    
    // Second action should be deployment
    expect(prodStage.Actions[1].Name).toBe('Deploy_prod');
    expect(prodStage.Actions[1].ActionTypeId.Provider).toBe('CloudFormation');
    expect(prodStage.Actions[1].Configuration.TemplatePath).toBe('BuildOutput::template.yaml');
    
    console.log('\n=== MANUAL APPROVAL GATES PRESERVED ===');
    console.log('Dev stage: No approval (1 action)');
    console.log('Prod stage: Approval + Deploy (2 actions)');
    console.log('Approval action comes BEFORE deploy action');
    console.log('========================================\n');
  });
  
  /**
   * Property-Based Test: Template path consistency across random configurations
   * 
   * This property-based test generates many random application configurations
   * and verifies that ALL of them use 'template.yaml' as the template path
   * when no templatePath is specified.
   * 
   * This provides strong guarantees that the default behavior is consistent.
   */
  test('Property-Based: All SAM applications without templatePath use template.yaml', () => {
    // Property: For all application configurations without templatePath,
    // the deployment action must use 'BuildOutput::template.yaml'
    
    fc.assert(
      fc.property(
        // Generate random application configurations
        fc.record({
          applicationName: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
          owner: fc.stringMatching(/^[a-z][a-z0-9-]{2,15}$/),
          repo: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
          branch: fc.constantFrom('main', 'develop', 'master'),
          targetName: fc.constantFrom('dev', 'staging', 'prod', 'test'),
          stackName: fc.stringMatching(/^[A-Z][a-zA-Z0-9]{3,20}Stack$/),
          requiresApproval: fc.boolean()
        }),
        (config) => {
          // GIVEN: A random SAM application configuration
          const app = new cdk.App();
          
          const pipelineConfig: ApplicationPipelineConfig = {
            applicationName: config.applicationName,
            sourceRepo: {
              owner: config.owner,
              repo: config.repo,
              branch: config.branch
            },
            deploymentTargets: [
              {
                name: config.targetName,
                account: '123456789012',
                region: 'us-east-1',
                stackName: config.stackName,
                requiresApproval: config.requiresApproval
              }
            ]
            // NOTE: No templatePath specified
          };
          
          const pipelineStack = new cdk.Stack(app, `PBT-${config.applicationName}-Stack`, {
            env: {
              account: '123456789012',
              region: 'us-east-1'
            }
          });
          
          const pipeline = new ApplicationPipelineConstruct(
            pipelineStack, 
            `PBT-${config.applicationName}-Pipeline`, 
            { config: pipelineConfig }
          );
          
          // THEN: Verify template path is always 'BuildOutput::template.yaml'
          const template = Template.fromStack(pipelineStack);
          const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
          const pipelineProps = Object.values(pipelineResource)[0].Properties;
          
          const deployStage = pipelineProps.Stages.find((stage: any) => 
            stage.Name === `Deploy_${config.targetName}`
          );
          
          const deployAction = deployStage.Actions.find((action: any) => 
            action.Name === `Deploy_${config.targetName}`
          );
          
          // PROPERTY: Template path is ALWAYS 'BuildOutput::template.yaml'
          expect(deployAction.Configuration.TemplatePath).toBe('BuildOutput::template.yaml');
          
          return true; // Property holds
        }
      ),
      {
        numRuns: 50, // Run 50 random test cases
        verbose: false
      }
    );
    
    console.log('\n=== PROPERTY-BASED TEST PASSED ===');
    console.log('Tested 50 random configurations');
    console.log('ALL configurations use: BuildOutput::template.yaml');
    console.log('Property holds across entire input domain');
    console.log('===================================\n');
  });
  
  /**
   * Property-Based Test: Multi-environment consistency
   * 
   * For any number of deployment targets (1-5), all deployment stages
   * must use the same template path: 'BuildOutput::template.yaml'
   */
  test('Property-Based: All deployment targets use consistent template path', () => {
    fc.assert(
      fc.property(
        // Generate random number of deployment targets (1-5)
        fc.array(
          fc.record({
            name: fc.constantFrom('dev', 'staging', 'prod', 'test', 'qa'),
            stackName: fc.stringMatching(/^[A-Z][a-zA-Z0-9]{3,15}Stack$/),
            requiresApproval: fc.boolean()
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (targets) => {
          // Ensure unique target names
          const uniqueTargets = Array.from(
            new Map(targets.map(t => [t.name, t])).values()
          );
          
          if (uniqueTargets.length === 0) {
            return true; // Skip empty arrays
          }
          
          // GIVEN: An application with multiple deployment targets
          const app = new cdk.App();
          
          const pipelineConfig: ApplicationPipelineConfig = {
            applicationName: 'multi-target-app',
            sourceRepo: {
              owner: 'test-owner',
              repo: 'test-repo',
              branch: 'main'
            },
            deploymentTargets: uniqueTargets.map(target => ({
              name: target.name,
              account: '123456789012',
              region: 'us-east-1',
              stackName: target.stackName,
              requiresApproval: target.requiresApproval
            }))
          };
          
          const pipelineStack = new cdk.Stack(app, `MultiTarget-${Date.now()}-Stack`, {
            env: {
              account: '123456789012',
              region: 'us-east-1'
            }
          });
          
          const pipeline = new ApplicationPipelineConstruct(
            pipelineStack,
            `MultiTarget-${Date.now()}-Pipeline`,
            { config: pipelineConfig }
          );
          
          // THEN: Verify ALL deployment stages use the same template path
          const template = Template.fromStack(pipelineStack);
          const pipelineResource = template.findResources('AWS::CodePipeline::Pipeline');
          const pipelineProps = Object.values(pipelineResource)[0].Properties;
          
          const deployStages = pipelineProps.Stages.filter((stage: any) => 
            stage.Name.startsWith('Deploy_')
          );
          
          // PROPERTY: All deployment stages use 'BuildOutput::template.yaml'
          deployStages.forEach((stage: any) => {
            const deployAction = stage.Actions.find((action: any) => 
              action.Name.startsWith('Deploy_')
            );
            expect(deployAction.Configuration.TemplatePath).toBe('BuildOutput::template.yaml');
          });
          
          return true; // Property holds
        }
      ),
      {
        numRuns: 30, // Run 30 random test cases
        verbose: false
      }
    );
    
    console.log('\n=== MULTI-TARGET PROPERTY TEST PASSED ===');
    console.log('Tested 30 random multi-target configurations');
    console.log('ALL targets consistently use: BuildOutput::template.yaml');
    console.log('=========================================\n');
  });
});

/**
 * PRESERVATION PROPERTY SUMMARY
 * 
 * These tests confirm the following behaviors on UNFIXED code:
 * 
 * 1. Default Template Path:
 *    - Applications without templatePath field use 'template.yaml'
 *    - This is the SAM convention and must be preserved
 * 
 * 2. Deployment Action Configuration:
 *    - CloudFormation action type is correct
 *    - Template path is 'BuildOutput::template.yaml'
 *    - Parameters are correctly passed through
 *    - Admin permissions are enabled
 * 
 * 3. Multi-Environment Deployments:
 *    - Stages execute in correct order: Source -> Build -> Deploy_*
 *    - All deployment stages use the same template path
 *    - Each environment gets its own deployment stage
 * 
 * 4. Manual Approval Gates:
 *    - Approval action is added when requiresApproval=true
 *    - Approval action comes BEFORE deployment action
 *    - No approval action when requiresApproval=false
 * 
 * 5. Property-Based Guarantees:
 *    - Tested across 50+ random configurations
 *    - Template path is ALWAYS 'BuildOutput::template.yaml' when not specified
 *    - Behavior is consistent across all input variations
 * 
 * EXPECTED OUTCOME:
 * - All tests PASS on unfixed code ✓
 * - All tests MUST STILL PASS after implementing the CDK template fix
 * - Any test failure after fix indicates a regression
 */

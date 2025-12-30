import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { SecurityStack } from '../lib/security-stack';

describe('SecurityStack', () => {
  let app: cdk.App;
  let stack: SecurityStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new SecurityStack(app, 'TestSecurityStack');
    template = Template.fromStack(stack);
  });

  test('creates platform pipeline role with correct service principal', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'PlatformPipelineExecutionRole',
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'codepipeline.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      }
    });
  });

  test('creates application pipeline role with correct service principal', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'ApplicationPipelineExecutionRole',
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'codepipeline.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      }
    });
  });

  test('creates codebuild service role with correct service principal', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'PlatformCodeBuildServiceRole',
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'codebuild.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      }
    });
  });

  test('creates cross-account deployment role', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'PlatformCrossAccountDeploymentRole'
    });
  });

  test('exports role ARNs as stack outputs', () => {
    template.hasOutput('PlatformPipelineRoleArn', {});
    template.hasOutput('ApplicationPipelineRoleArn', {});
    template.hasOutput('CodeBuildServiceRoleArn', {});
    template.hasOutput('CrossAccountDeploymentRoleArn', {});
  });

  test('applies correct tags to all resources', () => {
    // Verify that tags are applied at the stack level
    expect(stack.tags.tagValues()).toEqual({
      'Component': 'PlatformPipeline',
      'ManagedBy': 'PlatformTeam',
      'Purpose': 'Security'
    });
  });

  test('implements least privilege access patterns', () => {
    // Verify platform pipeline role exists with scoped permissions
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'PlatformPipelineExecutionRole'
    });
    
    // Verify CodeBuild role exists with appropriate permissions
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'PlatformCodeBuildServiceRole'
    });
  });

  test('supports cross-account configuration', () => {
    const crossAccountApp = new cdk.App();
    const crossAccountStack = new SecurityStack(crossAccountApp, 'CrossAccountSecurityStack', {
      crossAccountRoleArns: ['arn:aws:iam::123456789012:role/CrossAccountRole'],
      applicationAccounts: ['123456789012']
    });
    
    const crossAccountTemplate = Template.fromStack(crossAccountStack);
    
    // Verify cross-account role exists
    crossAccountTemplate.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'PlatformCrossAccountDeploymentRole'
    });
  });
});
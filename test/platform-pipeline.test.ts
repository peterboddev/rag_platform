import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as PlatformPipeline from '../lib/platform-pipeline-stack';

// Test the platform pipeline stack without application pipelines
test('Platform Pipeline Stack Creation', () => {
  const app = new cdk.App({
    context: {
      'platform': {
        'region': 'us-east-1',
        'account': '123456789012',
        // connectionArn is now optional - will be created by CDK
        'artifactBucketPrefix': 'platform-pipeline'
      },
      'environments': {},
      'applications': {},
      'defaults': {
        'buildRuntime': '20',
        'computeType': 'BUILD_GENERAL1_XLARGE',
        'buildImage': 'AMAZON_LINUX_2_STANDARD_3_0_ARM',
        'cacheEnabled': true
      }
    }
  });
  
  // WHEN
  const stack = new PlatformPipeline.PlatformPipelineStack(app, 'MyTestStack', {
    // connectionArn is now optional - will be created by CDK construct
    env: {
      account: '450683699755', // Use the same account as our environments
      region: 'us-east-1'
    }
  });
  
  // THEN
  const template = Template.fromStack(stack);
  
  // Verify the stack can be synthesized without errors
  expect(template).toBeDefined();
  
  // Verify that the platform pipeline is created
  template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
    Name: 'PlatformPipeline'
  });
  
  // Verify that CodeBuild projects are created (synth + validation steps for staging/prod + asset builds)
  template.resourceCountIs('AWS::CodeBuild::Project', 6);
  
  // Verify that CodeConnections connection is created by CDK
  template.hasResourceProperties('AWS::CodeConnections::Connection', {
    ConnectionName: 'platform-pipeline-github',
    ProviderType: 'GitHub'
  });
});
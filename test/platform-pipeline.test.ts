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
        'connectionArn': 'arn:aws:codestar-connections:us-east-1:123456789012:connection/test-connection-id',
        'artifactBucketPrefix': 'platform-pipeline'
      },
      'environments': {},
      'applications': {},
      'defaults': {
        'buildRuntime': '18',
        'computeType': 'BUILD_GENERAL1_SMALL',
        'buildImage': 'STANDARD_7_0',
        'cacheEnabled': true
      }
    }
  });
  
  // WHEN
  const stack = new PlatformPipeline.PlatformPipelineStack(app, 'MyTestStack', {
    connectionArn: 'arn:aws:codestar-connections:us-east-1:123456789012:connection/test-connection-id',
    env: {
      account: '123456789012',
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
  
  // Verify that CodeBuild projects are created (synth, self-mutation, and validation)
  template.resourceCountIs('AWS::CodeBuild::Project', 3);
});
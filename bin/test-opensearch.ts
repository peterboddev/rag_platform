#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TestOpenSearchStack } from '../lib/stacks/test-opensearch-stack';

const app = new cdk.App();

new TestOpenSearchStack(app, 'test-opensearch-dev', {
  env: {
    account: '450683699755',
    region: 'us-east-1',
  },
  applicationName: 'test',
  environment: 'dev',
});

console.log('✅ Test OpenSearch stack configured');
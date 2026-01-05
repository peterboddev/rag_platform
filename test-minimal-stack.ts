#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

class MinimalTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Just create a simple VPC
    const vpc = new ec2.Vpc(this, 'TestVPC', {
      maxAzs: 2,
      natGateways: 1,
    });

    new cdk.CfnOutput(this, 'VPCId', {
      value: vpc.vpcId,
      description: 'Test VPC ID',
    });
  }
}

const app = new cdk.App();
new MinimalTestStack(app, 'MinimalTestStack', {
  env: {
    account: '450683699755',
    region: 'us-east-1',
  },
});
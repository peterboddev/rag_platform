import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkInfrastructureConstruct } from '../constructs/network-infrastructure';

export interface FoundationStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
}

export class FoundationStack extends cdk.Stack {
  public readonly vpc: cdk.aws_ec2.Vpc;
  public readonly securityGroups: { [key: string]: cdk.aws_ec2.SecurityGroup };

  constructor(scope: Construct, id: string, props: FoundationStackProps) {
    super(scope, id, props);

    const { applicationName, environment } = props;

    // Network Infrastructure Foundation
    const networkInfrastructure = new NetworkInfrastructureConstruct(this, 'NetworkInfrastructure', {
      applicationName,
      environment,
    });

    this.vpc = networkInfrastructure.vpc;
    this.securityGroups = networkInfrastructure.securityGroups;

    // Stack Outputs
    new cdk.CfnOutput(this, 'VPCId', {
      value: this.vpc.vpcId,
      description: 'VPC ID for the RAG infrastructure',
      exportName: `${applicationName}-${environment}-vpc-id`,
    });

    new cdk.CfnOutput(this, 'VPCArn', {
      value: this.vpc.vpcArn,
      description: 'VPC ARN for cross-stack references',
      exportName: `${applicationName}-${environment}-vpc-arn`,
    });

    // Export security group IDs for other stacks
    Object.entries(this.securityGroups).forEach(([name, sg]) => {
      new cdk.CfnOutput(this, `SecurityGroup${name}Id`, {
        value: sg.securityGroupId,
        description: `Security Group ID for ${name}`,
        exportName: `${applicationName}-${environment}-sg-${name.toLowerCase()}-id`,
      });
    });
  }
}
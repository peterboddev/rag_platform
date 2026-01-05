import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { MonitoringConstruct } from '../constructs/monitoring';

export interface MonitoringStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly vpcId: string;
  readonly vectorDatabaseArn: string;
  readonly knowledgeBaseId?: string;
  readonly processingFunctionArns?: string[];
}

export class MonitoringStack extends cdk.Stack {
  public readonly monitoring: MonitoringConstruct;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { applicationName, environment, vpcId, vectorDatabaseArn, knowledgeBaseId, processingFunctionArns } = props;

    // Import the VPC from the foundation stack
    const vpc = ec2.Vpc.fromLookup(this, 'ImportedVPC', {
      vpcId: vpcId,
    });

    // Create monitoring and observability
    this.monitoring = new MonitoringConstruct(this, 'Monitoring', {
      applicationName,
      environment,
      vpc: vpc,
      vectorDatabaseArn,
      knowledgeBaseId,
      processingFunctionArns: processingFunctionArns || [],
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.monitoring.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: `${applicationName}-${environment}-dashboard-url`,
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.monitoring.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
      exportName: `${applicationName}-${environment}-alarm-topic-arn`,
    });
  }
}
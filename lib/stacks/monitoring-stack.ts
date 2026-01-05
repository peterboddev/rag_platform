import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly vectorDatabaseArn: string;
  readonly knowledgeBaseId?: string;
  readonly processingFunctionArns?: string[];
}

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { applicationName, environment, vectorDatabaseArn, knowledgeBaseId, processingFunctionArns } = props;

    // Create SNS topic for alerts
    this.alarmTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `${applicationName}-alerts-${environment}`,
      displayName: `RAG Infrastructure Alerts - ${environment}`,
    });

    // Create CloudWatch dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'RAGDashboard', {
      dashboardName: `${applicationName}-${environment}`,
    });

    // Add basic metrics widgets if function ARNs are provided
    if (processingFunctionArns && processingFunctionArns.length > 0) {
      processingFunctionArns.forEach((functionArn, index) => {
        const functionName = functionArn.split(':').pop() || `function-${index}`;
        
        this.dashboard.addWidgets(
          new cloudwatch.GraphWidget({
            title: `Lambda Function: ${functionName}`,
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Invocations',
                dimensionsMap: {
                  FunctionName: functionName,
                },
                statistic: 'Sum',
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Errors',
                dimensionsMap: {
                  FunctionName: functionName,
                },
                statistic: 'Sum',
              }),
            ],
            right: [
              new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Duration',
                dimensionsMap: {
                  FunctionName: functionName,
                },
                statistic: 'Average',
              }),
            ],
          })
        );

        // Create alarm for Lambda function errors
        const lambdaErrorAlarm = new cloudwatch.Alarm(this, `LambdaErrorAlarm${index}`, {
          alarmName: `${applicationName}-${environment}-lambda-errors-${index}`,
          alarmDescription: `Alert when Lambda function ${functionName} has errors`,
          metric: new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            dimensionsMap: {
              FunctionName: functionName,
            },
            statistic: 'Sum',
          }),
          threshold: 1,
          evaluationPeriods: 1,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        });

        lambdaErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
      });
    }

    // Create log group for application logs
    const applicationLogGroup = new logs.LogGroup(this, 'ApplicationLogGroup', {
      logGroupName: `/aws/rag/${applicationName}/${environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create a simple monitoring object to match the expected interface
    const monitoring = {
      dashboard: this.dashboard,
      alarmTopic: this.alarmTopic,
    };

    // Stack Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: `${applicationName}-${environment}-dashboard-url`,
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
      exportName: `${applicationName}-${environment}-alarm-topic-arn`,
    });

    new cdk.CfnOutput(this, 'LogGroupName', {
      value: applicationLogGroup.logGroupName,
      description: 'CloudWatch log group name for application logs',
      exportName: `${applicationName}-${environment}-log-group-name`,
    });
  }
}
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { KnowledgeBaseConstruct } from './knowledge-base';
import { DocumentProcessingConstruct } from './document-processing';
import { VectorDatabaseConstruct } from './vector-database';
import { DataStorageConstruct } from './data-storage';

export interface MonitoringProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly knowledgeBase: KnowledgeBaseConstruct;
  readonly documentProcessing: DocumentProcessingConstruct;
  readonly vectorDatabase: VectorDatabaseConstruct;
  readonly dataStorage: DataStorageConstruct;
}

export class MonitoringConstruct extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    // Create SNS topic for alerts
    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `${props.applicationName}-alerts-${props.environment}`,
      displayName: `RAG Infrastructure Alerts - ${props.environment}`,
    });

    // Create CloudWatch dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'RAGDashboard', {
      dashboardName: `${props.applicationName}-${props.environment}`,
    });

    // Add Lambda function metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Document Processing Function',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Invocations',
            dimensionsMap: {
              FunctionName: props.documentProcessing.processingFunction.functionName,
            },
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            dimensionsMap: {
              FunctionName: props.documentProcessing.processingFunction.functionName,
            },
            statistic: 'Sum',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            dimensionsMap: {
              FunctionName: props.documentProcessing.processingFunction.functionName,
            },
            statistic: 'Average',
          }),
        ],
      })
    );

    // Add SQS metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Document Processing Queue',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/SQS',
            metricName: 'NumberOfMessagesSent',
            dimensionsMap: {
              QueueName: props.documentProcessing.processingQueue.queueName,
            },
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/SQS',
            metricName: 'NumberOfMessagesReceived',
            dimensionsMap: {
              QueueName: props.documentProcessing.processingQueue.queueName,
            },
            statistic: 'Sum',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/SQS',
            metricName: 'ApproximateNumberOfVisibleMessages',
            dimensionsMap: {
              QueueName: props.documentProcessing.processingQueue.queueName,
            },
            statistic: 'Average',
          }),
        ],
      })
    );

    // Create alarms for Lambda function errors
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      alarmName: `${props.applicationName}-${props.environment}-lambda-errors`,
      alarmDescription: 'Alert when Lambda function has errors',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: {
          FunctionName: props.documentProcessing.processingFunction.functionName,
        },
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    lambdaErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));

    // Create alarm for SQS queue depth
    const queueDepthAlarm = new cloudwatch.Alarm(this, 'QueueDepthAlarm', {
      alarmName: `${props.applicationName}-${props.environment}-queue-depth`,
      alarmDescription: 'Alert when SQS queue has too many messages',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SQS',
        metricName: 'ApproximateNumberOfVisibleMessages',
        dimensionsMap: {
          QueueName: props.documentProcessing.processingQueue.queueName,
        },
        statistic: 'Average',
      }),
      threshold: 100,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    queueDepthAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));

    // Create log group for application logs
    const applicationLogGroup = new logs.LogGroup(this, 'ApplicationLogGroup', {
      logGroupName: `/aws/rag/${props.applicationName}/${props.environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Output monitoring information
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(this).region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'SNS topic ARN for alerts',
    });

    new cdk.CfnOutput(this, 'LogGroupName', {
      value: applicationLogGroup.logGroupName,
      description: 'CloudWatch log group name for application logs',
    });
  }
}
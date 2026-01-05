import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface MonitoringSimpleStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly vectorDatabaseArn: string;
  readonly processingFunctionArns?: string[];
  readonly alertEmail?: string;
}

export class MonitoringSimpleStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringSimpleStackProps) {
    super(scope, id, props);

    const { applicationName, environment, vectorDatabaseArn, processingFunctionArns = [], alertEmail } = props;

    // Create SNS topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `${applicationName}-alarms-${environment}`,
      displayName: `${applicationName} Alarms (${environment})`,
    });

    // Add email subscription if provided
    if (alertEmail) {
      this.alarmTopic.addSubscription(new snsSubscriptions.EmailSubscription(alertEmail));
    }

    // Create CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `${applicationName}-${environment}`,
    });

    // Add widgets for Lambda functions
    if (processingFunctionArns.length > 0) {
      const lambdaMetrics = processingFunctionArns.map(arn => {
        const functionName = arn.split(':').pop()!;
        return [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Invocations',
            dimensionsMap: { FunctionName: functionName },
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            dimensionsMap: { FunctionName: functionName },
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            dimensionsMap: { FunctionName: functionName },
            statistic: 'Average',
          }),
        ];
      }).flat();

      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Lambda Function Metrics',
          left: lambdaMetrics.filter((_, i) => i % 3 === 0), // Invocations
          right: lambdaMetrics.filter((_, i) => i % 3 === 1), // Errors
          width: 12,
          height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: 'Lambda Function Duration',
          left: lambdaMetrics.filter((_, i) => i % 3 === 2), // Duration
          width: 12,
          height: 6,
        })
      );

      // Create alarms for Lambda functions
      processingFunctionArns.forEach((arn, index) => {
        const functionName = arn.split(':').pop()!;
        
        // Error rate alarm
        const errorAlarm = new cloudwatch.Alarm(this, `LambdaErrorAlarm${index}`, {
          alarmName: `${applicationName}-${functionName}-errors-${environment}`,
          metric: new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            dimensionsMap: { FunctionName: functionName },
            statistic: 'Sum',
          }),
          threshold: 5,
          evaluationPeriods: 2,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        
        errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

        // Duration alarm
        const durationAlarm = new cloudwatch.Alarm(this, `LambdaDurationAlarm${index}`, {
          alarmName: `${applicationName}-${functionName}-duration-${environment}`,
          metric: new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            dimensionsMap: { FunctionName: functionName },
            statistic: 'Average',
          }),
          threshold: 30000, // 30 seconds
          evaluationPeriods: 3,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        
        durationAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
      });
    }

    // Add Bedrock metrics
    const bedrockInvocations = new cloudwatch.Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'Invocations',
      statistic: 'Sum',
    });

    const bedrockErrors = new cloudwatch.Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'ClientError',
      statistic: 'Sum',
    });

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Bedrock Model Usage',
        left: [bedrockInvocations],
        right: [bedrockErrors],
        width: 12,
        height: 6,
      })
    );

    // Add SQS metrics if processing functions exist
    if (processingFunctionArns.length > 0) {
      const sqsVisible = new cloudwatch.Metric({
        namespace: 'AWS/SQS',
        metricName: 'ApproximateNumberOfVisibleMessages',
        dimensionsMap: { QueueName: `${applicationName}-document-processing-${environment}` },
        statistic: 'Average',
      });

      const sqsReceived = new cloudwatch.Metric({
        namespace: 'AWS/SQS',
        metricName: 'NumberOfMessagesReceived',
        dimensionsMap: { QueueName: `${applicationName}-document-processing-${environment}` },
        statistic: 'Sum',
      });

      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Document Processing Queue',
          left: [sqsVisible],
          right: [sqsReceived],
          width: 12,
          height: 6,
        })
      );

      // SQS queue depth alarm
      const queueAlarm = new cloudwatch.Alarm(this, 'QueueDepthAlarm', {
        alarmName: `${applicationName}-queue-depth-${environment}`,
        metric: sqsVisible,
        threshold: 100,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      
      queueAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
    }

    // Create log groups for better log management
    const logGroups = processingFunctionArns.map((arn, index) => {
      const functionName = arn.split(':').pop()!;
      return new logs.LogGroup(this, `LogGroup${index}`, {
        logGroupName: `/aws/lambda/${functionName}`,
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });
    });

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

    new cdk.CfnOutput(this, 'DashboardName', {
      value: this.dashboard.dashboardName,
      description: 'CloudWatch Dashboard Name',
      exportName: `${applicationName}-${environment}-dashboard-name`,
    });
  }
}
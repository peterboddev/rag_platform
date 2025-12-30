import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

/**
 * Configuration for monitoring setup
 */
export interface MonitoringConfig {
  readonly pipelineName: string;
  readonly logRetentionDays?: logs.RetentionDays;
  readonly enableDetailedMetrics?: boolean;
  readonly enableAuditLogging?: boolean;
  readonly metricNamespace?: string;
  readonly notificationEmails?: string[];
  readonly enableFailureNotifications?: boolean;
}

/**
 * Properties for the MonitoringConstruct
 */
export interface MonitoringConstructProps {
  readonly config: MonitoringConfig;
  readonly pipeline?: codepipeline.Pipeline;
  readonly buildProject?: codebuild.Project;
}

/**
 * Construct for comprehensive pipeline monitoring using CloudWatch
 * 
 * This construct provides:
 * - Pipeline execution logging to CloudWatch
 * - Custom metrics for execution times and success rates
 * - Audit logging for infrastructure changes
 * - EventBridge rules for pipeline state changes
 * - SNS notifications for pipeline failures
 */
export class MonitoringConstruct extends Construct {
  public readonly pipelineLogGroup: logs.LogGroup;
  public readonly auditLogGroup: logs.LogGroup;
  public readonly executionTimeMetric: cloudwatch.Metric;
  public readonly successRateMetric: cloudwatch.Metric;
  public readonly pipelineStateRule: events.Rule;
  public readonly buildStateRule?: events.Rule;
  public readonly failureNotificationTopic?: sns.Topic;
  public readonly pipelineFailureRule?: events.Rule;
  public readonly buildFailureRule?: events.Rule;

  constructor(scope: Construct, id: string, props: MonitoringConstructProps) {
    super(scope, id);

    const { config } = props;
    const logRetention = config.logRetentionDays || logs.RetentionDays.ONE_MONTH;
    const metricNamespace = config.metricNamespace || 'PlatformPipeline/Monitoring';

    // Create CloudWatch Log Groups for pipeline execution logging
    this.pipelineLogGroup = new logs.LogGroup(this, 'PipelineLogGroup', {
      logGroupName: `/aws/platform-pipeline/${config.pipelineName}/execution`,
      retention: logRetention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create CloudWatch Log Group for audit logging
    this.auditLogGroup = new logs.LogGroup(this, 'AuditLogGroup', {
      logGroupName: `/aws/platform-pipeline/${config.pipelineName}/audit`,
      retention: logRetention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create custom metrics for pipeline monitoring
    this.executionTimeMetric = new cloudwatch.Metric({
      namespace: metricNamespace,
      metricName: 'PipelineExecutionTime',
      dimensionsMap: {
        PipelineName: config.pipelineName,
      },
      statistic: 'Average',
      unit: cloudwatch.Unit.SECONDS,
    });

    this.successRateMetric = new cloudwatch.Metric({
      namespace: metricNamespace,
      metricName: 'PipelineSuccessRate',
      dimensionsMap: {
        PipelineName: config.pipelineName,
      },
      statistic: 'Average',
      unit: cloudwatch.Unit.PERCENT,
    });

    // Create EventBridge rules for pipeline state changes
    if (props.pipeline) {
      this.pipelineStateRule = this.createPipelineStateRule(props.pipeline, config);
    } else {
      // Create a generic rule that will capture all CodePipeline events for this pipeline name
      this.pipelineStateRule = this.createGenericPipelineStateRule(config);
    }

    if (props.buildProject) {
      this.buildStateRule = this.createBuildStateRule(props.buildProject, config);
    }

    // Create CloudWatch Dashboard for monitoring
    if (config.enableDetailedMetrics) {
      this.createMonitoringDashboard(config);
    }

    // Set up failure notification system
    if (config.enableFailureNotifications !== false) {
      this.setupFailureNotifications(config, props);
    }

    // Add tags for resource management
    cdk.Tags.of(this).add('Component', 'Monitoring');
    cdk.Tags.of(this).add('Pipeline', config.pipelineName);
    cdk.Tags.of(this).add('ManagedBy', 'PlatformPipeline');
  }

  /**
   * Creates EventBridge rule for pipeline state changes
   */
  private createPipelineStateRule(pipeline: codepipeline.Pipeline, config: MonitoringConfig): events.Rule {
    const rule = new events.Rule(this, 'PipelineStateRule', {
      ruleName: `${config.pipelineName}-pipeline-state-changes`,
      description: `Captures state changes for ${config.pipelineName} pipeline`,
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
        detail: {
          pipeline: [pipeline.pipelineName],
        },
      },
    });

    // Add CloudWatch Logs target for pipeline events
    rule.addTarget(new targets.CloudWatchLogGroup(this.pipelineLogGroup));

    return rule;
  }

  /**
   * Creates generic EventBridge rule for pipeline state changes when pipeline reference is not available
   */
  private createGenericPipelineStateRule(config: MonitoringConfig): events.Rule {
    const rule = new events.Rule(this, 'PipelineStateRule', {
      ruleName: `${config.pipelineName}-pipeline-state-changes`,
      description: `Captures state changes for ${config.pipelineName} pipeline`,
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
        detail: {
          pipeline: [config.pipelineName],
        },
      },
    });

    // Add CloudWatch Logs target for pipeline events
    rule.addTarget(new targets.CloudWatchLogGroup(this.pipelineLogGroup));

    return rule;
  }

  /**
   * Creates EventBridge rule for CodeBuild state changes
   */
  private createBuildStateRule(buildProject: codebuild.Project, config: MonitoringConfig): events.Rule {
    const rule = new events.Rule(this, 'BuildStateRule', {
      ruleName: `${config.pipelineName}-build-state-changes`,
      description: `Captures state changes for ${config.pipelineName} build project`,
      eventPattern: {
        source: ['aws.codebuild'],
        detailType: ['CodeBuild Build State Change'],
        detail: {
          'project-name': [buildProject.projectName],
        },
      },
    });

    // Add CloudWatch Logs target for build events
    rule.addTarget(new targets.CloudWatchLogGroup(this.pipelineLogGroup));

    return rule;
  }

  /**
   * Creates CloudWatch Dashboard for pipeline monitoring
   */
  private createMonitoringDashboard(config: MonitoringConfig): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'MonitoringDashboard', {
      dashboardName: `${config.pipelineName}-monitoring`,
    });

    // Pipeline execution metrics widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Pipeline Execution Time',
        left: [this.executionTimeMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Pipeline Success Rate',
        left: [this.successRateMetric],
        width: 12,
        height: 6,
      })
    );

    return dashboard;
  }

  /**
   * Creates a custom metric filter for pipeline execution times
   */
  public createExecutionTimeMetricFilter(): logs.MetricFilter {
    return new logs.MetricFilter(this, 'ExecutionTimeMetricFilter', {
      logGroup: this.pipelineLogGroup,
      metricNamespace: this.executionTimeMetric.namespace,
      metricName: this.executionTimeMetric.metricName,
      filterPattern: logs.FilterPattern.exists('$.detail.execution-id'),
      metricValue: '1',
      defaultValue: 0,
    });
  }

  /**
   * Creates a custom metric filter for pipeline success rate
   */
  public createSuccessRateMetricFilter(): logs.MetricFilter {
    return new logs.MetricFilter(this, 'SuccessRateMetricFilter', {
      logGroup: this.pipelineLogGroup,
      metricNamespace: this.successRateMetric.namespace,
      metricName: this.successRateMetric.metricName,
      filterPattern: logs.FilterPattern.stringValue('$.state', '=', 'SUCCEEDED'),
      metricValue: '100',
      defaultValue: 0,
    });
  }

  /**
   * Adds audit logging for infrastructure changes
   */
  public addAuditLogging(cloudTrailLogGroupArn?: string): void {
    if (cloudTrailLogGroupArn) {
      // Create metric filter for CloudFormation stack changes
      const auditMetricFilter = new logs.MetricFilter(this, 'AuditMetricFilter', {
        logGroup: logs.LogGroup.fromLogGroupArn(this, 'CloudTrailLogGroup', cloudTrailLogGroupArn),
        metricNamespace: 'PlatformPipeline/Audit',
        metricName: 'InfrastructureChanges',
        filterPattern: logs.FilterPattern.all(
          logs.FilterPattern.stringValue('$.eventSource', '=', 'cloudformation.amazonaws.com'),
          logs.FilterPattern.exists('$.responseElements.stackId')
        ),
        metricValue: '1',
        defaultValue: 0,
      });
    }
  }

  /**
   * Gets the pipeline log group ARN
   */
  public getPipelineLogGroupArn(): string {
    return this.pipelineLogGroup.logGroupArn;
  }

  /**
   * Gets the audit log group ARN
   */
  public getAuditLogGroupArn(): string {
    return this.auditLogGroup.logGroupArn;
  }

  /**
   * Sets up SNS topics and EventBridge rules for failure notifications
   */
  private setupFailureNotifications(config: MonitoringConfig, props: MonitoringConstructProps): void {
    // Create SNS topic for failure notifications
    const failureNotificationTopic = new sns.Topic(this, 'FailureNotificationTopic', {
      topicName: `${config.pipelineName}-failure-notifications`,
      displayName: `${config.pipelineName} Pipeline Failure Notifications`,
    });

    // Store reference to the topic
    (this as any).failureNotificationTopic = failureNotificationTopic;

    // Add email subscriptions if provided
    if (config.notificationEmails && config.notificationEmails.length > 0) {
      config.notificationEmails.forEach((email, index) => {
        failureNotificationTopic.addSubscription(
          new subscriptions.EmailSubscription(email, {
            json: false, // Use formatted text messages instead of JSON
          })
        );
      });
    }

    // Create EventBridge rule for pipeline failures
    const pipelineFailureRule = new events.Rule(this, 'PipelineFailureRule', {
      ruleName: `${config.pipelineName}-pipeline-failures`,
      description: `Captures pipeline failure events for ${config.pipelineName}`,
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
        detail: {
          state: ['FAILED'],
          pipeline: [config.pipelineName],
        },
      },
    });

    // Store reference to the rule
    (this as any).pipelineFailureRule = pipelineFailureRule;

    // Add SNS target with message transformation for pipeline failures
    pipelineFailureRule.addTarget(new targets.SnsTopic(failureNotificationTopic, {
      message: events.RuleTargetInput.fromText(
        `🚨 PIPELINE FAILURE ALERT 🚨

Pipeline: ${config.pipelineName}
Status: FAILED
Execution ID: \${detail.execution-id}
Time: \${time}
Region: \${region}
Account: \${account}

Pipeline Details:
- Pipeline Name: \${detail.pipeline}
- State: \${detail.state}
- Version: \${detail.version}

Please check the AWS Console for detailed error information:
https://console.aws.amazon.com/codesuite/codepipeline/pipelines/\${detail.pipeline}/view

CloudWatch Logs: ${this.pipelineLogGroup.logGroupName}

This is an automated notification from the Platform Pipeline monitoring system.`
      ),
    }));

    // Create EventBridge rule for CodeBuild failures if build project is provided
    if (props.buildProject) {
      const buildFailureRule = new events.Rule(this, 'BuildFailureRule', {
        ruleName: `${config.pipelineName}-build-failures`,
        description: `Captures build failure events for ${config.pipelineName}`,
        eventPattern: {
          source: ['aws.codebuild'],
          detailType: ['CodeBuild Build State Change'],
          detail: {
            'build-status': ['FAILED', 'FAULT', 'STOPPED', 'TIMED_OUT'],
            'project-name': [props.buildProject.projectName],
          },
        },
      });

      // Store reference to the rule
      (this as any).buildFailureRule = buildFailureRule;

      // Add SNS target with message transformation for build failures
      buildFailureRule.addTarget(new targets.SnsTopic(failureNotificationTopic, {
        message: events.RuleTargetInput.fromText(
          `🔨 BUILD FAILURE ALERT 🔨

Project: \${detail.project-name}
Status: \${detail.build-status}
Build ID: \${detail.build-id}
Time: \${time}
Region: \${region}
Account: \${account}

Build Details:
- Project Name: \${detail.project-name}
- Build Status: \${detail.build-status}
- Build Phase: \${detail.current-phase}
- Build Phase Status: \${detail.current-phase-context}

Please check the AWS Console for detailed build logs:
https://console.aws.amazon.com/codesuite/codebuild/projects/\${detail.project-name}/build/\${detail.build-id}

CloudWatch Logs: ${this.pipelineLogGroup.logGroupName}

This is an automated notification from the Platform Pipeline monitoring system.`
        ),
      }));
    }

    // Create a generic rule for application pipeline failures (managed by this platform)
    const applicationPipelineFailureRule = new events.Rule(this, 'ApplicationPipelineFailureRule', {
      ruleName: `${config.pipelineName}-app-pipeline-failures`,
      description: `Captures failure events for application pipelines managed by ${config.pipelineName}`,
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
        detail: {
          state: ['FAILED'],
          // This will capture all pipeline failures - we can filter by naming convention if needed
        },
      },
    });

    // Add SNS target for application pipeline failures with different message format
    applicationPipelineFailureRule.addTarget(new targets.SnsTopic(failureNotificationTopic, {
      message: events.RuleTargetInput.fromText(
        `⚠️ APPLICATION PIPELINE FAILURE ⚠️

Application Pipeline: \${detail.pipeline}
Status: FAILED
Execution ID: \${detail.execution-id}
Time: \${time}
Region: \${region}
Account: \${account}

Pipeline Details:
- Pipeline Name: \${detail.pipeline}
- State: \${detail.state}
- Version: \${detail.version}

This application pipeline is managed by the ${config.pipelineName} platform pipeline.

Please check the AWS Console for detailed error information:
https://console.aws.amazon.com/codesuite/codepipeline/pipelines/\${detail.pipeline}/view

Platform Pipeline Logs: ${this.pipelineLogGroup.logGroupName}

This is an automated notification from the Platform Pipeline monitoring system.`
      ),
    }));

    // Add CloudWatch alarm for repeated failures
    const failureAlarm = new cloudwatch.Alarm(this, 'RepeatedFailuresAlarm', {
      alarmName: `${config.pipelineName}-repeated-failures`,
      alarmDescription: `Alarm for repeated failures in ${config.pipelineName} pipeline`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Events',
        metricName: 'MatchedEvents',
        dimensionsMap: {
          RuleName: pipelineFailureRule.ruleName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(15),
      }),
      threshold: 3, // Alert if 3 or more failures in 15 minutes
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Add SNS action to the alarm
    failureAlarm.addAlarmAction(new cloudwatchActions.SnsAction(failureNotificationTopic));
  }

  /**
   * Gets the failure notification topic ARN
   */
  public getFailureNotificationTopicArn(): string {
    return (this as any).failureNotificationTopic?.topicArn || '';
  }

  /**
   * Adds an email subscription to the failure notification topic
   */
  public addEmailNotification(email: string): void {
    const topic = (this as any).failureNotificationTopic as sns.Topic;
    if (topic) {
      topic.addSubscription(
        new subscriptions.EmailSubscription(email, {
          json: false,
        })
      );
    }
  }
}
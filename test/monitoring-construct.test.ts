import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { MonitoringConstruct } from '../lib/constructs/monitoring-construct';

describe('MonitoringConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
  });

  test('creates CloudWatch log groups for pipeline and audit logging', () => {
    // Create monitoring construct
    new MonitoringConstruct(stack, 'TestMonitoring', {
      config: {
        pipelineName: 'TestPipeline',
        logRetentionDays: logs.RetentionDays.ONE_WEEK,
        enableDetailedMetrics: true,
        enableAuditLogging: true,
        metricNamespace: 'Test/Monitoring',
      },
    });

    const template = Template.fromStack(stack);

    // Verify pipeline log group is created
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/platform-pipeline/TestPipeline/execution',
      RetentionInDays: 7,
    });

    // Verify audit log group is created
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/platform-pipeline/TestPipeline/audit',
      RetentionInDays: 7,
    });
  });

  test('creates EventBridge rule for pipeline state changes', () => {
    // Create monitoring construct
    new MonitoringConstruct(stack, 'TestMonitoring', {
      config: {
        pipelineName: 'TestPipeline',
        enableDetailedMetrics: true,
      },
    });

    const template = Template.fromStack(stack);

    // Verify EventBridge rule is created
    template.hasResourceProperties('AWS::Events::Rule', {
      Name: 'TestPipeline-pipeline-state-changes',
      Description: 'Captures state changes for TestPipeline pipeline',
      EventPattern: {
        source: ['aws.codepipeline'],
        'detail-type': ['CodePipeline Pipeline Execution State Change'],
        detail: {
          pipeline: ['TestPipeline'],
        },
      },
    });
  });

  test('creates CloudWatch dashboard when detailed metrics are enabled', () => {
    // Create monitoring construct
    new MonitoringConstruct(stack, 'TestMonitoring', {
      config: {
        pipelineName: 'TestPipeline',
        enableDetailedMetrics: true,
        metricNamespace: 'Test/Monitoring',
      },
    });

    const template = Template.fromStack(stack);

    // Verify CloudWatch dashboard is created
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'TestPipeline-monitoring',
    });
  });

  test('creates metric filters for execution time and success rate', () => {
    // Create monitoring construct
    const monitoring = new MonitoringConstruct(stack, 'TestMonitoring', {
      config: {
        pipelineName: 'TestPipeline',
        enableDetailedMetrics: true,
        metricNamespace: 'Test/Monitoring',
      },
    });

    // Create metric filters
    monitoring.createExecutionTimeMetricFilter();
    monitoring.createSuccessRateMetricFilter();

    const template = Template.fromStack(stack);

    // Verify metric filters are created
    template.hasResourceProperties('AWS::Logs::MetricFilter', {
      MetricTransformations: [
        {
          MetricNamespace: 'Test/Monitoring',
          MetricName: 'PipelineExecutionTime',
        },
      ],
    });

    template.hasResourceProperties('AWS::Logs::MetricFilter', {
      MetricTransformations: [
        {
          MetricNamespace: 'Test/Monitoring',
          MetricName: 'PipelineSuccessRate',
        },
      ],
    });
  });

  test('applies correct tags to monitoring resources', () => {
    // Create monitoring construct
    new MonitoringConstruct(stack, 'TestMonitoring', {
      config: {
        pipelineName: 'TestPipeline',
      },
    });

    const template = Template.fromStack(stack);

    // Verify tags are applied to log groups (checking for the presence of expected tags)
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      Tags: [
        {
          Key: 'Component',
          Value: 'Monitoring',
        },
        {
          Key: 'ManagedBy',
          Value: 'PlatformPipeline',
        },
        {
          Key: 'Pipeline',
          Value: 'TestPipeline',
        },
      ],
    });
  });

  test('creates SNS topic for failure notifications when enabled', () => {
    // Create monitoring construct with failure notifications enabled
    new MonitoringConstruct(stack, 'TestMonitoring', {
      config: {
        pipelineName: 'TestPipeline',
        enableFailureNotifications: true,
        notificationEmails: ['platform-team@example.com'],
      },
    });

    const template = Template.fromStack(stack);

    // Verify SNS topic is created
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'TestPipeline-failure-notifications',
      DisplayName: 'TestPipeline Pipeline Failure Notifications',
    });

    // Verify email subscription is created
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'platform-team@example.com',
    });
  });

  test('creates EventBridge rules for pipeline and build failures', () => {
    // Create monitoring construct with failure notifications
    new MonitoringConstruct(stack, 'TestMonitoring', {
      config: {
        pipelineName: 'TestPipeline',
        enableFailureNotifications: true,
      },
    });

    const template = Template.fromStack(stack);

    // Verify pipeline failure rule is created
    template.hasResourceProperties('AWS::Events::Rule', {
      Name: 'TestPipeline-pipeline-failures',
      Description: 'Captures pipeline failure events for TestPipeline',
      EventPattern: {
        source: ['aws.codepipeline'],
        'detail-type': ['CodePipeline Pipeline Execution State Change'],
        detail: {
          state: ['FAILED'],
          pipeline: ['TestPipeline'],
        },
      },
    });

    // Verify application pipeline failure rule is created
    template.hasResourceProperties('AWS::Events::Rule', {
      Name: 'TestPipeline-app-pipeline-failures',
      Description: 'Captures failure events for application pipelines managed by TestPipeline',
      EventPattern: {
        source: ['aws.codepipeline'],
        'detail-type': ['CodePipeline Pipeline Execution State Change'],
        detail: {
          state: ['FAILED'],
        },
      },
    });
  });

  test('creates CloudWatch alarm for repeated failures', () => {
    // Create monitoring construct with failure notifications
    new MonitoringConstruct(stack, 'TestMonitoring', {
      config: {
        pipelineName: 'TestPipeline',
        enableFailureNotifications: true,
      },
    });

    const template = Template.fromStack(stack);

    // Verify CloudWatch alarm is created
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'TestPipeline-repeated-failures',
      AlarmDescription: 'Alarm for repeated failures in TestPipeline pipeline',
      Threshold: 3,
      EvaluationPeriods: 1,
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
    });
  });

  test('does not create notification resources when disabled', () => {
    // Create monitoring construct with failure notifications disabled
    new MonitoringConstruct(stack, 'TestMonitoring', {
      config: {
        pipelineName: 'TestPipeline',
        enableFailureNotifications: false,
      },
    });

    const template = Template.fromStack(stack);

    // Verify SNS topic is not created
    template.resourceCountIs('AWS::SNS::Topic', 0);

    // Verify failure-specific EventBridge rules are not created
    const rules = template.findResources('AWS::Events::Rule');
    const ruleNames = Object.values(rules).map((rule: any) => rule.Properties?.Name);
    
    expect(ruleNames).not.toContain('TestPipeline-pipeline-failures');
    expect(ruleNames).not.toContain('TestPipeline-app-pipeline-failures');
  });

  test('provides methods to get notification topic ARN and add email subscriptions', () => {
    // Create monitoring construct
    const monitoring = new MonitoringConstruct(stack, 'TestMonitoring', {
      config: {
        pipelineName: 'TestPipeline',
        enableFailureNotifications: true,
      },
    });

    // Test that methods exist and return expected types
    expect(typeof monitoring.getFailureNotificationTopicArn()).toBe('string');
    expect(() => monitoring.addEmailNotification('test@example.com')).not.toThrow();
  });
});
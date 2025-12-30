# Failure Notification System

## Overview

The Platform Pipeline includes a comprehensive failure notification system that automatically alerts platform engineers when pipeline failures occur. The system uses Amazon SNS (Simple Notification Service) to send formatted email notifications for various types of failures.

## Features

- **Pipeline Failure Notifications**: Alerts for platform pipeline failures
- **Application Pipeline Failures**: Notifications for managed application pipeline failures  
- **Build Failure Alerts**: CodeBuild project failure notifications
- **Repeated Failure Alarms**: CloudWatch alarms for multiple failures within a time window
- **Formatted Messages**: Human-readable email notifications with direct links to AWS Console

## Configuration

### Email Notifications

Configure notification email addresses in several ways:

#### 1. CDK Context (Recommended)

Add to your `cdk.json` file:

```json
{
  "context": {
    "notificationEmails": [
      "platform-team@company.com",
      "devops-alerts@company.com"
    ]
  }
}
```

#### 2. Environment Variable

Set the `PLATFORM_NOTIFICATION_EMAILS` environment variable:

```bash
export PLATFORM_NOTIFICATION_EMAILS="platform-team@company.com,devops-alerts@company.com"
```

#### 3. Programmatic Configuration

Add emails programmatically after deployment:

```typescript
// Get reference to the monitoring construct
const monitoring = platformPipelineStack.monitoring;

// Add additional email subscriptions
monitoring.addEmailNotification('new-team-member@company.com');
```

### Enabling/Disabling Notifications

Notifications are enabled by default. To disable:

```typescript
new MonitoringConstruct(this, 'Monitoring', {
  config: {
    pipelineName: 'MyPipeline',
    enableFailureNotifications: false, // Disable notifications
  },
});
```

## Notification Types

### 1. Pipeline Failure Alerts

Triggered when the platform pipeline fails:

```
🚨 PIPELINE FAILURE ALERT 🚨

Pipeline: PlatformPipeline
Status: FAILED
Execution ID: 12345678-1234-1234-1234-123456789012
Time: 2024-01-15T10:30:00Z
Region: us-east-1
Account: 123456789012

Pipeline Details:
- Pipeline Name: PlatformPipeline
- State: FAILED
- Version: 1

Please check the AWS Console for detailed error information:
https://console.aws.amazon.com/codesuite/codepipeline/pipelines/PlatformPipeline/view

CloudWatch Logs: /aws/platform-pipeline/PlatformPipeline/execution

This is an automated notification from the Platform Pipeline monitoring system.
```

### 2. Build Failure Alerts

Triggered when CodeBuild projects fail:

```
🔨 BUILD FAILURE ALERT 🔨

Project: PlatformPipeline-Synth
Status: FAILED
Build ID: PlatformPipeline-Synth:12345678-1234-1234-1234-123456789012
Time: 2024-01-15T10:30:00Z
Region: us-east-1
Account: 123456789012

Build Details:
- Project Name: PlatformPipeline-Synth
- Build Status: FAILED
- Build Phase: BUILD
- Build Phase Status: FAILED

Please check the AWS Console for detailed build logs:
https://console.aws.amazon.com/codesuite/codebuild/projects/PlatformPipeline-Synth/build/12345678-1234-1234-1234-123456789012

CloudWatch Logs: /aws/platform-pipeline/PlatformPipeline/execution

This is an automated notification from the Platform Pipeline monitoring system.
```

### 3. Application Pipeline Failures

Triggered when managed application pipelines fail:

```
⚠️ APPLICATION PIPELINE FAILURE ⚠️

Application Pipeline: MyApp-Pipeline
Status: FAILED
Execution ID: 87654321-4321-4321-4321-210987654321
Time: 2024-01-15T10:30:00Z
Region: us-east-1
Account: 123456789012

Pipeline Details:
- Pipeline Name: MyApp-Pipeline
- State: FAILED
- Version: 2

This application pipeline is managed by the PlatformPipeline platform pipeline.

Please check the AWS Console for detailed error information:
https://console.aws.amazon.com/codesuite/codepipeline/pipelines/MyApp-Pipeline/view

Platform Pipeline Logs: /aws/platform-pipeline/PlatformPipeline/execution

This is an automated notification from the Platform Pipeline monitoring system.
```

### 4. Repeated Failure Alarms

CloudWatch alarm triggered when 3 or more failures occur within 15 minutes:

- Helps identify systemic issues
- Prevents notification spam during outages
- Provides aggregated failure metrics

## AWS Resources Created

The notification system creates the following AWS resources:

- **SNS Topic**: `{PipelineName}-failure-notifications`
- **Email Subscriptions**: One per configured email address
- **EventBridge Rules**: 
  - `{PipelineName}-pipeline-failures`
  - `{PipelineName}-build-failures` 
  - `{PipelineName}-app-pipeline-failures`
- **CloudWatch Alarm**: `{PipelineName}-repeated-failures`

## Troubleshooting

### Email Subscriptions Not Working

1. **Check Email Confirmation**: SNS requires email confirmation for new subscriptions
2. **Verify Email Addresses**: Ensure email addresses are valid and accessible
3. **Check Spam Folders**: AWS notifications may be filtered as spam

### Missing Notifications

1. **Verify Configuration**: Check that `enableFailureNotifications` is not set to `false`
2. **Check EventBridge Rules**: Ensure rules are active and properly configured
3. **Review CloudWatch Logs**: Check for EventBridge rule execution logs

### Too Many Notifications

1. **Adjust Alarm Threshold**: Modify the repeated failure alarm threshold
2. **Filter Rules**: Add more specific EventBridge rule filters
3. **Use Distribution Lists**: Configure team distribution lists instead of individual emails

## Security Considerations

- **Email Addresses**: Stored in CDK context and CloudFormation templates
- **SNS Permissions**: Topic access is restricted to EventBridge and CloudWatch
- **Message Content**: Contains pipeline names and execution IDs (no sensitive data)
- **Encryption**: SNS messages are encrypted in transit

## Cost Considerations

- **SNS Costs**: Minimal cost per notification (~$0.50 per million notifications)
- **EventBridge Costs**: ~$1.00 per million events
- **CloudWatch Alarms**: ~$0.10 per alarm per month
- **Total Estimated Cost**: <$5/month for typical usage

## Integration with Monitoring

The failure notification system integrates with the broader monitoring infrastructure:

- **CloudWatch Logs**: All events are logged for audit and debugging
- **CloudWatch Metrics**: Failure rates and counts are tracked
- **CloudWatch Dashboards**: Visual representation of failure trends
- **EventBridge**: Central event routing for all pipeline events

## Next Steps

1. **Configure Email Addresses**: Add your team's email addresses to CDK context
2. **Test Notifications**: Trigger a test failure to verify notification delivery
3. **Customize Messages**: Modify notification templates if needed
4. **Set Up Monitoring**: Review CloudWatch dashboards for failure trends
5. **Document Procedures**: Create runbooks for responding to different failure types
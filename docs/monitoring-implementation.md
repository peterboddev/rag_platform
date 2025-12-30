# CloudWatch Monitoring Implementation

## Overview

This document describes the CloudWatch integration implementation for pipeline monitoring as part of task 7.1. The implementation provides comprehensive monitoring capabilities for both platform and application pipelines.

## Features Implemented

### 1. Pipeline Execution Logging to CloudWatch

- **Platform Pipeline Logging**: All platform pipeline executions are logged to `/aws/platform-pipeline/PlatformPipeline/execution`
- **Application Pipeline Logging**: Each application pipeline has its own log group at `/aws/platform-pipeline/{ApplicationName}/execution`
- **CodeBuild Integration**: Build logs are automatically sent to CloudWatch with dedicated log groups for each project
- **Log Retention**: Configurable retention periods (default: 1 month for platform, 2 weeks for applications)

### 2. Metrics Collection for Execution Times and Success Rates

- **Custom Metrics**: 
  - `PipelineExecutionTime`: Tracks average execution time for pipelines
  - `PipelineSuccessRate`: Tracks success rate percentage for pipelines
- **Metric Namespaces**: 
  - Platform: `PlatformPipeline/Monitoring`
  - Applications: `ApplicationPipeline/{ApplicationName}`
- **Metric Filters**: Automatically extract metrics from CloudWatch logs using filter patterns

### 3. Audit Logging for Infrastructure Changes

- **Audit Log Groups**: Dedicated log groups for audit events at `/aws/platform-pipeline/{PipelineName}/audit`
- **EventBridge Integration**: Captures CloudFormation stack changes and infrastructure modifications
- **Change Tracking**: Logs all CDK deployments and infrastructure updates

### 4. EventBridge Rules for Real-time Monitoring

- **Pipeline State Changes**: Captures all CodePipeline execution state changes
- **Build State Changes**: Monitors CodeBuild project execution states
- **Automatic Log Forwarding**: Events are automatically forwarded to CloudWatch logs

### 5. CloudWatch Dashboard

- **Visual Monitoring**: Automatic dashboard creation for pipelines with detailed metrics enabled
- **Execution Time Graphs**: Visual representation of pipeline execution times over time
- **Success Rate Tracking**: Charts showing pipeline success rates and trends
- **Customizable**: Dashboard names follow the pattern `{PipelineName}-monitoring`

## Implementation Details

### MonitoringConstruct

The core monitoring functionality is implemented in `lib/constructs/monitoring-construct.ts`:

```typescript
export class MonitoringConstruct extends Construct {
  public readonly pipelineLogGroup: logs.LogGroup;
  public readonly auditLogGroup: logs.LogGroup;
  public readonly executionTimeMetric: cloudwatch.Metric;
  public readonly successRateMetric: cloudwatch.Metric;
  // ... additional properties
}
```

### Integration Points

1. **PlatformPipelineStack**: Integrated monitoring for the main platform pipeline
2. **ApplicationPipelineConstruct**: Each application pipeline gets its own monitoring
3. **SecurityStack**: Enhanced IAM permissions for CloudWatch and EventBridge operations

### Configuration Options

```typescript
interface MonitoringConfig {
  readonly pipelineName: string;
  readonly logRetentionDays?: logs.RetentionDays;
  readonly enableDetailedMetrics?: boolean;
  readonly enableAuditLogging?: boolean;
  readonly metricNamespace?: string;
}
```

## Security Considerations

### IAM Permissions

The implementation includes least-privilege IAM permissions for:
- CloudWatch Logs (CreateLogGroup, CreateLogStream, PutLogEvents)
- CloudWatch Metrics (PutMetricData, GetMetricStatistics)
- EventBridge (PutRule, PutTargets, DeleteRule)
- CloudWatch Dashboards (PutDashboard, GetDashboard)

### Resource Isolation

- Each pipeline has its own dedicated log groups
- Metric namespaces prevent cross-pipeline metric pollution
- EventBridge rules are scoped to specific pipeline names

## Monitoring Outputs

The implementation provides CloudFormation outputs for easy access:
- `PipelineLogGroupArn`: ARN of the pipeline execution log group
- `AuditLogGroupArn`: ARN of the audit log group

## Testing

Comprehensive unit tests verify:
- CloudWatch log group creation
- EventBridge rule configuration
- Metric filter setup
- Dashboard creation
- Proper resource tagging

## Usage Examples

### Viewing Pipeline Logs

```bash
# View recent pipeline executions
aws logs filter-log-events \
  --log-group-name "/aws/platform-pipeline/PlatformPipeline/execution" \
  --start-time $(date -d '1 hour ago' +%s)000

# Query execution metrics
aws logs start-query \
  --log-group-name "/aws/platform-pipeline/PlatformPipeline/execution" \
  --start-time $(date -d '1 day ago' +%s) \
  --end-time $(date +%s) \
  --query-string "fields @timestamp, @message | filter @message like /SUCCEEDED/ | stats count() by bin(5m)"
```

### Accessing Metrics

```bash
# Get pipeline success rate
aws cloudwatch get-metric-statistics \
  --namespace "PlatformPipeline/Monitoring" \
  --metric-name "PipelineSuccessRate" \
  --dimensions Name=PipelineName,Value=PlatformPipeline \
  --start-time $(date -d '1 day ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 3600 \
  --statistics Average
```

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 7.1**: ✅ Pipeline execution events logged to CloudWatch
- **Requirement 7.3**: ✅ Metrics collection for execution times and success rates  
- **Requirement 7.5**: ✅ Audit logging for infrastructure changes

The monitoring system provides comprehensive observability for the platform pipeline infrastructure while maintaining security best practices and resource isolation.
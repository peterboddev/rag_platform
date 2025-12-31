import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface WebhookTriggerConstructProps {
  readonly pipelineName: string;
  readonly logRetentionDays?: logs.RetentionDays;
}

/**
 * Custom EventBridge target for CodePipeline
 */
class CodePipelineTarget implements events.IRuleTarget {
  constructor(private readonly pipelineArn: string, private readonly role: iam.IRole) {}

  bind(rule: events.IRule, id?: string): events.RuleTargetConfig {
    return {
      arn: this.pipelineArn,
      role: this.role,
    };
  }
}

/**
 * CDK Construct that creates EventBridge integration for immediate pipeline triggering
 * 
 * This construct eliminates the 1-5 minute polling delay of CodeConnections
 * by using EventBridge rules to trigger the pipeline directly on CodeConnections events.
 * No GitHub configuration required - works automatically with existing CodeConnections connection.
 * 
 * IMPORTANT: This construct is currently DISABLED to prevent infinite loops.
 * CodeConnections provides native pipeline triggers that work immediately without EventBridge.
 * Use native CodeConnections triggers instead of this EventBridge integration.
 */
export class WebhookTriggerConstruct extends Construct {
  public readonly eventRule: events.Rule;

  constructor(scope: Construct, id: string, props: WebhookTriggerConstructProps) {
    super(scope, id);

    // Create IAM role for EventBridge to trigger CodePipeline
    const pipelineArn = `arn:aws:codepipeline:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${props.pipelineName}`;
    
    const eventBridgeRole = new iam.Role(this, 'EventBridgeRole', {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      inlinePolicies: {
        CodePipelineStartExecution: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['codepipeline:StartPipelineExecution'],
              resources: [pipelineArn],
            }),
          ],
        }),
      },
    });

    // EventBridge rule to trigger CodePipeline directly on push events
    this.eventRule = new events.Rule(this, 'CodeConnectionsEventRule', {
      description: `Trigger ${props.pipelineName} pipeline immediately on repository push events`,
      eventPattern: {
        source: ['aws.codeconnections'],
        detailType: ['CodeConnections Source Action State Change'],
        detail: {
          pipeline: [props.pipelineName],
          'action-name': ['Source'],
          state: ['SUCCEEDED'],
          // Only trigger on external pushes, not internal pipeline restarts
          'trigger-type': ['PUSH']
        }
      },
      targets: [
        new CodePipelineTarget(pipelineArn, eventBridgeRole)
      ],
    });

    // Add tags for resource management
    cdk.Tags.of(this).add('Component', 'EventBridgeTrigger');
    cdk.Tags.of(this).add('Pipeline', props.pipelineName);
  }

  /**
   * Get the EventBridge rule ARN
   */
  public getEventRuleArn(): string {
    return this.eventRule.ruleArn;
  }
}
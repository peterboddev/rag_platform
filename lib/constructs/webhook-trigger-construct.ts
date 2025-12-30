import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';

export interface WebhookTriggerConstructProps {
  readonly pipeline: codepipeline.Pipeline;
  readonly logRetentionDays?: logs.RetentionDays;
}

/**
 * CDK Construct that creates EventBridge integration for immediate pipeline triggering
 * 
 * This construct eliminates the 1-5 minute polling delay of CodeStar connections
 * by using EventBridge rules to trigger the pipeline directly on CodeStar events.
 * No GitHub configuration required - works automatically with existing CodeStar connection.
 */
export class WebhookTriggerConstruct extends Construct {
  public readonly eventRule: events.Rule;

  constructor(scope: Construct, id: string, props: WebhookTriggerConstructProps) {
    super(scope, id);

    // EventBridge rule to trigger CodePipeline directly on push events
    this.eventRule = new events.Rule(this, 'CodeStarEventRule', {
      description: `Trigger ${props.pipeline.pipelineName} pipeline immediately on repository push events`,
      eventPattern: {
        source: ['aws.codeconnections'],
        detailType: ['CodeStar Source Action State Change'],
        detail: {
          pipeline: [props.pipeline.pipelineName],
          'action-name': ['Source'],
          state: ['SUCCEEDED']
        }
      },
      targets: [
        new targets.CodePipeline(props.pipeline)
      ],
    });

    // Add tags for resource management
    cdk.Tags.of(this).add('Component', 'EventBridgeTrigger');
    cdk.Tags.of(this).add('Pipeline', props.pipeline.pipelineName);
  }

  /**
   * Get the EventBridge rule ARN
   */
  public getEventRuleArn(): string {
    return this.eventRule.ruleArn;
  }
}
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface BedrockAIServicesProps {
  readonly applicationName: string;
  readonly environment: string;
}

export class BedrockAIServicesConstruct extends Construct {
  public readonly novaProModelId: string;
  public readonly embeddingModelId: string;
  public readonly modelAccessRole: iam.Role;

  constructor(scope: Construct, id: string, props: BedrockAIServicesProps) {
    super(scope, id);

    // Define Bedrock model IDs
    this.novaProModelId = 'amazon.nova-pro-v1:0';
    this.embeddingModelId = 'amazon.titan-embed-text-v1';

    // Create IAM role for Bedrock model access
    this.modelAccessRole = new iam.Role(this, 'BedrockModelAccessRole', {
      roleName: `${props.applicationName}-bedrock-access-${props.environment}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant access to Nova Pro model
    this.modelAccessRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/${this.novaProModelId}`,
      ],
    }));

    // Grant access to embedding model
    this.modelAccessRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
      ],
      resources: [
        `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/${this.embeddingModelId}`,
      ],
    }));

    // Grant access to Bedrock Knowledge Base operations
    this.modelAccessRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:Retrieve',
        'bedrock:RetrieveAndGenerate',
      ],
      resources: [
        `arn:aws:bedrock:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:knowledge-base/*`,
      ],
    }));

    // Output model IDs for reference
    new cdk.CfnOutput(this, 'NovaProModelId', {
      value: this.novaProModelId,
      description: 'Bedrock Nova Pro model ID',
    });

    new cdk.CfnOutput(this, 'EmbeddingModelId', {
      value: this.embeddingModelId,
      description: 'Bedrock embedding model ID',
    });
  }
}
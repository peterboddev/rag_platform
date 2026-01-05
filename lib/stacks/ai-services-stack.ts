import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BedrockAIServicesConstruct } from '../constructs/bedrock-ai-services';

export interface AIServicesStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
}

export class AIServicesStack extends cdk.Stack {
  public readonly bedrockServices: BedrockAIServicesConstruct;

  constructor(scope: Construct, id: string, props: AIServicesStackProps) {
    super(scope, id, props);

    const { applicationName, environment } = props;

    // Bedrock AI Services
    this.bedrockServices = new BedrockAIServicesConstruct(this, 'BedrockAIServices', {
      applicationName,
      environment,
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'BedrockNovaProModelId', {
      value: this.bedrockServices.novaProModelId,
      description: 'Bedrock Nova Pro model ID',
      exportName: `${applicationName}-${environment}-bedrock-nova-pro-model-id`,
    });

    new cdk.CfnOutput(this, 'BedrockEmbeddingModelId', {
      value: this.bedrockServices.embeddingModelId,
      description: 'Bedrock embedding model ID',
      exportName: `${applicationName}-${environment}-bedrock-embedding-model-id`,
    });
  }
}
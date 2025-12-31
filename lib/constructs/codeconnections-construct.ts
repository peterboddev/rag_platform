import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_codestarconnections as codestarconnections } from 'aws-cdk-lib';

export interface CodeConnectionsConstructProps {
  readonly connectionName: string;
  readonly providerType?: string;
  readonly tags?: cdk.CfnTag[];
}

/**
 * CDK Construct for creating CodeStar Connections (will create newer codeconnections type)
 * 
 * This construct creates a CodeStar connection which will automatically be
 * created as the newer codeconnections type when deployed. It provides better 
 * integration with pipeline triggers and EventBridge.
 */
export class CodeConnectionsConstruct extends Construct {
  public readonly connection: codestarconnections.CfnConnection;
  public readonly connectionArn: string;

  constructor(scope: Construct, id: string, props: CodeConnectionsConstructProps) {
    super(scope, id);

    // Create the CodeStar connection (will be created as codeconnections type)
    this.connection = new codestarconnections.CfnConnection(this, 'Connection', {
      connectionName: props.connectionName,
      providerType: props.providerType || 'GitHub',
      tags: props.tags || [
        {
          key: 'ManagedBy',
          value: 'CDK'
        },
        {
          key: 'Service',
          value: 'PlatformPipeline'
        }
      ]
    });

    // Store the connection ARN for use in pipelines
    this.connectionArn = this.connection.attrConnectionArn;

    // Output the connection ARN for reference
    new cdk.CfnOutput(this, 'ConnectionArn', {
      value: this.connectionArn,
      description: 'ARN of the CodeStar connection (created as codeconnections type)',
      exportName: `${props.connectionName}-ConnectionArn`
    });

    // Output connection status information
    new cdk.CfnOutput(this, 'ConnectionStatus', {
      value: this.connection.attrConnectionStatus,
      description: 'Status of the CodeStar connection (will be PENDING until authorized)',
      exportName: `${props.connectionName}-ConnectionStatus`
    });

    // Add tags for resource management
    cdk.Tags.of(this).add('Component', 'CodeStarConnections');
    cdk.Tags.of(this).add('ConnectionName', props.connectionName);
  }

  /**
   * Gets the connection ARN
   */
  public getConnectionArn(): string {
    return this.connectionArn;
  }

  /**
   * Gets the connection name
   */
  public getConnectionName(): string {
    return this.connection.connectionName!;
  }
}
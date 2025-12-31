import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_codestarconnections as codestarconnections } from 'aws-cdk-lib';

export interface CodeConnectionsConstructProps {
  readonly connectionName: string;
  readonly providerType?: string;
  readonly tags?: cdk.CfnTag[];
}

/**
 * CDK Construct for creating CodeConnections (aws.codeconnections service)
 * 
 * This construct creates a CodeConnections connection which provides better 
 * integration with pipeline triggers and immediate push event handling.
 * 
 * IMPORTANT: Use CodeConnections, NOT CodeStar connections.
 * - CodeConnections: aws.codeconnections (✅ USE THIS)
 * - CodeStar Connections: aws.codestar-connections (❌ DON'T USE)
 */
export class CodeConnectionsConstruct extends Construct {
  public readonly connection: codestarconnections.CfnConnection;
  public readonly connectionArn: string;

  constructor(scope: Construct, id: string, props: CodeConnectionsConstructProps) {
    super(scope, id);

    // Create the CodeConnections connection (aws.codeconnections service)
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
        },
        {
          key: 'ConnectionType',
          value: 'CodeConnections'
        }
      ]
    });

    // Store the connection ARN for use in pipelines
    this.connectionArn = this.connection.attrConnectionArn;

    // Output the connection ARN for reference
    new cdk.CfnOutput(this, 'ConnectionArn', {
      value: this.connectionArn,
      description: 'ARN of the CodeConnections connection (aws.codeconnections service)',
      exportName: `${props.connectionName}-ConnectionArn`
    });

    // Output connection status information
    new cdk.CfnOutput(this, 'ConnectionStatus', {
      value: this.connection.attrConnectionStatus,
      description: 'Status of the CodeConnections connection (will be PENDING until authorized)',
      exportName: `${props.connectionName}-ConnectionStatus`
    });

    // Add tags for resource management
    cdk.Tags.of(this).add('Component', 'CodeConnections');
    cdk.Tags.of(this).add('ConnectionName', props.connectionName);
    cdk.Tags.of(this).add('Service', 'aws.codeconnections');
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
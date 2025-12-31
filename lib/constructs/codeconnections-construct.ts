import * as cdk from 'aws-cdk-lib';
import * as codeconnections from 'aws-cdk-lib/aws-codeconnections';
import { Construct } from 'constructs';

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
 * NOTE: Now using CodeConnections with CDK 2.233.0 which has full support.
 */
export class CodeConnectionsConstruct extends Construct {
  public readonly connection: codeconnections.CfnConnection;
  public readonly connectionArn: string;

  constructor(scope: Construct, id: string, props: CodeConnectionsConstructProps) {
    super(scope, id);

    // Create the CodeConnections connection (aws.codeconnections service)
    // Using new logical ID to create fresh connection
    this.connection = new codeconnections.CfnConnection(this, 'NewCodeConnectionsConnection', {
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
    return this.connection.connectionName || '';
  }
}
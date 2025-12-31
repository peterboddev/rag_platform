import * as cdk from 'aws-cdk-lib';
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
 * IMPORTANT: Use CodeConnections, NOT CodeStar connections.
 * - CodeConnections: aws.codeconnections (✅ USE THIS)
 * - CodeStar Connections: aws.codestar-connections (❌ DEPRECATED - DON'T USE)
 */
export class CodeConnectionsConstruct extends Construct {
  public readonly connection: cdk.CfnResource;
  public readonly connectionArn: string;

  constructor(scope: Construct, id: string, props: CodeConnectionsConstructProps) {
    super(scope, id);

    // Create the CodeConnections connection (aws.codeconnections service)
    // Using CfnResource to create AWS::CodeConnections::Connection directly
    this.connection = new cdk.CfnResource(this, 'Connection', {
      type: 'AWS::CodeConnections::Connection',
      properties: {
        ConnectionName: props.connectionName,
        ProviderType: props.providerType || 'GitHub',
        Tags: props.tags || [
          {
            Key: 'ManagedBy',
            Value: 'CDK'
          },
          {
            Key: 'Service',
            Value: 'PlatformPipeline'
          },
          {
            Key: 'ConnectionType',
            Value: 'CodeConnections'
          }
        ]
      }
    });

    // Store the connection ARN for use in pipelines
    this.connectionArn = this.connection.getAtt('ConnectionArn').toString();

    // Output the connection ARN for reference
    new cdk.CfnOutput(this, 'ConnectionArn', {
      value: this.connectionArn,
      description: 'ARN of the CodeConnections connection (aws.codeconnections service)',
      exportName: `${props.connectionName}-ConnectionArn`
    });

    // Output connection status information
    new cdk.CfnOutput(this, 'ConnectionStatus', {
      value: this.connection.getAtt('ConnectionStatus').toString(),
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
    return this.connection.getAtt('ConnectionName').toString();
  }
}
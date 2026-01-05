import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { VectorDatabaseConstruct } from './vector-database';

export interface KnowledgeBaseProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly vectorDatabase: VectorDatabaseConstruct;
  readonly embeddingModelId: string;
  readonly serviceRole?: iam.Role; // Make service role optional to allow external creation
}

export class KnowledgeBaseConstruct extends Construct {
  public readonly knowledgeBase: bedrock.CfnKnowledgeBase;
  public readonly knowledgeBaseId: string;
  public readonly serviceRole: iam.Role;

  constructor(scope: Construct, id: string, props: KnowledgeBaseProps) {
    super(scope, id);

    const knowledgeBaseName = `${props.applicationName}-kb-${props.environment}`;

    // Use provided service role or create a new one
    this.serviceRole = props.serviceRole || new iam.Role(this, 'KnowledgeBaseServiceRole', {
      roleName: `${props.applicationName}-kb-service-role-${props.environment}`,
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    // Grant permissions to access the vector database (both APIAccessAll and DashboardsAccessAll required)
    this.serviceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:APIAccessAll',
        'aoss:DashboardsAccessAll',
      ],
      resources: [props.vectorDatabase.collectionArn],
    }));

    // Grant permissions to invoke embedding model
    this.serviceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
      ],
      resources: [
        `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/${props.embeddingModelId}`,
      ],
    }));

    // Wait for collection to be active before creating Knowledge Base
    const waitForCollection = new cr.AwsCustomResource(this, 'WaitForCollection', {
      onCreate: {
        service: 'OpenSearchServerless',
        action: 'batchGetCollection',
        parameters: {
          names: [props.vectorDatabase.collection.name],
        },
        physicalResourceId: cr.PhysicalResourceId.of('wait-for-collection'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // Add dependencies
    waitForCollection.node.addDependency(props.vectorDatabase.collection);
    waitForCollection.node.addDependency(props.vectorDatabase.dataAccessPolicy);

    // Create Bedrock Knowledge Base
    this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
      name: knowledgeBaseName,
      description: `RAG application knowledge base for ${props.applicationName}`,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/${props.embeddingModelId}`,
        },
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: props.vectorDatabase.collectionArn,
          vectorIndexName: props.vectorDatabase.indexName,
          fieldMapping: {
            vectorField: 'vector',
            textField: 'text',
            metadataField: 'metadata',
          },
        },
      },
      roleArn: this.serviceRole.roleArn,
    });

    // Add explicit dependency on the vector database collection, data access policy, and wait for collection
    this.knowledgeBase.addDependency(props.vectorDatabase.collection);
    this.knowledgeBase.addDependency(props.vectorDatabase.dataAccessPolicy);
    this.knowledgeBase.node.addDependency(waitForCollection);

    this.knowledgeBaseId = this.knowledgeBase.attrKnowledgeBaseId;

    // Output Knowledge Base information
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: this.knowledgeBaseId,
      description: 'Bedrock Knowledge Base ID',
    });

    new cdk.CfnOutput(this, 'KnowledgeBaseArn', {
      value: this.knowledgeBase.attrKnowledgeBaseArn,
      description: 'Bedrock Knowledge Base ARN',
    });
  }
}
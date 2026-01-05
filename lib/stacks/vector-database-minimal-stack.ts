import * as cdk from 'aws-cdk-lib';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import { Construct } from 'constructs';

export interface VectorDatabaseMinimalStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
}

export class VectorDatabaseMinimalStack extends cdk.Stack {
  public readonly collectionArn: string;
  public readonly collectionEndpoint: string;
  public readonly indexName: string;

  constructor(scope: Construct, id: string, props: VectorDatabaseMinimalStackProps) {
    super(scope, id, props);

    const { applicationName, environment } = props;

    const collectionName = `${applicationName}-vectors-${environment}`;
    this.indexName = 'vector-index';

    // Create encryption policy for the collection (simplified like test)
    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'EncryptionPolicy', {
      name: `${collectionName}-enc`,
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${collectionName}`],
          },
        ],
        AWSOwnedKey: true,
      }),
    });

    // Create network policy for the collection (simplified like test)
    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkPolicy', {
      name: `${collectionName}-net`,
      type: 'network',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${collectionName}`],
            },
          ],
          AllowFromPublic: true,
        },
      ]),
    });

    // Create initial data access policy (simplified like test)
    const dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'DataAccessPolicy', {
      name: `${collectionName}-data`,
      type: 'data',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'index',
              Resource: [`index/${collectionName}/*`],
              Permission: ['aoss:ReadDocument', 'aoss:WriteDocument'],
            },
          ],
          Principal: [`arn:aws:iam::${this.account}:root`],
        },
      ]),
    });

    // Create the OpenSearch Serverless collection (simplified like test)
    const collection = new opensearchserverless.CfnCollection(this, 'VectorCollection', {
      name: collectionName,
      type: 'VECTORSEARCH',
      description: `Vector database for ${applicationName} RAG application`,
    });

    // Add dependencies
    collection.addDependency(encryptionPolicy);
    collection.addDependency(networkPolicy);
    collection.addDependency(dataAccessPolicy);

    this.collectionArn = collection.attrArn;
    this.collectionEndpoint = collection.attrCollectionEndpoint;

    // Stack Outputs
    new cdk.CfnOutput(this, 'VectorDatabaseEndpoint', {
      value: this.collectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint',
      exportName: `${applicationName}-${environment}-vector-db-endpoint`,
    });

    new cdk.CfnOutput(this, 'VectorDatabaseArn', {
      value: this.collectionArn,
      description: 'OpenSearch Serverless collection ARN',
      exportName: `${applicationName}-${environment}-vector-db-arn`,
    });

    new cdk.CfnOutput(this, 'VectorIndexName', {
      value: this.indexName,
      description: 'Vector index name',
      exportName: `${applicationName}-${environment}-vector-index-name`,
    });
  }
}
import * as cdk from 'aws-cdk-lib';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface VectorDatabaseProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly vpc: ec2.IVpc; // Changed from Vpc to IVpc to accept imported VPCs
  readonly accessRoles?: iam.Role[]; // Optional roles to grant access during creation
}

export class VectorDatabaseConstruct extends Construct {
  public readonly collection: opensearchserverless.CfnCollection;
  public readonly collectionArn: string;
  public readonly collectionEndpoint: string;
  public readonly indexName: string;
  public readonly dataAccessPolicy: opensearchserverless.CfnAccessPolicy;

  constructor(scope: Construct, id: string, props: VectorDatabaseProps) {
    super(scope, id);

    const collectionName = `${props.applicationName}-vectors-${props.environment}`;
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
    const initialPrincipals = [`arn:aws:iam::${cdk.Stack.of(this).account}:root`];
    if (props.accessRoles) {
      initialPrincipals.push(...props.accessRoles.map(role => role.roleArn));
    }

    this.dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'DataAccessPolicy', {
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
          Principal: initialPrincipals,
        },
      ]),
    });

    // Create the OpenSearch Serverless collection (simplified like test)
    this.collection = new opensearchserverless.CfnCollection(this, 'VectorCollection', {
      name: collectionName,
      type: 'VECTORSEARCH',
      description: `Vector database for ${props.applicationName} RAG application`,
    });

    // Add dependencies
    this.collection.addDependency(encryptionPolicy);
    this.collection.addDependency(networkPolicy);
    this.collection.addDependency(this.dataAccessPolicy);

    this.collectionArn = this.collection.attrArn;
    this.collectionEndpoint = this.collection.attrCollectionEndpoint;

    // Output collection information
    new cdk.CfnOutput(this, 'CollectionEndpoint', {
      value: this.collectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint',
    });

    new cdk.CfnOutput(this, 'CollectionArn', {
      value: this.collectionArn,
      description: 'OpenSearch Serverless collection ARN',
    });

    new cdk.CfnOutput(this, 'IndexName', {
      value: this.indexName,
      description: 'Vector index name',
    });
  }

  /**
   * Add IAM roles to the data access policy
   */
  public addAccessRoles(roles: iam.Role[]): void {
    const collectionName = this.collection.name!;
    const existingPrincipals = [`arn:aws:iam::${cdk.Stack.of(this).account}:root`];
    const newPrincipals = roles.map(role => role.roleArn);
    const allPrincipals = [...existingPrincipals, ...newPrincipals];

    // Update the data access policy with new principals (simplified like test)
    const updatedPolicy = JSON.stringify([
      {
        Rules: [
          {
            ResourceType: 'index',
            Resource: [`index/${collectionName}/*`],
            Permission: ['aoss:ReadDocument', 'aoss:WriteDocument'],
          },
        ],
        Principal: allPrincipals,
      },
    ]);

    // Update the existing policy
    this.dataAccessPolicy.addPropertyOverride('Policy', updatedPolicy);
  }
}
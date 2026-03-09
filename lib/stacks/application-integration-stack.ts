import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { BedrockAIServicesConstruct } from '../constructs/bedrock-ai-services';
import { ApplicationIntegrationConstruct } from '../constructs/application-integration';

export interface ApplicationIntegrationStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly userPoolId: string;
  readonly userPoolArn: string;
  readonly userPoolClientId: string;
  readonly identityPoolId?: string;
  readonly vectorDatabaseEndpoint: string;
  readonly vectorDatabaseArn: string;
  readonly vectorDatabaseCollectionName: string;
  readonly vectorDatabaseIndexName: string;
  readonly customersTableName: string;
  readonly customersTableArn: string;
  readonly documentsTableName: string;
  readonly documentsTableArn: string;
  readonly apiGatewayId: string;
  readonly apiGatewayRootResourceId: string;
  readonly apiGatewayUrl: string;
  readonly vpcId: string;
}

export class ApplicationIntegrationStack extends cdk.Stack {
  public readonly applicationRole: cdk.aws_iam.Role;
  public readonly configurationParameters: cdk.aws_ssm.StringParameter[];

  constructor(scope: Construct, id: string, props: ApplicationIntegrationStackProps) {
    super(scope, id, props);

    const { applicationName, environment } = props;

    // Bedrock AI Services (model IDs only, no resources created)
    const bedrockServices = new BedrockAIServicesConstruct(this, 'BedrockAIServices', {
      applicationName,
      environment,
    });

    // Import Cognito User Pool
    const userPool = cognito.UserPool.fromUserPoolArn(this, 'ImportedUserPool', props.userPoolArn);
    
    const userPoolClient = cognito.UserPoolClient.fromUserPoolClientId(
      this,
      'ImportedUserPoolClient',
      props.userPoolClientId
    );

    // Create a minimal VectorDatabaseConstruct wrapper for compatibility
    const vectorDatabase = {
      collectionEndpoint: props.vectorDatabaseEndpoint,
      collectionArn: props.vectorDatabaseArn,
      collectionName: props.vectorDatabaseCollectionName,
      indexName: props.vectorDatabaseIndexName,
      grantLambdaAccess: (lambdaRole: cdk.aws_iam.Role) => {
        // Grant IAM permissions for OpenSearch Serverless access
        lambdaRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ['aoss:APIAccessAll'],
          resources: [props.vectorDatabaseArn],
        }));
        
        lambdaRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: [
            'aoss:CreateCollectionItems',
            'aoss:DeleteCollectionItems',
            'aoss:UpdateCollectionItems',
            'aoss:DescribeCollectionItems',
            'aoss:CreateIndex',
            'aoss:DeleteIndex',
            'aoss:UpdateIndex',
            'aoss:DescribeIndex',
            'aoss:ReadDocument',
            'aoss:WriteDocument',
          ],
          resources: [props.vectorDatabaseArn, `${props.vectorDatabaseArn}/*`],
        }));
      },
    } as any;

    // Import Cognito Identity Pool if provided
    let identityPool: cognito.CfnIdentityPool | undefined;
    if (props.identityPoolId) {
      identityPool = {
        ref: props.identityPoolId,
      } as cognito.CfnIdentityPool;
    }

    // Application Integration Layer (IAM roles and SSM parameters)
    const applicationIntegration = new ApplicationIntegrationConstruct(this, 'ApplicationIntegration', {
      applicationName,
      environment,
      region: this.region,
      novaProModelId: bedrockServices.novaProModelId,
      embeddingModelId: bedrockServices.embeddingModelId,
      cognitoUserPool: userPool,
      cognitoUserPoolClient: userPoolClient,
      cognitoIdentityPool: identityPool,
      vectorDatabase,
      customersTableName: props.customersTableName,
      customersTableArn: props.customersTableArn,
      documentsTableName: props.documentsTableName,
      documentsTableArn: props.documentsTableArn,
      apiGatewayId: props.apiGatewayId,
      apiGatewayRootResourceId: props.apiGatewayRootResourceId,
      apiGatewayUrl: props.apiGatewayUrl,
      vpcId: props.vpcId,
    });

    this.applicationRole = applicationIntegration.applicationRole;
    this.configurationParameters = applicationIntegration.configurationParameters;

    // Stack Outputs
    new cdk.CfnOutput(this, 'ApplicationRoleArn', {
      value: this.applicationRole.roleArn,
      description: 'IAM role ARN for application Lambda functions',
      exportName: `${applicationName}-${environment}-application-role-arn`,
    });

    new cdk.CfnOutput(this, 'ApplicationRoleName', {
      value: this.applicationRole.roleName,
      description: 'IAM role name for application Lambda functions',
      exportName: `${applicationName}-${environment}-application-role-name`,
    });

    new cdk.CfnOutput(this, 'BedrockNovaProModelId', {
      value: bedrockServices.novaProModelId,
      description: 'Bedrock Nova Pro model ID',
      exportName: `${applicationName}-${environment}-bedrock-nova-pro-model-id`,
    });
  }
}

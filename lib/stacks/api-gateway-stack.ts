import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { ApiGatewayConstruct } from '../constructs/api-gateway';

export interface ApiGatewayStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly api: cdk.aws_apigateway.RestApi;
  public readonly apiId: string;
  public readonly apiUrl: string;
  public readonly rootResourceId: string;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const { applicationName, environment, userPoolId, userPoolClientId } = props;

    // Import Cognito User Pool from Authentication Stack
    const userPool = cognito.UserPool.fromUserPoolId(this, 'ImportedUserPool', userPoolId);
    
    const userPoolClient = cognito.UserPoolClient.fromUserPoolClientId(
      this,
      'ImportedUserPoolClient',
      userPoolClientId
    );

    // API Gateway (Platform-provided for application teams)
    const apiGateway = new ApiGatewayConstruct(this, 'ApiGateway', {
      applicationName,
      environment,
      userPool,
      userPoolClient,
    });

    this.api = apiGateway.api;
    this.apiId = apiGateway.api.restApiId;
    this.apiUrl = apiGateway.api.url;
    this.rootResourceId = apiGateway.api.root.resourceId;

    // Stack Outputs
    new cdk.CfnOutput(this, 'ApiGatewayId', {
      value: this.apiId,
      description: 'API Gateway REST API ID',
      exportName: `${applicationName}-${environment}-api-gateway-id`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.apiUrl,
      description: 'API Gateway endpoint URL',
      exportName: `${applicationName}-${environment}-api-gateway-url`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayRootResourceId', {
      value: this.rootResourceId,
      description: 'API Gateway root resource ID',
      exportName: `${applicationName}-${environment}-api-gateway-root-resource-id`,
    });
  }
}

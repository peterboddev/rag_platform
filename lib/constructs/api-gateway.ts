import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiGatewayConstructProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly userPool: cognito.IUserPool;
  readonly userPoolClient: cognito.IUserPoolClient;
}

/**
 * Platform-provided API Gateway for RAG applications
 * 
 * This construct creates a REST API Gateway that application teams can use
 * to add their Lambda function integrations. The API Gateway includes:
 * - Cognito authorizer for authentication
 * - CORS configuration
 * - CloudWatch logging
 * - Standard stages (dev, staging, prod)
 */
export class ApiGatewayConstruct extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    // Create CloudWatch log group for API Gateway
    this.logGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/aws/apigateway/${props.applicationName}-${props.environment}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create REST API Gateway
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `${props.applicationName}-api-${props.environment}`,
      description: `RAG Application API for ${props.environment} environment`,
      deployOptions: {
        stageName: props.environment,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(this.logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
    });

    // Create Cognito authorizer
    this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: `${props.applicationName}-authorizer-${props.environment}`,
      identitySource: 'method.request.header.Authorization',
    });

    // Create a health check endpoint to attach the authorizer
    // This ensures the authorizer is properly configured and can be used by app teams
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseTemplates: {
          'application/json': JSON.stringify({ status: 'healthy', timestamp: '$context.requestTime' })
        }
      }],
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [{ statusCode: '200' }],
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Export API Gateway ID and endpoint for application teams
    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway REST API ID',
      exportName: `${props.applicationName}-${props.environment}-api-id`,
    });

    new cdk.CfnOutput(this, 'ApiRootResourceId', {
      value: this.api.root.resourceId,
      description: 'API Gateway root resource ID',
      exportName: `${props.applicationName}-${props.environment}-api-root-id`,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway endpoint URL',
      exportName: `${props.applicationName}-${props.environment}-api-url`,
    });
  }

  /**
   * Get the API Gateway for application teams to add resources and methods
   */
  public getApi(): apigateway.RestApi {
    return this.api;
  }

  /**
   * Get the Cognito authorizer for securing endpoints
   */
  public getAuthorizer(): apigateway.CognitoUserPoolsAuthorizer {
    return this.authorizer;
  }
}

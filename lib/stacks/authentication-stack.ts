import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CognitoAuthenticationConstruct } from '../constructs/cognito-authentication';

export interface AuthenticationStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
}

export class AuthenticationStack extends cdk.Stack {
  public readonly authentication: CognitoAuthenticationConstruct;

  constructor(scope: Construct, id: string, props: AuthenticationStackProps) {
    super(scope, id, props);

    const { applicationName, environment } = props;

    // Create Cognito authentication
    this.authentication = new CognitoAuthenticationConstruct(this, 'Authentication', {
      applicationName,
      environment,
      callbackUrls: ['http://localhost:3000/callback', 'https://localhost:3000/callback'],
      logoutUrls: ['http://localhost:3000/', 'https://localhost:3000/'],
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.authentication.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${applicationName}-${environment}-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.authentication.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${applicationName}-${environment}-user-pool-client-id`,
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.authentication.identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: `${applicationName}-${environment}-identity-pool-id`,
    });
  }
}
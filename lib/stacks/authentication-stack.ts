import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CognitoAuthenticationConstruct } from '../constructs/cognito-authentication';

export interface AuthenticationStackProps extends cdk.StackProps {
  readonly applicationName: string;
  readonly environment: string;
  readonly websiteBucketName: string;
}

export class AuthenticationStack extends cdk.Stack {
  public readonly userPool: cdk.aws_cognito.UserPool;
  public readonly userPoolClient: cdk.aws_cognito.UserPoolClient;
  public readonly identityPool?: cdk.aws_cognito.CfnIdentityPool;

  constructor(scope: Construct, id: string, props: AuthenticationStackProps) {
    super(scope, id, props);

    const { applicationName, environment, websiteBucketName } = props;

    // Cognito Authentication
    const cognitoAuth = new CognitoAuthenticationConstruct(this, 'CognitoAuthentication', {
      applicationName,
      environment,
      callbackUrls: [`https://${websiteBucketName}.s3-website-${this.region}.amazonaws.com`],
      logoutUrls: [`https://${websiteBucketName}.s3-website-${this.region}.amazonaws.com`],
    });

    this.userPool = cognitoAuth.userPool;
    this.userPoolClient = cognitoAuth.userPoolClient;
    this.identityPool = cognitoAuth.identityPool;

    // Stack Outputs
    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${applicationName}-${environment}-cognito-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${applicationName}-${environment}-cognito-user-pool-arn`,
    });

    new cdk.CfnOutput(this, 'CognitoClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${applicationName}-${environment}-cognito-client-id`,
    });

    if (this.identityPool) {
      new cdk.CfnOutput(this, 'CognitoIdentityPoolId', {
        value: this.identityPool.ref,
        description: 'Cognito Identity Pool ID',
        exportName: `${applicationName}-${environment}-cognito-identity-pool-id`,
      });
    }
  }
}

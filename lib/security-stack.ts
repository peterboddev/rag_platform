import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface SecurityStackProps extends cdk.StackProps {
  readonly crossAccountRoleArns?: string[];
  readonly applicationAccounts?: string[];
}

export class SecurityStack extends cdk.Stack {
  public readonly platformPipelineRole: iam.Role;
  public readonly applicationPipelineRole: iam.Role;
  public readonly codeBuildServiceRole: iam.Role;
  public readonly crossAccountDeploymentRole: iam.Role;

  constructor(scope: Construct, id: string, props: SecurityStackProps = {}) {
    super(scope, id, props);

    // Platform Pipeline Execution Role - least privilege for platform pipeline operations
    this.platformPipelineRole = new iam.Role(this, 'PlatformPipelineRole', {
      roleName: 'PlatformPipelineExecutionRole',
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      description: 'IAM role for platform pipeline execution with least-privilege access',
      inlinePolicies: {
        PlatformPipelinePolicy: new iam.PolicyDocument({
          statements: [
            // CodePipeline service permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'codepipeline:GetPipeline',
                'codepipeline:GetPipelineExecution',
                'codepipeline:GetPipelineState',
                'codepipeline:ListPipelineExecutions',
                'codepipeline:StartPipelineExecution',
                'codepipeline:StopPipelineExecution',
                'codepipeline:RetryStageExecution',
                'codepipeline:PutActionRevision',
                'codepipeline:PutApprovalResult',
                'codepipeline:PutJobFailureResult',
                'codepipeline:PutJobSuccessResult',
                'codepipeline:PutThirdPartyJobFailureResult',
                'codepipeline:PutThirdPartyJobSuccessResult',
              ],
              resources: [
                `arn:aws:codepipeline:${this.region}:${this.account}:pipeline/PlatformPipeline*`,
              ],
            }),
            // CodeConnections permissions for GitHub integration
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'codeconnections:UseConnection',
              ],
              resources: [
                `arn:aws:codeconnections:${this.region}:${this.account}:connection/*`,
              ],
            }),
            // S3 permissions for pipeline artifacts
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetBucketVersioning',
                's3:GetObject',
                's3:GetObjectVersion',
                's3:PutObject',
                's3:PutObjectAcl',
              ],
              resources: [
                `arn:aws:s3:::cdk-*-assets-${this.account}-${this.region}`,
                `arn:aws:s3:::cdk-*-assets-${this.account}-${this.region}/*`,
              ],
            }),
            // CodeBuild permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'codebuild:BatchGetBuilds',
                'codebuild:StartBuild',
              ],
              resources: [
                `arn:aws:codebuild:${this.region}:${this.account}:project/PlatformPipeline*`,
              ],
            }),
            // CloudWatch permissions for monitoring and logging
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams',
                'cloudwatch:PutMetricData',
                'cloudwatch:GetMetricStatistics',
                'cloudwatch:ListMetrics',
                'events:PutEvents',
              ],
              resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/platform-pipeline/*`,
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/codebuild/*`,
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/codepipeline/*`,
                '*', // CloudWatch metrics require wildcard
              ],
            }),
            // CloudFormation permissions for CDK deployments
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudformation:CreateStack',
                'cloudformation:UpdateStack',
                'cloudformation:DeleteStack',
                'cloudformation:DescribeStacks',
                'cloudformation:DescribeStackEvents',
                'cloudformation:DescribeStackResources',
                'cloudformation:GetTemplate',
              ],
              resources: [
                `arn:aws:cloudformation:${this.region}:${this.account}:stack/CDKToolkit/*`,
                `arn:aws:cloudformation:${this.region}:${this.account}:stack/*PlatformPipeline*`,
                `arn:aws:cloudformation:${this.region}:${this.account}:stack/*ApplicationPipeline*`,
              ],
            }),
          ],
        }),
      },
    });

    // Application Pipeline Role - for individual application pipelines
    this.applicationPipelineRole = new iam.Role(this, 'ApplicationPipelineRole', {
      roleName: 'ApplicationPipelineExecutionRole',
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      description: 'IAM role for application pipeline execution',
      inlinePolicies: {
        ApplicationPipelinePolicy: new iam.PolicyDocument({
          statements: [
            // CodePipeline service permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'codepipeline:GetPipeline',
                'codepipeline:GetPipelineExecution',
                'codepipeline:GetPipelineState',
                'codepipeline:ListPipelineExecutions',
                'codepipeline:StartPipelineExecution',
                'codepipeline:StopPipelineExecution',
                'codepipeline:RetryStageExecution',
                'codepipeline:PutActionRevision',
                'codepipeline:PutApprovalResult',
                'codepipeline:PutJobFailureResult',
                'codepipeline:PutJobSuccessResult',
                'codepipeline:PutThirdPartyJobFailureResult',
                'codepipeline:PutThirdPartyJobSuccessResult',
              ],
              resources: [
                `arn:aws:codepipeline:${this.region}:${this.account}:pipeline/ApplicationPipeline*`,
              ],
            }),
            // CodeConnections permissions for GitHub integration
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'codeconnections:UseConnection',
              ],
              resources: [
                `arn:aws:codeconnections:${this.region}:${this.account}:connection/*`,
              ],
            }),
            // S3 permissions for application artifacts
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetBucketVersioning',
                's3:GetObject',
                's3:GetObjectVersion',
                's3:PutObject',
              ],
              resources: [
                `arn:aws:s3:::cdk-*-assets-${this.account}-${this.region}`,
                `arn:aws:s3:::cdk-*-assets-${this.account}-${this.region}/*`,
              ],
            }),
            // CodeBuild permissions for application builds
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'codebuild:BatchGetBuilds',
                'codebuild:StartBuild',
              ],
              resources: [
                `arn:aws:codebuild:${this.region}:${this.account}:project/ApplicationPipeline*`,
              ],
            }),
          ],
        }),
      },
    });

    // CodeBuild Service Role - for both platform and application builds
    this.codeBuildServiceRole = new iam.Role(this, 'CodeBuildServiceRole', {
      roleName: 'PlatformCodeBuildServiceRole',
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description: 'IAM role for CodeBuild projects with CDK deployment permissions',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
      ],
      inlinePolicies: {
        CodeBuildPolicy: new iam.PolicyDocument({
          statements: [
            // Enhanced CloudWatch and EventBridge permissions for monitoring
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams',
                'logs:PutMetricFilter',
                'logs:DeleteMetricFilter',
                'cloudwatch:PutMetricData',
                'cloudwatch:GetMetricStatistics',
                'cloudwatch:ListMetrics',
                'cloudwatch:PutDashboard',
                'cloudwatch:GetDashboard',
                'cloudwatch:DeleteDashboard',
                'events:PutRule',
                'events:DeleteRule',
                'events:PutTargets',
                'events:RemoveTargets',
                'events:DescribeRule',
                'events:ListTargetsByRule',
              ],
              resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/codebuild/*`,
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/platform-pipeline/*`,
                `arn:aws:events:${this.region}:${this.account}:rule/*`,
                '*', // CloudWatch metrics and dashboards require wildcard
              ],
            }),
            // S3 permissions for build artifacts and CDK assets
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetBucketVersioning',
                's3:GetObject',
                's3:GetObjectVersion',
                's3:PutObject',
                's3:ListBucket',
              ],
              resources: [
                `arn:aws:s3:::cdk-*-assets-${this.account}-${this.region}`,
                `arn:aws:s3:::cdk-*-assets-${this.account}-${this.region}/*`,
              ],
            }),
            // CDK deployment permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudformation:*',
                'iam:*',
                'codepipeline:*',
                'codebuild:*',
                'codeconnections:*',
                'sns:*',
                'events:*',
              ],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'aws:RequestedRegion': this.region,
                },
              },
            }),
            // Enhanced SSM Parameter Store access for configuration
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParametersByPath',
              ],
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/platform-pipeline/*`,
              ],
            }),
            // KMS access for encrypted secrets and parameters
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'kms:Decrypt',
                'kms:DescribeKey',
              ],
              resources: [
                `arn:aws:kms:${this.region}:${this.account}:key/*`,
              ],
              conditions: {
                StringEquals: {
                  'kms:ViaService': [
                    `ssm.${this.region}.amazonaws.com`,
                  ],
                },
              },
            }),
          ],
        }),
      },
    });

    // Cross-Account Deployment Role - for deploying to other AWS accounts
    this.crossAccountDeploymentRole = new iam.Role(this, 'CrossAccountDeploymentRole', {
      roleName: 'PlatformCrossAccountDeploymentRole',
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('codepipeline.amazonaws.com'),
        new iam.ServicePrincipal('codebuild.amazonaws.com'),
        // Allow platform pipeline role to assume this role
        new iam.ArnPrincipal(this.platformPipelineRole.roleArn),
        new iam.ArnPrincipal(this.codeBuildServiceRole.roleArn),
      ),
      description: 'IAM role for cross-account deployments from platform pipeline',
      inlinePolicies: {
        CrossAccountDeploymentPolicy: new iam.PolicyDocument({
          statements: [
            // STS permissions for cross-account role assumption (only if cross-account roles are specified)
            ...(props.crossAccountRoleArns && props.crossAccountRoleArns.length > 0 ? [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'sts:AssumeRole',
                ],
                resources: props.crossAccountRoleArns,
              })
            ] : []),
            // CloudFormation permissions for cross-account deployments
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudformation:CreateStack',
                'cloudformation:UpdateStack',
                'cloudformation:DeleteStack',
                'cloudformation:DescribeStacks',
                'cloudformation:DescribeStackEvents',
                'cloudformation:DescribeStackResources',
                'cloudformation:GetTemplate',
              ],
              resources: [
                `arn:aws:cloudformation:*:*:stack/*ApplicationPipeline*`,
                `arn:aws:cloudformation:*:*:stack/CDKToolkit/*`,
              ],
            }),
          ],
        }),
      },
    });

    // Output role ARNs for use by other stacks
    new cdk.CfnOutput(this, 'PlatformPipelineRoleArn', {
      value: this.platformPipelineRole.roleArn,
      description: 'ARN of the platform pipeline execution role',
      exportName: 'PlatformPipelineRoleArn',
    });

    new cdk.CfnOutput(this, 'ApplicationPipelineRoleArn', {
      value: this.applicationPipelineRole.roleArn,
      description: 'ARN of the application pipeline execution role',
      exportName: 'ApplicationPipelineRoleArn',
    });

    new cdk.CfnOutput(this, 'CodeBuildServiceRoleArn', {
      value: this.codeBuildServiceRole.roleArn,
      description: 'ARN of the CodeBuild service role',
      exportName: 'CodeBuildServiceRoleArn',
    });

    new cdk.CfnOutput(this, 'CrossAccountDeploymentRoleArn', {
      value: this.crossAccountDeploymentRole.roleArn,
      description: 'ARN of the cross-account deployment role',
      exportName: 'CrossAccountDeploymentRoleArn',
    });

    // Tags for all resources in this stack
    cdk.Tags.of(this).add('Component', 'PlatformPipeline');
    cdk.Tags.of(this).add('ManagedBy', 'PlatformTeam');
    cdk.Tags.of(this).add('Purpose', 'Security');
  }
}
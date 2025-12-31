import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { MonitoringConstruct } from './monitoring-construct';
import { CodeConnectionsConstruct } from './codeconnections-construct';

/**
 * Configuration for source repository
 */
export interface SourceRepositoryConfig {
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
  // connectionArn will be created by the construct for each repository
}

/**
 * Configuration for build specification
 */
export interface BuildConfig {
  readonly runtime?: string;
  readonly commands?: string[];
  readonly environment?: { [key: string]: string };
  readonly buildSpec?: codebuild.BuildSpec;
  readonly computeType?: codebuild.ComputeType;
  readonly buildImage?: codebuild.IBuildImage;
}

/**
 * Configuration for deployment target
 */
export interface DeploymentTarget {
  readonly name: string;
  readonly account: string;
  readonly region: string;
  readonly stackName: string;
  readonly parameters?: { [key: string]: string };
  readonly requiresApproval?: boolean;
}

/**
 * Configuration for notifications
 */
export interface NotificationConfig {
  readonly snsTopicArn?: string;
  readonly emailAddresses?: string[];
  readonly slackWebhookUrl?: string;
}

/**
 * Configuration for the ApplicationPipelineConstruct
 */
export interface ApplicationPipelineConfig {
  readonly applicationName: string;
  readonly sourceRepo: SourceRepositoryConfig;
  readonly buildConfig?: BuildConfig;
  readonly deploymentTargets: DeploymentTarget[];
  readonly notifications?: NotificationConfig;
  readonly artifactBucket?: s3.IBucket;
  readonly pipelineRole?: iam.IRole;
  readonly codeBuildRole?: iam.IRole;
}

/**
 * Properties for the ApplicationPipelineConstruct
 */
export interface ApplicationPipelineConstructProps {
  readonly config: ApplicationPipelineConfig;
}

/**
 * Reusable construct for creating standardized application pipelines
 * 
 * This construct creates a CodePipeline with standardized stages:
 * - Source: GitHub integration via CodeConnections
 * - Build: CodeBuild project with configurable build specifications
 * - Deploy: Multiple deployment stages with optional manual approvals
 * 
 * The construct enforces platform standards while allowing parameterization
 * for application-specific requirements.
 */
export class ApplicationPipelineConstruct extends Construct {
  public readonly pipeline: codepipeline.Pipeline;
  public readonly buildProject: codebuild.Project;
  public readonly artifactBucket: s3.IBucket;
  public readonly monitoring: MonitoringConstruct;
  public readonly codeConnection: CodeConnectionsConstruct;

  constructor(scope: Construct, id: string, props: ApplicationPipelineConstructProps) {
    super(scope, id);

    const { config } = props;

    // Validate configuration
    this.validateConfiguration(config);

    // Create CodeConnection for this application's repository
    this.codeConnection = new CodeConnectionsConstruct(this, 'CodeConnection', {
      connectionName: `${config.applicationName}-github`,
      providerType: 'GitHub',
      tags: [
        {
          key: 'ManagedBy',
          value: 'CDK'
        },
        {
          key: 'Application',
          value: config.applicationName
        },
        {
          key: 'Repository',
          value: `${config.sourceRepo.owner}/${config.sourceRepo.repo}`
        }
      ]
    });

    // Create or use existing artifact bucket
    this.artifactBucket = config.artifactBucket || this.createArtifactBucket(config.applicationName);

    // Create CodeBuild project for the application
    this.buildProject = this.createBuildProject(config);

    // Create the CodePipeline
    this.pipeline = this.createPipeline(config);

    // Create monitoring for the application pipeline
    this.monitoring = new MonitoringConstruct(this, 'ApplicationMonitoring', {
      config: {
        pipelineName: config.applicationName,
        logRetentionDays: logs.RetentionDays.TWO_WEEKS,
        enableDetailedMetrics: true,
        enableAuditLogging: false, // Application pipelines don't need audit logging
        metricNamespace: `ApplicationPipeline/${config.applicationName}`,
      },
      pipeline: this.pipeline,
      buildProject: this.buildProject,
    });

    // Create metric filters for application pipeline monitoring
    this.monitoring.createExecutionTimeMetricFilter();
    this.monitoring.createSuccessRateMetricFilter();

    // Add tags for resource management
    cdk.Tags.of(this).add('Application', config.applicationName);
    cdk.Tags.of(this).add('ManagedBy', 'PlatformPipeline');
    cdk.Tags.of(this).add('PipelineType', 'Application');
  }

  /**
   * Validates the application pipeline configuration
   */
  private validateConfiguration(config: ApplicationPipelineConfig): void {
    if (!config.applicationName || config.applicationName.trim() === '') {
      throw new Error('Application name is required and cannot be empty');
    }

    if (!config.sourceRepo.owner || !config.sourceRepo.repo) {
      throw new Error('Source repository owner and repo are required');
    }

    // connectionArn will be created by this construct, no need to validate

    if (!config.deploymentTargets || config.deploymentTargets.length === 0) {
      throw new Error('At least one deployment target is required');
    }

    // Validate deployment targets
    config.deploymentTargets.forEach((target, index) => {
      if (!target.name || !target.account || !target.region || !target.stackName) {
        throw new Error(`Deployment target at index ${index} is missing required fields (name, account, region, stackName)`);
      }
    });
  }

  /**
   * Creates an S3 bucket for pipeline artifacts
   */
  private createArtifactBucket(applicationName: string): s3.Bucket {
    return new s3.Bucket(this, 'ArtifactBucket', {
      bucketName: `${applicationName}-pipeline-artifacts-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: 'DeleteOldArtifacts',
          enabled: true,
          expiration: cdk.Duration.days(30),
          noncurrentVersionExpiration: cdk.Duration.days(7),
        },
      ],
    });
  }

  /**
   * Creates the CodeBuild project for the application
   */
  private createBuildProject(config: ApplicationPipelineConfig): codebuild.Project {
    const buildConfig = config.buildConfig || {};
    
    // Default build commands if not specified
    const defaultCommands = [
      'echo "Build started on `date`"',
      'echo "Installing dependencies..."',
      'npm ci',
      'echo "Running tests..."',
      'npm run test',
      'echo "Building application..."',
      'npm run build',
      'echo "Build completed on `date`"',
    ];

    // Default build specification
    const buildSpec = buildConfig.buildSpec || codebuild.BuildSpec.fromObject({
      version: '0.2',
      phases: {
        install: {
          'runtime-versions': {
            nodejs: buildConfig.runtime || '20',
          },
        },
        pre_build: {
          commands: [
            'echo "Pre-build phase started on `date`"',
            'echo "Node.js version: $(node --version)"',
            'echo "NPM version: $(npm --version)"',
          ],
        },
        build: {
          commands: buildConfig.commands || defaultCommands,
        },
        post_build: {
          commands: [
            'echo "Post-build phase completed on `date`"',
          ],
        },
      },
      artifacts: {
        files: [
          '**/*',
        ],
        'exclude-paths': [
          'node_modules/**/*',
          '.git/**/*',
        ],
      },
      cache: {
        paths: [
          'node_modules/**/*',
        ],
      },
    });

    return new codebuild.Project(this, 'BuildProject', {
      projectName: `${config.applicationName}-build`,
      description: `Build project for ${config.applicationName} application`,
      
      source: codebuild.Source.gitHub({
        owner: config.sourceRepo.owner,
        repo: config.sourceRepo.repo,
        webhook: false, // Pipeline will trigger builds, not webhooks
      }),
      
      buildSpec: buildSpec,
      
      environment: {
        buildImage: buildConfig.buildImage || codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
        computeType: buildConfig.computeType || codebuild.ComputeType.SMALL,
        environmentVariables: {
          'APPLICATION_NAME': {
            value: config.applicationName,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
          'AWS_DEFAULT_REGION': {
            value: cdk.Aws.REGION,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
          'AWS_ACCOUNT_ID': {
            value: cdk.Aws.ACCOUNT_ID,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
          // Add custom environment variables
          ...Object.entries(buildConfig.environment || {}).reduce((acc, [key, value]) => {
            acc[key] = {
              value: value,
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            };
            return acc;
          }, {} as { [key: string]: codebuild.BuildEnvironmentVariable }),
        },
      },
      
      cache: codebuild.Cache.local(
        codebuild.LocalCacheMode.SOURCE,
        codebuild.LocalCacheMode.DOCKER_LAYER,
        codebuild.LocalCacheMode.CUSTOM
      ),
      
      // Enhanced logging configuration for CloudWatch integration
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'BuildLogGroup', {
            logGroupName: `/aws/codebuild/${config.applicationName}-build`,
            retention: logs.RetentionDays.TWO_WEEKS,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
        },
      },
      
      role: config.codeBuildRole,
      
      timeout: cdk.Duration.minutes(30),
    });
  }

  /**
   * Creates the CodePipeline with standardized stages
   */
  private createPipeline(config: ApplicationPipelineConfig): codepipeline.Pipeline {
    // Create source and build artifacts
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // Create the pipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: `${config.applicationName}-pipeline`,
      pipelineType: codepipeline.PipelineType.V2, // Use V2 for CodeConnections source revisions
      artifactBucket: this.artifactBucket,
      role: config.pipelineRole,
      restartExecutionOnUpdate: true,
    });

    // Source Stage - GitHub integration
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeStarConnectionsSourceAction({
          actionName: 'GitHub_Source',
          owner: config.sourceRepo.owner,
          repo: config.sourceRepo.repo,
          branch: config.sourceRepo.branch,
          connectionArn: this.codeConnection.getConnectionArn(), // Uses CodeConnections ARN (arn:aws:codeconnections:...)
          output: sourceOutput,
        }),
      ],
    });

    // Build Stage - CodeBuild
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build',
          project: this.buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    // Deployment Stages - Multiple environments
    config.deploymentTargets.forEach((target, index) => {
      const stageActions: codepipeline.IAction[] = [];

      // Add manual approval if required
      if (target.requiresApproval) {
        stageActions.push(
          new codepipeline_actions.ManualApprovalAction({
            actionName: `Approve_${target.name}`,
            additionalInformation: `Please review and approve deployment to ${target.name} environment`,
          })
        );
      }

      // Add CloudFormation deployment action
      stageActions.push(
        new codepipeline_actions.CloudFormationCreateUpdateStackAction({
          actionName: `Deploy_${target.name}`,
          stackName: target.stackName,
          templatePath: buildOutput.atPath('template.yaml'),
          adminPermissions: true,
          parameterOverrides: target.parameters || {},
          region: target.region,
          account: target.account,
        })
      );

      pipeline.addStage({
        stageName: `Deploy_${target.name}`,
        actions: stageActions,
      });
    });

    return pipeline;
  }

  /**
   * Adds a notification rule to the pipeline
   */
  public addNotificationRule(config: NotificationConfig): void {
    if (config.snsTopicArn) {
      // Add SNS notification rule
      // Implementation would depend on specific notification requirements
      // This is a placeholder for future notification implementation
    }
  }

  /**
   * Gets the pipeline ARN
   */
  public getPipelineArn(): string {
    return this.pipeline.pipelineArn;
  }

  /**
   * Gets the build project ARN
   */
  public getBuildProjectArn(): string {
    return this.buildProject.projectArn;
  }
}
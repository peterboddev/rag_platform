import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipeline, CodePipelineSource, CodeBuildStep } from 'aws-cdk-lib/pipelines';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { ConfigurationManager } from './config/platform-config';
import { ApplicationPipelineStage } from './constructs/application-pipeline-stage';
import { SecurityStack } from './security-stack';
import { MonitoringConstruct } from './constructs/monitoring-construct';
import { CodeBuildCredentialsManager } from './config/codebuild-credentials';
import { CodeConnectionsConstruct } from './constructs/codeconnections-construct';

export interface PlatformPipelineStackProps extends cdk.StackProps {
  readonly githubOrg?: string;
  readonly githubRepo?: string;
  readonly branch?: string;
  readonly connectionArn?: string;
  readonly securityStack?: SecurityStack;
}

export class PlatformPipelineStack extends cdk.Stack {
  public readonly pipeline: CodePipeline;
  public readonly configurationManager: ConfigurationManager;
  public readonly applicationPipelineStage: ApplicationPipelineStage;
  public readonly monitoring: MonitoringConstruct;
  public readonly credentialsManager: CodeBuildCredentialsManager;
  public readonly codeConnection: CodeConnectionsConstruct;

  constructor(scope: Construct, id: string, props?: PlatformPipelineStackProps) {
    super(scope, id, props);

    // Initialize configuration manager
    this.configurationManager = new ConfigurationManager(this);

    // Create CodeConnections connection (aws.codeconnections service with CDK 2.233.0)
    // This will create a fresh CodeConnections connection with a new logical ID
    this.codeConnection = new CodeConnectionsConstruct(this, 'CodeConnection', {
      connectionName: 'platform-pipeline-github',
      providerType: 'GitHub',
      tags: [
        {
          key: 'ManagedBy',
          value: 'CDK'
        },
        {
          key: 'Service',
          value: 'PlatformPipeline'
        }
      ]
    });

    // Initialize secure credential management for CodeBuild
    // Note: Credential rotation is disabled for initial deployment to avoid conflicts
    this.credentialsManager = new CodeBuildCredentialsManager(this, 'CredentialsManager', {
      githubTokenSecretName: 'platform-pipeline/github-token',
      connectionArn: this.codeConnection.getConnectionArn(),
      enableCredentialRotation: false, // Disabled to avoid rotation schedule conflicts
      credentialValidationEnabled: true,
      secretsPrefix: 'platform-pipeline',
    });

    // Get configuration from CDK context or props with defaults
    const platformRepo = this.node.tryGetContext('platformRepository');
    const githubOrg = props?.githubOrg || platformRepo?.owner || 'platform-team';
    const githubRepo = props?.githubRepo || platformRepo?.repo || 'platform-pipeline';
    const branch = props?.branch || platformRepo?.branch || 'main';
    
    // Use CDK-created connection ARN (always available) or fallback to props
    const connectionArn = this.codeConnection.getConnectionArn();

    // Validate required configuration
    if (!connectionArn) {
      throw new Error('CodeConnections connection ARN is required. Connection should be created by CodeConnectionsConstruct.');
    }

    // Create the self-mutating pipeline with enhanced CodeBuild configuration and proper triggers
    this.pipeline = new CodePipeline(this, 'PlatformPipeline', {
      pipelineName: 'PlatformPipeline',
      pipelineType: codepipeline.PipelineType.V2, // Use V2 for CodeConnections source revisions
      selfMutation: true,
      crossAccountKeys: true,
      
      // Configure the source stage with GitHub integration and push triggers
      synth: new CodeBuildStep('Synth', {
        input: CodePipelineSource.connection(
          `${githubOrg}/${githubRepo}`,
          branch,
          {
            connectionArn: connectionArn,
            // Ensure pipeline triggers on push events (default is true, but being explicit)
            triggerOnPush: true,
          }
        ),
        
        // Commands for TypeScript compilation and CDK synthesis
        commands: [
          // Check environment and working directory
          'echo "Checking environment and working directory..."',
          'pwd',
          'ls -la',
          'echo "Node.js version:"',
          'node --version',
          'echo "npm version:"',
          'npm --version',
          'echo "Checking if package.json exists..."',
          'test -f package.json && echo "✅ package.json found" || echo "❌ package.json not found"',
          
          // Install dependencies (now includes TypeScript and @types/node)
          'echo "Installing dependencies..."',
          'npm install',
          
          // Debug: Check what was installed
          'echo "Checking node_modules structure..."',
          'ls -la node_modules/.bin/ | head -10',
          'echo "Checking if TypeScript is installed..."',
          'npm list typescript || echo "TypeScript not found in dependencies"',
          'echo "Checking if @types/node is installed..."',
          'npm list @types/node || echo "@types/node not found in dependencies"',
          
          // TypeScript compilation using npm script
          'echo "Compiling TypeScript..."',
          'npm run build',
          
          // Run tests to ensure code quality
          'echo "Running tests..."',
          'npm run test',
          
          // CDK synthesis to generate CloudFormation templates
          'echo "Synthesizing CDK templates..."',
          'npx cdk synth'
        ],
        
        // Primary output directory for CDK synthesis
        primaryOutputDirectory: 'cdk.out',
        
        // Partial buildspec to specify runtime version
        partialBuildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              'runtime-versions': {
                nodejs: '20',
              },
            },
          },
        }),
        
        // Enhanced CodeBuild configuration with ARM-based Amazon Linux 2 for Node.js 20
        buildEnvironment: {
          // Use ARM-based Amazon Linux 2 Standard 3.0 with Node.js 20 by default
          buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
          computeType: codebuild.ComputeType.SMALL,
          
          // Environment variables including secure credential access
          environmentVariables: {
            'NODE_ENV': {
              value: 'production',
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            },
            'CDK_DEFAULT_REGION': {
              value: cdk.Aws.REGION,
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            },
            'CDK_DEFAULT_ACCOUNT': {
              value: cdk.Aws.ACCOUNT_ID,
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            },
            // Add secure credential environment variables
            ...this.credentialsManager.createCodeBuildEnvironmentVariables(),
          },
        },
        
        // Configure caching for faster builds
        cache: codebuild.Cache.local(
          codebuild.LocalCacheMode.SOURCE,
          codebuild.LocalCacheMode.DOCKER_LAYER,
          codebuild.LocalCacheMode.CUSTOM
        ),
        
        // Enhanced logging configuration for CloudWatch integration
        logging: {
          cloudWatch: {
            logGroup: new logs.LogGroup(this, 'PipelineBuildLogGroup', {
              logGroupName: `/aws/codebuild/PlatformPipeline-Synth`,
              retention: logs.RetentionDays.ONE_MONTH,
              removalPolicy: cdk.RemovalPolicy.DESTROY,
            }),
          },
        },
        
        // Enhanced IAM permissions for CDK operations and secure credential access
        rolePolicyStatements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'sts:AssumeRole',
              'cloudformation:*',
              's3:*',
              'iam:*',
              'codepipeline:*',
              'codebuild:*',
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
              'cloudwatch:PutMetricData',
            ],
            resources: ['*'],
          }),
          // Add credential access policy statements
          ...this.credentialsManager.createCredentialAccessPolicyStatements(),
        ],
      }),
      
      // Enable Docker for potential future use with containerized builds
      dockerEnabledForSynth: true,
      
      // Use new-style synthesis for better performance
      useChangeSets: true,
    });

    // Add tags for resource management and cost tracking
    cdk.Tags.of(this).add('Project', 'PlatformPipeline');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('Environment', 'Platform');

    // Create the application pipeline deployment stage
    this.applicationPipelineStage = new ApplicationPipelineStage(this, 'ApplicationPipelines', {
      configurationManager: this.configurationManager,
      securityStack: props?.securityStack,
      // connectionArn will be imported from CloudFormation export
      env: props?.env, // Pass through environment settings
    });

    // Add the application pipeline stage to the platform pipeline with proper environment promotion
    const applicationStage = this.pipeline.addStage(this.applicationPipelineStage, {
      // Configure stage-level settings for application pipeline deployment
      pre: [
        // Add pre-deployment validation step
        new CodeBuildStep('ValidateApplicationConfigs', {
          commands: [
            'echo "Validating application configurations..."',
            'npm install',
            'npx ts-node scripts/validate-configs.ts',
            'echo "Configuration validation completed"',
          ],
          buildEnvironment: {
            buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
            computeType: codebuild.ComputeType.SMALL,
          },
        }),
      ],
    });

    // Configure environment promotion stages if multiple environments are configured
    const environments = this.configurationManager.getEnvironments();
    const environmentNames = Object.keys(environments);
    
    if (environmentNames.length > 1) {
      // Add environment-specific deployment stages for controlled promotion
      const promotionOrder = ['dev', 'staging', 'prod'];
      const configuredEnvironments = promotionOrder.filter(env => environments[env]);
      
      if (configuredEnvironments.length > 1) {
        console.log(`🔄 Configuring environment promotion: ${configuredEnvironments.join(' → ')}`);
        
        // Add post-deployment validation for each environment
        configuredEnvironments.forEach((envName, index) => {
          if (index > 0) { // Skip first environment (no promotion needed)
            applicationStage.addPost(
              new CodeBuildStep(`ValidatePromotion-${envName}`, {
                commands: [
                  `echo "Validating promotion to ${envName} environment..."`,
                  'npm install',
                  `npx ts-node scripts/validate-deployment.ts -- --environment ${envName}`,
                  `echo "Promotion to ${envName} validated successfully"`,
                ],
                buildEnvironment: {
                  buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
                  computeType: codebuild.ComputeType.SMALL,
                },
                env: {
                  ENVIRONMENT_NAME: envName,
                  VALIDATION_MODE: 'promotion',
                },
              })
            );
          }
        });
      }
    }

    // Create comprehensive monitoring for the platform pipeline
    // Note: Pipeline monitoring will be set up via EventBridge rules that don't require direct pipeline reference
    this.monitoring = new MonitoringConstruct(this, 'PlatformMonitoring', {
      config: {
        pipelineName: 'PlatformPipeline',
        logRetentionDays: logs.RetentionDays.ONE_MONTH,
        enableDetailedMetrics: true,
        enableAuditLogging: true,
        metricNamespace: 'PlatformPipeline/Monitoring',
        enableFailureNotifications: true,
        notificationEmails: this.getNotificationEmails(),
      },
    });

    // Create metric filters for execution time and success rate tracking
    this.monitoring.createExecutionTimeMetricFilter();
    this.monitoring.createSuccessRateMetricFilter();

    // Output configuration summary with cross-stack integration details
    const configSummary = this.applicationPipelineStage.getConfigurationSummary();
    new cdk.CfnOutput(this, 'ConfigurationSummary', {
      value: JSON.stringify({
        applicationCount: configSummary.applicationCount,
        environmentCount: configSummary.environmentCount,
        applications: configSummary.applications,
        environments: configSummary.environments,
        lastUpdated: configSummary.lastUpdated,
        crossStackDependencies: {
          securityStackArn: props?.securityStack?.stackId || 'N/A',
          platformPipelineArn: 'Will be available after pipeline creation',
          applicationPipelineCount: configSummary.applicationCount,
        },
        environmentPromotion: {
          enabled: Object.keys(this.configurationManager.getEnvironments()).length > 1,
          environments: Object.keys(this.configurationManager.getEnvironments()),
        },
        triggerConfiguration: {
          type: 'Native Pipeline Triggers',
          service: 'CodeConnections (aws.codeconnections)',
          triggerOnPush: true,
          noEventBridgeRequired: 'Pipeline triggers natively on push events',
          eliminatesLoops: 'No EventBridge loops possible with native triggers',
          connectionType: 'codeconnections (fresh connection created)',
        },
      }),
      description: 'Comprehensive platform configuration and cross-stack integration summary',
      exportName: 'PlatformPipeline-ComprehensiveConfigurationSummary',
    });

    // Output cross-stack dependency information for monitoring
    new cdk.CfnOutput(this, 'CrossStackDependencies', {
      value: JSON.stringify({
        dependsOn: props?.securityStack ? [props.securityStack.stackName] : [],
        provides: [
          'ApplicationPipelineDeployment',
          'PlatformPipelineManagement',
          'ConfigurationManagement',
          'MonitoringAndLogging',
        ],
        integrationPoints: {
          securityRoles: props?.securityStack ? 'Integrated' : 'Standalone',
          monitoring: 'Enabled',
          credentialManagement: 'Enabled',
          configurationValidation: 'Enabled',
        },
      }),
      description: 'Cross-stack dependencies and integration points',
      exportName: 'PlatformPipeline-CrossStackDependencies',
    });

    // Output monitoring information
    new cdk.CfnOutput(this, 'PipelineLogGroupArn', {
      value: this.monitoring.getPipelineLogGroupArn(),
      description: 'ARN of the pipeline execution log group',
      exportName: 'PlatformPipelineLogGroupArn',
    });

    new cdk.CfnOutput(this, 'AuditLogGroupArn', {
      value: this.monitoring.getAuditLogGroupArn(),
      description: 'ARN of the audit log group',
      exportName: 'PlatformAuditLogGroupArn',
    });

    new cdk.CfnOutput(this, 'FailureNotificationTopicArn', {
      value: this.monitoring.getFailureNotificationTopicArn(),
      description: 'ARN of the failure notification SNS topic',
      exportName: 'PlatformFailureNotificationTopicArn',
    });

    // Output pipeline trigger information
    this.outputPipelineTriggerInformation();

    // Output the connection ARN for use by application pipelines (after stage creation)
    new cdk.CfnOutput(this, 'CodeConnectionArn', {
      value: this.codeConnection.getConnectionArn(),
      description: 'ARN of the CodeConnections connection for use by application pipelines',
      exportName: 'PlatformPipeline-CodeConnectionArn',
    });
  }

  /**
   * Gets notification email addresses from CDK context or environment variables
   */
  private getNotificationEmails(): string[] {
    // Try to get emails from CDK context first
    const contextEmails = this.node.tryGetContext('notificationEmails');
    if (contextEmails && Array.isArray(contextEmails)) {
      return contextEmails;
    }

    // Try to get from environment variable as comma-separated list
    const envEmails = process.env.PLATFORM_NOTIFICATION_EMAILS;
    if (envEmails) {
      return envEmails.split(',').map(email => email.trim()).filter(email => email.length > 0);
    }

    // Default to empty array - notifications can be added later via addEmailNotification method
    return [];
  }

  /**
   * Gets the pipeline ARN after the pipeline is built
   */
  public getPipelineArn(): string {
    return this.pipeline.pipeline.pipelineArn;
  }

  /**
   * Gets the pipeline name after the pipeline is built
   */
  public getPipelineName(): string {
    return this.pipeline.pipeline.pipelineName;
  }

  /**
   * Outputs information about the native pipeline trigger configuration
   * This uses CodeConnections native triggers instead of EventBridge for better reliability
   */
  private outputPipelineTriggerInformation(): void {
    // Output native trigger configuration status
    new cdk.CfnOutput(this, 'PipelineTriggerConfiguration', {
      value: JSON.stringify({
        triggerType: 'Native CodeConnections Triggers',
        description: 'Pipeline triggers automatically on push events via CodeConnections',
        service: 'aws.codeconnections (fresh connection created)',
        advantages: [
          'No EventBridge loops',
          'Immediate triggering on push',
          'Native CodePipeline integration',
          'Better reliability than polling',
          'Eliminates 1-5 minute delays'
        ],
        connectionArn: this.codeConnection.getConnectionArn(),
        connectionName: this.codeConnection.getConnectionName(),
        triggerOnPush: true,
      }, null, 2),
      description: 'Native pipeline trigger configuration using CodeConnections',
      exportName: 'PlatformPipeline-TriggerConfiguration',
    });

    // Output pipeline monitoring URLs
    new cdk.CfnOutput(this, 'PipelineMonitoringUrls', {
      value: JSON.stringify({
        pipelineConsole: `https://${cdk.Aws.REGION}.console.aws.amazon.com/codesuite/codepipeline/pipelines/PlatformPipeline/view`,
        cloudWatchLogs: `https://${cdk.Aws.REGION}.console.aws.amazon.com/cloudwatch/home?region=${cdk.Aws.REGION}#logsV2:log-groups/log-group/$252Faws$252Fcodebuild$252FPlatformPipeline-Synth`,
        codeConnectionsConsole: `https://${cdk.Aws.REGION}.console.aws.amazon.com/codesuite/settings/connections`,
        cloudTrail: `https://${cdk.Aws.REGION}.console.aws.amazon.com/cloudtrail/home?region=${cdk.Aws.REGION}#/events`,
      }, null, 2),
      description: 'URLs for monitoring pipeline execution and CodeConnections',
      exportName: 'PlatformPipeline-MonitoringUrls',
    });
  }
}
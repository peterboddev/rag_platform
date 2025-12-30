import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipeline, CodePipelineSource, CodeBuildStep } from 'aws-cdk-lib/pipelines';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { ConfigurationManager } from './config/platform-config';
import { ApplicationPipelineStage } from './constructs/application-pipeline-stage';
import { SecurityStack } from './security-stack';
import { MonitoringConstruct } from './constructs/monitoring-construct';
import { CodeBuildCredentialsManager } from './config/codebuild-credentials';
import { WebhookTriggerConstruct } from './constructs/webhook-trigger-construct';

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
  public readonly webhookTrigger: WebhookTriggerConstruct;

  constructor(scope: Construct, id: string, props?: PlatformPipelineStackProps) {
    super(scope, id, props);

    // Initialize configuration manager
    this.configurationManager = new ConfigurationManager(this);

    // Initialize secure credential management for CodeBuild
    this.credentialsManager = new CodeBuildCredentialsManager(this, 'CredentialsManager', {
      githubTokenSecretName: 'platform-pipeline/github-token',
      connectionArn: props?.connectionArn || this.node.tryGetContext('connectionArn'),
      enableCredentialRotation: true,
      credentialValidationEnabled: true,
      secretsPrefix: 'platform-pipeline',
    });

    // Get configuration from CDK context or props with defaults
    const githubOrg = props?.githubOrg || this.node.tryGetContext('githubOrg') || 'platform-team';
    const githubRepo = props?.githubRepo || this.node.tryGetContext('githubRepo') || 'platform-pipeline';
    const branch = props?.branch || this.node.tryGetContext('branch') || 'main';
    const connectionArn = props?.connectionArn || this.node.tryGetContext('connectionArn');

    // Validate required configuration
    if (!connectionArn) {
      throw new Error('CodeStar connection ARN is required. Set it via CDK context "connectionArn" or props.');
    }

    // Create the self-mutating pipeline with enhanced CodeBuild configuration
    this.pipeline = new CodePipeline(this, 'PlatformPipeline', {
      pipelineName: 'PlatformPipeline',
      selfMutation: true,
      crossAccountKeys: true,
      
      // Configure the source stage with GitHub integration
      synth: new CodeBuildStep('Synth', {
        input: CodePipelineSource.connection(
          `${githubOrg}/${githubRepo}`,
          branch,
          {
            connectionArn: connectionArn,
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
          
          // Install dependencies
          'echo "Installing dependencies..."',
          'npm install',
          
          // TypeScript compilation using local tsc directly from node_modules
          'echo "Compiling TypeScript..."',
          './node_modules/.bin/tsc',
          
          // Run tests to ensure code quality
          'echo "Running tests..."',
          'npm run test',
          
          // CDK synthesis to generate CloudFormation templates
          'echo "Synthesizing CDK templates..."',
          'npx cdk synth'
        ],
        
        // Primary output directory for CDK synthesis
        primaryOutputDirectory: 'cdk.out',
        
        // Enhanced CodeBuild configuration with secure credential access
        buildEnvironment: {
          // Use Amazon Linux 2023 with explicit Node.js 20 runtime
          buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
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
            buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
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
                  buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
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

    // Create EventBridge integration for immediate pipeline triggering
    // This must be done after the pipeline is fully created and all stages are added
    this.webhookTrigger = new WebhookTriggerConstruct(this, 'EventBridgeTrigger', {
      pipelineName: 'PlatformPipeline',
      logRetentionDays: logs.RetentionDays.ONE_MONTH,
    });

    // Output webhook setup instructions for GitHub configuration
    this.outputWebhookSetupInstructions();
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
   * Outputs information about the EventBridge integration for immediate pipeline triggering
   * This eliminates the 1-5 minute polling delay from CodeStar connections automatically
   */
  private outputWebhookSetupInstructions(): void {
    // Output EventBridge integration status
    new cdk.CfnOutput(this, 'EventBridgeIntegrationStatus', {
      value: JSON.stringify({
        status: 'Enabled - Automatic immediate pipeline triggering',
        description: 'EventBridge rules automatically trigger pipeline on CodeStar connection events',
        noGitHubConfigRequired: 'This works automatically with existing CodeStar connection',
        eliminatesPollingDelay: 'No more 1-5 minute wait times',
        fallbackMechanism: 'CodeStar connection continues as backup',
      }, null, 2),
      description: 'EventBridge integration status for immediate pipeline triggering',
      exportName: 'PlatformPipeline-EventBridgeIntegrationStatus',
    });

    // Output infrastructure details
    new cdk.CfnOutput(this, 'ImmediateTriggerInfrastructure', {
      value: JSON.stringify({
        eventRuleArn: this.webhookTrigger.getEventRuleArn(),
        triggerMechanism: 'EventBridge → CodePipeline (direct)',
        authentication: 'AWS IAM (no external configuration needed)',
        monitoring: 'EventBridge metrics and CloudTrail logs',
        lambdaFunction: 'Not needed - EventBridge triggers CodePipeline directly',
      }, null, 2),
      description: 'Immediate trigger infrastructure details for monitoring',
      exportName: 'PlatformPipeline-ImmediateTriggerInfrastructure',
    });

    // Output pipeline monitoring URLs
    new cdk.CfnOutput(this, 'PipelineMonitoringUrls', {
      value: JSON.stringify({
        pipelineConsole: `https://${cdk.Aws.REGION}.console.aws.amazon.com/codesuite/codepipeline/pipelines/PlatformPipeline/view`,
        cloudWatchLogs: `https://${cdk.Aws.REGION}.console.aws.amazon.com/cloudwatch/home?region=${cdk.Aws.REGION}#logsV2:log-groups/log-group/$252Faws$252Fcodebuild$252FPlatformPipeline-Synth`,
        eventBridgeRules: `https://${cdk.Aws.REGION}.console.aws.amazon.com/events/home?region=${cdk.Aws.REGION}#/rules`,
        cloudTrail: `https://${cdk.Aws.REGION}.console.aws.amazon.com/cloudtrail/home?region=${cdk.Aws.REGION}#/events`,
      }, null, 2),
      description: 'URLs for monitoring pipeline execution and EventBridge integration',
      exportName: 'PlatformPipeline-MonitoringUrls',
    });
  }
}
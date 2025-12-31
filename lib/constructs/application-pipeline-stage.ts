import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApplicationPipelineConstruct, ApplicationPipelineConfig } from './application-pipeline-construct';
import { ConfigurationManager, ApplicationConfig, EnvironmentConfig } from '../config/platform-config';
import { SecurityStack } from '../security-stack';

/**
 * Properties for the ApplicationPipelineStage
 */
export interface ApplicationPipelineStageProps extends cdk.StageProps {
  readonly configurationManager: ConfigurationManager;
  readonly securityStack?: SecurityStack;
  // connectionArn will be imported from CloudFormation export
}

/**
 * Stack that contains application pipelines
 */
class ApplicationPipelineStack extends cdk.Stack {
  public readonly applicationPipelines: { [appName: string]: ApplicationPipelineConstruct } = {};

  constructor(scope: Construct, id: string, props: cdk.StackProps & {
    configurationManager: ConfigurationManager;
    securityStack?: SecurityStack;
  }) {
    super(scope, id, props);

    const { configurationManager, securityStack } = props;
    
    // Create application pipelines for all enabled applications
    const enabledApps = configurationManager.getEnabledApplications();
    const platformConfig = configurationManager.getPlatformConfig();

    Object.entries(enabledApps).forEach(([appName, appConfig]) => {
      try {
        // Transform application configuration to pipeline configuration
        const pipelineConfig = this.transformToPipelineConfig(appConfig, configurationManager, securityStack);
        
        // Create the application pipeline construct
        const pipeline = new ApplicationPipelineConstruct(this, `${appName}-Pipeline`, {
          config: pipelineConfig,
        });

        this.applicationPipelines[appName] = pipeline;

        // Add outputs for the created pipeline
        new cdk.CfnOutput(this, `${appName}-PipelineArn`, {
          value: pipeline.getPipelineArn(),
          description: `ARN of the ${appName} application pipeline`,
          exportName: `${appName}-PipelineArn`,
        });

        new cdk.CfnOutput(this, `${appName}-BuildProjectArn`, {
          value: pipeline.getBuildProjectArn(),
          description: `ARN of the ${appName} build project`,
          exportName: `${appName}-BuildProjectArn`,
        });

      } catch (error) {
        throw new Error(`Failed to create pipeline for application '${appName}': ${error}`);
      }
    });
  }

  /**
   * Transforms ApplicationConfig to ApplicationPipelineConfig
   */
  private transformToPipelineConfig(
    appConfig: ApplicationConfig,
    configManager: ConfigurationManager,
    securityStack?: SecurityStack
  ): ApplicationPipelineConfig {
    // Resolve deployment targets from environment names to environment configs
    const deploymentTargets = appConfig.deploymentTargets.map(envName => {
      const envConfig = configManager.getEnvironment(envName);
      if (!envConfig) {
        throw new Error(`Unknown environment '${envName}' referenced by application '${appConfig.applicationName}'`);
      }

      return this.transformToDeploymentTarget(envConfig, appConfig.applicationName);
    });

    // Build the pipeline configuration
    const pipelineConfig: ApplicationPipelineConfig = {
      applicationName: appConfig.applicationName,
      sourceRepo: {
        owner: appConfig.sourceRepo.owner,
        repo: appConfig.sourceRepo.repo,
        branch: appConfig.sourceRepo.branch,
        // connectionArn will be created by ApplicationPipelineConstruct for each app's repository
      },
      deploymentTargets: deploymentTargets,
      buildConfig: this.transformToBuildConfig(appConfig, configManager),
      notifications: appConfig.notifications,
      // Note: Not passing security stack roles to avoid cross-stage dependencies
      // The ApplicationPipelineConstruct will create its own roles
      // pipelineRole: securityStack?.applicationPipelineRole,
      // codeBuildRole: securityStack?.codeBuildServiceRole,
    };

    return pipelineConfig;
  }

  /**
   * Transforms EnvironmentConfig to DeploymentTarget
   */
  private transformToDeploymentTarget(envConfig: EnvironmentConfig, appName: string) {
    return {
      name: envConfig.name,
      account: envConfig.account,
      region: envConfig.region,
      stackName: `${appName}-${envConfig.name.toLowerCase()}`,
      parameters: envConfig.parameters,
      requiresApproval: envConfig.requiresApproval || false,
    };
  }

  /**
   * Transforms application build config with defaults
   */
  private transformToBuildConfig(appConfig: ApplicationConfig, configManager: ConfigurationManager) {
    const defaults = configManager.getDefaults();
    const buildConfig = appConfig.buildConfig || {};

    return {
      runtime: buildConfig.runtime || defaults.buildRuntime,
      commands: buildConfig.commands,
      environment: buildConfig.environment,
      // Add other build configuration transformations as needed
    };
  }

  /**
   * Adds CloudFormation outputs for pipeline management and monitoring
   */
  public addManagementOutputs(
    pipelineNames: string[],
    configSummary: any,
    deploymentMetadata: { [appName: string]: any },
    platformConfig: any
  ): void {
    // Output the list of managed application pipelines
    new cdk.CfnOutput(this, 'ManagedApplicationPipelines', {
      value: JSON.stringify(pipelineNames),
      description: 'List of application pipelines managed by this platform pipeline',
      exportName: 'PlatformPipeline-ManagedApplications',
    });

    // Output configuration summary for monitoring
    new cdk.CfnOutput(this, 'PipelineConfigurationSummary', {
      value: JSON.stringify(configSummary),
      description: 'Summary of pipeline configuration and deployment status',
      exportName: 'PlatformPipeline-ConfigurationSummary',
    });

    // Output deployment metadata for external monitoring systems
    new cdk.CfnOutput(this, 'DeploymentMetadata', {
      value: JSON.stringify(deploymentMetadata),
      description: 'Metadata about deployed application pipelines',
      exportName: 'PlatformPipeline-DeploymentMetadata',
    });

    // Output platform configuration version for change tracking
    const configHash = this.calculateConfigurationHash(platformConfig);
    new cdk.CfnOutput(this, 'PlatformConfigurationVersion', {
      value: configHash,
      description: 'Hash of current platform configuration for change detection',
      exportName: 'PlatformPipeline-ConfigurationVersion',
    });
  }

  /**
   * Calculates a hash of the configuration for change detection
   */
  private calculateConfigurationHash(config: any): string {
    const configString = JSON.stringify(config, Object.keys(config).sort());
    // Simple hash function for configuration change detection
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}

/**
 * CDK Stage that deploys multiple application pipelines based on configuration
 * 
 * This stage reads the platform configuration and creates ApplicationPipelineConstruct
 * instances for each enabled application. It handles:
 * - Configuration validation and transformation
 * - Security role assignment
 * - Environment-specific parameter resolution
 * - Pipeline standardization enforcement
 * - Automatic updates when configurations change
 * - Pipeline registration and management
 */
export class ApplicationPipelineStage extends cdk.Stage {
  public readonly applicationPipelineStack: ApplicationPipelineStack;
  private readonly configManager: ConfigurationManager;
  private readonly deploymentMetadata: { [appName: string]: any } = {};

  constructor(scope: Construct, id: string, props: ApplicationPipelineStageProps) {
    super(scope, id, props);

    this.configManager = props.configurationManager;

    // Validate configuration before proceeding
    this.configManager.validateOrThrow();

    // Validate deployment targets before creating pipelines
    this.validateDeploymentTargets();

    // Create the application pipeline stack
    this.applicationPipelineStack = new ApplicationPipelineStack(this, 'ApplicationPipelineStack', {
      configurationManager: this.configManager,
      securityStack: props.securityStack,
      // connectionArn will be imported from CloudFormation export inside the stack
      env: props.env, // Pass through the environment settings
    });

    // Register pipelines and collect deployment metadata
    this.registerApplicationPipelines();

    // Log summary of created pipelines
    const pipelineCount = Object.keys(this.applicationPipelineStack.applicationPipelines).length;
    const pipelineNames = Object.keys(this.applicationPipelineStack.applicationPipelines);
    
    console.log(`✅ Successfully created ${pipelineCount} application pipelines: ${pipelineNames.join(', ')}`);
    
    if (pipelineCount === 0) {
      console.warn('⚠️  No application pipelines were created. Check your configuration.');
    }

    // Add CloudFormation outputs for monitoring and management
    this.addManagementOutputs();
  }

  /**
   * Gets a specific application pipeline by name
   */
  public getApplicationPipeline(appName: string): ApplicationPipelineConstruct | undefined {
    return this.applicationPipelineStack.applicationPipelines[appName];
  }

  /**
   * Gets all application pipeline names
   */
  public getApplicationPipelineNames(): string[] {
    return Object.keys(this.applicationPipelineStack.applicationPipelines);
  }

  /**
   * Gets the count of created application pipelines
   */
  public getApplicationPipelineCount(): number {
    return Object.keys(this.applicationPipelineStack.applicationPipelines).length;
  }

  /**
   * Registers application pipelines and collects deployment metadata
   * This enables tracking and management of deployed pipelines
   */
  private registerApplicationPipelines(): void {
    const enabledApps = this.configManager.getEnabledApplications();
    const platformConfig = this.configManager.getPlatformConfig();

    Object.entries(enabledApps).forEach(([appName, appConfig]) => {
      // Collect metadata for each application pipeline
      this.deploymentMetadata[appName] = {
        applicationName: appConfig.applicationName,
        team: appConfig.team,
        sourceRepository: `${appConfig.sourceRepo.owner}/${appConfig.sourceRepo.repo}`,
        branch: appConfig.sourceRepo.branch,
        deploymentTargets: appConfig.deploymentTargets,
        enabled: appConfig.enabled !== false,
        lastUpdated: new Date().toISOString(),
        configurationHash: this.calculateConfigurationHash(appConfig),
      };
    });

    console.log(`📋 Registered ${Object.keys(this.deploymentMetadata).length} application pipelines for management`);
  }

  /**
   * Calculates a hash of the application configuration for change detection
   */
  private calculateConfigurationHash(appConfig: ApplicationConfig): string {
    const configString = JSON.stringify(appConfig, Object.keys(appConfig).sort());
    // Simple hash function for configuration change detection
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Adds CloudFormation outputs for pipeline management and monitoring
   */
  private addManagementOutputs(): void {
    // Delegate to the stack to create outputs since CfnOutput must be in a Stack
    this.applicationPipelineStack.addManagementOutputs(
      this.getApplicationPipelineNames(),
      this.getConfigurationSummary(),
      this.deploymentMetadata,
      this.configManager.getPlatformConfig()
    );
  }

  /**
   * Validates that all configured applications have valid deployment targets
   */
  public validateDeploymentTargets(): void {
    const enabledApps = this.configManager.getEnabledApplications();
    const environments = this.configManager.getEnvironments();

    Object.entries(enabledApps).forEach(([appName, appConfig]) => {
      appConfig.deploymentTargets.forEach(envName => {
        if (!environments[envName]) {
          throw new Error(
            `Application '${appName}' references unknown environment '${envName}'. ` +
            `Available environments: ${Object.keys(environments).join(', ')}`
          );
        }
      });
    });

    console.log(`✅ Validated deployment targets for ${Object.keys(enabledApps).length} applications`);
  }

  /**
   * Detects configuration changes and determines if pipeline updates are needed
   */
  public detectConfigurationChanges(previousMetadata?: { [appName: string]: any }): {
    added: string[];
    modified: string[];
    removed: string[];
    unchanged: string[];
  } {
    const currentApps = Object.keys(this.deploymentMetadata);
    const previousApps = previousMetadata ? Object.keys(previousMetadata) : [];

    const added = currentApps.filter(app => !previousApps.includes(app));
    const removed = previousApps.filter(app => !currentApps.includes(app));
    const unchanged: string[] = [];
    const modified: string[] = [];

    currentApps.forEach(app => {
      if (previousApps.includes(app)) {
        const currentHash = this.deploymentMetadata[app].configurationHash;
        const previousHash = previousMetadata?.[app]?.configurationHash;
        
        if (currentHash === previousHash) {
          unchanged.push(app);
        } else {
          modified.push(app);
        }
      }
    });

    return { added, modified, removed, unchanged };
  }

  /**
   * Gets deployment metadata for monitoring and management
   */
  public getDeploymentMetadata(): { [appName: string]: any } {
    return { ...this.deploymentMetadata };
  }

  /**
   * Checks if automatic updates are enabled for configuration changes
   */
  public isAutomaticUpdateEnabled(): boolean {
    // Check if automatic updates are enabled via configuration or context
    const automaticUpdates = this.node.tryGetContext('automaticUpdates');
    return automaticUpdates !== false; // Default to true unless explicitly disabled
  }

  /**
   * Triggers pipeline updates when configuration changes are detected
   * This method is called by the platform pipeline when changes are detected
   */
  public triggerPipelineUpdates(changes: {
    added: string[];
    modified: string[];
    removed: string[];
  }): void {
    if (!this.isAutomaticUpdateEnabled()) {
      console.log('⚠️  Automatic updates are disabled. Pipeline changes detected but not applied.');
      return;
    }

    const totalChanges = changes.added.length + changes.modified.length + changes.removed.length;
    
    if (totalChanges === 0) {
      console.log('✅ No pipeline configuration changes detected');
      return;
    }

    console.log(`🔄 Triggering pipeline updates for ${totalChanges} changes:`);
    
    if (changes.added.length > 0) {
      console.log(`  ➕ Added applications: ${changes.added.join(', ')}`);
    }
    
    if (changes.modified.length > 0) {
      console.log(`  🔧 Modified applications: ${changes.modified.join(', ')}`);
    }
    
    if (changes.removed.length > 0) {
      console.log(`  ➖ Removed applications: ${changes.removed.join(', ')}`);
    }

    // The actual pipeline updates are handled by CDK's self-mutation capability
    // This method provides logging and metadata tracking for the update process
  }

  /**
   * Gets configuration summary for monitoring and debugging
   */
  public getConfigurationSummary(): {
    applicationCount: number;
    environmentCount: number;
    applications: string[];
    environments: string[];
    lastUpdated: string;
  } {
    const apps = this.configManager.getEnabledApplications();
    const envs = this.configManager.getEnvironments();

    return {
      applicationCount: Object.keys(apps).length,
      environmentCount: Object.keys(envs).length,
      applications: Object.keys(apps),
      environments: Object.keys(envs),
      lastUpdated: new Date().toISOString(),
    };
  }
}
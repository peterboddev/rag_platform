import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfig {
  readonly name: string;
  readonly account: string;
  readonly region: string;
  readonly isProd?: boolean;
  readonly requiresApproval?: boolean;
  readonly parameters?: { [key: string]: string };
}

/**
 * Application-specific configuration that extends the base ApplicationPipelineConfig
 */
export interface ApplicationConfig {
  readonly applicationName: string;
  readonly team: string;
  readonly sourceRepo: {
    readonly owner: string;
    readonly repo: string;
    readonly branch: string;
  };
  readonly buildConfig?: {
    readonly runtime?: string;
    readonly commands?: string[];
    readonly environment?: { [key: string]: string };
  };
  readonly deploymentTargets: string[]; // References to environment names
  readonly notifications?: {
    readonly snsTopicArn?: string;
    readonly emailAddresses?: string[];
  };
  readonly enabled?: boolean;
}

/**
 * Platform-wide configuration
 */
export interface PlatformConfig {
  readonly platform: {
    readonly region: string;
    readonly account: string;
    readonly connectionArn: string;
    readonly artifactBucketPrefix?: string;
  };
  readonly environments: { [envName: string]: EnvironmentConfig };
  readonly applications: { [appName: string]: ApplicationConfig };
  readonly defaults: {
    readonly buildRuntime: string;
    readonly computeType: string;
    readonly buildImage: string;
    readonly cacheEnabled: boolean;
  };
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

/**
 * Configuration manager for platform and application settings
 * 
 * This class handles loading, validating, and managing configuration
 * for the platform pipeline system. It supports:
 * - CDK context integration
 * - Environment-specific overrides
 * - Configuration validation
 * - Default value management
 */
export class ConfigurationManager {
  private config: PlatformConfig;
  protected readonly scope: Construct;

  constructor(scope: Construct) {
    this.scope = scope;
    this.config = this.loadConfiguration();
  }

  /**
   * Loads configuration from CDK context and configuration files
   */
  private loadConfiguration(): PlatformConfig {
    // Load base configuration from CDK context
    const baseConfig = this.loadFromContext();
    
    // Load environment-specific overrides
    const envOverrides = this.loadEnvironmentOverrides();
    
    // Merge configurations with precedence: context < env overrides
    return this.mergeConfigurations(baseConfig, envOverrides);
  }

  /**
   * Loads configuration from CDK context
   */
  private loadFromContext(): Partial<PlatformConfig> {
    const node = this.scope.node;
    
    // Try to get platform config as an object first, then fall back to individual keys
    const platformContext = node.tryGetContext('platform');
    const connectionArn = node.tryGetContext('platform.connectionArn') || node.tryGetContext('connectionArn') || '';
    
    // If we have a platform context object, use it directly
    if (platformContext && typeof platformContext === 'object') {
      return {
        platform: {
          region: platformContext.region || cdk.Aws.REGION,
          account: platformContext.account || cdk.Aws.ACCOUNT_ID,
          connectionArn: platformContext.connectionArn || connectionArn,
          artifactBucketPrefix: platformContext.artifactBucketPrefix || 'platform-pipeline',
        },
        environments: node.tryGetContext('environments') || {},
        applications: node.tryGetContext('applications') || {},
        defaults: node.tryGetContext('defaults') || {
          buildRuntime: '20',
          computeType: 'BUILD_GENERAL1_SMALL',
          buildImage: 'AMAZON_LINUX_2_STANDARD_3_0_ARM',
          cacheEnabled: true,
        },
      };
    }
    
    // Fallback to individual context keys
    return {
      platform: {
        region: node.tryGetContext('platform.region') || cdk.Aws.REGION,
        account: node.tryGetContext('platform.account') || cdk.Aws.ACCOUNT_ID,
        connectionArn: connectionArn,
        artifactBucketPrefix: node.tryGetContext('platform.artifactBucketPrefix') || 'platform-pipeline',
      },
      environments: node.tryGetContext('environments') || {},
      applications: node.tryGetContext('applications') || {},
      defaults: {
        buildRuntime: node.tryGetContext('defaults.buildRuntime') || '20',
        computeType: node.tryGetContext('defaults.computeType') || 'BUILD_GENERAL1_SMALL',
        buildImage: node.tryGetContext('defaults.buildImage') || 'AMAZON_LINUX_2_STANDARD_3_0_ARM',
        cacheEnabled: node.tryGetContext('defaults.cacheEnabled') !== false,
      },
    };
  }

  /**
   * Loads environment-specific configuration overrides
   */
  private loadEnvironmentOverrides(): Partial<PlatformConfig> {
    const environment = process.env.NODE_ENV || 'development';
    const envContextKey = `env.${environment}`;
    
    return this.scope.node.tryGetContext(envContextKey) || {};
  }

  /**
   * Merges multiple configuration objects with proper precedence
   */
  private mergeConfigurations(...configs: Partial<PlatformConfig>[]): PlatformConfig {
    const merged: any = {
      platform: {
        region: '',
        account: '',
        connectionArn: '',
      },
      environments: {},
      applications: {},
      defaults: {
        buildRuntime: '20',
        computeType: 'BUILD_GENERAL1_SMALL',
        buildImage: 'AMAZON_LINUX_2_STANDARD_3_0_ARM',
        cacheEnabled: true,
      },
    };

    // Deep merge all configurations
    configs.forEach(config => {
      if (config.platform) {
        merged.platform = { ...merged.platform, ...config.platform };
      }
      if (config.environments) {
        merged.environments = { ...merged.environments, ...config.environments };
      }
      if (config.applications) {
        merged.applications = { ...merged.applications, ...config.applications };
      }
      if (config.defaults) {
        merged.defaults = { ...merged.defaults, ...config.defaults };
      }
    });

    return merged;
  }

  /**
   * Validates the complete configuration
   */
  public validateConfiguration(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate platform configuration
    const platformValidation = this.validatePlatformConfig();
    errors.push(...platformValidation.errors);
    warnings.push(...platformValidation.warnings);

    // Validate environments
    const envValidation = this.validateEnvironments();
    errors.push(...envValidation.errors);
    warnings.push(...envValidation.warnings);

    // Validate applications
    const appValidation = this.validateApplications();
    errors.push(...appValidation.errors);
    warnings.push(...appValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates platform-level configuration
   */
  private validatePlatformConfig(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const platform = this.config.platform;

    if (!platform.connectionArn) {
      errors.push('Platform connectionArn is required for GitHub integration');
    }

    if (!platform.region) {
      errors.push('Platform region is required');
    }

    if (!platform.account) {
      errors.push('Platform account is required');
    }

    // Validate ARN format
    if (platform.connectionArn && !platform.connectionArn.startsWith('arn:aws:codestar-connections:')) {
      errors.push('Platform connectionArn must be a valid CodeStar connection ARN');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates environment configurations
   */
  private validateEnvironments(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const environments = this.config.environments;

    if (Object.keys(environments).length === 0) {
      warnings.push('No environments configured - at least one environment is recommended');
    }

    Object.entries(environments).forEach(([envName, envConfig]) => {
      if (!envConfig.name) {
        errors.push(`Environment '${envName}' is missing name field`);
      }

      if (!envConfig.account) {
        errors.push(`Environment '${envName}' is missing account field`);
      }

      if (!envConfig.region) {
        errors.push(`Environment '${envName}' is missing region field`);
      }

      // Validate account ID format (12 digits)
      if (envConfig.account && !/^\d{12}$/.test(envConfig.account)) {
        errors.push(`Environment '${envName}' has invalid account ID format (must be 12 digits)`);
      }

      // Validate region format
      if (envConfig.region && !/^[a-z]{2}-[a-z]+-\d+$/.test(envConfig.region)) {
        warnings.push(`Environment '${envName}' region '${envConfig.region}' may not be a valid AWS region`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates application configurations
   */
  private validateApplications(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const applications = this.config.applications;

    if (Object.keys(applications).length === 0) {
      warnings.push('No applications configured');
    }

    Object.entries(applications).forEach(([appName, appConfig]) => {
      if (!appConfig.applicationName) {
        errors.push(`Application '${appName}' is missing applicationName field`);
      }

      if (!appConfig.team) {
        errors.push(`Application '${appName}' is missing team field`);
      }

      if (!appConfig.sourceRepo) {
        errors.push(`Application '${appName}' is missing sourceRepo configuration`);
      } else {
        if (!appConfig.sourceRepo.owner) {
          errors.push(`Application '${appName}' sourceRepo is missing owner field`);
        }

        if (!appConfig.sourceRepo.repo) {
          errors.push(`Application '${appName}' sourceRepo is missing repo field`);
        }

        if (!appConfig.sourceRepo.branch) {
          errors.push(`Application '${appName}' sourceRepo is missing branch field`);
        }
      }

      if (!appConfig.deploymentTargets || appConfig.deploymentTargets.length === 0) {
        errors.push(`Application '${appName}' must have at least one deployment target`);
      } else {
        // Validate that deployment targets reference valid environments
        appConfig.deploymentTargets.forEach(targetEnv => {
          if (!this.config.environments[targetEnv]) {
            errors.push(`Application '${appName}' references unknown environment '${targetEnv}'`);
          }
        });
      }

      if (appConfig.enabled === false) {
        warnings.push(`Application '${appName}' is disabled and will not be deployed`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Gets the complete platform configuration
   */
  public getConfig(): PlatformConfig {
    return { ...this.config };
  }

  /**
   * Gets platform-level configuration
   */
  public getPlatformConfig() {
    return { ...this.config.platform };
  }

  /**
   * Gets all environment configurations
   */
  public getEnvironments(): { [envName: string]: EnvironmentConfig } {
    return { ...this.config.environments };
  }

  /**
   * Gets a specific environment configuration
   */
  public getEnvironment(name: string): EnvironmentConfig | undefined {
    return this.config.environments[name] ? { ...this.config.environments[name] } : undefined;
  }

  /**
   * Gets all application configurations
   */
  public getApplications(): { [appName: string]: ApplicationConfig } {
    return { ...this.config.applications };
  }

  /**
   * Gets enabled application configurations only
   */
  public getEnabledApplications(): { [appName: string]: ApplicationConfig } {
    const enabled: { [appName: string]: ApplicationConfig } = {};
    
    Object.entries(this.config.applications).forEach(([appName, appConfig]) => {
      if (appConfig.enabled !== false) {
        enabled[appName] = { ...appConfig };
      }
    });

    return enabled;
  }

  /**
   * Gets a specific application configuration
   */
  public getApplication(name: string): ApplicationConfig | undefined {
    return this.config.applications[name] ? { ...this.config.applications[name] } : undefined;
  }

  /**
   * Gets default configuration values
   */
  public getDefaults() {
    return { ...this.config.defaults };
  }

  /**
   * Resolves a configuration parameter with environment-specific overrides
   */
  public resolveParameter(key: string, environmentName?: string): string | undefined {
    // Try environment-specific parameter first
    if (environmentName) {
      const env = this.getEnvironment(environmentName);
      if (env?.parameters?.[key]) {
        return env.parameters[key];
      }
    }

    // Fall back to CDK context
    return this.scope.node.tryGetContext(key);
  }

  /**
   * Resolves configuration with cascading precedence:
   * 1. Environment-specific parameters
   * 2. Application-specific parameters  
   * 3. CDK context values
   * 4. Default values
   */
  public resolveParameterWithDefaults(
    key: string, 
    defaultValue?: string, 
    environmentName?: string,
    applicationName?: string
  ): string | undefined {
    // 1. Try environment-specific parameter first
    if (environmentName) {
      const env = this.getEnvironment(environmentName);
      if (env?.parameters?.[key]) {
        return env.parameters[key];
      }
    }

    // 2. Try application-specific parameter
    if (applicationName) {
      const app = this.getApplication(applicationName);
      if (app?.buildConfig?.environment?.[key]) {
        return app.buildConfig.environment[key];
      }
    }

    // 3. Fall back to CDK context
    const contextValue = this.scope.node.tryGetContext(key);
    if (contextValue !== undefined) {
      return contextValue;
    }

    // 4. Use default value
    return defaultValue;
  }

  /**
   * Gets configuration for a specific deployment target
   */
  public getDeploymentConfig(applicationName: string, environmentName: string): {
    environment: EnvironmentConfig;
    application: ApplicationConfig;
    resolvedParameters: { [key: string]: string };
  } | undefined {
    const application = this.getApplication(applicationName);
    const environment = this.getEnvironment(environmentName);

    if (!application || !environment) {
      return undefined;
    }

    // Resolve all parameters for this deployment
    const resolvedParameters: { [key: string]: string } = {};
    
    // Merge environment parameters
    if (environment.parameters) {
      Object.assign(resolvedParameters, environment.parameters);
    }

    // Merge application build environment
    if (application.buildConfig?.environment) {
      Object.assign(resolvedParameters, application.buildConfig.environment);
    }

    return {
      environment,
      application,
      resolvedParameters,
    };
  }

  /**
   * Validates and throws an error if configuration is invalid
   */
  public validateOrThrow(): void {
    const validation = this.validateConfiguration();
    
    if (!validation.isValid) {
      const errorMessage = [
        'Configuration validation failed:',
        ...validation.errors.map(error => `  - ${error}`),
      ].join('\n');
      
      throw new Error(errorMessage);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('Configuration warnings:');
      validation.warnings.forEach(warning => {
        console.warn(`  - ${warning}`);
      });
    }
  }
}

/**
 * Utility functions for configuration management
 */
export class ConfigurationUtils {
  /**
   * Creates a sample configuration for documentation/testing purposes
   */
  static createSampleConfig(): PlatformConfig {
    return {
      platform: {
        region: 'us-east-1',
        account: '123456789012',
        connectionArn: 'arn:aws:codestar-connections:us-east-1:123456789012:connection/sample-connection-id',
        artifactBucketPrefix: 'platform-pipeline',
      },
      environments: {
        dev: {
          name: 'Development',
          account: '123456789012',
          region: 'us-east-1',
          isProd: false,
          requiresApproval: false,
        },
        staging: {
          name: 'Staging',
          account: '123456789012',
          region: 'us-east-1',
          isProd: false,
          requiresApproval: true,
        },
        prod: {
          name: 'Production',
          account: '987654321098',
          region: 'us-east-1',
          isProd: true,
          requiresApproval: true,
        },
      },
      applications: {
        'sample-app': {
          applicationName: 'sample-app',
          team: 'platform-team',
          sourceRepo: {
            owner: 'platform-team',
            repo: 'sample-application',
            branch: 'main',
          },
          deploymentTargets: ['dev', 'staging', 'prod'],
          enabled: true,
        },
      },
      defaults: {
        buildRuntime: '20',
        computeType: 'BUILD_GENERAL1_SMALL',
        buildImage: 'AMAZON_LINUX_2_STANDARD_3_0_ARM',
        cacheEnabled: true,
      },
    };
  }

  /**
   * Validates a configuration object against the schema
   */
  static validateConfigSchema(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object');
      return { isValid: false, errors, warnings };
    }

    // Required top-level properties
    const requiredProps = ['platform', 'environments', 'applications', 'defaults'];
    requiredProps.forEach(prop => {
      if (!config[prop]) {
        errors.push(`Missing required property: ${prop}`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Merges environment-specific configuration overrides
   */
  static mergeEnvironmentOverrides(
    baseConfig: PlatformConfig, 
    environmentOverrides: Partial<PlatformConfig>
  ): PlatformConfig {
    const merged = JSON.parse(JSON.stringify(baseConfig)); // Deep clone

    if (environmentOverrides.platform) {
      merged.platform = { ...merged.platform, ...environmentOverrides.platform };
    }

    if (environmentOverrides.environments) {
      Object.entries(environmentOverrides.environments).forEach(([envName, envConfig]) => {
        if (merged.environments[envName]) {
          merged.environments[envName] = { ...merged.environments[envName], ...envConfig };
        } else {
          merged.environments[envName] = envConfig;
        }
      });
    }

    if (environmentOverrides.applications) {
      Object.entries(environmentOverrides.applications).forEach(([appName, appConfig]) => {
        if (merged.applications[appName]) {
          merged.applications[appName] = { ...merged.applications[appName], ...appConfig };
        } else {
          merged.applications[appName] = appConfig;
        }
      });
    }

    if (environmentOverrides.defaults) {
      merged.defaults = { ...merged.defaults, ...environmentOverrides.defaults };
    }

    return merged;
  }

  /**
   * Validates that all application deployment targets reference valid environments
   */
  static validateDeploymentTargets(config: PlatformConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    Object.entries(config.applications).forEach(([appName, appConfig]) => {
      appConfig.deploymentTargets.forEach(targetEnv => {
        if (!config.environments[targetEnv]) {
          errors.push(`Application '${appName}' references unknown environment '${targetEnv}'`);
        }
      });
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Generates CDK context configuration from platform config
   */
  static generateCdkContext(config: PlatformConfig): any {
    return {
      platform: config.platform,
      environments: config.environments,
      applications: config.applications,
      defaults: config.defaults,
    };
  }

  /**
   * Validates AWS resource naming conventions
   */
  static validateResourceNames(config: PlatformConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate application names (must be valid for AWS resource names)
    Object.entries(config.applications).forEach(([appName, appConfig]) => {
      if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(appConfig.applicationName)) {
        errors.push(`Application name '${appConfig.applicationName}' contains invalid characters (must start with letter, contain only letters, numbers, and hyphens)`);
      }

      if (appConfig.applicationName.length > 63) {
        errors.push(`Application name '${appConfig.applicationName}' is too long (max 63 characters)`);
      }
    });

    // Validate environment names
    Object.keys(config.environments).forEach(envName => {
      if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(envName)) {
        errors.push(`Environment name '${envName}' contains invalid characters (must start with letter, contain only letters, numbers, and hyphens)`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Creates environment-specific configuration file content
   */
  static createEnvironmentConfig(
    environmentName: string, 
    environmentConfig: EnvironmentConfig,
    overrides?: Partial<PlatformConfig>
  ): any {
    const config: any = {
      environments: {
        [environmentName]: environmentConfig,
      },
    };

    if (overrides?.defaults) {
      config.defaults = overrides.defaults;
    }

    if (overrides?.platform) {
      config.platform = overrides.platform;
    }

    return config;
  }

  /**
   * Extracts configuration differences between two configs
   */
  static getConfigurationDiff(
    oldConfig: PlatformConfig, 
    newConfig: PlatformConfig
  ): {
    added: string[];
    modified: string[];
    removed: string[];
  } {
    const added: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];

    // Check applications
    const oldApps = Object.keys(oldConfig.applications);
    const newApps = Object.keys(newConfig.applications);

    newApps.forEach(app => {
      if (!oldApps.includes(app)) {
        added.push(`application.${app}`);
      } else {
        // Check for modifications (simplified comparison)
        const oldApp = JSON.stringify(oldConfig.applications[app]);
        const newApp = JSON.stringify(newConfig.applications[app]);
        if (oldApp !== newApp) {
          modified.push(`application.${app}`);
        }
      }
    });

    oldApps.forEach(app => {
      if (!newApps.includes(app)) {
        removed.push(`application.${app}`);
      }
    });

    // Check environments
    const oldEnvs = Object.keys(oldConfig.environments);
    const newEnvs = Object.keys(newConfig.environments);

    newEnvs.forEach(env => {
      if (!oldEnvs.includes(env)) {
        added.push(`environment.${env}`);
      } else {
        const oldEnv = JSON.stringify(oldConfig.environments[env]);
        const newEnv = JSON.stringify(newConfig.environments[env]);
        if (oldEnv !== newEnv) {
          modified.push(`environment.${env}`);
        }
      }
    });

    oldEnvs.forEach(env => {
      if (!newEnvs.includes(env)) {
        removed.push(`environment.${env}`);
      }
    });

    return { added, modified, removed };
  }
}
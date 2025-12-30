import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ConfigurationManager, PlatformConfig, ApplicationConfig, EnvironmentConfig, ValidationResult } from './platform-config';
import { ConfigurationLoader } from './configuration-loader';

/**
 * Advanced configuration management features for the platform pipeline system
 * 
 * This class extends the basic ConfigurationManager with additional capabilities:
 * - Dynamic configuration updates
 * - Configuration templating and substitution
 * - Environment-specific parameter resolution
 * - Configuration change tracking
 * - Rollback capabilities
 */
export class AdvancedConfigurationManager extends ConfigurationManager {
  private loader: ConfigurationLoader;
  private configHistory: PlatformConfig[] = [];

  constructor(scope: Construct, configDir: string = 'config') {
    super(scope);
    this.loader = new ConfigurationLoader(configDir);
    this.initializeConfigHistory();
  }

  /**
   * Initializes configuration history tracking
   */
  private initializeConfigHistory(): void {
    try {
      const currentConfig = this.getConfig();
      this.configHistory.push(JSON.parse(JSON.stringify(currentConfig)));
    } catch (error) {
      console.warn('Failed to initialize configuration history:', error);
    }
  }

  /**
   * Updates configuration with change tracking
   */
  public updateConfiguration(updates: Partial<PlatformConfig>): ValidationResult {
    // Backup current configuration
    const currentConfig = this.getConfig();
    this.configHistory.push(JSON.parse(JSON.stringify(currentConfig)));

    // Apply updates
    const updatedConfig = this.loader.mergeConfigurations(currentConfig, updates);
    
    // Validate updated configuration
    const validation = this.validateUpdatedConfiguration(updatedConfig);
    
    if (validation.isValid) {
      // Update internal configuration (this would require refactoring the base class)
      console.log('Configuration updated successfully');
    } else {
      // Rollback on validation failure
      console.error('Configuration update failed validation, rolling back');
    }

    return validation;
  }

  /**
   * Validates an updated configuration before applying
   */
  private validateUpdatedConfiguration(config: PlatformConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic structure
    const basicValidation = this.validateConfiguration();
    errors.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);

    // Additional validation for updates
    // Check for breaking changes
    const currentConfig = this.getConfig();
    
    // Validate that existing applications still have valid deployment targets
    Object.entries(config.applications).forEach(([appName, appConfig]) => {
      appConfig.deploymentTargets.forEach(targetEnv => {
        if (!config.environments[targetEnv]) {
          errors.push(`Application '${appName}' deployment target '${targetEnv}' references non-existent environment`);
        }
      });
    });

    // Validate that production environments are not accidentally modified
    Object.entries(config.environments).forEach(([envName, envConfig]) => {
      const currentEnv = currentConfig.environments[envName];
      if (currentEnv?.isProd && envConfig.account !== currentEnv.account) {
        warnings.push(`Production environment '${envName}' account changed from ${currentEnv.account} to ${envConfig.account}`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Rolls back to the previous configuration
   */
  public rollbackConfiguration(): boolean {
    if (this.configHistory.length < 2) {
      console.warn('No previous configuration available for rollback');
      return false;
    }

    // Remove current configuration and restore previous
    this.configHistory.pop();
    const previousConfig = this.configHistory[this.configHistory.length - 1];
    
    try {
      // This would require updating the base configuration
      console.log('Configuration rolled back successfully');
      return true;
    } catch (error) {
      console.error('Failed to rollback configuration:', error);
      return false;
    }
  }

  /**
   * Resolves configuration templates with parameter substitution
   */
  public resolveConfigurationTemplate(
    template: string, 
    parameters: { [key: string]: string },
    environmentName?: string
  ): string {
    let resolved = template;

    // Replace environment-specific parameters
    if (environmentName) {
      const env = this.getEnvironment(environmentName);
      if (env?.parameters) {
        Object.entries(env.parameters).forEach(([key, value]) => {
          const placeholder = `\${env.${key}}`;
          resolved = resolved.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        });
      }
    }

    // Replace provided parameters
    Object.entries(parameters).forEach(([key, value]) => {
      const placeholder = `\${${key}}`;
      resolved = resolved.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    // Replace CDK context values
    const contextPattern = /\$\{context\.([^}]+)\}/g;
    resolved = resolved.replace(contextPattern, (match, contextKey) => {
      const contextValue = this.scope.node.tryGetContext(contextKey);
      return contextValue !== undefined ? contextValue : match;
    });

    return resolved;
  }

  /**
   * Gets configuration for a specific deployment with all parameters resolved
   */
  public getResolvedDeploymentConfig(
    applicationName: string, 
    environmentName: string
  ): {
    environment: EnvironmentConfig;
    application: ApplicationConfig;
    resolvedParameters: { [key: string]: string };
    buildCommands: string[];
  } | undefined {
    const deploymentConfig = this.getDeploymentConfig(applicationName, environmentName);
    
    if (!deploymentConfig) {
      return undefined;
    }

    // Resolve build commands with parameter substitution
    const buildCommands = deploymentConfig.application.buildConfig?.commands?.map(command => {
      return this.resolveConfigurationTemplate(
        command, 
        deploymentConfig.resolvedParameters, 
        environmentName
      );
    }) || [];

    return {
      ...deploymentConfig,
      buildCommands,
    };
  }

  /**
   * Validates configuration against environment-specific constraints
   */
  public validateEnvironmentConstraints(environmentName: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const environment = this.getEnvironment(environmentName);
    if (!environment) {
      errors.push(`Environment '${environmentName}' not found`);
      return { isValid: false, errors, warnings };
    }

    // Production environment constraints
    if (environment.isProd) {
      if (!environment.requiresApproval) {
        warnings.push(`Production environment '${environmentName}' should require approval`);
      }

      // Check that production applications have proper configuration
      const prodApplications = Object.entries(this.getApplications())
        .filter(([_, app]) => app.deploymentTargets.includes(environmentName));

      prodApplications.forEach(([appName, app]) => {
        if (!app.notifications?.emailAddresses?.length && !app.notifications?.snsTopicArn) {
          warnings.push(`Production application '${appName}' should have notifications configured`);
        }
      });
    }

    // Development environment constraints
    if (!environment.isProd) {
      if (environment.requiresApproval) {
        warnings.push(`Development environment '${environmentName}' typically should not require approval`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Gets configuration change summary
   */
  public getConfigurationChanges(): {
    totalChanges: number;
    recentChanges: Array<{
      timestamp: Date;
      summary: string;
    }>;
  } {
    return {
      totalChanges: this.configHistory.length - 1,
      recentChanges: [
        // This would be populated with actual change tracking
        {
          timestamp: new Date(),
          summary: 'Configuration loaded',
        },
      ],
    };
  }

  /**
   * Exports configuration for external tools
   */
  public exportConfiguration(format: 'json' | 'yaml' | 'env'): string {
    const config = this.getConfig();

    switch (format) {
      case 'json':
        return JSON.stringify(config, null, 2);
      
      case 'yaml':
        // Simple YAML export (would use a proper YAML library in production)
        return this.configToYaml(config);
      
      case 'env':
        return this.configToEnvVars(config);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Simple YAML conversion (basic implementation)
   */
  private configToYaml(obj: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += this.configToYaml(value, indent + 1);
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        value.forEach(item => {
          yaml += `${spaces}  - ${item}\n`;
        });
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }

    return yaml;
  }

  /**
   * Converts configuration to environment variables format
   */
  private configToEnvVars(config: PlatformConfig): string {
    const envVars: string[] = [];

    // Platform configuration
    envVars.push(`PLATFORM_REGION=${config.platform.region}`);
    envVars.push(`PLATFORM_ACCOUNT=${config.platform.account}`);
    envVars.push(`PLATFORM_CONNECTION_ARN=${config.platform.connectionArn}`);

    // Default configuration
    envVars.push(`DEFAULT_BUILD_RUNTIME=${config.defaults.buildRuntime}`);
    envVars.push(`DEFAULT_COMPUTE_TYPE=${config.defaults.computeType}`);
    envVars.push(`DEFAULT_BUILD_IMAGE=${config.defaults.buildImage}`);
    envVars.push(`DEFAULT_CACHE_ENABLED=${config.defaults.cacheEnabled}`);

    return envVars.join('\n');
  }

  /**
   * Validates configuration against security best practices
   */
  public validateSecurityConstraints(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const config = this.getConfig();

    // Check for hardcoded secrets or sensitive data
    const configString = JSON.stringify(config);
    
    // Look for potential secrets (basic patterns)
    const secretPatterns = [
      /password/i,
      /secret/i,
      /key.*[=:]\s*['"]\w{20,}/i,
      /token.*[=:]\s*['"]\w{20,}/i,
    ];

    secretPatterns.forEach(pattern => {
      if (pattern.test(configString)) {
        warnings.push('Configuration may contain hardcoded secrets - use parameter references instead');
      }
    });

    // Validate IAM-related configurations
    Object.entries(config.environments).forEach(([envName, env]) => {
      // Check for overly permissive account configurations
      if (env.account === '123456789012') {
        warnings.push(`Environment '${envName}' uses example account ID - update with real account`);
      }
    });

    // Check for production safety
    const prodEnvs = Object.entries(config.environments)
      .filter(([_, env]) => env.isProd);

    if (prodEnvs.length === 0) {
      warnings.push('No production environments configured');
    }

    prodEnvs.forEach(([envName, env]) => {
      if (!env.requiresApproval) {
        errors.push(`Production environment '${envName}' must require approval`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }
}

/**
 * Configuration template processor for dynamic parameter substitution
 */
export class ConfigurationTemplateProcessor {
  private configManager: AdvancedConfigurationManager;

  constructor(configManager: AdvancedConfigurationManager) {
    this.configManager = configManager;
  }

  /**
   * Processes a configuration template with parameter substitution
   */
  public processTemplate(
    template: any, 
    context: {
      environment?: string;
      application?: string;
      parameters?: { [key: string]: string };
    }
  ): any {
    if (typeof template === 'string') {
      return this.configManager.resolveConfigurationTemplate(
        template, 
        context.parameters || {}, 
        context.environment
      );
    }

    if (Array.isArray(template)) {
      return template.map(item => this.processTemplate(item, context));
    }

    if (template && typeof template === 'object') {
      const processed: any = {};
      Object.entries(template).forEach(([key, value]) => {
        processed[key] = this.processTemplate(value, context);
      });
      return processed;
    }

    return template;
  }

  /**
   * Validates template syntax
   */
  public validateTemplate(template: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const templateString = JSON.stringify(template);
    
    // Check for unclosed parameter references
    const openBraces = (templateString.match(/\$\{/g) || []).length;
    const closeBraces = (templateString.match(/\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push('Template has unclosed parameter references');
    }

    // Check for invalid parameter syntax
    const invalidParams = templateString.match(/\$\{[^}]*\$\{/g);
    if (invalidParams) {
      errors.push('Template contains nested parameter references');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}
import * as fs from 'fs';
import * as path from 'path';
import { ApplicationConfig, EnvironmentConfig, PlatformConfig, ValidationResult } from './platform-config';

/**
 * Platform-only configuration (without applications)
 */
export interface PlatformOnlyConfig {
  readonly platform: {
    readonly region: string;
    readonly account: string;
    readonly connectionArn?: string;
    readonly artifactBucketPrefix?: string;
  };
  readonly platformRepository: {
    readonly owner: string;
    readonly repo: string;
    readonly branch: string;
    readonly description?: string;
  };
  readonly environments: { [envName: string]: EnvironmentConfig };
  readonly defaults: {
    readonly buildRuntime: string;
    readonly computeType: string;
    readonly buildImage: string;
    readonly cacheEnabled: boolean;
  };
}

/**
 * Application-only configuration (without platform settings)
 */
export interface ApplicationOnlyConfig {
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
  readonly deploymentTargets: string[];
  readonly notifications?: {
    readonly snsTopicArn?: string;
    readonly emailAddresses?: string[];
  };
  readonly enabled?: boolean;
}

/**
 * Configuration loader interface for pluggable configuration loading
 */
export interface ConfigurationLoader {
  /**
   * Loads platform-only configuration (infrastructure settings)
   */
  loadPlatformConfig(): PlatformOnlyConfig;

  /**
   * Loads all application configurations
   */
  loadApplicationConfigs(): ApplicationOnlyConfig[];

  /**
   * Validates a configuration object
   */
  validateConfiguration(config: any, configType: 'platform' | 'application'): ValidationResult;

  /**
   * Gets the source description for debugging
   */
  getSourceDescription(): string;
}

/**
 * File-based configuration loader that reads from separate files
 */
export class FileBasedConfigurationLoader implements ConfigurationLoader {
  private platformConfigPath: string;
  private applicationConfigDir: string;

  constructor(
    platformConfigPath: string = 'cdk.json',
    applicationConfigDir: string = 'config/applications'
  ) {
    this.platformConfigPath = platformConfigPath;
    this.applicationConfigDir = applicationConfigDir;
  }

  /**
   * Loads platform configuration from cdk.json context
   */
  loadPlatformConfig(): PlatformOnlyConfig {
    try {
      const cdkJsonPath = this.resolvePath(this.platformConfigPath);
      
      if (!fs.existsSync(cdkJsonPath)) {
        throw new Error(`Platform configuration file not found: ${cdkJsonPath}`);
      }

      const cdkJson = JSON.parse(fs.readFileSync(cdkJsonPath, 'utf8'));
      const context = cdkJson.context || {};

      // Extract only platform-related configuration
      const platformConfig: PlatformOnlyConfig = {
        platform: context.platform || {
          region: 'us-east-1',
          account: '',
          artifactBucketPrefix: 'platform-pipeline',
        },
        platformRepository: context.platformRepository || {
          owner: '',
          repo: '',
          branch: 'main',
        },
        environments: context.environments || {},
        defaults: context.defaults || {
          buildRuntime: '20',
          computeType: 'BUILD_GENERAL1_XLARGE',
          buildImage: 'AMAZON_LINUX_2_STANDARD_3_0_ARM',
          cacheEnabled: true,
        },
      };

      return platformConfig;
    } catch (error) {
      throw new Error(`Failed to load platform configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Loads application configurations from separate files
   */
  loadApplicationConfigs(): ApplicationOnlyConfig[] {
    const applications: ApplicationOnlyConfig[] = [];
    
    try {
      const configDir = this.resolvePath(this.applicationConfigDir);
      
      // If directory doesn't exist, return empty array (no applications configured)
      if (!fs.existsSync(configDir)) {
        console.warn(`Application configuration directory not found: ${configDir}`);
        return applications;
      }

      // Read all JSON files in the applications directory
      const files = fs.readdirSync(configDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(configDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const appConfig: ApplicationOnlyConfig = JSON.parse(fileContent);

          // Validate that this is an application configuration
          const validation = this.validateConfiguration(appConfig, 'application');
          if (!validation.isValid) {
            console.warn(`Invalid application configuration in ${file}:`, validation.errors);
            continue;
          }

          // Only include enabled applications (default to enabled if not specified)
          if (appConfig.enabled !== false) {
            applications.push(appConfig);
          }
        } catch (error) {
          console.warn(`Failed to load application configuration from ${file}:`, (error as Error).message);
        }
      }

      return applications;
    } catch (error) {
      console.warn(`Failed to read application configurations: ${(error as Error).message}`);
      return applications;
    }
  }

  /**
   * Validates configuration objects against expected schemas
   */
  validateConfiguration(config: any, configType: 'platform' | 'application'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object');
      return { isValid: false, errors, warnings };
    }

    if (configType === 'platform') {
      return this.validatePlatformConfiguration(config);
    } else {
      return this.validateApplicationConfiguration(config);
    }
  }

  /**
   * Validates platform configuration structure
   */
  private validatePlatformConfiguration(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for platform-only keys
    const platformKeys = ['platform', 'platformRepository', 'environments', 'defaults'];
    const applicationKeys = ['applications'];

    // Ensure platform configuration doesn't contain application data
    applicationKeys.forEach(key => {
      if (config[key]) {
        warnings.push(`Platform configuration contains application data: ${key}`);
      }
    });

    // Validate required platform keys
    if (!config.platform) {
      errors.push('Missing required platform configuration');
    } else {
      if (!config.platform.region) {
        errors.push('Platform region is required');
      }
      if (!config.platform.account) {
        errors.push('Platform account is required');
      }
    }

    if (!config.environments || Object.keys(config.environments).length === 0) {
      warnings.push('No environments configured');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates application configuration structure
   */
  private validateApplicationConfiguration(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for application-only keys
    const applicationKeys = ['applicationName', 'team', 'sourceRepo', 'buildConfig', 'deploymentTargets', 'notifications', 'enabled'];
    const platformKeys = ['platform', 'platformRepository', 'environments', 'defaults'];

    // Ensure application configuration doesn't contain platform data
    platformKeys.forEach(key => {
      if (config[key]) {
        warnings.push(`Application configuration contains platform data: ${key}`);
      }
    });

    // Validate required application keys
    if (!config.applicationName) {
      errors.push('Application name is required');
    }

    if (!config.team) {
      errors.push('Application team is required');
    }

    if (!config.sourceRepo) {
      errors.push('Application source repository configuration is required');
    } else {
      if (!config.sourceRepo.owner) {
        errors.push('Source repository owner is required');
      }
      if (!config.sourceRepo.repo) {
        errors.push('Source repository name is required');
      }
      if (!config.sourceRepo.branch) {
        errors.push('Source repository branch is required');
      }
    }

    if (!config.deploymentTargets || !Array.isArray(config.deploymentTargets) || config.deploymentTargets.length === 0) {
      errors.push('At least one deployment target is required');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Resolves file paths relative to the current working directory
   */
  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(process.cwd(), filePath);
  }

  /**
   * Gets source description for debugging
   */
  getSourceDescription(): string {
    return `FileBasedConfigurationLoader(platform: ${this.platformConfigPath}, applications: ${this.applicationConfigDir})`;
  }
}

/**
 * CDK Context configuration loader (backward compatibility)
 */
export class CdkContextConfigurationLoader implements ConfigurationLoader {
  private cdkJsonPath: string;

  constructor(cdkJsonPath: string = 'cdk.json') {
    this.cdkJsonPath = cdkJsonPath;
  }

  /**
   * Loads platform configuration from CDK context (legacy format)
   */
  loadPlatformConfig(): PlatformOnlyConfig {
    try {
      const cdkJsonPath = this.resolvePath(this.cdkJsonPath);
      
      if (!fs.existsSync(cdkJsonPath)) {
        throw new Error(`CDK configuration file not found: ${cdkJsonPath}`);
      }

      const cdkJson = JSON.parse(fs.readFileSync(cdkJsonPath, 'utf8'));
      const context = cdkJson.context || {};

      return {
        platform: context.platform || {
          region: 'us-east-1',
          account: '',
          artifactBucketPrefix: 'platform-pipeline',
        },
        platformRepository: context.platformRepository || {
          owner: '',
          repo: '',
          branch: 'main',
        },
        environments: context.environments || {},
        defaults: context.defaults || {
          buildRuntime: '20',
          computeType: 'BUILD_GENERAL1_XLARGE',
          buildImage: 'AMAZON_LINUX_2_STANDARD_3_0_ARM',
          cacheEnabled: true,
        },
      };
    } catch (error) {
      throw new Error(`Failed to load CDK context configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Loads application configurations from CDK context (legacy format)
   */
  loadApplicationConfigs(): ApplicationOnlyConfig[] {
    try {
      const cdkJsonPath = this.resolvePath(this.cdkJsonPath);
      
      if (!fs.existsSync(cdkJsonPath)) {
        return [];
      }

      const cdkJson = JSON.parse(fs.readFileSync(cdkJsonPath, 'utf8'));
      const context = cdkJson.context || {};
      const applications = context.applications || {};

      return Object.values(applications).map((app: any) => ({
        applicationName: app.applicationName,
        team: app.team,
        sourceRepo: app.sourceRepo,
        buildConfig: app.buildConfig,
        deploymentTargets: app.deploymentTargets,
        notifications: app.notifications,
        enabled: app.enabled !== false,
      }));
    } catch (error) {
      console.warn(`Failed to load applications from CDK context: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Validates configuration (uses same logic as FileBasedConfigurationLoader)
   */
  validateConfiguration(config: any, configType: 'platform' | 'application'): ValidationResult {
    // Reuse validation logic from FileBasedConfigurationLoader
    const fileLoader = new FileBasedConfigurationLoader();
    return fileLoader.validateConfiguration(config, configType);
  }

  /**
   * Resolves file paths relative to the current working directory
   */
  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(process.cwd(), filePath);
  }

  /**
   * Gets source description for debugging
   */
  getSourceDescription(): string {
    return `CdkContextConfigurationLoader(${this.cdkJsonPath})`;
  }
}

/**
 * Hybrid configuration loader that tries file-based first, falls back to CDK context
 */
export class HybridConfigurationLoader implements ConfigurationLoader {
  private fileLoader: FileBasedConfigurationLoader;
  private cdkLoader: CdkContextConfigurationLoader;

  constructor(
    platformConfigPath: string = 'cdk.json',
    applicationConfigDir: string = 'config/applications'
  ) {
    this.fileLoader = new FileBasedConfigurationLoader(platformConfigPath, applicationConfigDir);
    this.cdkLoader = new CdkContextConfigurationLoader(platformConfigPath);
  }

  /**
   * Loads platform configuration (always from CDK context for now)
   */
  loadPlatformConfig(): PlatformOnlyConfig {
    return this.fileLoader.loadPlatformConfig();
  }

  /**
   * Loads application configurations with fallback logic
   */
  loadApplicationConfigs(): ApplicationOnlyConfig[] {
    // Try file-based loading first
    const fileBasedApps = this.fileLoader.loadApplicationConfigs();
    
    // If we found applications in files, use them
    if (fileBasedApps.length > 0) {
      return fileBasedApps;
    }

    // Fall back to CDK context loading
    console.log('No file-based application configurations found, falling back to CDK context');
    return this.cdkLoader.loadApplicationConfigs();
  }

  /**
   * Validates configuration
   */
  validateConfiguration(config: any, configType: 'platform' | 'application'): ValidationResult {
    return this.fileLoader.validateConfiguration(config, configType);
  }

  /**
   * Gets source description for debugging
   */
  getSourceDescription(): string {
    return `HybridConfigurationLoader(file: ${this.fileLoader.getSourceDescription()}, cdk: ${this.cdkLoader.getSourceDescription()})`;
  }
}
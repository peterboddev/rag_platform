import * as fs from 'fs';
import * as path from 'path';
import { PlatformConfig, ApplicationConfig, EnvironmentConfig, ValidationResult } from './platform-config';

/**
 * Configuration file loader for platform pipeline system
 * 
 * This utility loads configuration from various sources:
 * - JSON configuration files
 * - Environment variables
 * - CDK context values
 * - Default values
 */
export class ConfigurationLoader {
  private readonly configDir: string;

  constructor(configDir: string = 'config') {
    this.configDir = configDir;
  }

  /**
   * Loads configuration from files in the config directory
   */
  public loadFromFiles(): Partial<PlatformConfig> {
    const config: any = {
      environments: {},
      applications: {},
    };

    // Load environment configurations
    const envDir = path.join(this.configDir, 'environments');
    if (fs.existsSync(envDir)) {
      const envFiles = fs.readdirSync(envDir).filter(file => file.endsWith('.json'));
      
      envFiles.forEach(file => {
        try {
          const filePath = path.join(envDir, file);
          const envConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          if (envConfig.environments) {
            config.environments = { ...config.environments, ...envConfig.environments };
          }
        } catch (error) {
          console.warn(`Failed to load environment config from ${file}:`, error);
        }
      });
    }

    // Load application configurations
    const appDir = path.join(this.configDir, 'applications');
    if (fs.existsSync(appDir)) {
      const appFiles = fs.readdirSync(appDir).filter(file => file.endsWith('.json'));
      
      appFiles.forEach(file => {
        try {
          const filePath = path.join(appDir, file);
          const appConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          // Use filename (without extension) as application key if not specified
          const appName = appConfig.applicationName || path.basename(file, '.json');
          
          if (!config.applications) {
            config.applications = {};
          }
          
          config.applications[appName] = appConfig;
        } catch (error) {
          console.warn(`Failed to load application config from ${file}:`, error);
        }
      });
    }

    return config;
  }

  /**
   * Loads configuration from environment variables
   */
  public loadFromEnvironment(): Partial<PlatformConfig> {
    const config: any = {};

    // Platform configuration from environment variables
    if (process.env.PLATFORM_REGION || process.env.PLATFORM_ACCOUNT || process.env.PLATFORM_CONNECTION_ARN) {
      config.platform = {
        region: process.env.PLATFORM_REGION || '',
        account: process.env.PLATFORM_ACCOUNT || '',
        connectionArn: process.env.PLATFORM_CONNECTION_ARN || '',
        artifactBucketPrefix: process.env.PLATFORM_ARTIFACT_BUCKET_PREFIX,
      };
    }

    // Default configuration from environment variables
    if (process.env.DEFAULT_BUILD_RUNTIME || process.env.DEFAULT_COMPUTE_TYPE) {
      config.defaults = {
        buildRuntime: process.env.DEFAULT_BUILD_RUNTIME || '18',
        computeType: process.env.DEFAULT_COMPUTE_TYPE || 'BUILD_GENERAL1_SMALL',
        buildImage: process.env.DEFAULT_BUILD_IMAGE || 'STANDARD_7_0',
        cacheEnabled: process.env.DEFAULT_CACHE_ENABLED !== 'false',
      };
    }

    return config;
  }

  /**
   * Saves configuration to a file
   */
  public saveConfiguration(config: PlatformConfig, filePath: string): void {
    try {
      const configJson = JSON.stringify(config, null, 2);
      fs.writeFileSync(filePath, configJson, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save configuration to ${filePath}: ${error}`);
    }
  }

  /**
   * Loads a specific application configuration file
   */
  public loadApplicationConfig(applicationName: string): ApplicationConfig | null {
    const filePath = path.join(this.configDir, 'applications', `${applicationName}.json`);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return config;
    } catch (error) {
      console.warn(`Failed to load application config for ${applicationName}:`, error);
      return null;
    }
  }

  /**
   * Saves an application configuration file
   */
  public saveApplicationConfig(applicationName: string, config: ApplicationConfig): void {
    const appDir = path.join(this.configDir, 'applications');
    
    // Ensure directory exists
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }

    const filePath = path.join(appDir, `${applicationName}.json`);
    
    try {
      const configJson = JSON.stringify(config, null, 2);
      fs.writeFileSync(filePath, configJson, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save application config for ${applicationName}: ${error}`);
    }
  }

  /**
   * Loads a specific environment configuration file
   */
  public loadEnvironmentConfig(environmentName: string): EnvironmentConfig | null {
    const filePath = path.join(this.configDir, 'environments', `${environmentName}.json`);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return config.environments?.[environmentName] || null;
    } catch (error) {
      console.warn(`Failed to load environment config for ${environmentName}:`, error);
      return null;
    }
  }

  /**
   * Lists all available application configuration files
   */
  public listApplicationConfigs(): string[] {
    const appDir = path.join(this.configDir, 'applications');
    
    if (!fs.existsSync(appDir)) {
      return [];
    }

    return fs.readdirSync(appDir)
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));
  }

  /**
   * Lists all available environment configuration files
   */
  public listEnvironmentConfigs(): string[] {
    const envDir = path.join(this.configDir, 'environments');
    
    if (!fs.existsSync(envDir)) {
      return [];
    }

    return fs.readdirSync(envDir)
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));
  }

  /**
   * Validates configuration files for syntax errors
   */
  public validateConfigurationFiles(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate environment configuration files
    const envDir = path.join(this.configDir, 'environments');
    if (fs.existsSync(envDir)) {
      const envFiles = fs.readdirSync(envDir).filter(file => file.endsWith('.json'));
      
      envFiles.forEach(file => {
        try {
          const filePath = path.join(envDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          JSON.parse(content);
        } catch (error) {
          errors.push(`Invalid JSON in environment config file ${file}: ${error}`);
        }
      });
    }

    // Validate application configuration files
    const appDir = path.join(this.configDir, 'applications');
    if (fs.existsSync(appDir)) {
      const appFiles = fs.readdirSync(appDir).filter(file => file.endsWith('.json'));
      
      appFiles.forEach(file => {
        try {
          const filePath = path.join(appDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const config = JSON.parse(content);
          
          // Basic validation
          if (!config.applicationName) {
            warnings.push(`Application config file ${file} is missing applicationName field`);
          }
          
          if (!config.sourceRepo) {
            errors.push(`Application config file ${file} is missing sourceRepo configuration`);
          }
        } catch (error) {
          errors.push(`Invalid JSON in application config file ${file}: ${error}`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Creates the configuration directory structure
   */
  public initializeConfigDirectory(): void {
    const dirs = [
      this.configDir,
      path.join(this.configDir, 'environments'),
      path.join(this.configDir, 'applications'),
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create .gitkeep files to ensure directories are tracked in git
    const gitkeepFiles = [
      path.join(this.configDir, 'environments', '.gitkeep'),
      path.join(this.configDir, 'applications', '.gitkeep'),
    ];

    gitkeepFiles.forEach(file => {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, '', 'utf8');
      }
    });
  }

  /**
   * Merges configuration from multiple sources with proper precedence
   * Order: files < environment variables < CDK context
   */
  public mergeConfigurations(...configs: Partial<PlatformConfig>[]): PlatformConfig {
    const merged: any = {
      platform: {
        region: '',
        account: '',
        connectionArn: '',
      },
      environments: {},
      applications: {},
      defaults: {
        buildRuntime: '18',
        computeType: 'BUILD_GENERAL1_SMALL',
        buildImage: 'STANDARD_7_0',
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
   * Loads configuration with full precedence chain:
   * 1. Configuration files
   * 2. Environment variables  
   * 3. CDK context (handled by ConfigurationManager)
   */
  public loadCompleteConfiguration(): Partial<PlatformConfig> {
    const fileConfig = this.loadFromFiles();
    const envConfig = this.loadFromEnvironment();
    
    return this.mergeConfigurations(fileConfig, envConfig);
  }

  /**
   * Saves environment-specific configuration
   */
  public saveEnvironmentConfig(environmentName: string, config: EnvironmentConfig): void {
    const envDir = path.join(this.configDir, 'environments');
    
    // Ensure directory exists
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true });
    }

    const filePath = path.join(envDir, `${environmentName}.json`);
    
    const envConfigFile = {
      environments: {
        [environmentName]: config,
      },
    };
    
    try {
      const configJson = JSON.stringify(envConfigFile, null, 2);
      fs.writeFileSync(filePath, configJson, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save environment config for ${environmentName}: ${error}`);
    }
  }

  /**
   * Updates an existing configuration file with new values
   */
  public updateConfigurationFile(filePath: string, updates: any): void {
    let existingConfig = {};
    
    // Load existing configuration if file exists
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        existingConfig = JSON.parse(content);
      } catch (error) {
        console.warn(`Failed to load existing config from ${filePath}, creating new file`);
      }
    }

    // Merge updates with existing configuration
    const mergedConfig = this.deepMerge(existingConfig, updates);
    
    try {
      const configJson = JSON.stringify(mergedConfig, null, 2);
      fs.writeFileSync(filePath, configJson, 'utf8');
    } catch (error) {
      throw new Error(`Failed to update configuration file ${filePath}: ${error}`);
    }
  }

  /**
   * Deep merge utility for configuration objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Backs up current configuration before making changes
   */
  public backupConfiguration(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.configDir, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupPath = path.join(backupDir, `config-backup-${timestamp}.json`);
    
    try {
      const currentConfig = this.loadFromFiles();
      const configJson = JSON.stringify(currentConfig, null, 2);
      fs.writeFileSync(backupPath, configJson, 'utf8');
      
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create configuration backup: ${error}`);
    }
  }

  /**
   * Restores configuration from a backup file
   */
  public restoreConfiguration(backupPath: string): void {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    try {
      const backupContent = fs.readFileSync(backupPath, 'utf8');
      const backupConfig = JSON.parse(backupContent);
      
      // Restore environment configurations
      if (backupConfig.environments) {
        Object.entries(backupConfig.environments).forEach(([envName, envConfig]: [string, any]) => {
          this.saveEnvironmentConfig(envName, envConfig);
        });
      }

      // Restore application configurations
      if (backupConfig.applications) {
        Object.entries(backupConfig.applications).forEach(([appName, appConfig]: [string, any]) => {
          this.saveApplicationConfig(appName, appConfig);
        });
      }

      console.log(`Configuration restored from backup: ${backupPath}`);
    } catch (error) {
      throw new Error(`Failed to restore configuration from backup: ${error}`);
    }
  }
}
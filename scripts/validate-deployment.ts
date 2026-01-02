#!/usr/bin/env node

/**
 * Deployment validation script for platform pipeline system
 * 
 * This script validates deployments and environment promotions to ensure
 * system integrity and proper configuration before proceeding with deployments.
 */

import { ConfigurationManager, ConfigurationUtils } from '../lib/config/platform-config';
import { HybridConfigurationLoader } from '../lib/config/configuration-loaders';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface ValidationOptions {
  environment?: string;
  mode?: 'deployment' | 'promotion' | 'configuration';
  verbose?: boolean;
}

class DeploymentValidator {
  private configManager: ConfigurationManager;
  private options: ValidationOptions;
  private loadedContext: any;

  constructor(options: ValidationOptions = {}) {
    this.options = options;
    
    // Load context from cdk.json first
    this.loadedContext = this.loadCdkContext();
    
    console.log('🔍 Debug: Creating CDK App with context keys:', Object.keys(this.loadedContext));
    console.log('🔍 Debug: Context environments:', Object.keys(this.loadedContext.environments || {}));
    console.log('🔍 Debug: Context applications:', Object.keys(this.loadedContext.applications || {}));
    
    // Create a temporary CDK app for configuration validation
    const app = new cdk.App({
      context: this.loadedContext
    });
    const tempConstruct = new Construct(app, 'ValidationConstruct');
    
    // Verify the construct can see the context
    console.log('🔍 Debug: CDK construct context check...');
    console.log('🔍 Debug: Construct sees environments:', tempConstruct.node.tryGetContext('environments'));
    console.log('🔍 Debug: Construct sees applications:', tempConstruct.node.tryGetContext('applications'));
    
    // Use HybridConfigurationLoader to load from both CDK context and separate files
    // This ensures we get environments from cdk.json and applications from config/applications/*.json
    const hybridLoader = new HybridConfigurationLoader();
    console.log('🔍 Debug: Using configuration loader:', hybridLoader.getSourceDescription());
    
    // Add debug logging to see what the loader finds
    console.log('🔍 Debug: Testing configuration loader directly...');
    try {
      const platformConfig = hybridLoader.loadPlatformConfig();
      console.log('🔍 Debug: Platform config loaded - environments:', Object.keys(platformConfig.environments));
      console.log('🔍 Debug: Platform config loaded - platform:', platformConfig.platform);
      
      const applicationConfigs = hybridLoader.loadApplicationConfigs();
      console.log('🔍 Debug: Application configs loaded - count:', applicationConfigs.length);
      applicationConfigs.forEach(app => {
        console.log(`🔍 Debug: Found application: ${app.applicationName} by ${app.team}`);
      });
    } catch (error) {
      console.error('🔍 Debug: Configuration loader failed:', error);
    }
    
    // Create ConfigurationManager with the CDK construct and hybrid loader
    this.configManager = new ConfigurationManager(tempConstruct, hybridLoader);
    
    // Add final debug check to see what ConfigurationManager sees
    console.log('🔍 Debug: Final ConfigurationManager check...');
    try {
      const config = this.configManager.getConfig();
      console.log('🔍 Debug: Final - environments:', Object.keys(config.environments));
      console.log('🔍 Debug: Final - applications:', Object.keys(config.applications));
    } catch (error) {
      console.error('🔍 Debug: Final ConfigurationManager check failed:', error);
    }
  }

  /**
   * Loads CDK context from cdk.json file
   */
  private loadCdkContext(): any {
    try {
      const fs = require('fs');
      const path = require('path');
      
      console.log('🔍 Debug: Current working directory:', process.cwd());
      console.log('🔍 Debug: Directory contents:', fs.readdirSync(process.cwd()));
      
      // Look for cdk.json in current directory and parent directories
      let currentDir = process.cwd();
      let cdkJsonPath: string | null = null;
      
      while (currentDir !== path.dirname(currentDir)) {
        const potentialPath = path.join(currentDir, 'cdk.json');
        console.log('🔍 Debug: Checking for cdk.json at:', potentialPath);
        if (fs.existsSync(potentialPath)) {
          cdkJsonPath = potentialPath;
          console.log('✅ Debug: Found cdk.json at:', cdkJsonPath);
          break;
        }
        currentDir = path.dirname(currentDir);
      }
      
      if (!cdkJsonPath) {
        console.warn('⚠️  cdk.json not found, using empty context');
        console.log('🔍 Debug: Searched directories up to:', currentDir);
        return {};
      }
      
      const cdkJson = JSON.parse(fs.readFileSync(cdkJsonPath, 'utf8'));
      const context = cdkJson.context || {};
      
      console.log('✅ Debug: Loaded CDK context with keys:', Object.keys(context));
      console.log('🔍 Debug: Environments found:', Object.keys(context.environments || {}));
      console.log('🔍 Debug: Applications found:', Object.keys(context.applications || {}));
      
      return context;
    } catch (error) {
      console.warn('⚠️  Failed to load cdk.json context:', (error as Error).message);
      console.log('🔍 Debug: Error details:', error);
      return {};
    }
  }

  /**
   * Main validation entry point
   */
  async validate(): Promise<boolean> {
    try {
      console.log('🔍 Starting deployment validation...');
      
      if (this.options.verbose) {
        console.log(`   Mode: ${this.options.mode || 'deployment'}`);
        console.log(`   Environment: ${this.options.environment || 'all'}`);
      }

      // Perform configuration validation
      const configValid = await this.validateConfiguration();
      if (!configValid) {
        return false;
      }

      // Perform environment-specific validation if specified
      if (this.options.environment) {
        const envValid = await this.validateEnvironment(this.options.environment);
        if (!envValid) {
          return false;
        }
      }

      // Perform mode-specific validation
      switch (this.options.mode) {
        case 'promotion':
          return await this.validatePromotion();
        case 'configuration':
          return await this.validateConfigurationChanges();
        default:
          return await this.validateDeployment();
      }

    } catch (error) {
      console.error('❌ Validation failed with error:', error);
      return false;
    }
  }

  /**
   * Validates the overall configuration
   */
  private async validateConfiguration(): Promise<boolean> {
    console.log('📋 Validating platform configuration...');
    
    try {
      // Add debug logging to see what the ConfigurationManager sees
      console.log('🔍 Debug: ConfigurationManager context check...');
      console.log('🔍 Debug: Configuration source:', this.configManager.getConfigurationSource());
      
      const config = this.configManager.getConfig();
      console.log('🔍 Debug: ConfigManager sees environments:', Object.keys(config.environments));
      console.log('🔍 Debug: ConfigManager sees applications:', Object.keys(config.applications));
      console.log('🔍 Debug: ConfigManager platform config:', config.platform);
      
      // Add more detailed debug info about what was loaded
      console.log('🔍 Debug: Environment details:');
      Object.entries(config.environments).forEach(([name, env]) => {
        console.log(`  - ${name}: ${env.name} (${env.account}/${env.region})`);
      });
      
      console.log('🔍 Debug: Application details:');
      Object.entries(config.applications).forEach(([name, app]) => {
        console.log(`  - ${name}: ${app.applicationName} by ${app.team} (targets: ${app.deploymentTargets.join(', ')})`);
      });
      
      this.configManager.validateOrThrow();
      console.log('✅ Configuration validation passed');
      return true;
    } catch (error) {
      console.error('❌ Configuration validation failed:', error);
      return false;
    }
  }

  /**
   * Validates a specific environment configuration
   */
  private async validateEnvironment(environmentName: string): Promise<boolean> {
    console.log(`🌍 Validating environment: ${environmentName}`);
    
    const environment = this.configManager.getEnvironment(environmentName);
    if (!environment) {
      console.error(`❌ Environment '${environmentName}' not found`);
      return false;
    }

    // Validate environment configuration
    if (!environment.account || !environment.region) {
      console.error(`❌ Environment '${environmentName}' missing required account or region`);
      return false;
    }

    // Validate account ID format
    if (!/^\d{12}$/.test(environment.account)) {
      console.error(`❌ Environment '${environmentName}' has invalid account ID format`);
      return false;
    }

    // Validate region format
    if (!/^[a-z]{2}-[a-z]+-\d+$/.test(environment.region)) {
      console.warn(`⚠️  Environment '${environmentName}' region may not be valid AWS region`);
    }

    console.log(`✅ Environment '${environmentName}' validation passed`);
    return true;
  }

  /**
   * Validates deployment readiness
   */
  private async validateDeployment(): Promise<boolean> {
    console.log('🚀 Validating deployment readiness...');
    
    const applications = this.configManager.getEnabledApplications();
    const environments = this.configManager.getEnvironments();

    // Validate that all applications have valid deployment targets
    for (const [appName, appConfig] of Object.entries(applications)) {
      for (const targetEnv of appConfig.deploymentTargets) {
        if (!environments[targetEnv]) {
          console.error(`❌ Application '${appName}' references unknown environment '${targetEnv}'`);
          return false;
        }
      }
    }

    // Validate resource naming conventions
    const namingValidation = ConfigurationUtils.validateResourceNames(this.configManager.getConfig());
    if (!namingValidation.isValid) {
      console.error('❌ Resource naming validation failed:');
      namingValidation.errors.forEach(error => console.error(`   - ${error}`));
      return false;
    }

    console.log('✅ Deployment validation passed');
    return true;
  }

  /**
   * Validates environment promotion readiness
   */
  private async validatePromotion(): Promise<boolean> {
    console.log('🔄 Validating environment promotion...');
    
    if (!this.options.environment) {
      console.error('❌ Environment must be specified for promotion validation');
      return false;
    }

    const targetEnv = this.configManager.getEnvironment(this.options.environment);
    if (!targetEnv) {
      console.error(`❌ Target environment '${this.options.environment}' not found`);
      return false;
    }

    // Validate promotion prerequisites
    if (targetEnv.requiresApproval && targetEnv.isProd) {
      console.log('📋 Production environment promotion requires manual approval');
    }

    // Validate deployment targets
    const deploymentValidation = ConfigurationUtils.validateDeploymentTargets(this.configManager.getConfig());
    if (!deploymentValidation.isValid) {
      console.error('❌ Deployment target validation failed:');
      deploymentValidation.errors.forEach(error => console.error(`   - ${error}`));
      return false;
    }

    console.log(`✅ Promotion to '${this.options.environment}' validated`);
    return true;
  }

  /**
   * Validates configuration changes
   */
  private async validateConfigurationChanges(): Promise<boolean> {
    console.log('🔧 Validating configuration changes...');
    
    // This would typically compare against a previous configuration
    // For now, we'll validate the current configuration structure
    const config = this.configManager.getConfig();
    const schemaValidation = ConfigurationUtils.validateConfigSchema(config);
    
    if (!schemaValidation.isValid) {
      console.error('❌ Configuration schema validation failed:');
      schemaValidation.errors.forEach(error => console.error(`   - ${error}`));
      return false;
    }

    if (schemaValidation.warnings.length > 0) {
      console.warn('⚠️  Configuration warnings:');
      schemaValidation.warnings.forEach(warning => console.warn(`   - ${warning}`));
    }

    console.log('✅ Configuration changes validated');
    return true;
  }

  /**
   * Generates a validation report
   */
  generateReport(): any {
    const config = this.configManager.getConfig();
    const validation = this.configManager.validateConfiguration();
    
    return {
      timestamp: new Date().toISOString(),
      environment: this.options.environment,
      mode: this.options.mode,
      configuration: {
        applicationCount: Object.keys(config.applications).length,
        environmentCount: Object.keys(config.environments).length,
        enabledApplications: Object.keys(this.configManager.getEnabledApplications()).length,
      },
      validation: {
        isValid: validation.isValid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
        errors: validation.errors,
        warnings: validation.warnings,
      },
    };
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options: ValidationOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--environment':
        options.environment = args[++i];
        break;
      case '--mode':
        options.mode = args[++i] as 'deployment' | 'promotion' | 'configuration';
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
Usage: validate-deployment [options]

Options:
  --environment <name>    Validate specific environment
  --mode <type>          Validation mode: deployment, promotion, configuration
  --verbose              Enable verbose output
  --help                 Show this help message

Examples:
  validate-deployment --environment prod --mode promotion
  validate-deployment --mode configuration --verbose
        `);
        process.exit(0);
    }
  }

  const validator = new DeploymentValidator(options);
  const isValid = await validator.validate();

  if (options.verbose) {
    const report = validator.generateReport();
    console.log('\n📊 Validation Report:');
    console.log(JSON.stringify(report, null, 2));
  }

  process.exit(isValid ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Validation script failed:', error);
    process.exit(1);
  });
}

export { DeploymentValidator, ValidationOptions };
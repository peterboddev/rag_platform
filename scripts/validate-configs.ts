#!/usr/bin/env node

/**
 * Configuration validation script for platform pipeline system
 * 
 * This script validates all configuration files and ensures they meet
 * the platform pipeline requirements before deployment.
 */

import { ConfigurationManager, ConfigurationUtils } from '../lib/config/platform-config';
import { HybridConfigurationLoader } from '../lib/config/configuration-loaders';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

class ConfigurationValidator {
  private configManager: ConfigurationManager;
  private loader: HybridConfigurationLoader;

  constructor() {
    // Create a CDK app with the actual context from cdk.json
    const app = new cdk.App({
      context: this.loadCdkContext()
    });
    const tempConstruct = new Construct(app, 'ConfigValidationConstruct');
    this.configManager = new ConfigurationManager(tempConstruct);
    
    // Initialize hybrid configuration loader
    this.loader = new HybridConfigurationLoader();
  }

  /**
   * Loads CDK context from cdk.json file
   */
  private loadCdkContext(): any {
    try {
      const cdkJsonPath = path.join(process.cwd(), 'cdk.json');
      if (fs.existsSync(cdkJsonPath)) {
        const cdkJson = JSON.parse(fs.readFileSync(cdkJsonPath, 'utf8'));
        return cdkJson.context || {};
      }
    } catch (error) {
      console.warn('⚠️  Could not load CDK context from cdk.json:', error);
    }
    return {};
  }

  /**
   * Main validation entry point
   */
  async validateAll(): Promise<boolean> {
    console.log('🔍 Starting configuration validation...');
    
    try {
      // Validate platform configuration using hybrid loader
      const platformValid = await this.validateCdkContext();
      if (!platformValid) {
        return false;
      }

      // Validate application configuration files using hybrid loader
      const appConfigsValid = await this.validateApplicationConfigs();
      if (!appConfigsValid) {
        return false;
      }

      // Validate platform configuration using ConfigurationManager
      const platformManagerValid = await this.validatePlatformConfiguration();
      if (!platformManagerValid) {
        return false;
      }

      // Validate cross-references and dependencies
      const dependenciesValid = await this.validateDependencies();
      if (!dependenciesValid) {
        return false;
      }

      console.log('✅ All configuration validation passed');
      return true;

    } catch (error) {
      console.error('❌ Configuration validation failed with error:', error);
      return false;
    }
  }

  /**
   * Validates CDK context configuration
   */
  private async validateCdkContext(): Promise<boolean> {
    console.log('📋 Validating platform configuration...');
    
    try {
      // Load platform config using hybrid loader
      const platformConfig = this.loader.loadPlatformConfig();
      
      // Validate platform configuration structure
      const validation = this.loader.validateConfiguration(platformConfig, 'platform');
      if (!validation.isValid) {
        console.error('❌ Platform configuration validation failed:');
        validation.errors.forEach(error => console.error(`   - ${error}`));
        return false;
      }

      if (validation.warnings.length > 0) {
        console.warn('⚠️  Platform configuration warnings:');
        validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
      }

      console.log('✅ Platform configuration validation passed');
      return true;

    } catch (error) {
      console.error('❌ Platform configuration loading failed:', error);
      return false;
    }
  }

  /**
   * Validates application configuration files
   */
  private async validateApplicationConfigs(): Promise<boolean> {
    console.log('📱 Validating application configuration files...');
    
    try {
      // Load application configs using hybrid loader
      const applicationConfigs = this.loader.loadApplicationConfigs();
      
      if (applicationConfigs.length === 0) {
        console.warn('⚠️  No application configurations found');
        return true; // Not an error if no applications are configured
      }

      // Validate each application configuration
      for (const appConfig of applicationConfigs) {
        console.log(`   Validating ${appConfig.applicationName}...`);
        
        const validation = this.loader.validateConfiguration(appConfig, 'application');
        if (!validation.isValid) {
          console.error(`❌ Application '${appConfig.applicationName}' validation failed:`);
          validation.errors.forEach(error => console.error(`   - ${error}`));
          return false;
        }

        if (validation.warnings.length > 0) {
          console.warn(`⚠️  Application '${appConfig.applicationName}' warnings:`);
          validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
        }
      }

      console.log(`✅ Application configuration files validated (${applicationConfigs.length} applications)`);
      return true;

    } catch (error) {
      console.error('❌ Application configuration validation failed:', error);
      return false;
    }
  }

  /**
   * Validates platform configuration using ConfigurationManager
   */
  private async validatePlatformConfiguration(): Promise<boolean> {
    console.log('🏗️  Validating platform configuration...');
    
    try {
      const validation = this.configManager.validateConfiguration();
      
      if (!validation.isValid) {
        console.error('❌ Platform configuration validation failed:');
        validation.errors.forEach(error => console.error(`   - ${error}`));
        return false;
      }

      if (validation.warnings.length > 0) {
        console.warn('⚠️  Platform configuration warnings:');
        validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
      }

      // Additional platform-specific validations
      const config = this.configManager.getConfig();
      
      // Validate connection ARN format (if provided)
      if (config.platform.connectionArn && 
          !config.platform.connectionArn.startsWith('arn:aws:codeconnections:')) {
        console.error('❌ Invalid CodeConnections ARN format');
        return false;
      }

      // Validate account ID format
      if (!/^\d{12}$/.test(config.platform.account)) {
        console.error('❌ Invalid AWS account ID format');
        return false;
      }

      console.log('✅ Platform configuration validation passed');
      return true;

    } catch (error) {
      console.error('❌ Platform configuration validation failed:', error);
      return false;
    }
  }

  /**
   * Validates cross-references and dependencies between configurations
   */
  private async validateDependencies(): Promise<boolean> {
    console.log('🔗 Validating configuration dependencies...');
    
    try {
      // Load configurations using hybrid loader
      const platformConfig = this.loader.loadPlatformConfig();
      const applicationConfigs = this.loader.loadApplicationConfigs();

      // Convert to format expected by existing validation methods
      const applications: { [key: string]: any } = {};
      applicationConfigs.forEach(app => {
        applications[app.applicationName] = app;
      });

      const environments = platformConfig.environments;

      // Validate that all application deployment targets reference valid environments
      for (const [appName, appConfig] of Object.entries(applications)) {
        for (const targetEnv of appConfig.deploymentTargets) {
          if (!environments[targetEnv]) {
            console.error(`❌ Application '${appName}' references unknown environment '${targetEnv}'`);
            console.error(`   Available environments: ${Object.keys(environments).join(', ')}`);
            return false;
          }
        }
      }

      // Use ConfigurationManager for remaining validations (it will use the same data)
      const config = this.configManager.getConfig();

      // Validate resource naming conventions
      const namingValidation = ConfigurationUtils.validateResourceNames(config);
      if (!namingValidation.isValid) {
        console.error('❌ Resource naming validation failed:');
        namingValidation.errors.forEach(error => console.error(`   - ${error}`));
        return false;
      }

      // Validate deployment target consistency
      const deploymentValidation = ConfigurationUtils.validateDeploymentTargets(config);
      if (!deploymentValidation.isValid) {
        console.error('❌ Deployment target validation failed:');
        deploymentValidation.errors.forEach(error => console.error(`   - ${error}`));
        return false;
      }

      console.log('✅ Configuration dependencies validation passed');
      return true;

    } catch (error) {
      console.error('❌ Configuration dependencies validation failed:', error);
      return false;
    }
  }

  /**
   * Generates a comprehensive validation report
   */
  generateReport(): any {
    try {
      // Load configurations using hybrid loader
      const platformConfig = this.loader.loadPlatformConfig();
      const applicationConfigs = this.loader.loadApplicationConfigs();

      // Convert to format expected by existing methods
      const applications: { [key: string]: any } = {};
      applicationConfigs.forEach(app => {
        applications[app.applicationName] = app;
      });

      // Use ConfigurationManager for validation (it will use the same underlying data)
      const config = this.configManager.getConfig();
      const validation = this.configManager.validateConfiguration();
      const environments = platformConfig.environments;

      return {
        timestamp: new Date().toISOString(),
        summary: {
          isValid: validation.isValid,
          applicationCount: Object.keys(applications).length,
          environmentCount: Object.keys(environments).length,
          errorCount: validation.errors.length,
          warningCount: validation.warnings.length,
        },
        platform: {
          account: platformConfig.platform.account,
          region: platformConfig.platform.region,
          connectionConfigured: !!platformConfig.platform.connectionArn || 'Will be created by CDK',
        },
        applications: Object.keys(applications).map(appName => ({
          name: appName,
          team: applications[appName].team,
          deploymentTargets: applications[appName].deploymentTargets,
          enabled: applications[appName].enabled !== false,
        })),
        environments: Object.keys(environments).map(envName => ({
          name: envName,
          account: environments[envName].account,
          region: environments[envName].region,
          isProd: environments[envName].isProd || false,
          requiresApproval: environments[envName].requiresApproval || false,
        })),
        validation: {
          errors: validation.errors,
          warnings: validation.warnings,
        },
        configurationSource: {
          loader: this.loader.getSourceDescription(),
          platformConfigSource: 'cdk.json context',
          applicationConfigSource: applicationConfigs.length > 0 ? 'config/applications/*.json files' : 'CDK context (fallback)',
        },
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        error: `Failed to generate report: ${(error as Error).message}`,
        summary: {
          isValid: false,
          applicationCount: 0,
          environmentCount: 0,
          errorCount: 1,
          warningCount: 0,
        },
      };
    }
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  let generateReport = false;
  let verbose = false;

  // Parse command line arguments
  for (const arg of args) {
    switch (arg) {
      case '--report':
        generateReport = true;
        break;
      case '--verbose':
        verbose = true;
        break;
      case '--help':
        console.log(`
Usage: validate-configs [options]

Options:
  --report     Generate detailed validation report
  --verbose    Enable verbose output
  --help       Show this help message

Examples:
  validate-configs
  validate-configs --report --verbose
        `);
        process.exit(0);
    }
  }

  const validator = new ConfigurationValidator();
  const isValid = await validator.validateAll();

  if (generateReport || verbose) {
    const report = validator.generateReport();
    console.log('\n📊 Configuration Validation Report:');
    console.log(JSON.stringify(report, null, 2));
  }

  if (isValid) {
    console.log('\n🎉 All configurations are valid and ready for deployment!');
  } else {
    console.log('\n💥 Configuration validation failed. Please fix the errors above.');
  }

  process.exit(isValid ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Configuration validation script failed:', error);
    process.exit(1);
  });
}

export { ConfigurationValidator };
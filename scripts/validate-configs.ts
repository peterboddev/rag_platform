#!/usr/bin/env node

/**
 * Configuration validation script for platform pipeline system
 * 
 * This script validates all configuration files and ensures they meet
 * the platform pipeline requirements before deployment.
 */

import { ConfigurationManager, ConfigurationUtils } from '../lib/config/platform-config';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

class ConfigurationValidator {
  private configManager: ConfigurationManager;

  constructor() {
    // Create a CDK app with the actual context from cdk.json
    const app = new cdk.App({
      context: this.loadCdkContext()
    });
    const tempConstruct = new Construct(app, 'ConfigValidationConstruct');
    this.configManager = new ConfigurationManager(tempConstruct);
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
      // Validate CDK context configuration
      const contextValid = await this.validateCdkContext();
      if (!contextValid) {
        return false;
      }

      // Validate application configuration files
      const appConfigsValid = await this.validateApplicationConfigs();
      if (!appConfigsValid) {
        return false;
      }

      // Validate platform configuration
      const platformValid = await this.validatePlatformConfiguration();
      if (!platformValid) {
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
    console.log('📋 Validating CDK context configuration...');
    
    try {
      // Check if cdk.json exists
      const cdkJsonPath = path.join(process.cwd(), 'cdk.json');
      if (!fs.existsSync(cdkJsonPath)) {
        console.error('❌ cdk.json file not found');
        return false;
      }

      // Parse and validate cdk.json
      const cdkJson = JSON.parse(fs.readFileSync(cdkJsonPath, 'utf8'));
      
      if (!cdkJson.context) {
        console.error('❌ CDK context configuration missing');
        return false;
      }

      // Validate required context keys
      const requiredKeys = ['platform', 'environments', 'applications'];
      for (const key of requiredKeys) {
        if (!cdkJson.context[key]) {
          console.error(`❌ Required CDK context key '${key}' missing`);
          return false;
        }
      }

      console.log('✅ CDK context validation passed');
      return true;

    } catch (error) {
      console.error('❌ CDK context validation failed:', error);
      return false;
    }
  }

  /**
   * Validates application configuration files
   */
  private async validateApplicationConfigs(): Promise<boolean> {
    console.log('📱 Validating application configuration files...');
    
    try {
      const configDir = path.join(process.cwd(), 'config', 'applications');
      
      if (!fs.existsSync(configDir)) {
        console.warn('⚠️  Application configuration directory not found');
        return true; // Not required if using CDK context only
      }

      const configFiles = fs.readdirSync(configDir).filter(file => file.endsWith('.json'));
      
      for (const configFile of configFiles) {
        const configPath = path.join(configDir, configFile);
        const appName = path.basename(configFile, '.json');
        
        console.log(`   Validating ${appName}...`);
        
        try {
          const appConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          
          // Validate required fields
          const requiredFields = ['applicationName', 'team', 'sourceRepo', 'deploymentTargets'];
          for (const field of requiredFields) {
            if (!appConfig[field]) {
              console.error(`❌ Application '${appName}' missing required field '${field}'`);
              return false;
            }
          }

          // Validate source repository configuration
          if (!appConfig.sourceRepo.owner || !appConfig.sourceRepo.repo || !appConfig.sourceRepo.branch) {
            console.error(`❌ Application '${appName}' has incomplete sourceRepo configuration`);
            return false;
          }

          // Validate deployment targets
          if (!Array.isArray(appConfig.deploymentTargets) || appConfig.deploymentTargets.length === 0) {
            console.error(`❌ Application '${appName}' must have at least one deployment target`);
            return false;
          }

        } catch (parseError) {
          console.error(`❌ Failed to parse application config '${appName}':`, parseError);
          return false;
        }
      }

      console.log(`✅ Application configuration files validated (${configFiles.length} files)`);
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
      const applications = this.configManager.getEnabledApplications();
      const environments = this.configManager.getEnvironments();

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

      // Validate resource naming conventions
      const namingValidation = ConfigurationUtils.validateResourceNames(this.configManager.getConfig());
      if (!namingValidation.isValid) {
        console.error('❌ Resource naming validation failed:');
        namingValidation.errors.forEach(error => console.error(`   - ${error}`));
        return false;
      }

      // Validate deployment target consistency
      const deploymentValidation = ConfigurationUtils.validateDeploymentTargets(this.configManager.getConfig());
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
    const config = this.configManager.getConfig();
    const validation = this.configManager.validateConfiguration();
    const applications = this.configManager.getEnabledApplications();
    const environments = this.configManager.getEnvironments();

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
        account: config.platform.account,
        region: config.platform.region,
        connectionConfigured: !!config.platform.connectionArn || 'Will be created by CDK',
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
    };
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
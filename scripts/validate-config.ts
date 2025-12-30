#!/usr/bin/env ts-node

/**
 * Configuration validation utility script
 * 
 * This script validates the platform configuration files and CDK context
 * to ensure all settings are correct before deployment.
 * 
 * Usage:
 *   npm run validate-config
 *   npx ts-node scripts/validate-config.ts
 */

import * as path from 'path';
import { ConfigurationLoader } from '../lib/config/configuration-loader';
import { ConfigurationManager, ConfigurationUtils } from '../lib/config/platform-config';
import { AdvancedConfigurationManager } from '../lib/config/configuration-manager-advanced';
import { ConfigurationSchemaValidator } from '../lib/config/configuration-schema';
import { App } from 'aws-cdk-lib';

interface ValidationOptions {
  verbose?: boolean;
  fix?: boolean;
  output?: string;
}

class ConfigurationValidator {
  private loader: ConfigurationLoader;
  private options: ValidationOptions;

  constructor(options: ValidationOptions = {}) {
    this.loader = new ConfigurationLoader();
    this.options = options;
  }

  /**
   * Main validation function
   */
  public async validate(): Promise<boolean> {
    console.log('🔍 Validating platform configuration...\n');

    let hasErrors = false;

    // 1. Validate configuration file syntax
    console.log('📄 Validating configuration file syntax...');
    const fileValidation = this.loader.validateConfigurationFiles();
    
    if (!fileValidation.isValid) {
      console.error('❌ Configuration file validation failed:');
      fileValidation.errors.forEach(error => console.error(`  - ${error}`));
      hasErrors = true;
    } else {
      console.log('✅ Configuration files are syntactically valid');
    }

    if (fileValidation.warnings.length > 0) {
      console.warn('⚠️  Configuration file warnings:');
      fileValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    // 2. Load and validate merged configuration
    console.log('\n🔧 Loading and validating merged configuration...');
    
    try {
      // Create a temporary CDK app to test configuration loading
      // Load context from cdk.json to ensure proper configuration loading
      const fs = require('fs');
      const cdkJson = JSON.parse(fs.readFileSync('cdk.json', 'utf8'));
      const app = new App({ context: cdkJson.context });
      const configManager = new ConfigurationManager(app);
      
      const validation = configManager.validateConfiguration();
      
      if (!validation.isValid) {
        console.error('❌ Configuration validation failed:');
        validation.errors.forEach(error => console.error(`  - ${error}`));
        hasErrors = true;
      } else {
        console.log('✅ Configuration is valid');
      }

      if (validation.warnings.length > 0) {
        console.warn('⚠️  Configuration warnings:');
        validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
      }

      // 3. Schema validation
      console.log('\n📋 Validating configuration schema...');
      const config = configManager.getConfig();
      const schemaValidation = ConfigurationSchemaValidator.validate(config, 'complete');
      
      if (!schemaValidation.isValid) {
        console.error('❌ Schema validation failed:');
        schemaValidation.errors.forEach(error => console.error(`  - ${error}`));
        hasErrors = true;
      } else {
        console.log('✅ Configuration schema is valid');
      }

      if (schemaValidation.warnings.length > 0) {
        console.warn('⚠️  Schema validation warnings:');
        schemaValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
      }

      // 4. Security validation
      console.log('\n🔒 Validating security constraints...');
      const advancedManager = new AdvancedConfigurationManager(app);
      const securityValidation = advancedManager.validateSecurityConstraints();
      
      if (!securityValidation.isValid) {
        console.error('❌ Security validation failed:');
        securityValidation.errors.forEach(error => console.error(`  - ${error}`));
        hasErrors = true;
      } else {
        console.log('✅ Security constraints are satisfied');
      }

      if (securityValidation.warnings.length > 0) {
        console.warn('⚠️  Security warnings:');
        securityValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
      }

      // 5. Display configuration summary if verbose
      if (this.options.verbose) {
        this.displayConfigurationSummary(configManager);
      }

      // 6. Check for missing required files
      console.log('\n📁 Checking configuration directory structure...');
      this.validateDirectoryStructure();

    } catch (error) {
      console.error('❌ Failed to load configuration:', error);
      hasErrors = true;
    }

    // 5. Validate CDK context
    console.log('\n⚙️  Validating CDK context...');
    this.validateCdkContext();

    // Summary
    console.log('\n' + '='.repeat(50));
    if (hasErrors) {
      console.error('❌ Configuration validation failed');
      console.error('Please fix the errors above before deploying');
      return false;
    } else {
      console.log('✅ Configuration validation passed');
      console.log('Configuration is ready for deployment');
      return true;
    }
  }

  /**
   * Displays detailed configuration summary
   */
  private displayConfigurationSummary(configManager: ConfigurationManager): void {
    console.log('\n📊 Configuration Summary:');
    
    const config = configManager.getConfig();
    
    console.log(`\n🏗️  Platform Configuration:`);
    console.log(`  Region: ${config.platform.region}`);
    console.log(`  Account: ${config.platform.account}`);
    console.log(`  Connection ARN: ${config.platform.connectionArn}`);
    
    console.log(`\n🌍 Environments (${Object.keys(config.environments).length}):`);
    Object.entries(config.environments).forEach(([name, env]) => {
      console.log(`  - ${name}: ${env.account}/${env.region} ${env.isProd ? '(PROD)' : '(DEV)'}`);
    });
    
    console.log(`\n📱 Applications (${Object.keys(config.applications).length}):`);
    Object.entries(config.applications).forEach(([name, app]) => {
      const status = app.enabled !== false ? 'enabled' : 'disabled';
      console.log(`  - ${name}: ${app.sourceRepo.owner}/${app.sourceRepo.repo} (${status})`);
    });
  }

  /**
   * Validates directory structure
   */
  private validateDirectoryStructure(): void {
    const requiredDirs = [
      'config',
      'config/environments',
      'config/applications',
    ];

    const missingDirs: string[] = [];
    
    requiredDirs.forEach(dir => {
      const fs = require('fs');
      if (!fs.existsSync(dir)) {
        missingDirs.push(dir);
      }
    });

    if (missingDirs.length > 0) {
      console.warn('⚠️  Missing configuration directories:');
      missingDirs.forEach(dir => console.warn(`  - ${dir}`));
      
      if (this.options.fix) {
        console.log('🔧 Creating missing directories...');
        this.loader.initializeConfigDirectory();
        console.log('✅ Configuration directories created');
      } else {
        console.log('💡 Run with --fix to create missing directories');
      }
    } else {
      console.log('✅ Configuration directory structure is valid');
    }
  }

  /**
   * Validates CDK context configuration
   */
  private validateCdkContext(): void {
    try {
      const fs = require('fs');
      const cdkJson = JSON.parse(fs.readFileSync('cdk.json', 'utf8'));
      
      const requiredContextKeys = [
        'platform.connectionArn',
        'environments',
        'applications',
      ];

      const missingKeys: string[] = [];
      
      requiredContextKeys.forEach(key => {
        const keys = key.split('.');
        let current = cdkJson.context;
        
        for (const k of keys) {
          if (!current || !current[k]) {
            missingKeys.push(key);
            break;
          }
          current = current[k];
        }
      });

      if (missingKeys.length > 0) {
        console.warn('⚠️  Missing CDK context keys:');
        missingKeys.forEach(key => console.warn(`  - ${key}`));
      } else {
        console.log('✅ CDK context configuration is valid');
      }

    } catch (error) {
      console.error('❌ Failed to validate CDK context:', error);
    }
  }

  /**
   * Creates a sample configuration for testing
   */
  public createSampleConfig(): void {
    console.log('📝 Creating sample configuration...');
    
    const sampleConfig = ConfigurationUtils.createSampleConfig();
    
    if (this.options.output) {
      this.loader.saveConfiguration(sampleConfig, this.options.output);
      console.log(`✅ Sample configuration saved to ${this.options.output}`);
    } else {
      console.log('Sample configuration:');
      console.log(JSON.stringify(sampleConfig, null, 2));
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: ValidationOptions = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    fix: args.includes('--fix'),
    output: args.includes('--output') ? args[args.indexOf('--output') + 1] : undefined,
  };

  const validator = new ConfigurationValidator(options);

  if (args.includes('--sample')) {
    validator.createSampleConfig();
    return;
  }

  const isValid = await validator.validate();
  process.exit(isValid ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Validation failed with error:', error);
    process.exit(1);
  });
}

export { ConfigurationValidator };
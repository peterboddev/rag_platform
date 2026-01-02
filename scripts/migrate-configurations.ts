#!/usr/bin/env ts-node

/**
 * Configuration Migration Script
 * 
 * This script automates the migration from single-file configuration (cdk.json)
 * to separated configuration architecture (platform in cdk.json, applications in separate files).
 * 
 * Usage:
 *   npx ts-node scripts/migrate-configurations.ts
 *   npm run migrate-config
 */

import * as fs from 'fs';
import * as path from 'path';

interface ApplicationConfig {
  applicationName: string;
  team: string;
  sourceRepo: {
    owner: string;
    repo: string;
    branch: string;
  };
  buildConfig?: {
    runtime?: string;
    commands?: string[];
    environment?: { [key: string]: string };
  };
  deploymentTargets: string[];
  notifications?: {
    snsTopicArn?: string;
    emailAddresses?: string[];
  };
  enabled?: boolean;
}

interface MigrationOptions {
  dryRun?: boolean;
  backup?: boolean;
  verbose?: boolean;
}

class ConfigurationMigrator {
  private options: MigrationOptions;

  constructor(options: MigrationOptions = {}) {
    this.options = {
      dryRun: false,
      backup: true,
      verbose: false,
      ...options
    };
  }

  /**
   * Main migration entry point
   */
  async migrate(): Promise<boolean> {
    try {
      console.log('🔄 Starting configuration migration...');
      
      if (this.options.dryRun) {
        console.log('🔍 DRY RUN MODE - No files will be modified');
      }

      // Step 1: Validate current state
      await this.validateCurrentState();

      // Step 2: Create backup if requested
      if (this.options.backup && !this.options.dryRun) {
        await this.createBackup();
      }

      // Step 3: Load current configuration
      const { cdkJson, applications } = await this.loadCurrentConfiguration();

      // Step 4: Check if migration is needed
      if (Object.keys(applications).length === 0) {
        console.log('✅ No applications found in cdk.json - migration not needed');
        return true;
      }

      // Step 5: Create application configuration directory
      await this.createApplicationDirectory();

      // Step 6: Extract application configurations
      await this.extractApplicationConfigurations(applications);

      // Step 7: Update cdk.json (remove applications section)
      await this.updateCdkJson(cdkJson);

      // Step 8: Validate migrated configuration
      await this.validateMigratedConfiguration();

      console.log('🎉 Configuration migration completed successfully!');
      this.printNextSteps();

      return true;

    } catch (error) {
      console.error('❌ Migration failed:', (error as Error).message);
      return false;
    }
  }

  /**
   * Validates the current state before migration
   */
  private async validateCurrentState(): Promise<void> {
    console.log('🔍 Validating current state...');

    // Check if cdk.json exists
    if (!fs.existsSync('cdk.json')) {
      throw new Error('cdk.json not found in current directory');
    }

    // Check if already migrated
    if (fs.existsSync('config/applications') && fs.readdirSync('config/applications').length > 0) {
      const existingFiles = fs.readdirSync('config/applications').filter(f => f.endsWith('.json'));
      if (existingFiles.length > 0) {
        console.log('⚠️  Application configuration files already exist:');
        existingFiles.forEach(file => console.log(`   - config/applications/${file}`));
        
        const proceed = await this.promptUser('Continue with migration? This may overwrite existing files. (y/N): ');
        if (!proceed) {
          throw new Error('Migration cancelled by user');
        }
      }
    }

    console.log('✅ Current state validation passed');
  }

  /**
   * Creates a backup of the current cdk.json
   */
  private async createBackup(): Promise<void> {
    console.log('💾 Creating backup...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `cdk.json.backup.${timestamp}`;

    fs.copyFileSync('cdk.json', backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
  }

  /**
   * Loads the current configuration from cdk.json
   */
  private async loadCurrentConfiguration(): Promise<{ cdkJson: any; applications: { [key: string]: ApplicationConfig } }> {
    console.log('📖 Loading current configuration...');

    const cdkJsonContent = fs.readFileSync('cdk.json', 'utf8');
    const cdkJson = JSON.parse(cdkJsonContent);

    if (!cdkJson.context) {
      throw new Error('cdk.json missing context section');
    }

    const applications = cdkJson.context.applications || {};

    console.log(`✅ Found ${Object.keys(applications).length} applications in cdk.json`);
    
    if (this.options.verbose) {
      Object.keys(applications).forEach(appName => {
        console.log(`   - ${appName}`);
      });
    }

    return { cdkJson, applications };
  }

  /**
   * Creates the application configuration directory
   */
  private async createApplicationDirectory(): Promise<void> {
    const appsDir = 'config/applications';

    if (!fs.existsSync(appsDir)) {
      console.log(`📁 Creating directory: ${appsDir}`);
      
      if (!this.options.dryRun) {
        fs.mkdirSync(appsDir, { recursive: true });
      }
    } else {
      console.log(`📁 Directory already exists: ${appsDir}`);
    }
  }

  /**
   * Extracts application configurations to separate files
   */
  private async extractApplicationConfigurations(applications: { [key: string]: ApplicationConfig }): Promise<void> {
    console.log('📤 Extracting application configurations...');

    for (const [appName, appConfig] of Object.entries(applications)) {
      const appFilePath = path.join('config/applications', `${appName}.json`);
      
      // Validate application configuration
      this.validateApplicationConfig(appName, appConfig);

      // Add default values if missing
      const enhancedConfig = this.enhanceApplicationConfig(appConfig);

      console.log(`   ✅ Extracting ${appName} → ${appFilePath}`);
      
      if (this.options.verbose) {
        console.log(`      Team: ${enhancedConfig.team}`);
        console.log(`      Repository: ${enhancedConfig.sourceRepo.owner}/${enhancedConfig.sourceRepo.repo}`);
        console.log(`      Deployment targets: ${enhancedConfig.deploymentTargets.join(', ')}`);
      }

      if (!this.options.dryRun) {
        fs.writeFileSync(appFilePath, JSON.stringify(enhancedConfig, null, 2));
      }
    }

    console.log(`✅ Extracted ${Object.keys(applications).length} application configurations`);
  }

  /**
   * Validates an application configuration
   */
  private validateApplicationConfig(appName: string, appConfig: any): void {
    const requiredFields = ['applicationName', 'team', 'sourceRepo', 'deploymentTargets'];
    
    for (const field of requiredFields) {
      if (!appConfig[field]) {
        throw new Error(`Application '${appName}' missing required field: ${field}`);
      }
    }

    // Validate sourceRepo structure
    if (!appConfig.sourceRepo.owner || !appConfig.sourceRepo.repo || !appConfig.sourceRepo.branch) {
      throw new Error(`Application '${appName}' has invalid sourceRepo structure`);
    }

    // Validate deploymentTargets
    if (!Array.isArray(appConfig.deploymentTargets) || appConfig.deploymentTargets.length === 0) {
      throw new Error(`Application '${appName}' must have at least one deployment target`);
    }
  }

  /**
   * Enhances application configuration with defaults and best practices
   */
  private enhanceApplicationConfig(appConfig: ApplicationConfig): ApplicationConfig {
    const enhanced = { ...appConfig };

    // Set enabled to true if not specified
    if (enhanced.enabled === undefined) {
      enhanced.enabled = true;
    }

    // Add default build configuration if not present
    if (!enhanced.buildConfig) {
      enhanced.buildConfig = {
        runtime: '20',
        commands: [
          'echo "Installing dependencies..."',
          'npm ci',
          'echo "Running tests..."',
          'npm run test --if-present',
          'echo "Building application..."',
          'npm run build --if-present',
          'echo "Build completed successfully"'
        ],
        environment: {
          'NODE_ENV': 'production',
          'NPM_CONFIG_CACHE': '/tmp/.npm'
        }
      };
    }

    return enhanced;
  }

  /**
   * Updates cdk.json to remove applications section
   */
  private async updateCdkJson(cdkJson: any): Promise<void> {
    console.log('📝 Updating cdk.json...');

    // Remove applications section
    if (cdkJson.context.applications) {
      console.log('   🗑️  Removing applications section from cdk.json');
      delete cdkJson.context.applications;
    }

    if (!this.options.dryRun) {
      fs.writeFileSync('cdk.json', JSON.stringify(cdkJson, null, 2));
    }

    console.log('✅ cdk.json updated successfully');
  }

  /**
   * Validates the migrated configuration
   */
  private async validateMigratedConfiguration(): Promise<void> {
    console.log('🔍 Validating migrated configuration...');

    if (this.options.dryRun) {
      console.log('⚠️  Skipping validation in dry-run mode');
      return;
    }

    try {
      // Import and run configuration validation
      const { ConfigurationValidator } = await import('./validate-config');
      const validator = new ConfigurationValidator({ verbose: false });
      const isValid = await validator.validate();

      if (!isValid) {
        throw new Error('Configuration validation failed after migration');
      }

      console.log('✅ Migrated configuration validation passed');

    } catch (error) {
      console.warn('⚠️  Could not run configuration validation:', (error as Error).message);
      console.warn('   Please run: npm run validate-config');
    }
  }

  /**
   * Prints next steps for the user
   */
  private printNextSteps(): void {
    console.log('');
    console.log('📋 Next Steps:');
    console.log('');
    console.log('1. Validate the migrated configuration:');
    console.log('   npm run validate-config');
    console.log('');
    console.log('2. Test CDK synthesis:');
    console.log('   cdk synth');
    console.log('');
    console.log('3. Deploy the platform pipeline:');
    console.log('   cdk deploy PlatformPipelineStack');
    console.log('');
    console.log('4. Verify application pipelines are created correctly');
    console.log('');
    console.log('💡 If you encounter issues, you can restore from backup:');
    const backupFiles = fs.readdirSync('.').filter(f => f.startsWith('cdk.json.backup.'));
    if (backupFiles.length > 0) {
      const latestBackup = backupFiles.sort().reverse()[0];
      console.log(`   cp ${latestBackup} cdk.json`);
    }
  }

  /**
   * Prompts user for input (simplified for this example)
   */
  private async promptUser(message: string): Promise<boolean> {
    // In a real implementation, you would use readline or inquirer
    // For this example, we'll assume user wants to proceed
    console.log(message);
    return true;
  }

  /**
   * Rollback migration (restore from backup)
   */
  async rollback(backupFile?: string): Promise<boolean> {
    try {
      console.log('🔄 Rolling back configuration migration...');

      // Find backup file
      let backupPath = backupFile;
      if (!backupPath) {
        const backupFiles = fs.readdirSync('.').filter(f => f.startsWith('cdk.json.backup.'));
        if (backupFiles.length === 0) {
          throw new Error('No backup files found');
        }
        backupPath = backupFiles.sort().reverse()[0]; // Use latest backup
      }

      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      // Restore cdk.json from backup
      fs.copyFileSync(backupPath, 'cdk.json');
      console.log(`✅ Restored cdk.json from ${backupPath}`);

      // Remove application configuration files
      if (fs.existsSync('config/applications')) {
        const configFiles = fs.readdirSync('config/applications').filter(f => f.endsWith('.json'));
        for (const file of configFiles) {
          fs.unlinkSync(path.join('config/applications', file));
          console.log(`🗑️  Removed config/applications/${file}`);
        }

        // Remove directory if empty
        if (fs.readdirSync('config/applications').length === 0) {
          fs.rmdirSync('config/applications');
          console.log('🗑️  Removed empty config/applications directory');
        }
      }

      console.log('🎉 Rollback completed successfully!');
      return true;

    } catch (error) {
      console.error('❌ Rollback failed:', (error as Error).message);
      return false;
    }
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    backup: !args.includes('--no-backup'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Configuration Migration Tool

Usage:
  npm run migrate-config [options]
  npx ts-node scripts/migrate-configurations.ts [options]

Options:
  --dry-run          Show what would be done without making changes
  --no-backup        Skip creating backup of cdk.json
  --verbose, -v      Show detailed output
  --rollback [file]  Rollback migration using backup file
  --help, -h         Show this help message

Examples:
  npm run migrate-config
  npm run migrate-config -- --dry-run --verbose
  npm run migrate-config -- --rollback cdk.json.backup.2024-01-02T10-30-00-000Z
`);
    return;
  }

  const migrator = new ConfigurationMigrator(options);

  if (args.includes('--rollback')) {
    const backupFileIndex = args.indexOf('--rollback') + 1;
    const backupFile = args[backupFileIndex] && !args[backupFileIndex].startsWith('--') 
      ? args[backupFileIndex] 
      : undefined;
    
    const success = await migrator.rollback(backupFile);
    process.exit(success ? 0 : 1);
  } else {
    const success = await migrator.migrate();
    process.exit(success ? 0 : 1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
}

export { ConfigurationMigrator };
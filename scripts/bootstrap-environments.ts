#!/usr/bin/env ts-node

/**
 * Environment bootstrapping utility script
 * 
 * This script bootstraps CDK environments across multiple AWS accounts
 * and regions based on the configuration.
 * 
 * Usage:
 *   npm run bootstrap:all-envs
 *   npx ts-node scripts/bootstrap-environments.ts
 */

import { execSync } from 'child_process';
import { App } from 'aws-cdk-lib';
import { ConfigurationManager } from '../lib/config/platform-config';

interface BootstrapOptions {
  dryRun?: boolean;
  verbose?: boolean;
  force?: boolean;
}

class EnvironmentBootstrapper {
  private configManager: ConfigurationManager;
  private options: BootstrapOptions;

  constructor(options: BootstrapOptions = {}) {
    const app = new App();
    this.configManager = new ConfigurationManager(app);
    this.options = options;
  }

  /**
   * Bootstrap all environments defined in configuration
   */
  public async bootstrapAllEnvironments(): Promise<void> {
    console.log('🚀 Bootstrapping CDK environments...\n');

    const config = this.configManager.getConfig();
    const environments = config.environments;

    if (Object.keys(environments).length === 0) {
      console.log('ℹ️  No environments found in configuration');
      return;
    }

    console.log(`📋 Found ${Object.keys(environments).length} environment(s) to bootstrap:`);
    Object.entries(environments).forEach(([name, env]) => {
      console.log(`  - ${name}: ${env.account}/${env.region} ${env.isProd ? '(PROD)' : '(DEV)'}`);
    });

    if (this.options.dryRun) {
      console.log('\n🔍 Dry run mode - no actual bootstrapping will be performed');
      return;
    }

    console.log('\n🔧 Starting bootstrap process...\n');

    let successCount = 0;
    let failureCount = 0;

    for (const [envName, envConfig] of Object.entries(environments)) {
      try {
        console.log(`📦 Bootstrapping ${envName} (${envConfig.account}/${envConfig.region})...`);
        
        await this.bootstrapEnvironment(envConfig.account, envConfig.region, envName);
        
        console.log(`✅ Successfully bootstrapped ${envName}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to bootstrap ${envName}:`, error);
        failureCount++;
        
        if (!this.options.force) {
          console.error('💥 Stopping due to failure. Use --force to continue on errors.');
          break;
        }
      }
      
      console.log(''); // Add spacing between environments
    }

    // Summary
    console.log('='.repeat(50));
    console.log(`📊 Bootstrap Summary:`);
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ❌ Failed: ${failureCount}`);
    console.log(`  📋 Total: ${successCount + failureCount}`);

    if (failureCount > 0) {
      console.error('\n💡 Some environments failed to bootstrap. Check the errors above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All environments bootstrapped successfully!');
    }
  }

  /**
   * Bootstrap a specific environment
   */
  private async bootstrapEnvironment(account: string, region: string, envName: string): Promise<void> {
    const command = `cdk bootstrap aws://${account}/${region}`;
    
    if (this.options.verbose) {
      console.log(`  🔧 Running: ${command}`);
    }

    try {
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      if (this.options.verbose && output) {
        console.log(output);
      }
    } catch (error: any) {
      throw new Error(`Bootstrap command failed: ${error.message}`);
    }
  }

  /**
   * Check if environments are already bootstrapped
   */
  public async checkBootstrapStatus(): Promise<void> {
    console.log('🔍 Checking bootstrap status for all environments...\n');

    const config = this.configManager.getConfig();
    const environments = config.environments;

    for (const [envName, envConfig] of Object.entries(environments)) {
      try {
        console.log(`📋 Checking ${envName} (${envConfig.account}/${envConfig.region})...`);
        
        // Try to list stacks to see if the bootstrap stack exists
        const command = `aws cloudformation list-stacks --region ${envConfig.region} --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query "StackSummaries[?contains(StackName, 'CDKToolkit')].StackName" --output text`;
        
        const output = execSync(command, { encoding: 'utf8' });
        
        if (output.trim()) {
          console.log(`  ✅ Bootstrapped (CDK Toolkit stack found)`);
        } else {
          console.log(`  ❌ Not bootstrapped (CDK Toolkit stack not found)`);
        }
        
      } catch (error) {
        console.log(`  ⚠️  Unable to check status: ${error}`);
      }
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: BootstrapOptions = {
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    force: args.includes('--force') || args.includes('-f'),
  };

  const bootstrapper = new EnvironmentBootstrapper(options);

  if (args.includes('--check') || args.includes('-c')) {
    await bootstrapper.checkBootstrapStatus();
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Environment Bootstrapper

Usage:
  npm run bootstrap:all-envs [options]
  npx ts-node scripts/bootstrap-environments.ts [options]

Options:
  --dry-run, -n     Show what would be bootstrapped without doing it
  --verbose, -v     Show detailed output from CDK commands
  --force, -f       Continue bootstrapping even if some environments fail
  --check, -c       Check bootstrap status of all environments
  --help, -h        Show this help message

Examples:
  npm run bootstrap:all-envs
  npm run bootstrap:all-envs -- --dry-run
  npm run bootstrap:all-envs -- --verbose --force
  npm run bootstrap:all-envs -- --check
`);
    return;
  }

  await bootstrapper.bootstrapAllEnvironments();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Bootstrap failed with error:', error);
    process.exit(1);
  });
}

export { EnvironmentBootstrapper };
#!/usr/bin/env ts-node

/**
 * Local development workflow utility script
 * 
 * This script provides a comprehensive local development workflow
 * for platform engineers working with the CDK pipeline system.
 * 
 * Usage:
 *   npm run local-dev
 *   npx ts-node scripts/local-dev-workflow.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigurationValidator } from './validate-config';

interface WorkflowOptions {
  skipTests?: boolean;
  skipValidation?: boolean;
  skipSynth?: boolean;
  verbose?: boolean;
  interactive?: boolean;
}

class LocalDevelopmentWorkflow {
  private options: WorkflowOptions;

  constructor(options: WorkflowOptions = {}) {
    this.options = options;
  }

  /**
   * Run the complete local development workflow
   */
  public async runWorkflow(): Promise<boolean> {
    console.log('🚀 Starting local development workflow...\n');

    try {
      // 1. Environment check
      if (!await this.checkEnvironment()) {
        return false;
      }

      // 2. Build TypeScript
      if (!await this.buildTypeScript()) {
        return false;
      }

      // 3. Run tests
      if (!this.options.skipTests && !await this.runTests()) {
        return false;
      }

      // 4. Validate configuration
      if (!this.options.skipValidation && !await this.validateConfiguration()) {
        return false;
      }

      // 5. Synthesize CDK
      if (!this.options.skipSynth && !await this.synthesizeCdk()) {
        return false;
      }

      // 6. Show diff (optional)
      if (this.options.interactive) {
        await this.showDiff();
      }

      console.log('\n🎉 Local development workflow completed successfully!');
      console.log('\n💡 Next steps:');
      console.log('  - Review the changes with: npm run diff');
      console.log('  - Deploy to dev with: npm run deploy');
      console.log('  - Run full validation with: npm run validate:full');

      return true;

    } catch (error) {
      console.error('💥 Workflow failed with error:', error);
      return false;
    }
  }

  /**
   * Check development environment prerequisites
   */
  private async checkEnvironment(): Promise<boolean> {
    console.log('🔍 Checking development environment...');

    const checks = [
      { name: 'Node.js', command: 'node --version' },
      { name: 'npm', command: 'npm --version' },
      { name: 'AWS CLI', command: 'aws --version' },
      { name: 'CDK CLI', command: 'cdk --version' },
      { name: 'TypeScript', command: 'tsc --version' },
    ];

    let allPassed = true;

    for (const check of checks) {
      try {
        const version = execSync(check.command, { encoding: 'utf8' }).trim();
        console.log(`  ✅ ${check.name}: ${version.split('\n')[0]}`);
      } catch (error) {
        console.error(`  ❌ ${check.name}: Not found or not working`);
        allPassed = false;
      }
    }

    // Check for required files
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'cdk.json',
      'bin/platform-pipeline.ts',
    ];

    for (const file of requiredFiles) {
      if (fs.existsSync(file)) {
        console.log(`  ✅ ${file}: Found`);
      } else {
        console.error(`  ❌ ${file}: Missing`);
        allPassed = false;
      }
    }

    // Check AWS credentials
    try {
      execSync('aws sts get-caller-identity', { stdio: 'pipe' });
      console.log('  ✅ AWS credentials: Configured');
    } catch (error) {
      console.error('  ❌ AWS credentials: Not configured or invalid');
      console.error('     Run: aws configure');
      allPassed = false;
    }

    if (!allPassed) {
      console.error('\n💥 Environment check failed. Please fix the issues above.');
      return false;
    }

    console.log('✅ Environment check passed\n');
    return true;
  }

  /**
   * Build TypeScript code
   */
  private async buildTypeScript(): Promise<boolean> {
    console.log('🔧 Building TypeScript...');

    try {
      const output = execSync('npm run build', { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });

      if (this.options.verbose && output) {
        console.log(output);
      }

      console.log('✅ TypeScript build completed\n');
      return true;

    } catch (error: any) {
      console.error('❌ TypeScript build failed:');
      console.error(error.stdout || error.message);
      return false;
    }
  }

  /**
   * Run tests
   */
  private async runTests(): Promise<boolean> {
    console.log('🧪 Running tests...');

    try {
      const output = execSync('npm test', { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });

      if (this.options.verbose && output) {
        console.log(output);
      }

      console.log('✅ All tests passed\n');
      return true;

    } catch (error: any) {
      console.error('❌ Tests failed:');
      console.error(error.stdout || error.message);
      
      if (this.options.interactive) {
        console.log('\n💡 Would you like to continue anyway? (y/N)');
        // In a real implementation, you'd read from stdin here
        // For now, we'll just return false
      }
      
      return false;
    }
  }

  /**
   * Validate configuration
   */
  private async validateConfiguration(): Promise<boolean> {
    console.log('📋 Validating configuration...');

    try {
      const validator = new ConfigurationValidator({ verbose: this.options.verbose });
      const isValid = await validator.validate();

      if (isValid) {
        console.log('✅ Configuration validation passed\n');
        return true;
      } else {
        console.error('❌ Configuration validation failed\n');
        return false;
      }

    } catch (error) {
      console.error('❌ Configuration validation error:', error);
      return false;
    }
  }

  /**
   * Synthesize CDK templates
   */
  private async synthesizeCdk(): Promise<boolean> {
    console.log('🏗️  Synthesizing CDK templates...');

    try {
      const output = execSync('cdk synth', { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });

      if (this.options.verbose && output) {
        console.log(output);
      }

      // Check if cdk.out directory was created
      if (fs.existsSync('cdk.out')) {
        const files = fs.readdirSync('cdk.out');
        const templateFiles = files.filter(f => f.endsWith('.template.json'));
        console.log(`✅ CDK synthesis completed (${templateFiles.length} template(s) generated)\n`);
      } else {
        console.log('✅ CDK synthesis completed\n');
      }

      return true;

    } catch (error: any) {
      console.error('❌ CDK synthesis failed:');
      console.error(error.stdout || error.message);
      return false;
    }
  }

  /**
   * Show CDK diff
   */
  private async showDiff(): Promise<void> {
    console.log('📊 Showing CDK diff...');

    try {
      const output = execSync('cdk diff', { 
        encoding: 'utf8',
        stdio: 'inherit'
      });

    } catch (error: any) {
      // cdk diff returns non-zero exit code when there are differences
      // This is expected behavior, so we don't treat it as an error
      if (error.status === 1) {
        console.log('\n💡 Differences found (this is normal)');
      } else {
        console.error('❌ Failed to generate diff:', error.message);
      }
    }
  }

  /**
   * Clean up generated files
   */
  public async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up generated files...');

    const filesToClean = [
      'cdk.out',
      'lib/**/*.js',
      'lib/**/*.d.ts',
      'bin/**/*.js',
      'bin/**/*.d.ts',
      'scripts/**/*.js',
      'scripts/**/*.d.ts',
    ];

    try {
      execSync('npm run clean', { stdio: 'pipe' });
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  /**
   * Show workflow status and next steps
   */
  public showStatus(): void {
    console.log('\n📊 Development Workflow Status:');
    
    // Check build status
    const hasCompiledFiles = fs.existsSync('lib') && 
      fs.readdirSync('lib', { recursive: true }).some(f => f.toString().endsWith('.js'));
    console.log(`  🔧 Build: ${hasCompiledFiles ? '✅ Up to date' : '❌ Needs building'}`);

    // Check CDK output
    const hasCdkOutput = fs.existsSync('cdk.out');
    console.log(`  🏗️  CDK Synth: ${hasCdkOutput ? '✅ Up to date' : '❌ Needs synthesis'}`);

    // Check test results (simplified check)
    console.log(`  🧪 Tests: ❓ Run 'npm test' to check`);

    console.log('\n💡 Available commands:');
    console.log('  npm run local-dev     - Run full development workflow');
    console.log('  npm run validate      - Quick validation (build + test + config)');
    console.log('  npm run validate:full - Comprehensive validation');
    console.log('  npm run diff          - Show infrastructure changes');
    console.log('  npm run deploy        - Deploy to AWS (after validation)');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: WorkflowOptions = {
    skipTests: args.includes('--skip-tests'),
    skipValidation: args.includes('--skip-validation'),
    skipSynth: args.includes('--skip-synth'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    interactive: args.includes('--interactive') || args.includes('-i'),
  };

  const workflow = new LocalDevelopmentWorkflow(options);

  if (args.includes('--status')) {
    workflow.showStatus();
    return;
  }

  if (args.includes('--clean')) {
    await workflow.cleanup();
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Local Development Workflow

Usage:
  npm run local-dev [options]
  npx ts-node scripts/local-dev-workflow.ts [options]

Options:
  --skip-tests         Skip running tests
  --skip-validation    Skip configuration validation
  --skip-synth         Skip CDK synthesis
  --verbose, -v        Show detailed output
  --interactive, -i    Interactive mode with prompts
  --status             Show current workflow status
  --clean              Clean up generated files
  --help, -h           Show this help message

Examples:
  npm run local-dev
  npm run local-dev -- --verbose
  npm run local-dev -- --skip-tests --interactive
`);
    return;
  }

  const success = await workflow.runWorkflow();
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Local development workflow failed:', error);
    process.exit(1);
  });
}

export { LocalDevelopmentWorkflow };
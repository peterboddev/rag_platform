#!/usr/bin/env ts-node

/**
 * Pre-commit validation utility script
 * 
 * This script runs comprehensive validation checks before commits
 * to ensure code quality and prevent deployment issues.
 * 
 * Usage:
 *   npm run pre-commit
 *   npx ts-node scripts/pre-commit-validation.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import { ConfigurationValidator } from './validate-config';

interface ValidationResult {
  name: string;
  passed: boolean;
  message?: string;
  duration?: number;
}

interface PreCommitOptions {
  verbose?: boolean;
  fix?: boolean;
  skipTests?: boolean;
  skipLinting?: boolean;
}

class PreCommitValidator {
  private options: PreCommitOptions;
  private results: ValidationResult[] = [];

  constructor(options: PreCommitOptions = {}) {
    this.options = options;
  }

  /**
   * Run all pre-commit validation checks
   */
  public async runValidation(): Promise<boolean> {
    console.log('🔍 Running pre-commit validation checks...\n');

    const startTime = Date.now();

    // Run all validation checks
    await this.checkTypeScriptCompilation();
    await this.checkCodeFormatting();
    await this.checkLinting();
    await this.runUnitTests();
    await this.validateConfiguration();
    await this.checkCdkSynthesis();
    await this.checkSecurityConstraints();
    await this.checkGitIgnore();

    const totalTime = Date.now() - startTime;

    // Display results
    this.displayResults(totalTime);

    // Return overall success
    const allPassed = this.results.every(r => r.passed);
    
    if (allPassed) {
      console.log('\n🎉 All pre-commit checks passed! Ready to commit.');
    } else {
      console.log('\n❌ Some pre-commit checks failed. Please fix the issues above.');
    }

    return allPassed;
  }

  /**
   * Check TypeScript compilation
   */
  private async checkTypeScriptCompilation(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('🔧 Checking TypeScript compilation...');
      
      execSync('npm run build', { stdio: 'pipe' });
      
      this.results.push({
        name: 'TypeScript Compilation',
        passed: true,
        duration: Date.now() - startTime
      });
      
      console.log('  ✅ TypeScript compilation passed');
      
    } catch (error: any) {
      this.results.push({
        name: 'TypeScript Compilation',
        passed: false,
        message: error.stdout || error.message,
        duration: Date.now() - startTime
      });
      
      console.error('  ❌ TypeScript compilation failed');
      if (this.options.verbose) {
        console.error('    ', error.stdout || error.message);
      }
    }
  }

  /**
   * Check code formatting (if prettier is available)
   */
  private async checkCodeFormatting(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('📝 Checking code formatting...');
      
      // Check if prettier is available
      try {
        execSync('npx prettier --version', { stdio: 'pipe' });
      } catch {
        this.results.push({
          name: 'Code Formatting',
          passed: true,
          message: 'Prettier not configured - skipped',
          duration: Date.now() - startTime
        });
        console.log('  ⚠️  Prettier not configured - skipping formatting check');
        return;
      }

      // Check formatting
      execSync('npx prettier --check "**/*.{ts,js,json,md}"', { stdio: 'pipe' });
      
      this.results.push({
        name: 'Code Formatting',
        passed: true,
        duration: Date.now() - startTime
      });
      
      console.log('  ✅ Code formatting is correct');
      
    } catch (error: any) {
      const canFix = this.options.fix;
      
      if (canFix) {
        try {
          console.log('  🔧 Fixing code formatting...');
          execSync('npx prettier --write "**/*.{ts,js,json,md}"', { stdio: 'pipe' });
          
          this.results.push({
            name: 'Code Formatting',
            passed: true,
            message: 'Fixed automatically',
            duration: Date.now() - startTime
          });
          
          console.log('  ✅ Code formatting fixed automatically');
        } catch (fixError) {
          this.results.push({
            name: 'Code Formatting',
            passed: false,
            message: 'Failed to fix formatting automatically',
            duration: Date.now() - startTime
          });
          
          console.error('  ❌ Failed to fix code formatting');
        }
      } else {
        this.results.push({
          name: 'Code Formatting',
          passed: false,
          message: 'Run: npx prettier --write "**/*.{ts,js,json,md}"',
          duration: Date.now() - startTime
        });
        
        console.error('  ❌ Code formatting issues found');
        console.error('    Run: npx prettier --write "**/*.{ts,js,json,md}"');
      }
    }
  }

  /**
   * Check linting (if ESLint is available)
   */
  private async checkLinting(): Promise<void> {
    if (this.options.skipLinting) {
      console.log('📋 Skipping linting checks...');
      return;
    }

    const startTime = Date.now();
    
    try {
      console.log('📋 Checking code linting...');
      
      // Check if ESLint is available
      try {
        execSync('npx eslint --version', { stdio: 'pipe' });
      } catch {
        this.results.push({
          name: 'Code Linting',
          passed: true,
          message: 'ESLint not configured - skipped',
          duration: Date.now() - startTime
        });
        console.log('  ⚠️  ESLint not configured - skipping linting check');
        return;
      }

      // Run linting
      execSync('npx eslint "**/*.{ts,js}"', { stdio: 'pipe' });
      
      this.results.push({
        name: 'Code Linting',
        passed: true,
        duration: Date.now() - startTime
      });
      
      console.log('  ✅ Code linting passed');
      
    } catch (error: any) {
      this.results.push({
        name: 'Code Linting',
        passed: false,
        message: error.stdout || error.message,
        duration: Date.now() - startTime
      });
      
      console.error('  ❌ Code linting failed');
      if (this.options.verbose) {
        console.error('    ', error.stdout || error.message);
      }
    }
  }

  /**
   * Run unit tests
   */
  private async runUnitTests(): Promise<void> {
    if (this.options.skipTests) {
      console.log('🧪 Skipping unit tests...');
      return;
    }

    const startTime = Date.now();
    
    try {
      console.log('🧪 Running unit tests...');
      
      execSync('npm test', { stdio: 'pipe' });
      
      this.results.push({
        name: 'Unit Tests',
        passed: true,
        duration: Date.now() - startTime
      });
      
      console.log('  ✅ All unit tests passed');
      
    } catch (error: any) {
      this.results.push({
        name: 'Unit Tests',
        passed: false,
        message: error.stdout || error.message,
        duration: Date.now() - startTime
      });
      
      console.error('  ❌ Unit tests failed');
      if (this.options.verbose) {
        console.error('    ', error.stdout || error.message);
      }
    }
  }

  /**
   * Validate configuration
   */
  private async validateConfiguration(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('📋 Validating configuration...');
      
      // Validate platform configuration (cdk.json)
      console.log('  🔍 Validating platform configuration...');
      if (!fs.existsSync('cdk.json')) {
        throw new Error('Platform configuration file (cdk.json) not found');
      }

      // Validate JSON syntax
      try {
        const cdkJson = JSON.parse(fs.readFileSync('cdk.json', 'utf8'));
        if (!cdkJson.context) {
          throw new Error('Platform configuration missing context section');
        }
        
        // Check for required platform fields
        const context = cdkJson.context;
        const requiredPlatformFields = ['platform', 'environments', 'defaults'];
        const missingFields = requiredPlatformFields.filter(field => !context[field]);
        
        if (missingFields.length > 0) {
          throw new Error(`Platform configuration missing required fields: ${missingFields.join(', ')}`);
        }
        
        console.log('    ✅ Platform configuration syntax and structure valid');
      } catch (error) {
        throw new Error(`Platform configuration validation failed: ${(error as Error).message}`);
      }

      // Validate application configurations
      console.log('  🔍 Validating application configurations...');
      if (fs.existsSync('config/applications')) {
        const configFiles = fs.readdirSync('config/applications').filter(file => file.endsWith('.json'));
        
        if (configFiles.length === 0) {
          console.log('    ⚠️  No application configuration files found');
        } else {
          for (const configFile of configFiles) {
            const filePath = `config/applications/${configFile}`;
            try {
              const appConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              
              // Check for required application fields
              const requiredAppFields = ['applicationName', 'team', 'sourceRepo', 'deploymentTargets'];
              const missingFields = requiredAppFields.filter(field => !appConfig[field]);
              
              if (missingFields.length > 0) {
                throw new Error(`Application configuration ${configFile} missing required fields: ${missingFields.join(', ')}`);
              }
              
              // Validate sourceRepo structure
              if (!appConfig.sourceRepo.owner || !appConfig.sourceRepo.repo || !appConfig.sourceRepo.branch) {
                throw new Error(`Application configuration ${configFile} has invalid sourceRepo structure`);
              }
              
              // Validate deploymentTargets is array
              if (!Array.isArray(appConfig.deploymentTargets) || appConfig.deploymentTargets.length === 0) {
                throw new Error(`Application configuration ${configFile} must have at least one deployment target`);
              }
              
              console.log(`    ✅ ${configFile} configuration valid`);
            } catch (error) {
              throw new Error(`Application configuration ${configFile} validation failed: ${(error as Error).message}`);
            }
          }
        }
      } else {
        console.log('    ⚠️  Application configuration directory not found (config/applications)');
      }

      // Run comprehensive configuration validation using ConfigurationValidator
      console.log('  🔍 Running comprehensive configuration validation...');
      const validator = new ConfigurationValidator({ verbose: false });
      const isValid = await validator.validate();
      
      if (!isValid) {
        throw new Error('Comprehensive configuration validation failed');
      }
      
      this.results.push({
        name: 'Configuration Validation',
        passed: true,
        duration: Date.now() - startTime
      });
      
      console.log('  ✅ All configuration validation passed');
      
    } catch (error: any) {
      this.results.push({
        name: 'Configuration Validation',
        passed: false,
        message: error.message,
        duration: Date.now() - startTime
      });
      
      console.error('  ❌ Configuration validation failed:', error.message);
    }
  }

  /**
   * Check CDK synthesis
   */
  private async checkCdkSynthesis(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('🏗️  Checking CDK synthesis...');
      
      execSync('cdk synth', { stdio: 'pipe' });
      
      this.results.push({
        name: 'CDK Synthesis',
        passed: true,
        duration: Date.now() - startTime
      });
      
      console.log('  ✅ CDK synthesis successful');
      
    } catch (error: any) {
      this.results.push({
        name: 'CDK Synthesis',
        passed: false,
        message: error.stdout || error.message,
        duration: Date.now() - startTime
      });
      
      console.error('  ❌ CDK synthesis failed');
      if (this.options.verbose) {
        console.error('    ', error.stdout || error.message);
      }
    }
  }

  /**
   * Check security constraints
   */
  private async checkSecurityConstraints(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('🔒 Checking security constraints...');
      
      // Check for sensitive files that shouldn't be committed
      const sensitivePatterns = [
        '.git_credentials',
        '*.pem',
        '*.key',
        '.env',
        '.env.local',
        'aws-credentials',
      ];

      let foundSensitiveFiles = false;
      
      for (const pattern of sensitivePatterns) {
        try {
          const output = execSync(`find . -name "${pattern}" -not -path "./node_modules/*" -not -path "./.git/*"`, { 
            encoding: 'utf8',
            stdio: 'pipe'
          });
          
          if (output.trim()) {
            console.error(`  ⚠️  Found sensitive file pattern: ${pattern}`);
            foundSensitiveFiles = true;
          }
        } catch {
          // find command failed, which is fine
        }
      }

      // Check .gitignore for required entries
      const requiredGitIgnoreEntries = [
        '.git_credentials',
        'node_modules',
        'cdk.out',
        '*.js',
        '*.d.ts',
      ];

      let gitIgnoreIssues = false;
      
      if (fs.existsSync('.gitignore')) {
        const gitIgnoreContent = fs.readFileSync('.gitignore', 'utf8');
        
        for (const entry of requiredGitIgnoreEntries) {
          if (!gitIgnoreContent.includes(entry)) {
            console.error(`  ⚠️  Missing .gitignore entry: ${entry}`);
            gitIgnoreIssues = true;
          }
        }
      } else {
        console.error('  ❌ .gitignore file not found');
        gitIgnoreIssues = true;
      }

      const passed = !foundSensitiveFiles && !gitIgnoreIssues;
      
      this.results.push({
        name: 'Security Constraints',
        passed: passed,
        message: passed ? undefined : 'Security issues found',
        duration: Date.now() - startTime
      });
      
      if (passed) {
        console.log('  ✅ Security constraints satisfied');
      } else {
        console.error('  ❌ Security constraint violations found');
      }
      
    } catch (error: any) {
      this.results.push({
        name: 'Security Constraints',
        passed: false,
        message: error.message,
        duration: Date.now() - startTime
      });
      
      console.error('  ❌ Security check failed:', error.message);
    }
  }

  /**
   * Check .gitignore file
   */
  private async checkGitIgnore(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('📁 Checking .gitignore configuration...');
      
      if (!fs.existsSync('.gitignore')) {
        this.results.push({
          name: 'GitIgnore Configuration',
          passed: false,
          message: '.gitignore file not found',
          duration: Date.now() - startTime
        });
        
        console.error('  ❌ .gitignore file not found');
        return;
      }

      const gitIgnoreContent = fs.readFileSync('.gitignore', 'utf8');
      const requiredEntries = [
        '.git_credentials',
        'node_modules/',
        'cdk.out/',
        '*.js',
        '*.d.ts',
        '.env',
        '.env.local',
      ];

      const missingEntries = requiredEntries.filter(entry => 
        !gitIgnoreContent.includes(entry.replace('/', ''))
      );

      if (missingEntries.length === 0) {
        this.results.push({
          name: 'GitIgnore Configuration',
          passed: true,
          duration: Date.now() - startTime
        });
        
        console.log('  ✅ .gitignore configuration is complete');
      } else {
        this.results.push({
          name: 'GitIgnore Configuration',
          passed: false,
          message: `Missing entries: ${missingEntries.join(', ')}`,
          duration: Date.now() - startTime
        });
        
        console.error('  ❌ .gitignore missing required entries:');
        missingEntries.forEach(entry => console.error(`    - ${entry}`));
      }
      
    } catch (error: any) {
      this.results.push({
        name: 'GitIgnore Configuration',
        passed: false,
        message: error.message,
        duration: Date.now() - startTime
      });
      
      console.error('  ❌ .gitignore check failed:', error.message);
    }
  }

  /**
   * Display validation results summary
   */
  private displayResults(totalTime: number): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Pre-commit Validation Results');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${status} ${result.name}${duration}`);
      
      if (result.message) {
        console.log(`   ${result.message}`);
      }
    });

    console.log('='.repeat(60));
    console.log(`📈 Summary: ${passed} passed, ${failed} failed (${totalTime}ms total)`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: PreCommitOptions = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    fix: args.includes('--fix'),
    skipTests: args.includes('--skip-tests'),
    skipLinting: args.includes('--skip-linting'),
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Pre-commit Validation

Usage:
  npm run pre-commit [options]
  npx ts-node scripts/pre-commit-validation.ts [options]

Options:
  --verbose, -v      Show detailed output
  --fix              Automatically fix issues where possible
  --skip-tests       Skip running unit tests
  --skip-linting     Skip linting checks
  --help, -h         Show this help message

Examples:
  npm run pre-commit
  npm run pre-commit -- --verbose --fix
  npm run pre-commit -- --skip-tests
`);
    return;
  }

  const validator = new PreCommitValidator(options);
  const success = await validator.runValidation();
  
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Pre-commit validation failed:', error);
    process.exit(1);
  });
}

export { PreCommitValidator };
#!/usr/bin/env ts-node

/**
 * Credential Setup and Validation Script
 * 
 * This script helps platform engineers set up and validate secure credential handling
 * for local development of the platform pipeline CDK system.
 * 
 * Features:
 * - Validates .gitignore configuration for credential files
 * - Helps set up .git_credentials file for GitHub integration
 * - Validates AWS credential configuration
 * - Provides guidance on secure credential management
 * 
 * Requirements: 4.1, 4.2
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

interface CredentialValidationResult {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
}

interface GitCredentialsConfig {
  githubToken?: string;
  githubUsername?: string;
  connectionArn?: string;
}

class CredentialSetupManager {
  private readonly projectRoot: string;
  private readonly gitIgnorePath: string;
  private readonly gitCredentialsPath: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.gitIgnorePath = path.join(this.projectRoot, '.gitignore');
    this.gitCredentialsPath = path.join(this.projectRoot, '.git_credentials');
  }

  /**
   * Main entry point for credential setup and validation
   */
  public async run(): Promise<void> {
    console.log('🔐 Platform Pipeline Credential Setup and Validation');
    console.log('=' .repeat(60));
    console.log();

    try {
      // Parse command line arguments
      const args = process.argv.slice(2);
      const command = args[0] || 'validate';

      switch (command) {
        case 'validate':
          await this.validateCredentials();
          break;
        case 'setup':
          await this.setupCredentials();
          break;
        case 'check-gitignore':
          await this.validateGitIgnore();
          break;
        case 'help':
          this.showHelp();
          break;
        default:
          console.error(`❌ Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error during credential setup:', error);
      process.exit(1);
    }
  }

  /**
   * Validates all credential-related configurations
   */
  private async validateCredentials(): Promise<void> {
    console.log('🔍 Validating credential configuration...\n');

    const results: CredentialValidationResult[] = [];

    // Validate .gitignore configuration
    results.push(await this.validateGitIgnoreConfig());

    // Validate .git_credentials setup
    results.push(await this.validateGitCredentials());

    // Validate AWS credentials
    results.push(await this.validateAwsCredentials());

    // Validate file permissions
    results.push(await this.validateFilePermissions());

    // Display results
    this.displayValidationResults(results);
  }

  /**
   * Interactive setup process for credentials
   */
  private async setupCredentials(): Promise<void> {
    console.log('🛠️  Setting up credentials for local development...\n');

    // Check .gitignore first
    const gitIgnoreResult = await this.validateGitIgnoreConfig();
    if (!gitIgnoreResult.isValid) {
      console.log('⚠️  .gitignore configuration needs attention:');
      gitIgnoreResult.issues.forEach(issue => console.log(`   - ${issue}`));
      console.log();
    }

    // Setup .git_credentials if needed
    await this.setupGitCredentials();

    // Provide AWS setup guidance
    await this.provideAwsSetupGuidance();

    console.log('✅ Credential setup completed!');
    console.log('💡 Run "npm run credential-setup validate" to verify configuration.');
  }

  /**
   * Validates .gitignore configuration for credential files
   */
  private async validateGitIgnoreConfig(): Promise<CredentialValidationResult> {
    const result: CredentialValidationResult = {
      isValid: true,
      issues: [],
      recommendations: []
    };

    try {
      if (!fs.existsSync(this.gitIgnorePath)) {
        result.isValid = false;
        result.issues.push('.gitignore file does not exist');
        return result;
      }

      const gitIgnoreContent = fs.readFileSync(this.gitIgnorePath, 'utf8');
      const requiredEntries = [
        '.git_credentials',
        '*.pem',
        '*.key'
      ];

      const missingEntries = requiredEntries.filter(entry => 
        !gitIgnoreContent.includes(entry)
      );

      if (missingEntries.length > 0) {
        result.isValid = false;
        result.issues.push(`Missing .gitignore entries: ${missingEntries.join(', ')}`);
      }

      // Check for common credential patterns
      const credentialPatterns = [
        'aws_access_key_id',
        'aws_secret_access_key',
        'github_token',
        '.env'
      ];

      const recommendedEntries = credentialPatterns.filter(pattern => 
        !gitIgnoreContent.toLowerCase().includes(pattern.toLowerCase())
      );

      if (recommendedEntries.length > 0) {
        result.recommendations.push(`Consider adding: ${recommendedEntries.join(', ')}`);
      }

    } catch (error) {
      result.isValid = false;
      result.issues.push(`Error reading .gitignore: ${error}`);
    }

    return result;
  }

  /**
   * Validates .git_credentials file setup
   */
  private async validateGitCredentials(): Promise<CredentialValidationResult> {
    const result: CredentialValidationResult = {
      isValid: true,
      issues: [],
      recommendations: []
    };

    try {
      if (!fs.existsSync(this.gitCredentialsPath)) {
        result.isValid = false;
        result.issues.push('.git_credentials file does not exist');
        result.recommendations.push('Run "npm run credential-setup setup" to create it');
        return result;
      }

      // Check file permissions (should be readable only by owner)
      const stats = fs.statSync(this.gitCredentialsPath);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);
      
      if (permissions !== '600' && permissions !== '644') {
        result.recommendations.push(`Consider setting .git_credentials permissions to 600 (currently ${permissions})`);
      }

      // Validate file content structure
      const content = fs.readFileSync(this.gitCredentialsPath, 'utf8');
      const config = this.parseGitCredentials(content);

      if (!config.githubToken && !config.connectionArn) {
        result.isValid = false;
        result.issues.push('Either GitHub token or CodeConnections ARN is required');
      }

      if (config.githubToken && config.githubToken.length < 20) {
        result.issues.push('GitHub token appears to be invalid (too short)');
      }

    } catch (error) {
      result.isValid = false;
      result.issues.push(`Error validating .git_credentials: ${error}`);
    }

    return result;
  }

  /**
   * Validates AWS credentials configuration
   */
  private async validateAwsCredentials(): Promise<CredentialValidationResult> {
    const result: CredentialValidationResult = {
      isValid: true,
      issues: [],
      recommendations: []
    };

    try {
      // Check AWS CLI installation
      execSync('aws --version', { stdio: 'pipe' });
      
      // Check AWS credentials configuration
      try {
        execSync('aws sts get-caller-identity', { stdio: 'pipe' });
      } catch (error) {
        result.isValid = false;
        result.issues.push('AWS credentials not configured or invalid');
        result.recommendations.push('Run "aws configure" to set up AWS credentials');
      }

      // Check CDK CLI installation
      try {
        execSync('cdk --version', { stdio: 'pipe' });
      } catch (error) {
        result.issues.push('CDK CLI not installed');
        result.recommendations.push('Install CDK CLI: npm install -g aws-cdk');
      }

    } catch (error) {
      result.isValid = false;
      result.issues.push('AWS CLI not installed');
      result.recommendations.push('Install AWS CLI: https://aws.amazon.com/cli/');
    }

    return result;
  }

  /**
   * Validates file permissions for credential files
   */
  private async validateFilePermissions(): Promise<CredentialValidationResult> {
    const result: CredentialValidationResult = {
      isValid: true,
      issues: [],
      recommendations: []
    };

    const credentialFiles = [
      this.gitCredentialsPath,
      path.join(os.homedir(), '.aws', 'credentials'),
      path.join(os.homedir(), '.aws', 'config')
    ];

    for (const filePath of credentialFiles) {
      if (fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          const permissions = (stats.mode & parseInt('777', 8)).toString(8);
          
          if (permissions !== '600' && permissions !== '644') {
            result.recommendations.push(`Consider securing ${path.basename(filePath)} with chmod 600`);
          }
        } catch (error) {
          result.issues.push(`Cannot check permissions for ${filePath}: ${error}`);
        }
      }
    }

    return result;
  }

  /**
   * Interactive setup for .git_credentials file
   */
  private async setupGitCredentials(): Promise<void> {
    console.log('📝 Setting up .git_credentials file...\n');

    if (fs.existsSync(this.gitCredentialsPath)) {
      console.log('ℹ️  .git_credentials file already exists.');
      console.log('   Review the file to ensure it contains valid GitHub credentials.');
      console.log();
      return;
    }

    const template = `# GitHub Credentials for Platform Pipeline
# 
# This file contains credentials for GitHub integration with the platform pipeline.
# It is automatically excluded from version control via .gitignore.
#
# Choose ONE of the following authentication methods:

# Option 1: GitHub Personal Access Token
# GITHUB_TOKEN=ghp_your_personal_access_token_here
# GITHUB_USERNAME=your_github_username

# Option 2: AWS CodeConnections ARN (recommended for production)
# CONNECTION_ARN=arn:aws:codeconnections:region:account:connection/connection-id

# Additional configuration (optional)
# GITHUB_ORG=your_organization_name
# GITHUB_REPO=platform-pipeline-repo-name
# BRANCH=main

# Instructions:
# 1. Uncomment and fill in the appropriate authentication method above
# 2. For GitHub tokens: Create at https://github.com/settings/tokens
#    Required scopes: repo, workflow, admin:repo_hook
# 3. For CodeConnections: Create in AWS Console under Developer Tools > Connections
# 4. Save this file and run: npm run credential-setup validate
`;

    fs.writeFileSync(this.gitCredentialsPath, template, { mode: 0o600 });
    
    console.log('✅ Created .git_credentials template file');
    console.log('📝 Please edit .git_credentials and add your GitHub credentials');
    console.log('💡 The file has been created with secure permissions (600)');
    console.log();
  }

  /**
   * Provides guidance for AWS credential setup
   */
  private async provideAwsSetupGuidance(): Promise<void> {
    console.log('☁️  AWS Credentials Setup Guidance:\n');
    
    console.log('1. Install AWS CLI if not already installed:');
    console.log('   https://aws.amazon.com/cli/\n');
    
    console.log('2. Configure AWS credentials:');
    console.log('   aws configure\n');
    
    console.log('3. Install CDK CLI globally:');
    console.log('   npm install -g aws-cdk\n');
    
    console.log('4. Bootstrap CDK environments:');
    console.log('   npm run bootstrap:all-envs\n');
    
    console.log('💡 For production deployments, use IAM roles instead of long-term credentials.');
    console.log();
  }

  /**
   * Parses .git_credentials file content
   */
  private parseGitCredentials(content: string): GitCredentialsConfig {
    const config: GitCredentialsConfig = {};
    
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) {
        continue;
      }
      
      const [key, value] = trimmed.split('=', 2);
      switch (key.trim().toUpperCase()) {
        case 'GITHUB_TOKEN':
          config.githubToken = value.trim();
          break;
        case 'GITHUB_USERNAME':
          config.githubUsername = value.trim();
          break;
        case 'CONNECTION_ARN':
          config.connectionArn = value.trim();
          break;
      }
    }
    
    return config;
  }

  /**
   * Displays validation results in a formatted way
   */
  private displayValidationResults(results: CredentialValidationResult[]): void {
    let allValid = true;
    let totalIssues = 0;
    let totalRecommendations = 0;

    console.log('📊 Validation Results:\n');

    const categories = [
      'GitIgnore Configuration',
      'Git Credentials',
      'AWS Credentials',
      'File Permissions'
    ];

    results.forEach((result, index) => {
      const category = categories[index];
      const status = result.isValid ? '✅' : '❌';
      
      console.log(`${status} ${category}`);
      
      if (result.issues.length > 0) {
        allValid = false;
        totalIssues += result.issues.length;
        result.issues.forEach(issue => {
          console.log(`   ❌ ${issue}`);
        });
      }
      
      if (result.recommendations.length > 0) {
        totalRecommendations += result.recommendations.length;
        result.recommendations.forEach(rec => {
          console.log(`   💡 ${rec}`);
        });
      }
      
      console.log();
    });

    // Summary
    console.log('=' .repeat(60));
    if (allValid) {
      console.log('🎉 All credential configurations are valid!');
    } else {
      console.log(`⚠️  Found ${totalIssues} issue(s) that need attention.`);
    }
    
    if (totalRecommendations > 0) {
      console.log(`💡 ${totalRecommendations} recommendation(s) for improvement.`);
    }
    
    console.log();
    
    if (!allValid) {
      console.log('🔧 To fix issues, run: npm run credential-setup setup');
      process.exit(1);
    }
  }

  /**
   * Validates .gitignore file specifically
   */
  private async validateGitIgnore(): Promise<void> {
    console.log('🔍 Validating .gitignore configuration...\n');
    
    const result = await this.validateGitIgnoreConfig();
    
    if (result.isValid) {
      console.log('✅ .gitignore configuration is correct');
    } else {
      console.log('❌ .gitignore configuration issues:');
      result.issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
    if (result.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      result.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
    
    console.log();
  }

  /**
   * Shows help information
   */
  private showHelp(): void {
    console.log(`
🔐 Platform Pipeline Credential Setup and Validation

USAGE:
  npm run credential-setup [command]

COMMANDS:
  validate        Validate all credential configurations (default)
  setup          Interactive setup for credentials
  check-gitignore Validate .gitignore configuration only
  help           Show this help message

EXAMPLES:
  npm run credential-setup                    # Validate all configurations
  npm run credential-setup setup             # Interactive setup
  npm run credential-setup check-gitignore   # Check .gitignore only

REQUIREMENTS:
  - Node.js and npm installed
  - Git repository initialized
  - AWS CLI installed (for full validation)
  - CDK CLI installed (for full validation)

SECURITY NOTES:
  - .git_credentials file is automatically excluded from version control
  - File permissions are set to 600 (owner read/write only)
  - Never commit credential files to version control
  - Use IAM roles for production deployments

For more information, see the platform pipeline documentation.
`);
  }
}

// Main execution
if (require.main === module) {
  const manager = new CredentialSetupManager();
  manager.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { CredentialSetupManager };
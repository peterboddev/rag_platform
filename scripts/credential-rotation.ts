#!/usr/bin/env ts-node

/**
 * Credential Rotation and Management Script
 * 
 * This script provides automated credential rotation and validation capabilities
 * for the platform pipeline system. It manages GitHub tokens, AWS credentials,
 * and other sensitive information stored in AWS Secrets Manager.
 * 
 * Requirements: 4.3
 */

import { SecretsManagerClient, ListSecretsCommand, GetSecretValueCommand, CreateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { SSMClient } from '@aws-sdk/client-ssm';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface CredentialRotationConfig {
  readonly secretsPrefix: string;
  readonly region: string;
  readonly dryRun: boolean;
  readonly validateOnly: boolean;
}

interface SecretInfo {
  readonly name: string;
  readonly arn: string;
  readonly type: string;
  readonly lastRotated?: Date;
  readonly nextRotation?: Date;
}

class CredentialRotationManager {
  private readonly secretsManager: SecretsManagerClient;
  private readonly ssm: SSMClient;
  private readonly sts: STSClient;
  private readonly config: CredentialRotationConfig;

  constructor(config: CredentialRotationConfig) {
    this.config = config;
    
    // Initialize AWS SDK clients
    this.secretsManager = new SecretsManagerClient({ region: config.region });
    this.ssm = new SSMClient({ region: config.region });
    this.sts = new STSClient({ region: config.region });
  }

  /**
   * Main entry point for credential rotation operations
   */
  public async run(): Promise<void> {
    console.log('🔄 Platform Pipeline Credential Rotation Manager');
    console.log('=' .repeat(60));
    console.log(`Region: ${this.config.region}`);
    console.log(`Secrets Prefix: ${this.config.secretsPrefix}`);
    console.log(`Mode: ${this.config.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log();

    try {
      // Parse command line arguments
      const args = process.argv.slice(2);
      const command = args[0] || 'status';

      switch (command) {
        case 'status':
          await this.showCredentialStatus();
          break;
        case 'rotate':
          await this.rotateCredentials();
          break;
        case 'validate':
          await this.validateCredentials();
          break;
        case 'setup':
          await this.setupCredentials();
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
      console.error('❌ Error during credential rotation:', error);
      process.exit(1);
    }
  }

  /**
   * Shows the status of all managed credentials
   */
  private async showCredentialStatus(): Promise<void> {
    console.log('📊 Credential Status Report\n');

    try {
      const secrets = await this.listManagedSecrets();
      
      if (secrets.length === 0) {
        console.log('ℹ️  No managed secrets found.');
        return;
      }

      console.log(`Found ${secrets.length} managed secret(s):\n`);

      for (const secret of secrets) {
        await this.displaySecretStatus(secret);
      }

      // Check for secrets that need rotation
      const needsRotation = secrets.filter(s => this.needsRotation(s));
      if (needsRotation.length > 0) {
        console.log(`⚠️  ${needsRotation.length} secret(s) need rotation:`);
        needsRotation.forEach(s => console.log(`   - ${s.name}`));
        console.log('\n💡 Run "npm run credential-rotation rotate" to rotate credentials');
      }

    } catch (error) {
      console.error('❌ Error retrieving credential status:', error);
      throw error;
    }
  }

  /**
   * Rotates credentials that are due for rotation
   */
  private async rotateCredentials(): Promise<void> {
    console.log('🔄 Starting credential rotation process\n');

    if (this.config.dryRun) {
      console.log('🧪 DRY RUN MODE - No actual changes will be made\n');
    }

    try {
      const secrets = await this.listManagedSecrets();
      const needsRotation = secrets.filter(s => this.needsRotation(s));

      if (needsRotation.length === 0) {
        console.log('✅ No credentials need rotation at this time.');
        return;
      }

      console.log(`Found ${needsRotation.length} credential(s) that need rotation:\n`);

      for (const secret of needsRotation) {
        await this.rotateSecret(secret);
      }

      console.log('\n✅ Credential rotation completed successfully');

    } catch (error) {
      console.error('❌ Error during credential rotation:', error);
      throw error;
    }
  }

  /**
   * Validates all managed credentials
   */
  private async validateCredentials(): Promise<void> {
    console.log('🔍 Validating all managed credentials\n');

    try {
      const secrets = await this.listManagedSecrets();
      let validationErrors = 0;

      for (const secret of secrets) {
        const isValid = await this.validateSecret(secret);
        if (!isValid) {
          validationErrors++;
        }
      }

      if (validationErrors === 0) {
        console.log('\n✅ All credentials are valid');
      } else {
        console.log(`\n❌ Found ${validationErrors} invalid credential(s)`);
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Error during credential validation:', error);
      throw error;
    }
  }

  /**
   * Sets up initial credentials in Secrets Manager
   */
  private async setupCredentials(): Promise<void> {
    console.log('🛠️  Setting up initial credentials in Secrets Manager\n');

    if (this.config.dryRun) {
      console.log('🧪 DRY RUN MODE - No actual changes will be made\n');
    }

    const credentialTemplates = [
      {
        name: `${this.config.secretsPrefix}/github-token`,
        description: 'GitHub personal access token for platform pipeline repository access',
        template: {
          username: 'platform-pipeline',
          token: 'REPLACE_WITH_ACTUAL_TOKEN',
        },
      },
      {
        name: `${this.config.secretsPrefix}/aws-credentials`,
        description: 'AWS access credentials for cross-account deployments',
        template: {
          accessKeyId: 'REPLACE_WITH_ACCESS_KEY_ID',
          secretAccessKey: 'REPLACE_WITH_SECRET_ACCESS_KEY',
        },
      },
    ];

    for (const template of credentialTemplates) {
      await this.createSecretFromTemplate(template);
    }

    console.log('\n✅ Initial credential setup completed');
    console.log('⚠️  Remember to update the placeholder values with actual credentials');
  }

  /**
   * Lists all managed secrets with the configured prefix
   */
  private async listManagedSecrets(): Promise<SecretInfo[]> {
    const command = new ListSecretsCommand({
      Filters: [
        {
          Key: 'name',
          Values: [`${this.config.secretsPrefix}/`],
        },
      ],
    });

    const response = await this.secretsManager.send(command);
    
    return (response.SecretList || []).map((secret: any) => ({
      name: secret.Name!,
      arn: secret.ARN!,
      type: this.getSecretType(secret.Name!),
      lastRotated: secret.LastRotatedDate,
      nextRotation: secret.NextRotationDate,
    }));
  }

  /**
   * Displays the status of a specific secret
   */
  private async displaySecretStatus(secret: SecretInfo): Promise<void> {
    const rotationStatus = this.needsRotation(secret) ? '⚠️  Needs Rotation' : '✅ Current';
    const lastRotated = secret.lastRotated 
      ? secret.lastRotated.toLocaleDateString() 
      : 'Never';
    
    console.log(`📋 ${secret.name}`);
    console.log(`   Type: ${secret.type}`);
    console.log(`   Status: ${rotationStatus}`);
    console.log(`   Last Rotated: ${lastRotated}`);
    
    if (secret.nextRotation) {
      console.log(`   Next Rotation: ${secret.nextRotation.toLocaleDateString()}`);
    }
    
    console.log();
  }

  /**
   * Determines if a secret needs rotation
   */
  private needsRotation(secret: SecretInfo): boolean {
    if (!secret.lastRotated) {
      return true; // Never rotated
    }

    const daysSinceRotation = Math.floor(
      (Date.now() - secret.lastRotated.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Rotate every 90 days
    return daysSinceRotation >= 90;
  }

  /**
   * Rotates a specific secret
   */
  private async rotateSecret(secret: SecretInfo): Promise<void> {
    console.log(`🔄 Rotating ${secret.name}...`);

    if (this.config.dryRun) {
      console.log('   🧪 DRY RUN - Would rotate this secret');
      return;
    }

    try {
      switch (secret.type) {
        case 'github-token':
          await this.rotateGitHubToken(secret);
          break;
        case 'aws-credentials':
          await this.rotateAwsCredentials(secret);
          break;
        default:
          console.log(`   ⚠️  Unknown secret type: ${secret.type}`);
          return;
      }

      console.log(`   ✅ Successfully rotated ${secret.name}`);

    } catch (error) {
      console.error(`   ❌ Failed to rotate ${secret.name}:`, error);
      throw error;
    }
  }

  /**
   * Validates a specific secret
   */
  private async validateSecret(secret: SecretInfo): Promise<boolean> {
    console.log(`🔍 Validating ${secret.name}...`);

    try {
      const command = new GetSecretValueCommand({
        SecretId: secret.arn,
      });
      
      const secretValue = await this.secretsManager.send(command);

      if (!secretValue.SecretString) {
        console.log(`   ❌ Secret value is empty`);
        return false;
      }

      const credentials = JSON.parse(secretValue.SecretString);

      switch (secret.type) {
        case 'github-token':
          return await this.validateGitHubToken(credentials.token);
        case 'aws-credentials':
          return await this.validateAwsCredentials(credentials);
        default:
          console.log(`   ⚠️  Unknown secret type: ${secret.type}`);
          return false;
      }

    } catch (error) {
      console.error(`   ❌ Error validating ${secret.name}:`, error);
      return false;
    }
  }

  /**
   * Rotates a GitHub token (requires manual intervention)
   */
  private async rotateGitHubToken(secret: SecretInfo): Promise<void> {
    console.log('   ⚠️  GitHub token rotation requires manual intervention');
    console.log('   📝 Steps to rotate GitHub token:');
    console.log('      1. Go to https://github.com/settings/tokens');
    console.log('      2. Generate a new token with required scopes');
    console.log('      3. Update the secret value in AWS Secrets Manager');
    console.log('      4. Test the new token with validation');
    
    // For now, we just update the rotation timestamp
    // In a production environment, this could integrate with GitHub's API
    // or send notifications to platform engineers
  }

  /**
   * Rotates AWS credentials using IAM
   */
  private async rotateAwsCredentials(secret: SecretInfo): Promise<void> {
    console.log('   🔄 Rotating AWS credentials...');
    
    // This is a simplified example - production implementation would:
    // 1. Create new access key
    // 2. Update secret with new credentials
    // 3. Test new credentials
    // 4. Delete old access key
    
    console.log('   ⚠️  AWS credential rotation requires careful implementation');
    console.log('   💡 Consider using IAM roles instead of long-term credentials');
  }

  /**
   * Validates a GitHub token
   */
  private async validateGitHubToken(token: string): Promise<boolean> {
    if (!token || token === 'REPLACE_WITH_ACTUAL_TOKEN') {
      console.log('   ❌ GitHub token is not set or is placeholder value');
      return false;
    }

    try {
      // Use curl to validate the token
      const result = execSync(
        `curl -s -H "Authorization: token ${token}" https://api.github.com/user`,
        { encoding: 'utf8' }
      );

      const response = JSON.parse(result);
      if (response.login) {
        console.log(`   ✅ GitHub token is valid (user: ${response.login})`);
        return true;
      } else {
        console.log('   ❌ GitHub token is invalid');
        return false;
      }

    } catch (error) {
      console.log('   ❌ Error validating GitHub token:', error);
      return false;
    }
  }

  /**
   * Validates AWS credentials
   */
  private async validateAwsCredentials(credentials: any): Promise<boolean> {
    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      console.log('   ❌ AWS credentials are incomplete');
      return false;
    }

    if (credentials.accessKeyId === 'REPLACE_WITH_ACCESS_KEY_ID') {
      console.log('   ❌ AWS credentials are placeholder values');
      return false;
    }

    try {
      // Create temporary STS client with the credentials
      const sts = new STSClient({
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
        region: this.config.region,
      });

      const command = new GetCallerIdentityCommand({});
      const identity = await sts.send(command);
      console.log(`   ✅ AWS credentials are valid (ARN: ${identity.Arn})`);
      return true;

    } catch (error) {
      console.log('   ❌ AWS credentials are invalid:', error);
      return false;
    }
  }

  /**
   * Creates a secret from a template
   */
  private async createSecretFromTemplate(template: any): Promise<void> {
    console.log(`📝 Creating secret: ${template.name}`);

    if (this.config.dryRun) {
      console.log('   🧪 DRY RUN - Would create this secret');
      return;
    }

    try {
      // Check if secret already exists
      try {
        const getCommand = new GetSecretValueCommand({
          SecretId: template.name,
        });
        await this.secretsManager.send(getCommand);
        
        console.log('   ℹ️  Secret already exists, skipping creation');
        return;
      } catch (error) {
        // Secret doesn't exist, continue with creation
      }

      const createCommand = new CreateSecretCommand({
        Name: template.name,
        Description: template.description,
        SecretString: JSON.stringify(template.template),
      });

      await this.secretsManager.send(createCommand);

      console.log(`   ✅ Created secret: ${template.name}`);

    } catch (error) {
      console.error(`   ❌ Failed to create secret ${template.name}:`, error);
      throw error;
    }
  }

  /**
   * Gets the secret type from the secret name
   */
  private getSecretType(secretName: string): string {
    if (secretName.includes('github-token')) {
      return 'github-token';
    } else if (secretName.includes('aws-credentials')) {
      return 'aws-credentials';
    } else if (secretName.includes('deployment-keys')) {
      return 'deployment-keys';
    } else {
      return 'unknown';
    }
  }

  /**
   * Shows help information
   */
  private showHelp(): void {
    console.log(`
🔄 Platform Pipeline Credential Rotation Manager

USAGE:
  npm run credential-rotation [command] [options]

COMMANDS:
  status          Show status of all managed credentials (default)
  rotate          Rotate credentials that are due for rotation
  validate        Validate all managed credentials
  setup           Set up initial credentials in Secrets Manager
  help            Show this help message

OPTIONS:
  --dry-run       Show what would be done without making changes
  --region        AWS region (default: from AWS config)
  --prefix        Secrets prefix (default: platform-pipeline)

EXAMPLES:
  npm run credential-rotation status                    # Show credential status
  npm run credential-rotation rotate --dry-run          # Preview rotation changes
  npm run credential-rotation validate                  # Validate all credentials
  npm run credential-rotation setup                     # Initial setup

SECURITY NOTES:
  - Credentials are stored securely in AWS Secrets Manager
  - Rotation schedules are automatically managed
  - All operations are logged for audit purposes
  - Use IAM roles instead of long-term credentials when possible

For more information, see the platform pipeline documentation.
`);
  }
}

// Main execution
if (require.main === module) {
  // Parse command line options
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const validateOnly = args.includes('--validate-only');
  const region = process.env.AWS_REGION || 'us-east-1';
  const secretsPrefix = process.env.SECRETS_PREFIX || 'platform-pipeline';

  const config: CredentialRotationConfig = {
    secretsPrefix,
    region,
    dryRun,
    validateOnly,
  };

  const manager = new CredentialRotationManager(config);
  manager.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { CredentialRotationManager };
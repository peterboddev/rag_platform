#!/usr/bin/env ts-node

/**
 * Credential Sync Script
 * 
 * This script syncs GitHub credentials from .git_credentials file to AWS Secrets Manager
 * for secure storage and use in CI/CD pipelines.
 */

import { SecretsManagerClient, UpdateSecretCommand, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import * as fs from 'fs';
import * as path from 'path';

interface GitCredentials {
  githubToken?: string;
  githubUsername?: string;
  connectionArn?: string;
}

class CredentialSyncManager {
  private readonly secretsManager: SecretsManagerClient;
  private readonly region: string;
  private readonly secretsPrefix: string;

  constructor(region: string = 'us-east-1', secretsPrefix: string = 'platform-pipeline') {
    this.region = region;
    this.secretsPrefix = secretsPrefix;
    this.secretsManager = new SecretsManagerClient({ region });
  }

  /**
   * Main sync operation
   */
  public async sync(): Promise<void> {
    console.log('🔄 Syncing credentials from .git_credentials to AWS Secrets Manager');
    console.log('=' .repeat(70));
    console.log();

    try {
      // 1. Read credentials from .git_credentials
      const localCredentials = this.readLocalCredentials();
      
      if (!localCredentials.githubToken || !localCredentials.githubUsername) {
        console.error('❌ GitHub token or username not found in .git_credentials');
        console.log('💡 Please update .git_credentials with your GitHub token and username');
        process.exit(1);
      }

      if (localCredentials.githubToken === 'ghp_your_personal_access_token_here') {
        console.error('❌ Please replace the placeholder GitHub token with your actual token');
        process.exit(1);
      }

      // 2. Validate the GitHub token
      console.log('🔍 Validating GitHub token...');
      const isValid = await this.validateGitHubToken(localCredentials.githubToken);
      
      if (!isValid) {
        console.error('❌ GitHub token validation failed');
        process.exit(1);
      }

      // 3. Update AWS Secrets Manager
      console.log('📤 Updating AWS Secrets Manager...');
      await this.updateSecretsManager(localCredentials);

      // 4. Verify the update
      console.log('✅ Verifying stored credentials...');
      await this.verifyStoredCredentials();

      console.log();
      console.log('🎉 Credential sync completed successfully!');
      console.log('💡 Your GitHub credentials are now securely stored in AWS Secrets Manager');
      console.log('🔒 CI/CD pipelines will use the stored credentials automatically');

    } catch (error) {
      console.error('❌ Error during credential sync:', error);
      process.exit(1);
    }
  }

  /**
   * Reads credentials from .git_credentials file
   */
  private readLocalCredentials(): GitCredentials {
    const gitCredentialsPath = path.join(process.cwd(), '.git_credentials');
    
    if (!fs.existsSync(gitCredentialsPath)) {
      throw new Error('.git_credentials file not found');
    }

    const content = fs.readFileSync(gitCredentialsPath, 'utf8');
    const credentials: GitCredentials = {};

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) {
        continue;
      }

      const [key, value] = trimmed.split('=', 2);
      switch (key.trim().toUpperCase()) {
        case 'GITHUB_TOKEN':
          credentials.githubToken = value.trim();
          break;
        case 'GITHUB_USERNAME':
          credentials.githubUsername = value.trim();
          break;
        case 'CONNECTION_ARN':
          credentials.connectionArn = value.trim();
          break;
      }
    }

    return credentials;
  }

  /**
   * Validates GitHub token by making an API call
   */
  private async validateGitHubToken(token: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'platform-pipeline-credential-sync'
        }
      });

      if (response.ok) {
        const user = await response.json();
        console.log(`   ✅ Token is valid (user: ${user.login})`);
        return true;
      } else {
        console.log(`   ❌ Token validation failed: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.log('   ❌ Error validating token:', error);
      return false;
    }
  }

  /**
   * Updates the GitHub token in AWS Secrets Manager
   */
  private async updateSecretsManager(credentials: GitCredentials): Promise<void> {
    const secretName = `${this.secretsPrefix}/github-token`;
    
    const secretValue = {
      username: credentials.githubUsername,
      token: credentials.githubToken,
      updatedAt: new Date().toISOString(),
      source: 'local-git-credentials'
    };

    try {
      const command = new UpdateSecretCommand({
        SecretId: secretName,
        SecretString: JSON.stringify(secretValue)
      });

      await this.secretsManager.send(command);
      console.log(`   ✅ Updated secret: ${secretName}`);

    } catch (error) {
      console.error(`   ❌ Failed to update secret: ${error}`);
      throw error;
    }
  }

  /**
   * Verifies that the credentials were stored correctly
   */
  private async verifyStoredCredentials(): Promise<void> {
    const secretName = `${this.secretsPrefix}/github-token`;

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretName
      });

      const response = await this.secretsManager.send(command);
      
      if (response.SecretString) {
        const storedCredentials = JSON.parse(response.SecretString);
        
        if (storedCredentials.token && storedCredentials.username) {
          console.log(`   ✅ Credentials verified in AWS Secrets Manager`);
          console.log(`   📅 Updated: ${storedCredentials.updatedAt}`);
          console.log(`   👤 Username: ${storedCredentials.username}`);
        } else {
          throw new Error('Stored credentials are incomplete');
        }
      } else {
        throw new Error('No secret value found');
      }

    } catch (error) {
      console.error(`   ❌ Failed to verify stored credentials: ${error}`);
      throw error;
    }
  }

  /**
   * Shows current status of stored credentials
   */
  public async status(): Promise<void> {
    console.log('📊 Credential Status');
    console.log('=' .repeat(30));
    console.log();

    try {
      // Check local credentials
      console.log('📁 Local Credentials (.git_credentials):');
      const localCredentials = this.readLocalCredentials();
      
      if (localCredentials.githubToken) {
        const tokenPreview = localCredentials.githubToken.substring(0, 10) + '...';
        console.log(`   🔑 GitHub Token: ${tokenPreview}`);
        console.log(`   👤 Username: ${localCredentials.githubUsername || 'Not set'}`);
      } else {
        console.log('   ❌ No GitHub token found');
      }

      console.log();

      // Check AWS Secrets Manager
      console.log('☁️  AWS Secrets Manager:');
      const secretName = `${this.secretsPrefix}/github-token`;

      try {
        const command = new GetSecretValueCommand({
          SecretId: secretName
        });

        const response = await this.secretsManager.send(command);
        
        if (response.SecretString) {
          const storedCredentials = JSON.parse(response.SecretString);
          console.log(`   ✅ Secret exists: ${secretName}`);
          console.log(`   👤 Username: ${storedCredentials.username || 'Not set'}`);
          console.log(`   📅 Last updated: ${storedCredentials.updatedAt || 'Unknown'}`);
        }
      } catch (error) {
        console.log(`   ❌ Secret not found or inaccessible: ${secretName}`);
      }

    } catch (error) {
      console.error('❌ Error checking credential status:', error);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'sync';

  const manager = new CredentialSyncManager();

  switch (command) {
    case 'sync':
      await manager.sync();
      break;
    case 'status':
      await manager.status();
      break;
    case 'help':
      console.log(`
🔄 Credential Sync Manager

USAGE:
  npm run sync-credentials [command]

COMMANDS:
  sync      Sync credentials from .git_credentials to AWS Secrets Manager (default)
  status    Show current credential status
  help      Show this help message

EXAMPLES:
  npm run sync-credentials                    # Sync credentials
  npm run sync-credentials status             # Check status
`);
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { CredentialSyncManager };
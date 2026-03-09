# Configuration Migration Guide

## Overview

This guide explains how to migrate from the single-file configuration approach (all configuration in `cdk.json`) to the separated configuration architecture (platform configuration in `cdk.json`, application configurations in separate files).

## Migration Benefits

- **Separation of Concerns**: Platform infrastructure settings are separate from application-specific configurations
- **Better Maintainability**: Each application team can manage their own configuration files
- **Improved Validation**: Dedicated JSON schemas for platform and application configurations
- **Backward Compatibility**: Migration is gradual and maintains compatibility during transition

## Migration Process

### Phase 1: Preparation (Current State)

The new configuration system is already implemented and working. The system uses a `HybridConfigurationLoader` that:

1. **Platform Configuration**: Always loads from `cdk.json` context
2. **Application Configuration**: Tries file-based loading first, falls back to `cdk.json` context
3. **Validation**: Validates both platform and application configurations

### Phase 2: Extract Application Configurations

#### Step 1: Create Application Configuration Directory

```bash
mkdir -p config/applications
```

#### Step 2: Extract Application Configurations

For each application in your `cdk.json` context, create a separate JSON file:

**Example: Extract `rag-app` configuration**

From `cdk.json`:
```json
{
  "context": {
    "applications": {
      "rag-app": {
        "applicationName": "rag-app",
        "team": "ai-team",
        "sourceRepo": {
          "owner": "peterboddev",
          "repo": "rag",
          "branch": "main"
        },
        "deploymentTargets": ["dev", "staging", "prod"],
        "enabled": true
      }
    }
  }
}
```

To `config/applications/rag-app.json`:
```json
{
  "applicationName": "rag-app",
  "team": "ai-team",
  "sourceRepo": {
    "owner": "peterboddev",
    "repo": "rag",
    "branch": "main"
  },
  "buildConfig": {
    "runtime": "20",
    "commands": [
      "echo 'Installing dependencies...'",
      "npm ci",
      "echo 'Running tests...'",
      "npm run test --if-present",
      "echo 'Building application...'",
      "npm run build --if-present",
      "echo 'Build completed successfully'"
    ],
    "environment": {
      "NPM_CONFIG_CACHE": "/tmp/.npm"
    }
  },
  "deploymentTargets": ["dev", "staging", "prod"],
  "enabled": true
}
```

#### Step 3: Remove Application Configurations from cdk.json

After creating separate application configuration files, remove the `applications` section from `cdk.json`:

```json
{
  "context": {
    "platform": {
      "region": "us-east-1",
      "account": "450683699755",
      "artifactBucketPrefix": "platform-pipeline"
    },
    "platformRepository": {
      "owner": "peterboddev",
      "repo": "rag_platform",
      "branch": "main",
      "description": "Platform pipeline infrastructure repository"
    },
    "environments": {
      "dev": { /* ... */ },
      "staging": { /* ... */ },
      "prod": { /* ... */ }
    },
    "defaults": {
      "buildRuntime": "20",
      "computeType": "BUILD_GENERAL1_SMALL",
      "buildImage": "AMAZON_LINUX_2_STANDARD_3_0_ARM",
      "cacheEnabled": true
    }
    // Remove "applications" section - now in separate files
  }
}
```

### Phase 3: Validation and Testing

#### Step 1: Validate Configuration Structure

```bash
# Validate platform configuration
npm run validate-config

# Run pre-commit validation (includes configuration validation)
npm run pre-commit

# Test CDK synthesis
cdk synth
```

#### Step 2: Test Pipeline Deployment

```bash
# Deploy platform pipeline with new configuration structure
cdk deploy PlatformPipelineStack
```

#### Step 3: Verify Application Pipeline Creation

The platform pipeline should automatically detect and create pipelines for applications in the `config/applications/` directory.

## Configuration Schemas

### Platform Configuration Schema

Platform configuration must include:

- `platform`: AWS account, region, and artifact bucket settings
- `platformRepository`: GitHub repository containing platform pipeline code
- `environments`: Environment definitions (dev, staging, prod, etc.)
- `defaults`: Default build settings for all applications

### Application Configuration Schema

Application configuration must include:

- `applicationName`: Unique application identifier
- `team`: Team responsible for the application
- `sourceRepo`: GitHub repository containing application code
- `deploymentTargets`: List of environments to deploy to
- `buildConfig` (optional): Custom build settings
- `notifications` (optional): Notification settings
- `enabled` (optional): Whether application is enabled (default: true)

## Migration Script

You can use this script to automate the migration:

```typescript
#!/usr/bin/env ts-node

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
  buildConfig?: any;
  deploymentTargets: string[];
  notifications?: any;
  enabled?: boolean;
}

async function migrateApplicationConfigurations() {
  console.log('🔄 Starting application configuration migration...');

  // Read current cdk.json
  const cdkJsonPath = 'cdk.json';
  if (!fs.existsSync(cdkJsonPath)) {
    throw new Error('cdk.json not found');
  }

  const cdkJson = JSON.parse(fs.readFileSync(cdkJsonPath, 'utf8'));
  const applications = cdkJson.context?.applications || {};

  if (Object.keys(applications).length === 0) {
    console.log('✅ No applications found in cdk.json - migration not needed');
    return;
  }

  // Create applications directory
  const appsDir = 'config/applications';
  if (!fs.existsSync(appsDir)) {
    fs.mkdirSync(appsDir, { recursive: true });
    console.log(`📁 Created directory: ${appsDir}`);
  }

  // Extract each application to separate file
  for (const [appName, appConfig] of Object.entries(applications)) {
    const appFilePath = path.join(appsDir, `${appName}.json`);
    
    // Write application configuration to separate file
    fs.writeFileSync(appFilePath, JSON.stringify(appConfig, null, 2));
    console.log(`✅ Extracted ${appName} configuration to ${appFilePath}`);
  }

  // Remove applications from cdk.json
  delete cdkJson.context.applications;
  fs.writeFileSync(cdkJsonPath, JSON.stringify(cdkJson, null, 2));
  console.log('✅ Removed applications section from cdk.json');

  console.log('🎉 Migration completed successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Run: npm run validate-config');
  console.log('2. Run: cdk synth');
  console.log('3. Run: cdk deploy PlatformPipelineStack');
}

// Run migration
if (require.main === module) {
  migrateApplicationConfigurations().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
}
```

## Rollback Process

If you need to rollback to the single-file configuration:

1. **Copy application configurations back to cdk.json**:
   ```bash
   # Manually merge application configs back into cdk.json context.applications
   ```

2. **Remove application configuration files**:
   ```bash
   rm -rf config/applications
   ```

3. **Redeploy platform pipeline**:
   ```bash
   cdk deploy PlatformPipelineStack
   ```

## Troubleshooting

### Common Issues

#### 1. "Environment 'staging' not found" Error

**Cause**: Application configuration references environments that don't exist in platform configuration.

**Solution**: Ensure all environments referenced in `deploymentTargets` are defined in `cdk.json` environments section.

#### 2. Configuration Validation Fails

**Cause**: Missing required fields in application configuration files.

**Solution**: Check that each application configuration file has all required fields:
- `applicationName`
- `team`
- `sourceRepo` (with `owner`, `repo`, `branch`)
- `deploymentTargets`

#### 3. Pipeline Not Finding Applications

**Cause**: Application configuration files not in correct directory or format.

**Solution**: 
- Ensure files are in `config/applications/` directory
- Ensure files have `.json` extension
- Ensure JSON syntax is valid
- Ensure `enabled` is not set to `false`

### Validation Commands

```bash
# Validate configuration structure
npm run validate-config

# Validate JSON syntax
find config/applications -name "*.json" -exec jq empty {} \;

# Run comprehensive validation
npm run pre-commit

# Test CDK synthesis
cdk synth
```

## Best Practices

1. **File Naming**: Use kebab-case for application configuration files (e.g., `my-app.json`)

2. **Version Control**: Commit application configuration files to version control

3. **Team Ownership**: Each application team should own their configuration file

4. **Environment Consistency**: Ensure all applications reference valid environments

5. **Validation**: Always run validation before committing configuration changes

6. **Backup**: Keep a backup of your original `cdk.json` before migration

## Support

If you encounter issues during migration:

1. Check the validation output for specific error messages
2. Ensure all required fields are present in configuration files
3. Verify JSON syntax using `jq` or similar tools
4. Test CDK synthesis before deployment
5. Review the configuration loader logs for debugging information

The migration maintains backward compatibility, so you can always rollback if needed.
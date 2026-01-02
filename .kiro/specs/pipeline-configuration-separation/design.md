# Design Document

## Overview

This design explores architectural options for separating platform pipeline configuration from application pipeline configurations. The current single `cdk.json` approach mixes platform infrastructure settings with application-specific configurations, creating coupling between platform changes and application onboarding.

## Architecture Analysis

### Current Architecture Issues

**Single Configuration File Problems:**
- Platform infrastructure changes require touching application configurations
- Application onboarding requires platform pipeline repository modifications
- Configuration validation is mixed between platform and application concerns
- Scaling challenges as more applications are added
- Unclear ownership boundaries between platform and application teams

### Architecture Options

#### Option 1: File-Based Separation (Recommended)

**Structure:**
```
platform-pipeline/
├── cdk.json                    # Platform-only configuration
├── config/
│   ├── platform.json          # Platform settings (alternative to cdk.json context)
│   └── applications/           # Application configurations
│       ├── rag-app.json
│       ├── web-app.json
│       └── api-service.json
```

**Platform Configuration (cdk.json):**
```json
{
  "app": "npx ts-node --prefer-ts-exts bin/platform-pipeline.ts",
  "context": {
    "platform": {
      "region": "us-east-1",
      "account": "450683699755",
      "artifactBucketPrefix": "platform-pipeline"
    },
    "platformRepository": {
      "owner": "peterboddev",
      "repo": "rag_platform",
      "branch": "main"
    },
    "environments": {
      "dev": { "name": "Development", "account": "450683699755", "region": "us-east-1" },
      "staging": { "name": "Staging", "account": "450683699755", "region": "us-east-1" },
      "prod": { "name": "Production", "account": "450683699755", "region": "us-east-1" }
    },
    "defaults": {
      "buildRuntime": "20",
      "computeType": "BUILD_GENERAL1_SMALL",
      "buildImage": "AMAZON_LINUX_2_STANDARD_3_0_ARM"
    }
  }
}
```

**Application Configuration (config/applications/rag-app.json):**
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
    "commands": ["npm ci", "npm run test", "npm run build"],
    "environment": {
      "NODE_ENV": "production"
    }
  },
  "deploymentTargets": ["dev", "staging", "prod"],
  "enabled": true
}
```

**Advantages:**
- Clear separation of concerns
- Application teams can manage their own configurations
- Platform changes don't affect application configurations
- Easy to add new applications without platform pipeline changes
- Simple file-based discovery mechanism

**Disadvantages:**
- Requires configuration loading logic changes
- Multiple files to manage
- Need to ensure application configurations are valid

#### Option 2: External Configuration Management

**Structure:**
- Platform configuration remains in `cdk.json`
- Application configurations stored in AWS Systems Manager Parameter Store or AWS AppConfig
- Configuration discovery via AWS APIs

**Advantages:**
- Centralized configuration management
- Runtime configuration updates without deployments
- Built-in validation and rollback capabilities
- Fine-grained access control

**Disadvantages:**
- Additional AWS service dependencies
- More complex configuration loading
- Requires AWS API access during build
- Higher operational complexity

#### Option 3: Repository-Per-Application Configuration

**Structure:**
- Each application repository contains its own pipeline configuration
- Platform pipeline discovers configurations via GitHub API or webhooks
- Configuration stored in application repositories as `.pipeline/config.json`

**Advantages:**
- Application teams have full control over their pipeline configuration
- Configuration lives with application code
- Natural versioning with application releases

**Disadvantages:**
- Platform pipeline needs access to all application repositories
- Complex discovery mechanism
- Potential security concerns with cross-repository access
- Harder to enforce platform standards

## Components and Interfaces

### Configuration Loader Interface

```typescript
interface ConfigurationLoader {
  loadPlatformConfig(): PlatformConfig;
  loadApplicationConfigs(): ApplicationConfig[];
  validateConfiguration(config: any): ValidationResult;
}
```

### File-Based Configuration Loader

```typescript
class FileBasedConfigurationLoader implements ConfigurationLoader {
  private platformConfigPath: string;
  private applicationConfigDir: string;

  loadPlatformConfig(): PlatformConfig {
    // Load from cdk.json context or separate platform.json
  }

  loadApplicationConfigs(): ApplicationConfig[] {
    // Scan config/applications/ directory
    // Load and validate each JSON file
    // Return array of valid configurations
  }

  validateConfiguration(config: any): ValidationResult {
    // Validate against JSON schema
    // Check required fields
    // Validate cross-references (environments, etc.)
  }
}
```

### Configuration Manager Updates

```typescript
class ConfigurationManager {
  private loader: ConfigurationLoader;

  constructor(scope: Construct, loader?: ConfigurationLoader) {
    this.loader = loader || new FileBasedConfigurationLoader();
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): PlatformConfig {
    const platformConfig = this.loader.loadPlatformConfig();
    const applicationConfigs = this.loader.loadApplicationConfigs();
    
    return {
      ...platformConfig,
      applications: this.convertApplicationConfigs(applicationConfigs)
    };
  }
}
```

## Data Models

### Platform Configuration Schema

```typescript
interface PlatformOnlyConfig {
  platform: {
    region: string;
    account: string;
    artifactBucketPrefix?: string;
  };
  platformRepository: {
    owner: string;
    repo: string;
    branch: string;
  };
  environments: { [envName: string]: EnvironmentConfig };
  defaults: {
    buildRuntime: string;
    computeType: string;
    buildImage: string;
    cacheEnabled: boolean;
  };
}
```

### Application Configuration Schema

```typescript
interface ApplicationOnlyConfig {
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
```

## Migration Strategy

### Phase 1: Backward Compatibility

1. **Extend ConfigurationManager** to support both old and new formats
2. **Add FileBasedConfigurationLoader** alongside existing CDK context loading
3. **Implement fallback logic**: try new format first, fall back to old format
4. **Maintain existing validation** for both formats

### Phase 2: Configuration Extraction

1. **Extract application configurations** from `cdk.json` to separate files
2. **Update platform configuration** to remove application sections
3. **Test thoroughly** to ensure no functionality regression
4. **Document migration process** for future applications

### Phase 3: New Format Only

1. **Remove backward compatibility** code
2. **Simplify ConfigurationManager** to use only new format
3. **Update documentation** and examples
4. **Provide migration tools** for any remaining old-format configurations

## Error Handling

### Configuration Loading Errors

```typescript
class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly configType: 'platform' | 'application',
    public readonly configName?: string,
    public readonly validationErrors?: string[]
  ) {
    super(message);
  }
}
```

### Validation Strategy

1. **Schema Validation**: JSON Schema validation for structure
2. **Cross-Reference Validation**: Ensure deployment targets reference valid environments
3. **Business Rule Validation**: Application-specific validation rules
4. **Early Failure**: Fail fast with descriptive error messages

## Testing Strategy

### Unit Tests

- Configuration loading from different sources
- Validation logic for both platform and application configurations
- Error handling for malformed configurations
- Migration logic between old and new formats

### Integration Tests

- End-to-end configuration loading in CDK context
- Platform pipeline creation with separated configurations
- Application pipeline creation from file-based configurations
- Validation script compatibility with new configuration format

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Platform Configuration Isolation
*For any* platform configuration loaded by the system, it should contain only platform-specific keys (platform, platformRepository, environments, defaults) and no application-specific data
**Validates: Requirements 1.1, 1.3**

### Property 2: Application Configuration Isolation  
*For any* application configuration loaded by the system, it should contain only application-specific keys (applicationName, team, sourceRepo, buildConfig, deploymentTargets) and no platform-specific data
**Validates: Requirements 2.2**

### Property 3: Configuration Discovery Completeness
*For any* set of valid application configuration files in the expected directory, the configuration loader should discover and load all of them
**Validates: Requirements 3.1, 3.2**

### Property 4: Configuration Filtering
*For any* application configuration marked as disabled or invalid, it should be excluded from the final loaded configuration set
**Validates: Requirements 3.3**

### Property 5: Schema Validation Consistency
*For any* configuration object, validation should produce consistent results regardless of whether it's loaded from old or new format
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 6: Backward Compatibility Equivalence
*For any* logical configuration, loading it from old format (cdk.json) and new format (separate files) should produce equivalent platform configuration objects
**Validates: Requirements 5.1, 5.2**

### Property 7: Configuration Loader Interface Consistency
*For any* configuration loader implementation (file-based, external, etc.), loading the same logical configuration should produce equivalent results
**Validates: Requirements 2.4, 3.4**

### Property 8: Platform Infrastructure Independence
*For any* change to platform configuration, existing application configurations should remain valid and unchanged
**Validates: Requirements 1.2, 2.3**

### Property 9: Configuration Format Detection
*For any* configuration loading scenario, when only new format configurations exist, the system should use only the new format loader and not attempt old format loading
**Validates: Requirements 5.4**
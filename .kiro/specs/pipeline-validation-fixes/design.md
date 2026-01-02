# Pipeline Validation Fixes - Design

## Architecture Overview

This design addresses two critical pipeline issues:
1. **CodeBuild Image Configuration**: Ensure all CodeBuild steps use ARM-based images
2. **Configuration Loading Integration**: Update validation scripts to use the new hybrid configuration architecture

## Design Decisions

### 1. CodeBuild Image Standardization

**Decision**: Standardize all CodeBuild steps to use ARM-based `AMAZON_LINUX_2_STANDARD_3_0` image

**Rationale**:
- ARM images provide better price/performance ratio
- Node.js 20 is pre-installed and fully compatible
- Eliminates npm version compatibility warnings
- Aligns with steering document requirements

**Implementation**:
```typescript
buildEnvironment: {
  buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
  computeType: codebuild.ComputeType.SMALL,
}
```

### 2. Configuration Loading Integration

**Decision**: Update `validate-configs.ts` to use `HybridConfigurationLoader`

**Rationale**:
- Leverages existing hybrid configuration architecture
- Maintains backward compatibility with CDK context
- Supports new file-based application configurations
- Provides clear error messages for configuration issues

**Implementation**:
```typescript
// Replace direct CDK context access with HybridConfigurationLoader
const loader = new HybridConfigurationLoader();
const platformConfig = loader.loadPlatformConfig();
const applicationConfigs = loader.loadApplicationConfigs();
```

## Component Design

### 1. Platform Pipeline Stack Updates

**File**: `lib/platform-pipeline-stack.ts`

**Changes Required**:
- Update `ValidateApplicationConfigs` CodeBuild step to use ARM image
- Ensure `partialBuildSpec` specifies `nodejs: 20`
- Verify all CodeBuild steps use consistent image configuration

**Current Issue**:
```typescript
// PROBLEM: Missing buildEnvironment configuration in ValidateApplicationConfigs step
new CodeBuildStep('ValidateApplicationConfigs', {
  commands: [...],
  // Missing: buildEnvironment with ARM image
})
```

**Solution**:
```typescript
new CodeBuildStep('ValidateApplicationConfigs', {
  commands: [...],
  buildEnvironment: {
    buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
    computeType: codebuild.ComputeType.SMALL,
  },
  partialBuildSpec: codebuild.BuildSpec.fromObject({
    version: '0.2',
    phases: {
      install: {
        'runtime-versions': {
          nodejs: '20'
        }
      }
    }
  }),
})
```

### 2. Configuration Validation Script Updates

**File**: `scripts/validate-configs.ts`

**Changes Required**:
- Replace direct CDK context loading with `HybridConfigurationLoader`
- Update validation logic to work with separated platform/application configs
- Improve error messages for new configuration architecture

**Current Issue**:
```typescript
// PROBLEM: Expects 'applications' key in CDK context
const requiredKeys = ['platform', 'environments', 'applications'];
for (const key of requiredKeys) {
  if (!cdkJson.context[key]) {
    console.error(`❌ Required CDK context key '${key}' missing`);
    return false;
  }
}
```

**Solution**:
```typescript
// Use HybridConfigurationLoader instead
import { HybridConfigurationLoader } from '../lib/config/configuration-loaders';

class ConfigurationValidator {
  private loader: HybridConfigurationLoader;

  constructor() {
    this.loader = new HybridConfigurationLoader();
  }

  async validateAll(): Promise<boolean> {
    // Load configurations using hybrid loader
    const platformConfig = this.loader.loadPlatformConfig();
    const applicationConfigs = this.loader.loadApplicationConfigs();
    
    // Validate platform configuration
    const platformValid = this.validatePlatformConfig(platformConfig);
    
    // Validate application configurations
    const appsValid = this.validateApplicationConfigs(applicationConfigs);
    
    return platformValid && appsValid;
  }
}
```

### 3. Configuration Manager Integration

**File**: `lib/config/platform-config.ts`

**Changes Required**:
- Ensure `ConfigurationManager` uses `HybridConfigurationLoader` by default
- Update constructor to accept optional loader parameter
- Maintain backward compatibility

**Implementation**:
```typescript
export class ConfigurationManager {
  private loader: ConfigurationLoader;

  constructor(
    scope: Construct, 
    loader?: ConfigurationLoader
  ) {
    // Use HybridConfigurationLoader by default
    this.loader = loader || new HybridConfigurationLoader();
    // ... rest of constructor
  }
}
```

## Data Flow

### Configuration Loading Flow
```
1. HybridConfigurationLoader.loadPlatformConfig()
   └── FileBasedConfigurationLoader.loadPlatformConfig()
       └── Read cdk.json context

2. HybridConfigurationLoader.loadApplicationConfigs()
   ├── Try: FileBasedConfigurationLoader.loadApplicationConfigs()
   │   └── Read config/applications/*.json files
   └── Fallback: CdkContextConfigurationLoader.loadApplicationConfigs()
       └── Read cdk.json context.applications (if exists)

3. Validation
   ├── Validate platform config structure
   ├── Validate each application config structure
   └── Validate cross-references (environments, etc.)
```

### Pipeline Execution Flow
```
1. Platform Pipeline Synth Step
   ├── Uses: AMAZON_LINUX_2_STANDARD_3_0 (ARM)
   ├── Runtime: nodejs: 20
   └── Commands: npm install, build, test, cdk synth

2. ValidateApplicationConfigs Step
   ├── Uses: AMAZON_LINUX_2_STANDARD_3_0 (ARM)
   ├── Runtime: nodejs: 20
   └── Commands: validate-configs.ts (with HybridConfigurationLoader)

3. Application Pipeline Deployment
   └── Uses validated configurations from hybrid loader
```

## Error Handling

### Configuration Loading Errors
- **Missing Platform Config**: Clear error pointing to `cdk.json`
- **Missing Application Configs**: Warning if no files found, fallback to CDK context
- **Invalid JSON**: Specific file and line number information
- **Missing Required Fields**: Field-specific error messages

### CodeBuild Image Errors
- **Image Not Available**: Clear error about ARM image availability in region
- **Runtime Version Mismatch**: Error about Node.js 20 requirement
- **Compute Type Issues**: Guidance on supported compute types for ARM

## Testing Strategy

### Unit Tests
- Test `HybridConfigurationLoader` with various configuration scenarios
- Test configuration validation with both valid and invalid configs
- Test error handling for missing files and invalid JSON

### Integration Tests
- Test pipeline with ARM-based CodeBuild images
- Test configuration loading in CodeBuild environment
- Test validation script with actual configuration files

### Validation Scenarios
1. **File-based configs only**: Applications in `config/applications/`, none in CDK context
2. **CDK context only**: Applications in CDK context, no files
3. **Mixed scenario**: Some applications in files, some in CDK context
4. **Empty scenario**: No applications configured anywhere
5. **Invalid configs**: Malformed JSON, missing required fields

## Performance Considerations

### ARM Image Benefits
- 20% better price/performance ratio compared to x86
- Faster build times due to optimized architecture
- Native Node.js 20 support eliminates compatibility overhead

### Configuration Loading
- File-based loading is faster than CDK context parsing
- Caching of loaded configurations within validation script
- Minimal memory footprint for configuration objects

## Security Considerations

### Configuration Files
- Application configs contain repository information (not sensitive)
- No credentials stored in configuration files
- CodeConnections handles authentication securely

### CodeBuild Environment
- ARM images have same security profile as x86 images
- Node.js 20 includes latest security patches
- Environment variables properly scoped to build context

## Migration Path

### Immediate Changes (This Spec)
1. Fix CodeBuild image configuration in platform pipeline
2. Update `validate-configs.ts` to use `HybridConfigurationLoader`
3. Test with existing `rag-app.json` configuration

### Future Enhancements
1. Migrate remaining applications from CDK context to files
2. Add configuration schema validation
3. Implement configuration file watching for local development

## Rollback Plan

### If ARM Images Fail
- Revert to x86 images with explicit Node.js 20 installation
- Update buildspec to install Node.js 20 manually
- Monitor for compatibility issues

### If Configuration Loading Fails
- Revert `validate-configs.ts` to CDK context-only loading
- Move application configs back to CDK context temporarily
- Investigate and fix hybrid loader issues

## Success Metrics

### Technical Metrics
- Pipeline build time (should improve with ARM images)
- Configuration loading time (should be faster with files)
- Error rate in validation steps (should decrease)

### Functional Metrics
- Pipeline success rate (should reach 100%)
- Configuration validation accuracy (no false positives/negatives)
- Developer experience (clear error messages, fast feedback)
# Pipeline Validation Fixes - Implementation Tasks

## Task Breakdown

### Phase 1: Fix CodeBuild Image Configuration

#### Task 1.1: Update Platform Pipeline Stack CodeBuild Configuration
**Priority**: Critical  
**Estimated Time**: 15 minutes  
**File**: `lib/platform-pipeline-stack.ts`

**Description**: Fix the `ValidateApplicationConfigs` CodeBuild step to use ARM-based image

**Implementation Steps**:
1. Locate the `ValidateApplicationConfigs` CodeBuildStep in `addStage` pre-deployment validation
2. Add `buildEnvironment` configuration with ARM image
3. Add `partialBuildSpec` with Node.js 20 runtime
4. Verify all other CodeBuild steps use consistent configuration

**Code Changes**:
```typescript
// In the pre-deployment validation step
new CodeBuildStep('ValidateApplicationConfigs', {
  commands: [
    // ... existing commands
  ],
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
}),
```

**Acceptance Criteria**:
- [ ] `ValidateApplicationConfigs` step uses `AMAZON_LINUX_2_STANDARD_3_0` image
- [ ] Runtime version is set to `nodejs: 20`
- [ ] Compute type is `SMALL` for cost efficiency
- [ ] Configuration matches main synth step

#### Task 1.2: Verify Promotion Validation Steps
**Priority**: Medium  
**Estimated Time**: 10 minutes  
**File**: `lib/platform-pipeline-stack.ts`

**Description**: Ensure promotion validation steps also use ARM images

**Implementation Steps**:
1. Locate the `ValidatePromotion-${envName}` CodeBuildStep creation
2. Verify it has proper `buildEnvironment` and `partialBuildSpec`
3. Update if necessary to match the main validation step

**Acceptance Criteria**:
- [ ] All promotion validation steps use ARM images
- [ ] Runtime versions are consistent across all steps

### Phase 2: Update Configuration Validation Script

#### Task 2.1: Integrate HybridConfigurationLoader
**Priority**: Critical  
**Estimated Time**: 30 minutes  
**File**: `scripts/validate-configs.ts`

**Description**: Replace direct CDK context access with `HybridConfigurationLoader`

**Implementation Steps**:
1. Import `HybridConfigurationLoader` from configuration-loaders
2. Replace `ConfigurationManager` instantiation with direct loader usage
3. Update `validateCdkContext()` method to use hybrid loading
4. Remove hardcoded 'applications' requirement from CDK context
5. Add proper error handling for configuration loading failures

**Code Changes**:
```typescript
import { HybridConfigurationLoader } from '../lib/config/configuration-loaders';

class ConfigurationValidator {
  private loader: HybridConfigurationLoader;

  constructor() {
    this.loader = new HybridConfigurationLoader();
  }

  private async validateCdkContext(): Promise<boolean> {
    console.log('📋 Validating platform configuration...');
    
    try {
      // Load platform config using hybrid loader
      const platformConfig = this.loader.loadPlatformConfig();
      
      // Validate platform configuration structure
      const validation = this.loader.validateConfiguration(platformConfig, 'platform');
      if (!validation.isValid) {
        console.error('❌ Platform configuration validation failed:');
        validation.errors.forEach(error => console.error(`   - ${error}`));
        return false;
      }

      console.log('✅ Platform configuration validation passed');
      return true;
    } catch (error) {
      console.error('❌ Platform configuration loading failed:', error);
      return false;
    }
  }
}
```

**Acceptance Criteria**:
- [ ] Script uses `HybridConfigurationLoader` instead of direct CDK context access
- [ ] No longer requires 'applications' key in CDK context
- [ ] Loads platform config from `cdk.json` successfully
- [ ] Provides clear error messages for configuration issues

#### Task 2.2: Update Application Configuration Validation
**Priority**: Critical  
**Estimated Time**: 20 minutes  
**File**: `scripts/validate-configs.ts`

**Description**: Update application validation to work with file-based configs

**Implementation Steps**:
1. Update `validateApplicationConfigs()` method to use hybrid loader
2. Remove duplicate file reading logic (now handled by loader)
3. Use loader's validation methods instead of custom validation
4. Update error messages to reflect new configuration architecture

**Code Changes**:
```typescript
private async validateApplicationConfigs(): Promise<boolean> {
  console.log('📱 Validating application configuration files...');
  
  try {
    // Load application configs using hybrid loader
    const applicationConfigs = this.loader.loadApplicationConfigs();
    
    if (applicationConfigs.length === 0) {
      console.warn('⚠️  No application configurations found');
      return true; // Not an error if no applications are configured
    }

    // Validate each application configuration
    for (const appConfig of applicationConfigs) {
      console.log(`   Validating ${appConfig.applicationName}...`);
      
      const validation = this.loader.validateConfiguration(appConfig, 'application');
      if (!validation.isValid) {
        console.error(`❌ Application '${appConfig.applicationName}' validation failed:`);
        validation.errors.forEach(error => console.error(`   - ${error}`));
        return false;
      }
    }

    console.log(`✅ Application configuration files validated (${applicationConfigs.length} applications)`);
    return true;
  } catch (error) {
    console.error('❌ Application configuration validation failed:', error);
    return false;
  }
}
```

**Acceptance Criteria**:
- [ ] Validates applications loaded from `config/applications/*.json`
- [ ] Falls back to CDK context if no files exist
- [ ] Uses loader's validation methods
- [ ] Provides clear error messages for each application

#### Task 2.3: Update Configuration Manager Integration
**Priority**: Medium  
**Estimated Time**: 15 minutes  
**File**: `scripts/validate-configs.ts`

**Description**: Update remaining methods to use hybrid loader consistently

**Implementation Steps**:
1. Update `validatePlatformConfiguration()` to use loaded config
2. Update `validateDependencies()` to use loaded configs
3. Update `generateReport()` to use loaded configs
4. Remove redundant configuration loading

**Acceptance Criteria**:
- [ ] All methods use configurations from hybrid loader
- [ ] No redundant configuration loading
- [ ] Report generation works with new architecture

### Phase 3: Update Configuration Manager Default

#### Task 3.1: Update ConfigurationManager Constructor
**Priority**: Low  
**Estimated Time**: 10 minutes  
**File**: `lib/config/platform-config.ts`

**Description**: Make `HybridConfigurationLoader` the default for `ConfigurationManager`

**Implementation Steps**:
1. Import `HybridConfigurationLoader`
2. Update constructor to use hybrid loader by default
3. Maintain backward compatibility with custom loaders
4. Update any existing instantiations if needed

**Code Changes**:
```typescript
import { HybridConfigurationLoader, ConfigurationLoader } from './configuration-loaders';

export class ConfigurationManager {
  private loader: ConfigurationLoader;

  constructor(
    scope: Construct, 
    loader?: ConfigurationLoader
  ) {
    this.loader = loader || new HybridConfigurationLoader();
    // ... rest of constructor
  }
}
```

**Acceptance Criteria**:
- [ ] `ConfigurationManager` uses `HybridConfigurationLoader` by default
- [ ] Custom loaders can still be passed to constructor
- [ ] No breaking changes to existing code

### Phase 4: Testing and Validation

#### Task 4.1: Test Configuration Loading
**Priority**: High  
**Estimated Time**: 15 minutes  

**Description**: Test the updated validation script locally

**Implementation Steps**:
1. Run `npx ts-node scripts/validate-configs.ts` locally
2. Verify it loads platform config from `cdk.json`
3. Verify it loads application config from `config/applications/rag-app.json`
4. Test error scenarios (missing files, invalid JSON)

**Acceptance Criteria**:
- [ ] Script runs successfully with current configuration
- [ ] Loads platform config correctly
- [ ] Loads application config correctly
- [ ] Provides clear error messages for issues

#### Task 4.2: Test Pipeline Deployment
**Priority**: High  
**Estimated Time**: 10 minutes  

**Description**: Deploy updated pipeline and verify CodeBuild image usage

**Implementation Steps**:
1. Deploy platform pipeline: `cdk deploy PlatformPipelineStack`
2. Trigger pipeline execution (push to repository)
3. Monitor CodeBuild logs for ARM image usage
4. Verify validation step completes successfully

**Acceptance Criteria**:
- [ ] Pipeline deploys successfully
- [ ] CodeBuild uses ARM-based image
- [ ] Validation step passes
- [ ] No image compatibility errors

### Phase 5: Documentation Updates

#### Task 5.1: Update Steering Document
**Priority**: Low  
**Estimated Time**: 5 minutes  
**File**: `.kiro/steering/platform-pipeline-architecture.md`

**Description**: Update documentation to reflect fixes

**Implementation Steps**:
1. Add note about ARM image configuration being enforced
2. Update configuration loading section to mention hybrid approach
3. Add troubleshooting section for common issues

**Acceptance Criteria**:
- [ ] Documentation reflects current implementation
- [ ] Troubleshooting guidance is clear
- [ ] Examples are up to date

## Task Dependencies

```
Task 1.1 (Fix CodeBuild Config) 
├── Task 1.2 (Verify Promotion Steps)
└── Task 4.2 (Test Pipeline Deployment)

Task 2.1 (Integrate HybridLoader)
├── Task 2.2 (Update App Validation)
├── Task 2.3 (Update Manager Integration)
└── Task 4.1 (Test Configuration Loading)

Task 3.1 (Update ConfigManager) 
└── Task 4.1 (Test Configuration Loading)

Task 4.1 (Test Config Loading)
└── Task 4.2 (Test Pipeline Deployment)

Task 4.2 (Test Pipeline Deployment)
└── Task 5.1 (Update Documentation)
```

## Execution Order

### Critical Path (Must be completed first)
1. **Task 1.1**: Fix CodeBuild image configuration
2. **Task 2.1**: Integrate HybridConfigurationLoader
3. **Task 2.2**: Update application configuration validation
4. **Task 4.1**: Test configuration loading locally
5. **Task 4.2**: Test pipeline deployment

### Parallel Tasks (Can be done simultaneously)
- **Task 1.2**: Verify promotion validation steps (parallel with Task 2.x)
- **Task 2.3**: Update configuration manager integration (parallel with Task 3.1)
- **Task 3.1**: Update ConfigurationManager constructor (parallel with Task 2.3)

### Final Tasks (After critical path)
- **Task 5.1**: Update documentation

## Risk Mitigation

### High-Risk Tasks
- **Task 2.1**: Major changes to validation script
  - **Mitigation**: Test thoroughly locally before deployment
  - **Rollback**: Keep backup of original script

- **Task 4.2**: Pipeline deployment testing
  - **Mitigation**: Monitor CloudWatch logs closely
  - **Rollback**: Revert to previous pipeline version if issues

### Medium-Risk Tasks
- **Task 1.1**: CodeBuild configuration changes
  - **Mitigation**: ARM images are well-tested in AWS
  - **Rollback**: Revert to x86 images if compatibility issues

## Success Criteria

### Technical Success
- [ ] Pipeline builds successfully without CodeBuild image errors
- [ ] Configuration validation passes in pipeline execution
- [ ] `validate-configs.ts` works with hybrid configuration loading
- [ ] All CodeBuild steps use ARM-based images with Node.js 20

### Functional Success
- [ ] No regression in existing functionality
- [ ] Clear error messages for configuration issues
- [ ] Improved build performance with ARM images
- [ ] Consistent configuration loading across all scripts

### Quality Success
- [ ] Code follows existing patterns and conventions
- [ ] Documentation is updated and accurate
- [ ] Error handling is comprehensive
- [ ] Testing validates all scenarios
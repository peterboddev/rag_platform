# Development Scripts and Utilities

This directory contains utility scripts that support local development workflows for the platform pipeline CDK system. These scripts help platform engineers validate, test, and deploy infrastructure changes efficiently.

## Available Scripts

### Core Development Workflow

#### `local-dev-workflow.ts`
**Command:** `npm run local-dev`

Comprehensive local development workflow that runs all necessary checks before committing code.

**Features:**
- Environment prerequisite checks
- TypeScript compilation
- Unit test execution
- Configuration validation
- CDK synthesis
- Optional diff display

**Usage:**
```bash
npm run local-dev                    # Run full workflow
npm run local-dev -- --verbose      # Show detailed output
npm run local-dev -- --skip-tests   # Skip unit tests
npm run local-dev -- --interactive  # Interactive mode with prompts
npm run local-dev:status            # Show current workflow status
npm run local-dev:clean             # Clean generated files
```

#### `pre-commit-validation.ts`
**Command:** `npm run pre-commit`

Comprehensive validation checks designed to run before commits to ensure code quality.

**Features:**
- TypeScript compilation check
- Code formatting validation (Prettier)
- Linting checks (ESLint)
- Unit test execution
- Configuration validation
- CDK synthesis validation
- Security constraint checks
- .gitignore validation

**Usage:**
```bash
npm run pre-commit                  # Run all pre-commit checks
npm run pre-commit:fix             # Auto-fix issues where possible
npm run pre-commit -- --verbose    # Show detailed output
npm run pre-commit -- --skip-tests # Skip unit tests
```

### Configuration Management

#### `validate-config.ts`
**Command:** `npm run validate-config`

Validates platform configuration files and CDK context to ensure all settings are correct.

**Features:**
- Configuration file syntax validation
- Merged configuration validation
- Schema validation
- Security constraint validation
- Directory structure validation
- CDK context validation

**Usage:**
```bash
npm run validate-config             # Basic validation
npm run validate-config:verbose     # Detailed validation with summary
npm run validate-config:fix         # Create missing directories
npm run validate-config:sample      # Generate sample configuration
```

#### `credential-setup.ts`
**Command:** `npm run credential-setup`

Sets up and validates secure credential handling for local development and CI/CD execution.

**Features:**
- .gitignore configuration validation
- .git_credentials file setup and validation
- AWS credential configuration checks
- File permission validation
- Interactive credential setup
- Security best practices guidance

**Usage:**
```bash
npm run credential-setup             # Validate all credential configurations
npm run credential-setup setup      # Interactive setup process
npm run credential-setup check-gitignore  # Validate .gitignore only
npm run credential-setup help       # Show detailed help
```

### Environment Management

#### `bootstrap-environments.ts`
**Command:** `npm run bootstrap:all-envs`

Bootstraps CDK environments across multiple AWS accounts and regions based on configuration.

**Features:**
- Multi-environment bootstrapping
- Bootstrap status checking
- Dry-run mode
- Force mode for error recovery
- Detailed progress reporting

**Usage:**
```bash
npm run bootstrap:all-envs          # Bootstrap all environments
npm run bootstrap:all-envs -- --dry-run    # Show what would be done
npm run bootstrap:all-envs -- --verbose    # Show detailed output
npm run bootstrap:all-envs -- --force      # Continue on errors
npm run bootstrap:all-envs -- --check      # Check bootstrap status
```

### Testing Utilities

#### `test-utilities.ts`
**Command:** `npm run test:utilities`

Comprehensive testing framework for unit tests, CDK tests, integration tests, and configuration tests.

**Features:**
- Unit test execution with Jest
- CDK snapshot testing
- Integration test support
- Configuration validation testing
- Coverage reporting
- Test report generation (JSON/HTML)

**Usage:**
```bash
npm run test:utilities              # Run all tests
npm run test:utilities -- --coverage       # Generate coverage report
npm run test:utilities -- --verbose        # Show detailed output
npm run test:utilities -- --pattern "Security"  # Run specific tests
npm run test:utilities -- --updateSnapshot # Update Jest snapshots
npm run test:utilities -- --report         # Generate test reports
npm run test:clean                  # Clean test artifacts
```

## NPM Script Reference

### Build and Compilation
- `npm run build` - Compile TypeScript
- `npm run watch` - Watch mode compilation
- `npm run clean` - Clean compiled files
- `npm run reset` - Clean and rebuild

### Testing
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run test:utilities` - Run comprehensive test suite
- `npm run test:clean` - Clean test artifacts

### CDK Operations
- `npm run diff` - Show infrastructure changes
- `npm run diff:all` - Show changes for all stacks
- `npm run synth` - Synthesize CloudFormation templates
- `npm run synth:all` - Synthesize all stacks
- `npm run deploy` - Deploy infrastructure (with validation)
- `npm run deploy:all` - Deploy all stacks
- `npm run deploy:security` - Deploy security stack only
- `npm run deploy:pipeline` - Deploy pipeline stack only
- `npm run bootstrap` - Bootstrap current environment
- `npm run bootstrap:all-envs` - Bootstrap all configured environments
- `npm run destroy` - Destroy infrastructure
- `npm run destroy:all` - Destroy all stacks

### Validation and Quality
- `npm run validate` - Quick validation (build + test + config)
- `npm run validate:full` - Comprehensive validation
- `npm run validate-config` - Configuration validation only
- `npm run validate-config:verbose` - Detailed configuration validation
- `npm run validate-config:fix` - Fix configuration issues
- `npm run credential-setup` - Credential setup and validation
- `npm run local-dev` - Local development workflow
- `npm run pre-commit` - Pre-commit validation

## Development Workflow

### Recommended Daily Workflow

1. **Start Development Session**
   ```bash
   npm run local-dev:status    # Check current status
   npm run local-dev          # Run full validation
   ```

2. **Make Changes**
   - Edit TypeScript files
   - Update configuration as needed
   - Add/update tests

3. **Validate Changes**
   ```bash
   npm run validate           # Quick validation
   npm run diff              # Review infrastructure changes
   ```

4. **Before Committing**
   ```bash
   npm run pre-commit        # Comprehensive pre-commit checks
   ```

5. **Deploy Changes**
   ```bash
   npm run deploy            # Deploy to AWS
   ```

### Environment Setup Workflow

1. **Initial Setup**
   ```bash
   npm install               # Install dependencies
   npm run credential-setup setup  # Set up secure credentials
   npm run validate-config   # Validate configuration
   npm run bootstrap:all-envs # Bootstrap environments
   ```

2. **Configuration Changes**
   ```bash
   npm run validate-config:verbose  # Validate changes
   npm run synth:all               # Test synthesis
   ```

3. **Credential Validation**
   ```bash
   npm run credential-setup validate  # Validate credential setup
   ```

### Testing Workflow

1. **Development Testing**
   ```bash
   npm test                  # Quick unit tests
   npm run test:watch       # Continuous testing
   ```

2. **Comprehensive Testing**
   ```bash
   npm run test:utilities -- --coverage  # Full test suite with coverage
   npm run test:utilities -- --report    # Generate test reports
   ```

## Script Dependencies

All scripts require:
- Node.js (v18+)
- npm
- AWS CLI (configured)
- CDK CLI
- TypeScript

Optional dependencies:
- Prettier (for code formatting)
- ESLint (for linting)

## Configuration Files

Scripts read configuration from:
- `package.json` - npm scripts and dependencies
- `tsconfig.json` - TypeScript compilation settings
- `cdk.json` - CDK configuration and context
- `jest.config.js` - Jest testing configuration
- `config/` directory - Platform configuration files

## Error Handling

All scripts include comprehensive error handling:
- Clear error messages with actionable guidance
- Exit codes (0 = success, 1 = failure)
- Verbose modes for debugging
- Rollback capabilities where applicable

## Security Considerations

Scripts automatically check for:
- Sensitive files in version control
- Required .gitignore entries
- AWS credential configuration
- IAM permission validation

## Troubleshooting

### Common Issues

1. **TypeScript Compilation Errors**
   ```bash
   npm run clean && npm run build
   ```

2. **Configuration Validation Failures**
   ```bash
   npm run validate-config:verbose
   npm run validate-config:fix
   ```

3. **CDK Synthesis Errors**
   ```bash
   npm run build
   cdk synth --verbose
   ```

4. **Test Failures**
   ```bash
   npm run test:utilities -- --verbose
   npm run test:clean
   ```

### Getting Help

Each script supports `--help` flag:
```bash
npx ts-node scripts/validate-config.ts --help
npx ts-node scripts/bootstrap-environments.ts --help
npx ts-node scripts/local-dev-workflow.ts --help
```

## Contributing

When adding new scripts:
1. Follow the existing naming convention
2. Include comprehensive help text
3. Add error handling and validation
4. Update this README
5. Add corresponding npm scripts to package.json
6. Include unit tests where applicable
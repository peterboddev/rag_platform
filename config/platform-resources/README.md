# Platform Resources Configuration

This directory contains resource specifications for platform-provided infrastructure that application teams consume.

## Purpose

These configuration files document:
- What resources the platform provides to each application
- Resource names, ARNs, and identifiers
- Access permissions and capabilities
- How to retrieve configuration values
- What app teams are responsible for creating

## File Structure

```
config/platform-resources/
└── README.md                      # This file (guidance only)

config/applications/
├── [app-name].json                # Application pipeline configuration
└── [app-name]-requirements.json   # Simple resource requirements
```

## Resource Management Approach

### Single Source of Truth: CDK Code

All platform resources are defined in CDK code:
- `lib/constructs/data-storage.ts` - DynamoDB tables
- `lib/constructs/cognito-authentication.ts` - Cognito resources
- `lib/constructs/vector-database.ts` - OpenSearch collections
- `lib/constructs/application-integration.ts` - IAM roles and permissions

### Simple Requirements Tracking

**Location**: `config/applications/[app-name]-requirements.json`

**Purpose**: Track what app teams requested
- Simple, readable format
- Just resource names and basic info
- Updated when app teams make requests
- Does NOT duplicate CDK code or deployment details

**Example**: `config/applications/rag-app-requirements.json`

### Runtime Configuration: SSM Parameter Store

All deployed resource values are stored in SSM Parameter Store:
```bash
# Get all configuration for an application
aws ssm get-parameters-by-path --path "/rag-app/dev/" --recursive
```

**Why SSM Parameter Store?**
- ✅ Automatically populated by CDK during deployment
- ✅ Always up-to-date with actual deployed resources
- ✅ No manual maintenance required
- ✅ Programmatically accessible by app teams
- ✅ Single source of truth for runtime configuration

## Resource Specification Format

### Requirements File (Simple)

Each application requirements file contains:
- Application metadata (name, environment, team)
- List of requested platform resources
- Basic purpose for each resource
- Deployment status

**This file does NOT contain:**
- Detailed schemas (see CDK code)
- SSM parameter paths (retrieved at runtime)
- CloudFormation exports (managed by CDK)
- Detailed permissions (see CDK IAM policies)

### Where to Find Detailed Information

1. **Resource Definitions**: CDK code in `lib/constructs/`
2. **Deployed Values**: SSM Parameter Store
3. **Permissions**: CDK IAM policies in `lib/constructs/application-integration.ts`
4. **Usage Guide**: `docs/rag-app-team-guide-v2.md`

## Usage

### For Platform Team

When app teams request resources:

1. **Check existing resources**: Review the application's resource file
2. **Update if needed**: Add new resources to the JSON file
3. **Deploy infrastructure**: Use CDK to deploy the resources
4. **Update the file**: Document the deployed resources with actual names/ARNs
5. **Commit changes**: Version control the resource specifications

### For Application Teams

To find what resources are available:

1. **Read your resource file**: `config/platform-resources/[your-app]-resources.json`
2. **Retrieve configuration**: Use the commands in `retrievingConfiguration` section
3. **Use in your code**: Reference the resource names/ARNs in your application

### Example: Retrieving All Configuration

```bash
# Get all parameters for your application
aws ssm get-parameters-by-path \
  --path "/rag-app/dev/" \
  --recursive \
  --query 'Parameters[*].[Name,Value]' \
  --output table

# Get specific resource
aws ssm get-parameter \
  --name "/rag-app/dev/dynamodb/customers-table-name" \
  --query 'Parameter.Value' \
  --output text
```

## Resource Naming Conventions

All platform resources follow consistent naming patterns:

### DynamoDB Tables
- Format: `{applicationName}-{purpose}-{environment}`
- Example: `rag-app-customers-dev`

### Cognito Resources
- User Pool: `{applicationName}-users-{environment}`
- Example: `rag-app-users-dev`

### OpenSearch Collections
- Format: `{applicationName}-vectors-{environment}`
- Example: `rag-app-vectors-dev`

### IAM Roles
- Format: `{applicationName}-{purpose}-role-{environment}`
- Example: `rag-app-rag-role-dev`

### SSM Parameters
- Format: `/{applicationName}/{environment}/{service}/{parameter-name}`
- Example: `/rag-app/dev/dynamodb/customers-table-name`

### CloudFormation Exports
- Format: `{applicationName}-{environment}-{resource-type}`
- Example: `rag-app-dev-customers-table`

## Maintenance

### Adding New Resources

1. Update the application's resource JSON file
2. Add the resource specification with:
   - Resource name/identifier
   - Purpose and description
   - SSM parameter path
   - CloudFormation export name (if applicable)
   - Permissions granted to app team

3. Deploy the infrastructure
4. Verify the resource is accessible
5. Commit the updated configuration

### Removing Resources

1. Coordinate with app team to ensure resource is no longer used
2. Remove from infrastructure code
3. Deploy the change
4. Update the resource JSON file
5. Document the removal in git commit message

## Best Practices

1. **Keep files up-to-date**: Update resource files immediately after infrastructure changes
2. **Document everything**: Include purpose, permissions, and retrieval methods
3. **Version control**: Commit all changes with descriptive messages
4. **Validate before deploy**: Ensure resource names match conventions
5. **Communicate changes**: Notify app teams of any resource modifications

## Related Documentation

- Platform Architecture: `docs/PLATFORM_ARCHITECTURE.md`
- RAG App Team Guide: `docs/rag-app-team-guide-v2.md`
- Modular Stack Deployment: `docs/modular-stack-deployment.md`
- Application Pipeline Configuration: `docs/application-pipeline-configuration.md`

## Support

For questions about platform resources:
1. Check the resource specification file for your application
2. Review the related documentation
3. Contact the platform team for assistance

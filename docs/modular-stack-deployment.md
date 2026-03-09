# Modular Stack Deployment Guide

## Overview

The RAG infrastructure has been refactored into separate, independent stacks for better modularity, easier troubleshooting, and independent deployment capabilities.

## Stack Architecture

### 1. Network Stack (`rag-app-network-dev`)
- **Purpose**: VPC and networking infrastructure
- **Resources**: VPC, subnets, security groups, NAT gateways
- **Dependencies**: None (foundation stack)
- **Exports**: VPC ID, VPC CIDR

### 2. Storage Stack (`rag-app-storage-dev`) - DEPRECATED
- **Status**: Removed - App teams create their own S3 buckets
- **Reason**: S3 buckets are application-specific, not platform infrastructure

### 3. Data Storage Stack (`rag-app-data-storage-dev`)
- **Purpose**: DynamoDB tables for application data
- **Resources**: Customers table, documents table
- **Dependencies**: Network Stack (for VPC lookup)
- **Exports**: Table names, table ARNs

### 4. Authentication Stack (`rag-app-authentication-dev`)
- **Purpose**: User authentication and authorization
- **Resources**: Cognito user pool, user pool client, identity pool
- **Dependencies**: Storage Stack (for callback URLs)
- **Exports**: User pool ID, client ID, identity pool ID

### 5. Vector Database Stack (`rag-app-vector-db-dev`)
- **Purpose**: Vector storage for embeddings
- **Resources**: OpenSearch Serverless collection, security policies
- **Dependencies**: Network Stack (for VPC)
- **Exports**: Collection endpoint, collection ARN, index name

### 6. API Gateway Stack (`rag-app-api-gateway-dev`)
- **Purpose**: API endpoints for application
- **Resources**: REST API, Cognito authorizer, health check endpoint
- **Dependencies**: Authentication Stack
- **Exports**: API ID, API URL, root resource ID

### 7. Application Integration Stack (`rag-app-integration-dev`)
- **Purpose**: IAM roles and SSM parameters for app teams
- **Resources**: Application IAM role, 17 SSM parameters
- **Dependencies**: All other stacks
- **Exports**: Application role ARN, Bedrock model IDs

## Deployment Commands

### Deploy All Stacks (Recommended for Initial Setup)

```bash
# Deploy all stacks in dependency order
npx cdk deploy --all \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --require-approval never \
  --region us-east-1
```

### Deploy Individual Stacks

```bash
# Network Stack (foundation)
npx cdk deploy rag-app-network-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --require-approval never

# Storage Stack
npx cdk deploy rag-app-storage-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --require-approval never

# Data Storage Stack (DynamoDB tables)
npx cdk deploy rag-app-data-storage-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --require-approval never

# Authentication Stack
npx cdk deploy rag-app-authentication-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --require-approval never

# Vector Database Stack
npx cdk deploy rag-app-vector-db-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --require-approval never

# API Gateway Stack
npx cdk deploy rag-app-api-gateway-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --require-approval never

# Application Integration Stack (SSM parameters)
npx cdk deploy rag-app-integration-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --require-approval never
```

### Destroy Individual Stacks

```bash
# Destroy in reverse dependency order

# 1. Application Integration Stack (depends on all)
npx cdk destroy rag-app-integration-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --force

# 2. API Gateway Stack
npx cdk destroy rag-app-api-gateway-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --force

# 3. Vector Database Stack
npx cdk destroy rag-app-vector-db-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --force

# 4. Authentication Stack
npx cdk destroy rag-app-authentication-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --force

# 5. Data Storage Stack
npx cdk destroy rag-app-data-storage-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --force

# 6. Storage Stack
npx cdk destroy rag-app-storage-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --force

# 7. Network Stack (foundation)
npx cdk destroy rag-app-network-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --force
```

### Destroy All Stacks

```bash
# Destroy all stacks (handles dependencies automatically)
npx cdk destroy --all \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --force
```

## Benefits of Modular Architecture

### 1. Independent Deployment
- Deploy only the stacks you need to update
- Faster deployment times for individual components
- Reduced blast radius for changes

### 2. Better Isolation
- Issues in one stack don't affect others
- Easier to troubleshoot specific components
- Clear separation of concerns

### 3. Easier Rollback
- Roll back individual stacks without affecting others
- Maintain stable components while fixing issues
- Granular version control

### 4. Clearer Dependencies
- Explicit stack dependencies via `addDependency()`
- CloudFormation exports for cross-stack references
- Better understanding of infrastructure relationships

### 5. Flexible Updates
- Update DynamoDB tables without touching OpenSearch
- Modify API Gateway without redeploying authentication
- Change SSM parameters independently

## Common Scenarios

### Scenario 1: Add New DynamoDB Table

```bash
# 1. Update DataStorageConstruct in lib/constructs/data-storage.ts
# 2. Deploy only Data Storage Stack
npx cdk deploy rag-app-data-storage-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts"

# 3. Update Application Integration Stack to add SSM parameter
npx cdk deploy rag-app-integration-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts"
```

### Scenario 2: Update API Gateway Configuration

```bash
# Deploy only API Gateway Stack
npx cdk deploy rag-app-api-gateway-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts"
```

### Scenario 3: Fix OpenSearch Collection Issue

```bash
# 1. Destroy Vector Database Stack
npx cdk destroy rag-app-vector-db-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --force

# 2. Redeploy Vector Database Stack
npx cdk deploy rag-app-vector-db-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts"

# 3. Update Application Integration Stack (if needed)
npx cdk deploy rag-app-integration-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts"
```

### Scenario 4: Fresh Deployment

```bash
# Deploy all stacks in correct order
npx cdk deploy --all \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --require-approval never
```

## Verification

### Check Stack Status

```bash
# List all stacks
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `rag-app`)].{Name:StackName,Status:StackStatus}' \
  --output table
```

### Verify Exports

```bash
# List all CloudFormation exports
aws cloudformation list-exports \
  --query 'Exports[?starts_with(Name, `rag-app-dev`)].{Name:Name,Value:Value}' \
  --output table
```

### Verify SSM Parameters

```bash
# Get all SSM parameters
aws ssm get-parameters-by-path \
  --path "/rag-app/dev/" \
  --recursive \
  --query 'Parameters[*].[Name,Value]' \
  --output table
```

### Verify DynamoDB Tables

```bash
# List DynamoDB tables
aws dynamodb list-tables \
  --query 'TableNames[?starts_with(@, `rag-app`)]' \
  --output table
```

## Troubleshooting

### Issue: Stack Dependency Error

**Symptom**: "Export rag-app-dev-vpc-id cannot be deleted as it is in use"

**Solution**: Delete dependent stacks first, then the stack with the export

```bash
# Delete in reverse dependency order
npx cdk destroy rag-app-integration-dev --force
npx cdk destroy rag-app-data-storage-dev --force
npx cdk destroy rag-app-network-dev --force
```

### Issue: VPC Lookup Fails

**Symptom**: "Cannot find VPC with ID vpc-xxxxx"

**Solution**: Ensure Network Stack is deployed first

```bash
npx cdk deploy rag-app-network-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts"
```

### Issue: OpenSearch Collection Replacement

**Symptom**: "CloudFormation cannot update a stack when a custom-named resource requires replacing"

**Solution**: Delete and recreate Vector Database Stack

```bash
npx cdk destroy rag-app-vector-db-dev --force
npx cdk deploy rag-app-vector-db-dev \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts"
```

## Migration from Monolithic Stack

If you have an existing `RAGInfrastructureStack`, follow these steps:

### Step 1: Destroy Existing Stack

```bash
npx cdk destroy RAGInfrastructureStack \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure.ts" \
  --force
```

### Step 2: Deploy Modular Stacks

```bash
npx cdk deploy --all \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --require-approval never
```

### Step 3: Verify All Resources

```bash
# Check stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE

# Check SSM parameters
aws ssm get-parameters-by-path --path "/rag-app/dev/" --recursive

# Check DynamoDB tables
aws dynamodb list-tables
```

## Best Practices

1. **Always deploy Network Stack first** - It's the foundation for other stacks
2. **Use `--all` for initial deployment** - Ensures correct dependency order
3. **Deploy individual stacks for updates** - Faster and safer
4. **Verify exports before deleting** - Check if other stacks depend on them
5. **Use `--force` for destroy** - Skips confirmation prompts in automation
6. **Tag all resources** - Already configured in the CDK app
7. **Monitor CloudFormation events** - Watch for errors during deployment

## Next Steps

After successful deployment:

1. Verify all 17 SSM parameters are created
2. Check DynamoDB tables exist with correct schemas (customers and documents)
3. Test API Gateway health check endpoint
4. Verify Cognito user pool configuration
5. Review CloudFormation exports for app team integration

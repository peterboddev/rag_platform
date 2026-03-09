# RAG Infrastructure Deployment

> **Status**: Modular architecture successfully deployed on 2026-03-06
> - 6 stacks deployed
> - 20 SSM parameters configured
> - 2 DynamoDB tables with GSIs

## Quick Start

### Option 1: Modular Stack Architecture (Recommended)

Deploy infrastructure as separate, independent stacks for better modularity and easier management.

```bash
# Deploy all stacks
npx cdk deploy --all \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --require-approval never \
  --region us-east-1
```

**Stacks created:**
1. `rag-app-network-dev` - VPC and networking
2. `rag-app-authentication-dev` - Cognito
3. `rag-app-vector-db-dev` - OpenSearch Serverless
4. `rag-app-data-storage-dev` - DynamoDB tables (customers + documents)
5. `rag-app-api-gateway-dev` - API Gateway
6. `rag-app-integration-dev` - IAM roles and SSM parameters

**Note**: S3 buckets are now created by app teams, not the platform.

### Option 2: Monolithic Stack (Legacy)

Deploy all infrastructure in a single stack.

```bash
# Deploy single stack
npx cdk deploy RAGInfrastructureStack \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure.ts" \
  --require-approval never \
  --region us-east-1
```

## Recommended Approach

Use **Option 1 (Modular)** for:
- ✅ Independent deployment of components
- ✅ Easier troubleshooting and rollback
- ✅ Better isolation between services
- ✅ Faster updates to individual components

## Verification

```bash
# Check deployed stacks
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `rag-app`)].StackName'

# Verify SSM parameters (20 parameters expected)
aws ssm get-parameters-by-path \
  --path "/rag-app/dev/" \
  --recursive \
  --query 'Parameters[*].[Name,Value]' \
  --output table

# Verify DynamoDB tables (2 tables expected)
aws dynamodb list-tables \
  --query 'TableNames[?starts_with(@, `rag-app-`)]'
```

## Documentation

- **Modular Stack Guide**: [docs/modular-stack-deployment.md](docs/modular-stack-deployment.md)
- **Platform Architecture**: [docs/PLATFORM_ARCHITECTURE.md](docs/PLATFORM_ARCHITECTURE.md)
- **App Team Guide**: [docs/rag-app-team-guide.md](docs/rag-app-team-guide.md)

## Cleanup

```bash
# Destroy all modular stacks
npx cdk destroy --all \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure-modular.ts" \
  --force

# OR destroy monolithic stack
npx cdk destroy RAGInfrastructureStack \
  --app "npx ts-node --prefer-ts-exts bin/rag-infrastructure.ts" \
  --force
```

# Architecture Changes: Platform vs Application Responsibilities

## Summary

We've refactored the RAG platform architecture to clearly separate platform-provided infrastructure from application-specific resources. This gives app teams full control over their application resources while maintaining platform-managed foundational services.

## What Changed

### Before (Old Architecture)
- Platform created S3 buckets for app teams
- App teams had limited control over storage
- Unclear boundaries between platform and application

### After (New Architecture)
- Platform provides foundational AI/ML services only
- App teams create their own S3 buckets, SQS queues, EventBridge rules, Step Functions
- Clear separation of responsibilities
- App teams have full control over application resources

## Platform Responsibilities (What Platform Provides)

### Infrastructure (Read-Only for App Teams)
1. **VPC & Networking** - VPC, subnets, security groups
2. **AWS Bedrock** - Nova Pro model, embedding models
3. **Vector Database** - OpenSearch Serverless collection
4. **Authentication** - Cognito user pools, identity pools
5. **API Gateway** - REST API with Cognito authorizer
6. **DynamoDB Tables** - Conversations and documents tables
7. **IAM Role** - Lambda execution role with comprehensive permissions

### Key Point
Platform provides the foundation. App teams build on top.

## Application Team Responsibilities (What App Teams Create)

### Application Resources (Full Control)
1. **S3 Buckets** - Documents, uploads, website, backups
2. **Lambda Functions** - Business logic (chat, search, upload)
3. **SQS Queues** - Async processing, dead-letter queues
4. **EventBridge Rules** - Event-driven workflows
5. **Step Functions** - Orchestration workflows
6. **API Gateway Methods** - Add methods to platform API

### Key Point
App teams have full control and can create resources as needed.

## IAM Permissions Granted

The platform-provided IAM role includes permissions for:

### Platform Services (Read/Write)
- Bedrock: Invoke models
- Textract: Extract text from documents
- OpenSearch: Read/write vectors
- DynamoDB: Read/write data (no create/delete table)
- Cognito: Manage users
- API Gateway: Add methods

### Application Resources (Create/Manage)
- S3: Full access to `rag-app-*` buckets
- Lambda: Create/manage `rag-app-*` functions
- SQS: Create/manage `rag-app-*` queues
- EventBridge: Create/manage `rag-app-*` rules
- Step Functions: Create/manage `rag-app-*` state machines

## Migration Guide

### For Existing Applications

If you were using platform-provided S3 buckets:

1. **Create your own S3 buckets** with CDK/SAM
2. **Update Lambda environment variables** to point to your buckets
3. **Remove references** to platform bucket SSM parameters
4. **Deploy** your updated application

### For New Applications

Follow the new guide: `docs/rag-app-team-guide-v2.md`

## Benefits

1. **Full Control**: App teams control their application resources
2. **Flexibility**: Create resources as needed for your use case
3. **Clear Boundaries**: No confusion about who manages what
4. **Scalability**: Each app team manages their own resources independently

## Documentation

- **New Guide**: `docs/rag-app-team-guide-v2.md` (comprehensive guide for app teams)
- **Old Guide**: `docs/rag-app-team-guide.md` (deprecated, kept for reference)
- **Modular Stacks**: `docs/modular-stack-deployment.md` (platform deployment guide)

## Questions?

Contact the platform team for:
- IAM permission issues
- Platform infrastructure problems
- Questions about architecture

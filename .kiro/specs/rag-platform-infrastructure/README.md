# RAG Platform Infrastructure

## Project Overview

This specification defines the **RAG Platform Infrastructure** - the foundational AWS infrastructure and services that enable developers to build RAG (Retrieval-Augmented Generation) applications.

## Project Distinction

**Important**: This is the **RAG Platform Infrastructure** project, not a RAG application itself.

### RAG Platform Infrastructure (This Project)
- **Purpose**: Provides foundational AWS infrastructure and AI/ML services
- **Managed by**: Platform team
- **Contains**: AWS Bedrock Nova Pro, vector databases, document processing pipelines, authentication services, monitoring, etc.
- **Deployed via**: Platform pipeline (CDK/CloudFormation)
- **Consumers**: Application developers building RAG Applications

### RAG Applications (Separate Projects)
- **Purpose**: End-user applications that provide RAG functionality
- **Built by**: Application developers
- **Contains**: Frontend interfaces, API endpoints, business logic, user experiences
- **Deployed via**: Application pipelines
- **Dependencies**: Consumes services from RAG Platform Infrastructure

## Architecture

The RAG Platform Infrastructure provides:

1. **AI Services**: AWS Bedrock Nova Pro and embedding models
2. **Vector Database**: OpenSearch Serverless for similarity search
3. **Document Processing**: Automated pipeline for document ingestion and embedding generation
4. **Knowledge Base**: AWS Bedrock Knowledge Base service
5. **Authentication**: Cognito user pools and identity management
6. **Storage**: S3 buckets for documents, configuration, and backups
7. **Monitoring**: CloudWatch dashboards and alerting
8. **Security**: IAM roles, KMS encryption, VPC endpoints
9. **Integration**: Configuration exports for application developers

## Usage by Application Developers

Application developers building RAG Applications will:

1. **Access AI Services**: Call Bedrock Nova Pro through provided IAM roles and endpoints
2. **Query Vector Database**: Search document embeddings for retrieval
3. **Use Authentication**: Integrate with Cognito for user management
4. **Process Documents**: Upload documents to trigger automated processing
5. **Monitor Usage**: Access CloudWatch metrics and logs

## Documentation Structure

- `requirements.md` - Detailed requirements for the platform infrastructure
- `design.md` - Technical architecture and implementation design
- `tasks.md` - Implementation tasks and development plan

## Deployment

The RAG Platform Infrastructure is deployed and managed by the platform team through the existing platform pipeline system.
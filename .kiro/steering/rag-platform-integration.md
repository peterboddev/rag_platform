# RAG Platform Integration Guide for Development Teams

## Overview

This guide provides development teams with everything they need to build **RAG Applications** that integrate with the **RAG Platform Infrastructure**. The platform team has deployed foundational AI/ML services that your applications can consume to provide RAG (Retrieval-Augmented Generation) capabilities.

## Project Distinction

**Important**: Understand the difference between what the platform provides and what you build:

### RAG Platform Infrastructure (Provided by Platform Team)
- **AWS Bedrock Nova Pro** - Advanced text generation model
- **Vector Database** - OpenSearch Serverless for document embeddings
- **Document Processing Pipeline** - Automated text extraction and embedding generation
- **Knowledge Base Service** - AWS Bedrock Knowledge Base for document retrieval
- **Authentication Services** - Cognito user pools and identity management
- **Storage Infrastructure** - S3 buckets for documents and configuration
- **Monitoring & Security** - CloudWatch dashboards, IAM roles, VPC endpoints

### RAG Applications (What You Build)
- **Frontend Interfaces** - React, Vue, Angular, or other web frameworks
- **API Endpoints** - API Gateway and Lambda functions for business logic
- **User Experience** - Chat interfaces, document upload UIs, search interfaces
- **Business Logic** - Application-specific workflows and data processing
- **Integration Code** - Code that calls the platform-provided AI services

## Available Services & Endpoints

### 1. AWS Bedrock Nova Pro Access

**Service**: Advanced text generation and reasoning
**Access Method**: Direct AWS SDK calls from your Lambda functions
**IAM Role**: Automatically provided when deployed via application pipeline

```typescript
// Example: Calling Bedrock Nova Pro from Lambda
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

const response = await client.send(new InvokeModelCommand({
  modelId: "amazon.nova-pro-v1:0",
  body: JSON.stringify({
    messages: [
      {
        role: "user",
        content: [{ text: "Your question here" }]
      }
    ],
    inferenceConfig: {
      max_new_tokens: 1000,
      temperature: 0.7
    }
  })
}));
```

### 2. Vector Database (OpenSearch Serverless)

**Service**: Document embedding storage and similarity search
**Endpoint**: Available via environment variables in deployed Lambda functions
**Access**: Through OpenSearch client with provided IAM roles

```typescript
// Example: Querying vector database
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';

const client = new Client({
  ...AwsSigv4Signer({
    region: process.env.AWS_REGION,
    service: 'aoss',
  }),
  node: process.env.VECTOR_DB_ENDPOINT,
});

// Search for similar documents
const searchResponse = await client.search({
  index: 'documents',
  body: {
    query: {
      knn: {
        vector_field: {
          vector: embeddingVector,
          k: 5
        }
      }
    }
  }
});
```

### 3. Document Processing Pipeline

**Service**: Automated document processing and embedding generation
**Usage**: Upload documents to designated S3 bucket OR process documents directly with Textract
**Supported Formats**: PDF, DOCX, TXT, HTML, PNG, JPG

```typescript
// Example: Uploading documents for processing
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({ region: "us-east-1" });

await s3Client.send(new PutObjectCommand({
  Bucket: process.env.DOCUMENTS_BUCKET,
  Key: `documents/${filename}`,
  Body: fileBuffer,
  ContentType: 'application/pdf'
}));

// Document will be automatically processed and embeddings stored
```

### 3a. Amazon Textract Integration

**Service**: Direct document text extraction and analysis
**Access Method**: Direct AWS SDK calls from your Lambda functions
**IAM Role**: Automatically provided when deployed via application pipeline
**Use Cases**: Real-time document processing, custom document workflows

```typescript
// Example: Using Textract directly in your application
import { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand } from "@aws-sdk/client-textract";

const textractClient = new TextractClient({ region: "us-east-1" });

// Basic text extraction
const detectResponse = await textractClient.send(new DetectDocumentTextCommand({
  Document: {
    S3Object: {
      Bucket: process.env.DOCUMENTS_BUCKET,
      Name: documentKey
    }
  }
}));

// Extract text from blocks
const extractedText = detectResponse.Blocks
  ?.filter(block => block.BlockType === 'LINE')
  .map(block => block.Text)
  .join('\n') || '';

// Advanced document analysis (forms, tables, etc.)
const analyzeResponse = await textractClient.send(new AnalyzeDocumentCommand({
  Document: {
    S3Object: {
      Bucket: process.env.DOCUMENTS_BUCKET,
      Name: documentKey
    }
  },
  FeatureTypes: ['FORMS', 'TABLES']
}));

// Process forms and tables
const forms = analyzeResponse.Blocks?.filter(block => block.BlockType === 'KEY_VALUE_SET');
const tables = analyzeResponse.Blocks?.filter(block => block.BlockType === 'TABLE');
```

### 4. Knowledge Base Service

**Service**: AWS Bedrock Knowledge Base for document retrieval
**Access**: Via Bedrock Agent Runtime API
**Use Case**: Retrieve relevant documents for RAG context

```typescript
// Example: Querying knowledge base
import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";

const client = new BedrockAgentRuntimeClient({ region: "us-east-1" });

const response = await client.send(new RetrieveCommand({
  knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
  retrievalQuery: {
    text: "User's question or search query"
  },
  retrievalConfiguration: {
    vectorSearchConfiguration: {
      numberOfResults: 5
    }
  }
}));
```

### 5. Authentication (Cognito)

**Service**: User authentication and authorization
**Integration**: Frontend and API Gateway integration
**Provided**: User pools, identity pools, and app clients

```typescript
// Example: Frontend authentication with Amplify
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: 'us-east-1',
    userPoolId: process.env.REACT_APP_USER_POOL_ID,
    userPoolWebClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
    identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID
  }
});
```

## Environment Variables

When your application is deployed via the application pipeline, these environment variables will be automatically available:

### Lambda Function Environment Variables
```bash
# AI Services
BEDROCK_REGION=us-east-1
KNOWLEDGE_BASE_ID=rag-app-v2-kb-dev
VECTOR_DB_ENDPOINT=https://xxx.us-east-1.aoss.amazonaws.com

# Document Processing
DOCUMENTS_BUCKET=rag-app-v2-documents-dev
PROCESSING_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/xxx/rag-app-v2-document-processing-dev
DOCUMENTS_TABLE=rag-app-v2-documents-dev

# Authentication
USER_POOL_ID=us-east-1_xxxxxxxxx
USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Frontend Environment Variables
```bash
# For React/Vue/Angular applications
REACT_APP_USER_POOL_ID=us-east-1_xxxxxxxxx
REACT_APP_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
REACT_APP_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
REACT_APP_API_GATEWAY_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
```

## Common Integration Patterns

### 1. Basic RAG Chat Application

```typescript
// Lambda function for RAG chat endpoint
export const handler = async (event: APIGatewayProxyEvent) => {
  const { question } = JSON.parse(event.body || '{}');
  
  // 1. Retrieve relevant documents
  const retrievalResponse = await bedrockAgentClient.send(new RetrieveCommand({
    knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
    retrievalQuery: { text: question }
  }));
  
  // 2. Build context from retrieved documents
  const context = retrievalResponse.retrievalResults
    ?.map(result => result.content?.text)
    .join('\n\n') || '';
  
  // 3. Generate response with Nova Pro
  const prompt = `Context: ${context}\n\nQuestion: ${question}\n\nAnswer:`;
  
  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: "amazon.nova-pro-v1:0",
    body: JSON.stringify({
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { max_new_tokens: 1000, temperature: 0.7 }
    })
  }));
  
  return {
    statusCode: 200,
    body: JSON.stringify({ answer: response.body })
  };
};
```

### 2. Document Upload and Processing

```typescript
// Frontend: Upload document
const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/upload-document', {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  return response.json();
};

// Lambda: Handle document upload with Textract processing
export const uploadHandler = async (event: APIGatewayProxyEvent) => {
  // Parse multipart form data
  const { file, filename } = parseMultipartForm(event.body);
  
  // Upload to S3
  const s3Key = `documents/${Date.now()}-${filename}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.DOCUMENTS_BUCKET,
    Key: s3Key,
    Body: file
  }));
  
  // Process with Textract immediately (optional - or let platform pipeline handle it)
  const textractResponse = await textractClient.send(new DetectDocumentTextCommand({
    Document: {
      S3Object: {
        Bucket: process.env.DOCUMENTS_BUCKET,
        Name: s3Key
      }
    }
  }));
  
  // Extract text
  const extractedText = textractResponse.Blocks
    ?.filter(block => block.BlockType === 'LINE')
    .map(block => block.Text)
    .join('\n') || '';
  
  // Generate embeddings using Bedrock
  const embeddingResponse = await bedrockClient.send(new InvokeModelCommand({
    modelId: "amazon.titan-embed-text-v1",
    body: JSON.stringify({
      inputText: extractedText.substring(0, 8000) // Limit text length
    })
  }));
  
  const embeddingData = JSON.parse(embeddingResponse.body.transformToString());
  const embedding = embeddingData.embedding;
  
  // Store in vector database
  await opensearchClient.index({
    index: 'documents',
    body: {
      text: extractedText,
      embedding: embedding,
      filename: filename,
      s3Key: s3Key,
      timestamp: new Date().toISOString()
    }
  });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      message: 'Document processed successfully',
      documentId: s3Key,
      extractedText: extractedText.substring(0, 500) + '...' // Preview
    })
  };
};
```

### 2a. Advanced Document Processing with Forms and Tables

```typescript
// Lambda: Advanced document analysis
export const analyzeDocumentHandler = async (event: APIGatewayProxyEvent) => {
  const { documentKey } = JSON.parse(event.body || '{}');
  
  // Analyze document with forms and tables
  const analyzeResponse = await textractClient.send(new AnalyzeDocumentCommand({
    Document: {
      S3Object: {
        Bucket: process.env.DOCUMENTS_BUCKET,
        Name: documentKey
      }
    },
    FeatureTypes: ['FORMS', 'TABLES']
  }));
  
  // Extract structured data
  const blocks = analyzeResponse.Blocks || [];
  
  // Process forms (key-value pairs)
  const forms = extractForms(blocks);
  
  // Process tables
  const tables = extractTables(blocks);
  
  // Store structured data
  await dynamoClient.send(new PutItemCommand({
    TableName: process.env.DOCUMENTS_TABLE,
    Item: {
      documentId: { S: documentKey },
      forms: { S: JSON.stringify(forms) },
      tables: { S: JSON.stringify(tables) },
      processedAt: { S: new Date().toISOString() }
    }
  }));
  
  return {
    statusCode: 200,
    body: JSON.stringify({ forms, tables })
  };
};

// Helper functions for processing Textract output
function extractForms(blocks: any[]): Record<string, string> {
  const forms: Record<string, string> = {};
  const keyValueSets = blocks.filter(block => block.BlockType === 'KEY_VALUE_SET');
  
  keyValueSets.forEach(kvSet => {
    if (kvSet.EntityTypes?.includes('KEY')) {
      const key = getTextFromRelationships(kvSet, blocks);
      const valueBlock = kvSet.Relationships?.find((rel: any) => rel.Type === 'VALUE');
      if (valueBlock) {
        const value = getTextFromRelationships(valueBlock, blocks);
        forms[key] = value;
      }
    }
  });
  
  return forms;
}

function extractTables(blocks: any[]): any[] {
  const tables: any[] = [];
  const tableBlocks = blocks.filter(block => block.BlockType === 'TABLE');
  
  tableBlocks.forEach(table => {
    const rows: any[] = [];
    const cellRelationships = table.Relationships?.find((rel: any) => rel.Type === 'CHILD');
    
    if (cellRelationships) {
      // Process table cells and organize into rows
      // Implementation depends on your specific table structure needs
    }
    
    tables.push({ rows });
  });
  
  return tables;
}

function getTextFromRelationships(block: any, allBlocks: any[]): string {
  const childRelationship = block.Relationships?.find((rel: any) => rel.Type === 'CHILD');
  if (!childRelationship) return '';
  
  return childRelationship.Ids
    .map((id: string) => allBlocks.find(b => b.Id === id))
    .filter((b: any) => b?.BlockType === 'WORD')
    .map((b: any) => b.Text)
    .join(' ');
}
```

### 3. Search Interface

```typescript
// Frontend: Search documents
const searchDocuments = async (query: string) => {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  return response.json();
};

// Lambda: Search endpoint
export const searchHandler = async (event: APIGatewayProxyEvent) => {
  const query = event.queryStringParameters?.q || '';
  
  // Search knowledge base
  const results = await bedrockAgentClient.send(new RetrieveCommand({
    knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
    retrievalQuery: { text: query },
    retrievalConfiguration: {
      vectorSearchConfiguration: { numberOfResults: 10 }
    }
  }));
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      results: results.retrievalResults?.map(result => ({
        content: result.content?.text,
        score: result.score,
        metadata: result.metadata
      }))
    })
  };
};
```

## Required Dependencies

### Lambda Functions (package.json)
```json
{
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.x.x",
    "@aws-sdk/client-bedrock-agent-runtime": "^3.x.x",
    "@aws-sdk/client-s3": "^3.x.x",
    "@aws-sdk/client-textract": "^3.x.x",
    "@aws-sdk/client-dynamodb": "^3.x.x",
    "@opensearch-project/opensearch": "^2.x.x"
  }
}
```

### Frontend Applications
```json
{
  "dependencies": {
    "aws-amplify": "^6.x.x",
    "@aws-amplify/ui-react": "^6.x.x"
  }
}
```

## Security Considerations

### 1. IAM Permissions
- Your Lambda functions automatically receive IAM roles with appropriate permissions for:
  - **Bedrock**: Nova Pro model access and embedding generation
  - **Textract**: Document text extraction and analysis (DetectDocumentText, AnalyzeDocument)
  - **OpenSearch**: Vector database queries and indexing
  - **S3**: Document storage and retrieval
  - **DynamoDB**: Application data storage
  - **Cognito**: User authentication and management
- No need to configure AWS credentials - use default credential chain
- Permissions are scoped to only the resources your application needs

### 2. API Security
- Use Cognito authorizers on API Gateway endpoints
- Validate JWT tokens in Lambda functions
- Implement proper input validation and sanitization

### 3. Data Protection
- All data is encrypted in transit and at rest
- Use HTTPS for all API calls
- Sensitive data should not be logged

## Monitoring and Debugging

### CloudWatch Logs
- Lambda function logs: `/aws/lambda/your-function-name`
- API Gateway logs: Available in CloudWatch
- Platform infrastructure logs: Managed by platform team

### Metrics and Alarms
- Platform team provides infrastructure monitoring
- Add custom metrics for your application logic
- Use CloudWatch Insights for log analysis

### Debugging Tips
```typescript
// Add structured logging
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'INFO',
  message: 'Processing user query',
  userId: event.requestContext.authorizer?.claims?.sub,
  query: question
}));
```

## Cost Optimization

### Bedrock Usage
- Monitor token usage and implement caching where appropriate
- Use appropriate model parameters (temperature, max_tokens)
- Consider batch processing for multiple requests

### Vector Database
- Optimize query patterns and indexing
- Use appropriate batch sizes for bulk operations
- Monitor OpenSearch Serverless capacity units

## Support and Troubleshooting

### Platform Team Contact
- **Infrastructure Issues**: Contact platform team for service outages or configuration problems
- **Access Issues**: Platform team manages IAM roles and permissions
- **Monitoring**: Platform team provides infrastructure monitoring and alerting

### Development Team Responsibilities
- **Application Code**: Debug and maintain your RAG application code
- **Integration Issues**: Troubleshoot API calls and SDK usage
- **Performance**: Optimize your application's use of platform services

### Common Issues

1. **Permission Denied Errors**
   - Ensure your Lambda is deployed via application pipeline
   - Check that IAM roles are properly attached
   - Contact platform team if permissions seem incorrect

2. **Vector Database Connection Issues**
   - Verify environment variables are set correctly
   - Check VPC configuration if using VPC-deployed Lambdas
   - Ensure proper AWS SDK configuration

3. **Textract Processing Errors**
   - Verify document format is supported (PDF, PNG, JPG, TIFF)
   - Check document size limits (5MB for synchronous, 500MB for asynchronous)
   - Ensure proper S3 permissions for Textract to access documents
   - Handle Textract throttling with exponential backoff

4. **Bedrock Model Access**
   - Verify model is enabled in your AWS region
   - Check IAM permissions for Bedrock service
   - Ensure proper model ID in API calls

## Getting Started Checklist

- [ ] Review this integration guide
- [ ] Set up your development environment with required dependencies
- [ ] Create a simple Lambda function that calls Bedrock Nova Pro
- [ ] Test document upload and processing pipeline
- [ ] Test Textract integration for document text extraction
- [ ] Implement basic authentication with Cognito
- [ ] Build a simple frontend interface
- [ ] Deploy via application pipeline and test integration
- [ ] Add monitoring and logging to your application
- [ ] Review security best practices
- [ ] Contact platform team with any infrastructure questions

## Example Applications

The platform team can provide example applications demonstrating:
- Basic RAG chat interface
- Document management system with Textract integration
- Search and retrieval interface
- Multi-user RAG application with authentication
- Advanced document processing with forms and tables extraction

Contact the platform team for access to example code repositories and templates.
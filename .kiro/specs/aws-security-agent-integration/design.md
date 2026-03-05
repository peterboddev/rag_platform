# Design Document

## Overview

This design implements AWS Security Agent integration into the platform pipeline infrastructure to provide comprehensive security scanning throughout the software development lifecycle. The solution follows a "shift-left" security approach where developers can perform security reviews locally in Kiro IDE before committing code, with the CI/CD pipeline providing automated security gates to ensure no vulnerabilities reach production.

AWS Security Agent is a frontier AI agent that provides:
- **Design Security Review**: Analyzes architectural documents against organizational security requirements
- **Code Security Review**: Detects OWASP Top 10 vulnerabilities, secrets, and policy violations in pull requests
- **Dependency Vulnerability Scanning**: Identifies known vulnerabilities in third-party packages and libraries
- **On-Demand Penetration Testing**: Executes context-aware penetration tests against deployed applications

The integration consists of three main components:
1. **Pipeline Integration**: Automated security scanning in CodeBuild stages
2. **Kiro IDE Integration**: Local security scanning via MCP server or direct integration
3. **Security Reporting**: Centralized security dashboards and notifications

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer Workflow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │  Kiro IDE    │────────▶│ AWS Security │                      │
│  │              │         │    Agent     │                      │
│  │ - Code Review│         │  (Local)     │                      │
│  │ - Secrets    │         └──────────────┘                      │
│  │   Detection  │                                                │
│  └──────────────┘                                                │
│         │                                                         │
│         │ git push                                                │
│         ▼                                                         │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Application Pipeline                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────┐   ┌──────────────┐   ┌───────┐   ┌────────────┐   │
│  │ Source │──▶│   Security   │──▶│ Build │──▶│   Deploy   │   │
│  │ Stage  │   │  Scan Stage  │   │ Stage │   │   Stage    │   │
│  └────────┘   └──────────────┘   └───────┘   └────────────┘   │
│                      │                                            │
│                      │ Fail on Critical/High                      │
│                      ▼                                            │
│               ┌──────────────┐                                   │
│               │ AWS Security │                                   │
│               │    Agent     │                                   │
│               │  - SAST      │                                   │
│               │  - Secrets   │                                   │
│               │  - IaC Scan  │                                   │
│               │  - Dependency│                                   │
│               │    Scanning  │                                   │
│               └──────────────┘                                   │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                Integration Test Environment                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │ Integration  │────────▶│ AWS Security │                      │
│  │    Tests     │         │    Agent     │                      │
│  │              │         │ Penetration  │                      │
│  │              │         │   Testing    │                      │
│  └──────────────┘         └──────────────┘                      │
│                                  │                                │
│                                  │ Test Results                   │
│                                  ▼                                │
│                           ┌──────────────┐                       │
│                           │   Security   │                       │
│                           │  Dashboard   │                       │
│                           └──────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

### Component Architecture

#### 1. Pipeline Security Scanning Component

The pipeline security scanning component integrates AWS Security Agent into the CodeBuild stage of application pipelines.

**Components:**
- **Security Scan CodeBuild Project**: Dedicated CodeBuild project for running security scans
- **Security Policy Configuration**: Centralized security requirements and thresholds
- **Scan Results Storage**: S3 bucket for storing scan reports and artifacts
- **Security Gate Logic**: Lambda function to evaluate scan results and block deployments

**Flow:**
1. Source stage completes and triggers security scan stage
2. CodeBuild project clones repository and runs AWS Security Agent
3. Security Agent performs SAST, secrets detection, and IaC scanning
4. Results are evaluated against configured severity thresholds
5. If critical/high vulnerabilities found, pipeline fails
6. Scan results published to S3 and CloudWatch
7. Notifications sent to development and security teams

#### 2. Kiro IDE Integration Component

The Kiro IDE integration provides local security scanning capabilities through an MCP server.

**Components:**
- **AWS Security Agent MCP Server**: Model Context Protocol server for Kiro integration
- **Local Scan Engine**: Executes security scans on local codebase
- **Results Viewer**: UI component in Kiro for displaying findings
- **Auto-Scan Trigger**: Watches file changes and triggers scans automatically

**Flow:**
1. Developer writes code in Kiro IDE
2. Auto-scan triggers on file save or manual scan requested
3. MCP server invokes AWS Security Agent API
4. Security Agent scans local files for vulnerabilities
5. Results displayed inline with code annotations
6. Developer fixes issues and re-scans to verify

#### 3. Penetration Testing Component

The penetration testing component runs automated security tests against deployed applications.

**Components:**
- **Penetration Test Orchestrator**: Lambda function to trigger and manage pen tests
- **Test Environment Configuration**: Defines target URLs, authentication, and scope
- **Attack Surface Discovery**: Automated endpoint enumeration and reconnaissance
- **Vulnerability Validation**: Executes exploit chains to confirm vulnerabilities
- **Test Results Aggregator**: Collects and formats penetration test findings

**Flow:**
1. Integration tests deploy application to test environment
2. Penetration test orchestrator triggers AWS Security Agent
3. Security Agent discovers attack surface (endpoints, APIs)
4. Executes specialized agents for 13 risk categories
5. Validates vulnerabilities through multistep attack scenarios
6. Generates detailed report with reproduction steps
7. Pipeline fails if exploitable vulnerabilities found

## Components and Interfaces

### 1. SecurityScanConstruct (CDK Construct)

**Purpose**: Creates CodeBuild project for security scanning in application pipelines

**Interfaces:**
```typescript
interface SecurityScanConstructProps {
  applicationName: string;
  environment: string;
  sourceArtifact: codepipeline.Artifact;
  securityPolicyArn: string;
  severityThreshold: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  scanTypes: ('SAST' | 'SECRETS' | 'IAC' | 'DEPENDENCIES')[];
  notificationTopicArn?: string;
  resultsB
ucketName?: string;
}

class SecurityScanConstruct extends Construct {
  public readonly scanProject: codebuild.Project;
  public readonly scanAction: codepipeline_actions.CodeBuildAction;
  
  constructor(scope: Construct, id: string, props: SecurityScanConstructProps);
  
  // Methods
  public addScanType(scanType: string): void;
  public updateSeverityThreshold(threshold: string): void;
  public getResultsLocation(): string;
}
```

**Responsibilities:**
- Create CodeBuild project with AWS Security Agent configuration
- Configure IAM roles with permissions for Security Agent API
- Set up environment variables for scan configuration
- Create CodePipeline action for security scanning stage
- Configure result storage and notification integration

### 2. SecurityPolicyManager (Configuration Manager)

**Purpose**: Manages centralized security requirements and policies

**Interfaces:**
```typescript
interface SecurityRequirement {
  id: string;
  name: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'AUTHENTICATION' | 'AUTHORIZATION' | 'DATA_PROTECTION' | 'NETWORK' | 'LOGGING';
  enabled: boolean;
  customRule?: string;
}

interface SecurityPolicy {
  policyId: string;
  policyName: string;
  requirements: SecurityRequirement[];
  severityThresholds: {
    blockOnCritical: boolean;
    blockOnHigh: boolean;
    blockOnMedium: boolean;
    blockOnLow: boolean;
  };
  environments: string[]; // Which environments this policy applies to
}

class SecurityPolicyManager {
  constructor(configPath: string);
  
  // Methods
  public loadPolicy(policyId: string): SecurityPolicy;
  public createCustomRequirement(requirement: SecurityRequirement): void;
  public enableManagedRequirement(requirementId: string): void;
  public updateThresholds(policyId: string, thresholds: object): void;
  public validatePolicy(policy: SecurityPolicy): boolean;
}
```

**Responsibilities:**
- Load and manage security policies from configuration files
- Support both AWS managed and custom security requirements
- Validate policy configurations
- Provide policy enforcement logic for pipeline gates

### 3. SecurityAgentClient (API Client)

**Purpose**: Wrapper for AWS Security Agent API calls

**Interfaces:**
```typescript
interface ScanRequest {
  scanType: 'CODE_REVIEW' | 'DESIGN_REVIEW' | 'PENETRATION_TEST';
  agentSpaceId: string;
  sourceLocation: string; // S3 path or local path
  securityRequirements: string[];
  context?: {
    apiSpecifications?: string[];
    designDocuments?: string[];
    threatModels?: string[];
  };
}

interface ScanResult {
  scanId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  findings: Finding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  completedAt?: Date;
}

interface Finding {
  findingId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  description: string;
  location: {
    file: string;
    line?: number;
    column?: number;
  };
  remediation: string;
  cweId?: string;
  owaspCategory?: string;
}

class SecurityAgentClient {
  constructor(region: string, agentSpaceId: string);
  
  // Methods
  public async startCodeReview(request: ScanRequest): Promise<string>; // Returns scanId
  public async startDesignReview(request: ScanRequest): Promise<string>;
  public async startPenetrationTest(request: ScanRequest): Promise<string>;
  public async getScanStatus(scanId: string): Promise<ScanResult>;
  public async getScanFindings(scanId: string): Promise<Finding[]>;
  public async downloadReport(scanId: string, format: 'JSON' | 'PDF' | 'SARIF'): Promise<Buffer>;
}
```

**Responsibilities:**
- Authenticate with AWS Security Agent service
- Submit scan requests with appropriate context
- Poll for scan completion
- Retrieve and parse scan results
- Download formatted reports

### 4. PenetrationTestOrchestrator (Lambda Function)

**Purpose**: Orchestrates penetration testing during integration test phase

**Interfaces:**
```typescript
interface PenetrationTestConfig {
  applicationName: string;
  environment: string;
  targetUrls: string[];
  authentication?: {
    type: 'BASIC' | 'BEARER' | 'OAUTH2' | 'COGNITO';
    credentials: string; // Reference to Secrets Manager
  };
  vpcConfig?: {
    vpcId: string;
    subnetIds: string[];
    securityGroupIds: string[];
  };
  contextSources: {
    apiSpecifications?: string[]; // S3 paths
    sourceCode?: string; // GitHub repo or S3 path
    designDocuments?: string[];
  };
  threatModel?: string;
}

interface PenetrationTestResult {
  testId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startTime: Date;
  duration?: number;
  vulnerabilities: Vulnerability[];
  attackSurface: {
    endpoints: number;
    parameters: number;
    authenticationMechanisms: string[];
  };
}

interface Vulnerability {
  vulnerabilityId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  description: string;
  exploitSteps: string[];
  impact: string;
  remediation: string;
  cveId?: string;
}

export async function handler(event: PenetrationTestEvent): Promise<PenetrationTestResult>;
```

**Responsibilities:**
- Configure penetration test scope and authentication
- Trigger AWS Security Agent penetration testing
- Monitor test execution progress
- Aggregate and format vulnerability findings
- Determine if pipeline should proceed based on results

### 5. SecurityDashboardConstruct (Monitoring)

**Purpose**: Creates CloudWatch dashboard for security metrics

**Interfaces:**
```typescript
interface SecurityDashboardProps {
  dashboardName: string;
  applications: string[];
  metricNamespace: string;
}

class SecurityDashboardConstruct extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;
  
  constructor(scope: Construct, id: string, props: SecurityDashboardProps);
  
  // Methods
  public addApplicationMetrics(applicationName: string): void;
  public addAlarm(metric: cloudwatch.Metric, threshold: number): cloudwatch.Alarm;
}
```

**Responsibilities:**
- Create CloudWatch dashboard with security metrics
- Display vulnerability trends over time
- Show scan success/failure rates
- Track mean time to remediation
- Provide drill-down into specific findings

## Data Models

### Security Scan Configuration

```json
{
  "securityScanConfig": {
    "enabled": true,
    "agentSpaceId": "agent-space-12345",
    "scanTypes": ["SAST", "SECRETS", "IAC", "DEPENDENCIES"],
    "severityThresholds": {
      "dev": {
        "blockOnCritical": true,
        "blockOnHigh": false,
        "blockOnMedium": false,
        "blockOnLow": false
      },
      "staging": {
        "blockOnCritical": true,
        "blockOnHigh": true,
        "blockOnMedium": false,
        "blockOnLow": false
      },
      "prod": {
        "blockOnCritical": true,
        "blockOnHigh": true,
        "blockOnMedium": true,
        "blockOnLow": false
      }
    },
    "securityRequirements": [
      "aws-managed-owasp-top-10",
      "aws-managed-cwe-top-25",
      "custom-network-segmentation",
      "custom-encryption-keys",
      "custom-session-timeouts"
    ],
    "notifications": {
      "onFailure": true,
      "onCriticalFindings": true,
      "emailAddresses": ["security-team@example.com"],
      "snsTopicArn": "arn:aws:sns:us-east-1:123456789012:security-alerts"
    },
    "resultsRetention": {
      "s3BucketName": "security-scan-results",
      "retentionDays": 90
    }
  }
}
```

### Penetration Test Configuration

```json
{
  "penetrationTestConfig": {
    "enabled": true,
    "runOn": ["staging", "prod"],
    "triggerOn": "INTEGRATION_TESTS_COMPLETE",
    "targetConfiguration": {
      "baseUrl": "https://api.example.com",
      "additionalUrls": [
        "https://app.example.com",
        "https://admin.example.com"
      ],
      "authentication": {
        "type": "COGNITO",
        "userPoolId": "${COGNITO_USER_POOL_ID}",
        "testUserSecretArn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:pen-test-user"
      }
    },
    "contextSources": {
      "apiSpecification": "s3://app-docs/openapi.yaml",
      "sourceCodeRepo": "github.com/org/repo",
      "designDocuments": ["s3://app-docs/architecture.md"]
    },
    "testScope": {
      "riskCategories": [
        "AUTHENTICATION",
        "AUTHORIZATION",
        "INJECTION",
        "XSS",
        "CSRF",
        "SSRF",
        "IDOR",
        "SENSITIVE_DATA_EXPOSURE"
      ],
      "maxDuration": 3600,
      "aggressiveness": "MODERATE"
    }
  }
}
```

### Security Finding

```json
{
  "findingId": "finding-abc123",
  "scanId": "scan-xyz789",
  "timestamp": "2026-01-19T10:30:00Z",
  "severity": "HIGH",
  "category": "INJECTION",
  "title": "SQL Injection vulnerability in user query endpoint",
  "description": "The application constructs SQL queries using unsanitized user input, allowing attackers to inject malicious SQL code.",
  "location": {
    "file": "src/api/users.ts",
    "line": 45,
    "column": 12,
    "snippet": "const query = `SELECT * FROM users WHERE id = ${userId}`;",
    "function": "getUserById"
  },
  "impact": "An attacker could extract sensitive data, modify database records, or execute administrative operations.",
  "remediation": "Use parameterized queries or prepared statements. Replace string concatenation with parameter binding.",
  "remediationCode": "const query = 'SELECT * FROM users WHERE id = ?';\nconst result = await db.query(query, [userId]);",
  "cweId": "CWE-89",
  "owaspCategory": "A03:2021 - Injection",
  "references": [
    "https://owasp.org/www-community/attacks/SQL_Injection",
    "https://cwe.mitre.org/data/definitions/89.html"
  ],
  "status": "OPEN",
  "assignedTo": null,
  "resolvedAt": null
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Security Scan Execution

*For any* application pipeline with security scanning enabled, when code is pushed to the repository, a security scan must be executed before the build stage begins.

**Validates: Requirements 1.1, 1.2**

### Property 2: Critical Vulnerability Blocking

*For any* security scan that detects critical severity vulnerabilities, the pipeline must fail and prevent deployment to any environment.

**Validates: Requirements 1.3, 3.2**

### Property 3: Scan Results Persistence

*For any* completed security scan, the results must be stored in S3 with a retention period matching the configured policy, and must be retrievable for audit purposes.

**Validates: Requirements 4.1, 4.4**

### Property 4: Local Scan Availability

*For any* developer using Kiro IDE with AWS Security Agent integration, security scanning capabilities must be available and executable on the local codebase without requiring pipeline execution.

**Validates: Requirements 2.1, 2.2**

### Property 5: Inline Vulnerability Display

*For any* vulnerability detected during local scanning in Kiro, the finding must be displayed inline with code annotations showing the exact file, line number, and remediation guidance.

**Validates: Requirements 2.3, 2.4**

### Property 6: Environment-Specific Thresholds

*For any* application pipeline, the severity threshold for blocking deployments must be configurable per environment, with production environments enforcing stricter policies than non-production environments.

**Validates: Requirements 3.1, 3.2**

### Property 7: Secrets Detection Blocking

*For any* code that contains hardcoded secrets (API keys, passwords, tokens, AWS credentials), the security scan must immediately fail the pipeline and prevent any deployment.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 8: Penetration Test Execution

*For any* application with penetration testing enabled, when integration tests complete successfully, a penetration test must be triggered against the deployed test environment before promoting to production.

**Validates: Requirements 9.1, 9.2**

### Property 9: Vulnerability Remediation Tracking

*For any* security finding, the system must track the finding status (open, in progress, resolved) and maintain historical data showing when the vulnerability was detected and when it was remediated.

**Validates: Requirements 4.4**

### Property 10: Notification Delivery

*For any* security scan that detects critical vulnerabilities or fails the pipeline, notifications must be sent to both the application development team and the security team within 5 minutes of scan completion.

**Validates: Requirements 4.3**

### Property 11: Scan Performance

*For any* security scan executed in the pipeline, the scan must complete within 5 minutes for typical codebases (under 100,000 lines of code), ensuring minimal impact on development velocity.

**Validates: Requirements 7.2**

### Property 12: Incremental Scanning

*For any* code change that modifies only a subset of files, the security scan should perform incremental analysis on changed files when possible, rather than rescanning the entire codebase.

**Validates: Requirements 7.3**

### Property 13: Dependency Vulnerability Detection

*For any* application that includes third-party dependencies (npm packages, Python packages, Maven dependencies, etc.), the security scan must analyze all dependencies for known vulnerabilities and report findings with CVE identifiers.

**Validates: Requirements 1.1, 3.3**

## Error Handling

### Pipeline Security Scan Failures

**Scenario**: Security scan fails due to service unavailability or timeout

**Handling**:
1. Retry scan up to 3 times with exponential backoff
2. If all retries fail, send alert to platform team
3. Allow pipeline to continue with warning (configurable per environment)
4. Log failure details to CloudWatch for investigation
5. Create incident ticket for platform team

**Scenario**: Security scan detects vulnerabilities above threshold

**Handling**:
1. Fail pipeline immediately
2. Generate detailed report with all findings
3. Send notifications to development and security teams
4. Provide clear error message in pipeline logs
5. Include links to remediation documentation
6. Allow manual override for non-production with approval

### Local Kiro IDE Scan Failures

**Scenario**: Local scan fails due to network connectivity issues

**Handling**:
1. Display user-friendly error message in Kiro
2. Suggest checking AWS credentials and network connection
3. Provide option to retry scan
4. Cache previous scan results for reference
5. Allow developer to continue working (scan is advisory, not blocking)

**Scenario**: AWS Security Agent API rate limiting

**Handling**:
1. Implement exponential backoff with jitter
2. Queue scan requests locally
3. Display estimated wait time to developer
4. Provide option to cancel queued scan
5. Log rate limit events for capacity planning

### Penetration Test Failures

**Scenario**: Penetration test times out or fails to complete

**Handling**:
1. Capture partial results if available
2. Log timeout details and test progress
3. Fail pipeline with clear timeout message
4. Provide option to extend timeout for complex applications
5. Alert security team for manual review

**Scenario**: Penetration test discovers critical exploitable vulnerabilities

**Handling**:
1. Immediately fail pipeline
2. Generate detailed exploit reproduction steps
3. Send urgent notifications to security and development teams
4. Block all deployments until vulnerabilities are remediated
5. Require security team approval to override

### Configuration Errors

**Scenario**: Invalid security policy configuration

**Handling**:
1. Validate configuration during pipeline synthesis
2. Fail CDK deployment with clear validation errors
3. Provide schema validation messages
4. Include examples of correct configuration
5. Prevent deployment of misconfigured pipelines

**Scenario**: Missing AWS Security Agent permissions

**Handling**:
1. Detect permission errors during scan initialization
2. Provide specific IAM policy requirements in error message
3. Include link to documentation for permission setup
4. Fail pipeline with actionable error message
5. Alert platform team to fix IAM configuration

## Testing Strategy

### Unit Tests

**Purpose**: Verify individual components function correctly in isolation

**Test Cases**:
1. **SecurityScanConstruct Creation**
   - Test CDK construct creates CodeBuild project with correct configuration
   - Verify IAM roles have required permissions
   - Validate environment variables are set correctly
   - Test different scan type combinations

2. **SecurityPolicyManager**
   - Test loading security policies from configuration files
   - Verify custom requirement creation and validation
   - Test threshold evaluation logic
   - Validate policy enforcement rules

3. **SecurityAgentClient**
   - Test API authentication and request formatting
   - Verify scan request submission
   - Test result parsing and error handling
   - Mock AWS Security Agent API responses

4. **PenetrationTestOrchestrator**
   - Test Lambda function invocation and configuration
   - Verify target URL validation
   - Test authentication credential retrieval
   - Validate result aggregation logic

5. **Error Handling**
   - Test retry logic for transient failures
   - Verify timeout handling
   - Test rate limiting backoff
   - Validate error message formatting

### Property-Based Tests

**Purpose**: Verify universal properties hold across all inputs

**Configuration**: Minimum 100 iterations per property test

**Property Test 1: Security Scan Execution**
- **Property**: For any application configuration with security scanning enabled, pipeline must include security scan stage
- **Generator**: Random application configurations with varying scan settings
- **Assertion**: Synthesized pipeline contains security scan stage before build stage
- **Tag**: Feature: aws-security-agent-integration, Property 1: Security Scan Execution

**Property Test 2: Critical Vulnerability Blocking**
- **Property**: For any scan result containing critical vulnerabilities, pipeline evaluation must return failure status
- **Generator**: Random scan results with varying severity distributions
- **Assertion**: Pipeline fails when critical vulnerabilities present, passes otherwise
- **Tag**: Feature: aws-security-agent-integration, Property 2: Critical Vulnerability Blocking

**Property Test 3: Environment-Specific Thresholds**
- **Property**: For any environment configuration, production must have stricter or equal thresholds compared to non-production
- **Generator**: Random environment configurations with severity thresholds
- **Assertion**: Production threshold >= staging threshold >= dev threshold
- **Tag**: Feature: aws-security-agent-integration, Property 6: Environment-Specific Thresholds

**Property Test 4: Secrets Detection**
- **Property**: For any code containing patterns matching secret formats (API keys, passwords, tokens), scan must detect and flag them
- **Generator**: Random code snippets with embedded secrets in various formats
- **Assertion**: All secret patterns are detected and reported
- **Tag**: Feature: aws-security-agent-integration, Property 7: Secrets Detection Blocking

**Property Test 5: Notification Delivery**
- **Property**: For any scan with critical findings, notifications must be sent to all configured recipients
- **Generator**: Random scan results with critical findings and notification configurations
- **Assertion**: Notification sent to each configured email/SNS topic
- **Tag**: Feature: aws-security-agent-integration, Property 10: Notification Delivery

**Property Test 6: Dependency Vulnerability Detection**
- **Property**: For any application with third-party dependencies containing known vulnerabilities, scan must detect and report them with CVE identifiers
- **Generator**: Random package.json/requirements.txt files with vulnerable dependency versions
- **Assertion**: All vulnerable dependencies are detected and reported with correct CVE IDs
- **Tag**: Feature: aws-security-agent-integration, Property 13: Dependency Vulnerability Detection

### Integration Tests

**Purpose**: Verify components work together correctly in realistic scenarios

**Test Scenarios**:
1. **End-to-End Pipeline Security Scan**
   - Deploy test application pipeline with security scanning
   - Push code with known vulnerabilities
   - Verify scan detects vulnerabilities
   - Confirm pipeline fails appropriately
   - Validate notifications are sent

2. **Kiro IDE Local Scanning**
   - Set up Kiro with AWS Security Agent MCP server
   - Create test project with security issues
   - Trigger local security scan
   - Verify findings displayed inline
   - Test remediation and re-scan workflow

3. **Penetration Testing Integration**
   - Deploy application to test environment
   - Trigger penetration test via orchestrator
   - Verify test discovers attack surface
   - Confirm vulnerabilities are validated
   - Check pipeline blocks on critical findings

4. **Multi-Environment Deployment**
   - Deploy application through dev → staging → prod
   - Verify different severity thresholds per environment
   - Test that dev allows medium severity but prod blocks it
   - Confirm security dashboard shows metrics for all environments

5. **Security Policy Updates**
   - Update security requirements configuration
   - Redeploy application pipelines
   - Verify new requirements are enforced
   - Test that existing findings are re-evaluated

### Performance Tests

**Purpose**: Ensure security scanning meets performance requirements

**Test Cases**:
1. **Scan Duration**
   - Test scan completion time for codebases of varying sizes
   - Verify 5-minute target for typical codebases
   - Measure incremental scan performance
   - Test parallel scanning of multiple applications

2. **API Rate Limiting**
   - Simulate high-volume scan requests
   - Verify rate limiting backoff works correctly
   - Test queue management under load
   - Measure impact on developer experience

3. **Dashboard Performance**
   - Load security dashboard with data from 50+ applications
   - Verify page load time under 3 seconds
   - Test metric aggregation performance
   - Validate real-time updates don't degrade performance

## Implementation Notes

### AWS Security Agent Setup

1. **Agent Space Creation**
   - Create one agent space per application or project
   - Use naming convention: `{applicationName}-{environment}`
   - Configure IAM roles for agent space access
   - Set up domain verification for penetration testing

2. **Security Requirements Configuration**
   - Enable AWS managed requirements (OWASP Top 10, CWE Top 25)
   - Define custom requirements for organization-specific policies
   - Document requirement rationale and remediation guidance
   - Version control security requirements configuration

3. **Authentication and Permissions**
   - Use IAM roles for CodeBuild and Lambda access
   - Configure least-privilege permissions for Security Agent API
   - Set up cross-account access if needed
   - Implement MFA for sensitive operations

### Kiro IDE Integration Options

**Option 1: MCP Server (Recommended)**
- Develop AWS Security Agent MCP server
- Provides standardized interface for Kiro
- Supports auto-scan and manual scan triggers
- Displays results in Kiro UI

**Option 2: Direct API Integration**
- Integrate AWS SDK directly in Kiro
- Call Security Agent API from IDE
- Requires AWS credentials configuration
- More complex but more flexible

**Option 3: CLI Wrapper**
- Create CLI tool for local scanning
- Kiro invokes CLI commands
- Simpler implementation
- Less integrated user experience

### Pipeline Integration Patterns

**Pattern 1: Dedicated Security Stage**
- Add security scan as separate pipeline stage
- Runs after source, before build
- Clear separation of concerns
- Easy to enable/disable per application

**Pattern 2: Pre-Build Hook**
- Integrate security scan into build stage
- Runs as first step in buildspec.yml
- Tighter integration with build process
- Harder to manage separately

**Pattern 3: Parallel Security Scan**
- Run security scan in parallel with build
- Faster overall pipeline execution
- Requires careful result aggregation
- More complex error handling

**Recommendation**: Use Pattern 1 (Dedicated Security Stage) for clarity and maintainability.

### Cost Optimization

1. **Caching Strategy**
   - Cache dependency vulnerability scans (dependencies change less frequently than code)
   - Store dependency scan results with hash of lock files (package-lock.json, yarn.lock, requirements.txt)
   - Invalidate cache only when dependency files change
   - Implement incremental scanning for unchanged files
   - Reuse scan results for identical commits
   - Set appropriate cache TTL (24 hours for code, 7 days for dependencies)

2. **Dependency Scanning Optimization**
   - Scan dependencies once per unique lock file hash
   - Share dependency scan results across applications using same dependencies
   - Use local vulnerability database cache to reduce API calls
   - Schedule full dependency rescans weekly to catch newly disclosed CVEs
   - Implement differential scanning for dependency updates

3. **Scan Scheduling**
   - Run full scans on main branch only
   - Use incremental scans for feature branches
   - Schedule comprehensive dependency rescans weekly
   - Schedule comprehensive scans during off-peak hours
   - Limit penetration test frequency (weekly for non-prod, on-demand for prod)

4. **Resource Sizing**
   - Use appropriate CodeBuild compute types
   - Scale based on codebase size
   - Monitor scan duration and adjust resources
   - Implement auto-scaling for high-volume periods

### Security Considerations

1. **Scan Result Protection**
   - Encrypt scan results at rest in S3
   - Use KMS customer-managed keys
   - Implement access logging for audit trail
   - Set appropriate retention policies

2. **Credential Management**
   - Store penetration test credentials in Secrets Manager
   - Rotate test credentials regularly
   - Use temporary credentials where possible
   - Audit credential access

3. **Network Security**
   - Run penetration tests from isolated VPC
   - Use VPC endpoints for AWS service access
   - Implement network segmentation
   - Monitor and log all test traffic

4. **Compliance**
   - Maintain audit logs for all security scans
   - Generate compliance reports for SOC2, ISO 27001
   - Implement data retention policies
   - Document security processes and procedures

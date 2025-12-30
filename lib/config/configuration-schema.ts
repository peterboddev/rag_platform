/**
 * Configuration schema validation for the platform pipeline system
 * 
 * This module provides comprehensive schema validation for all configuration
 * types including platform, environment, and application configurations.
 */

import { ValidationResult } from './platform-config';

/**
 * JSON Schema definitions for configuration validation
 */
export const ConfigurationSchemas = {
  /**
   * Platform configuration schema
   */
  platform: {
    type: 'object',
    required: ['region', 'account', 'connectionArn'],
    properties: {
      region: {
        type: 'string',
        pattern: '^[a-z]{2}-[a-z]+-\\d+$',
        description: 'AWS region (e.g., us-east-1)',
      },
      account: {
        type: 'string',
        pattern: '^\\d{12}$',
        description: 'AWS account ID (12 digits)',
      },
      connectionArn: {
        type: 'string',
        pattern: '^arn:aws:codestar-connections:[^:]+:\\d{12}:connection/.+$',
        description: 'CodeStar connection ARN for GitHub integration',
      },
      artifactBucketPrefix: {
        type: 'string',
        pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$',
        description: 'S3 bucket prefix for pipeline artifacts',
      },
    },
  },

  /**
   * Environment configuration schema
   */
  environment: {
    type: 'object',
    required: ['name', 'account', 'region'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Human-readable environment name',
      },
      account: {
        type: 'string',
        pattern: '^\\d{12}$',
        description: 'AWS account ID for this environment',
      },
      region: {
        type: 'string',
        pattern: '^[a-z]{2}-[a-z]+-\\d+$',
        description: 'AWS region for this environment',
      },
      isProd: {
        type: 'boolean',
        description: 'Whether this is a production environment',
      },
      requiresApproval: {
        type: 'boolean',
        description: 'Whether deployments require manual approval',
      },
      parameters: {
        type: 'object',
        patternProperties: {
          '^[a-zA-Z][a-zA-Z0-9_]*$': {
            type: 'string',
          },
        },
        description: 'Environment-specific parameters',
      },
    },
  },

  /**
   * Application configuration schema
   */
  application: {
    type: 'object',
    required: ['applicationName', 'team', 'sourceRepo', 'deploymentTargets'],
    properties: {
      applicationName: {
        type: 'string',
        pattern: '^[a-zA-Z][a-zA-Z0-9-]*$',
        minLength: 1,
        maxLength: 63,
        description: 'Application name (valid for AWS resources)',
      },
      team: {
        type: 'string',
        minLength: 1,
        description: 'Team responsible for this application',
      },
      sourceRepo: {
        type: 'object',
        required: ['owner', 'repo', 'branch'],
        properties: {
          owner: {
            type: 'string',
            minLength: 1,
            description: 'GitHub repository owner',
          },
          repo: {
            type: 'string',
            minLength: 1,
            description: 'GitHub repository name',
          },
          branch: {
            type: 'string',
            minLength: 1,
            description: 'Git branch to track',
          },
        },
      },
      buildConfig: {
        type: 'object',
        properties: {
          runtime: {
            type: 'string',
            description: 'Node.js runtime version',
          },
          commands: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Build commands to execute',
          },
          environment: {
            type: 'object',
            patternProperties: {
              '^[a-zA-Z_][a-zA-Z0-9_]*$': {
                type: 'string',
              },
            },
            description: 'Build environment variables',
          },
        },
      },
      deploymentTargets: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'string',
          minLength: 1,
        },
        description: 'List of environment names to deploy to',
      },
      notifications: {
        type: 'object',
        properties: {
          snsTopicArn: {
            type: 'string',
            pattern: '^arn:aws:sns:[^:]+:\\d{12}:.+$',
            description: 'SNS topic ARN for notifications',
          },
          emailAddresses: {
            type: 'array',
            items: {
              type: 'string',
              format: 'email',
            },
            description: 'Email addresses for notifications',
          },
        },
      },
      enabled: {
        type: 'boolean',
        description: 'Whether this application is enabled',
      },
    },
  },

  /**
   * Default configuration schema
   */
  defaults: {
    type: 'object',
    required: ['buildRuntime', 'computeType', 'buildImage', 'cacheEnabled'],
    properties: {
      buildRuntime: {
        type: 'string',
        enum: ['16', '18', '20', '22'],
        description: 'Default Node.js runtime version',
      },
      computeType: {
        type: 'string',
        enum: [
          'BUILD_GENERAL1_SMALL',
          'BUILD_GENERAL1_MEDIUM',
          'BUILD_GENERAL1_LARGE',
          'BUILD_GENERAL1_2XLARGE',
        ],
        description: 'Default CodeBuild compute type',
      },
      buildImage: {
        type: 'string',
        enum: [
          'STANDARD_5_0',
          'STANDARD_6_0',
          'STANDARD_7_0',
          'AMAZON_LINUX_2_STANDARD_3_0_ARM',
          'AMAZON_LINUX_2023_STANDARD_5_0',
          'AMAZON_LINUX_2023_STANDARD_5_0_ARM',
        ],
        description: 'Default CodeBuild image',
      },
      cacheEnabled: {
        type: 'boolean',
        description: 'Whether build caching is enabled by default',
      },
    },
  },

  /**
   * Complete platform configuration schema
   */
  complete: {
    type: 'object',
    required: ['platform', 'environments', 'applications', 'defaults'],
    properties: {
      platform: { $ref: '#/definitions/platform' },
      environments: {
        type: 'object',
        patternProperties: {
          '^[a-zA-Z][a-zA-Z0-9-]*$': { $ref: '#/definitions/environment' },
        },
      },
      applications: {
        type: 'object',
        patternProperties: {
          '^[a-zA-Z][a-zA-Z0-9-]*$': { $ref: '#/definitions/application' },
        },
      },
      defaults: { $ref: '#/definitions/defaults' },
    },
    definitions: {
      platform: { $ref: '#/platform' },
      environment: { $ref: '#/environment' },
      application: { $ref: '#/application' },
      defaults: { $ref: '#/defaults' },
    },
  },
};

/**
 * Configuration schema validator
 */
export class ConfigurationSchemaValidator {
  /**
   * Validates a configuration object against its schema
   */
  public static validate(config: any, schemaType: keyof typeof ConfigurationSchemas): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const schema = ConfigurationSchemas[schemaType];
    
    try {
      const validation = this.validateObject(config, schema, '');
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    } catch (error) {
      errors.push(`Schema validation failed: ${error}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates an object against a schema definition
   */
  private static validateObject(
    obj: any, 
    schema: any, 
    path: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (schema.type === 'object') {
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        errors.push(`${path || 'root'} must be an object`);
        return { isValid: false, errors, warnings };
      }

      // Check required properties
      if (schema.required) {
        schema.required.forEach((prop: string) => {
          if (!(prop in obj)) {
            errors.push(`${path}.${prop} is required`);
          }
        });
      }

      // Validate properties
      if (schema.properties) {
        Object.entries(schema.properties).forEach(([prop, propSchema]: [string, any]) => {
          if (prop in obj) {
            const propPath = path ? `${path}.${prop}` : prop;
            const propValidation = this.validateValue(obj[prop], propSchema, propPath);
            errors.push(...propValidation.errors);
            warnings.push(...propValidation.warnings);
          }
        });
      }

      // Validate pattern properties
      if (schema.patternProperties) {
        Object.entries(obj).forEach(([prop, value]) => {
          Object.entries(schema.patternProperties).forEach(([pattern, propSchema]: [string, any]) => {
            if (new RegExp(pattern).test(prop)) {
              const propPath = path ? `${path}.${prop}` : prop;
              const propValidation = this.validateValue(value, propSchema, propPath);
              errors.push(...propValidation.errors);
              warnings.push(...propValidation.warnings);
            }
          });
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates a value against a schema definition
   */
  private static validateValue(
    value: any, 
    schema: any, 
    path: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Type validation
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== schema.type) {
        errors.push(`${path} must be of type ${schema.type}, got ${actualType}`);
        return { isValid: false, errors, warnings };
      }
    }

    // String validations
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        errors.push(`${path} must be at least ${schema.minLength} characters long`);
      }

      if (schema.maxLength && value.length > schema.maxLength) {
        errors.push(`${path} must be at most ${schema.maxLength} characters long`);
      }

      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push(`${path} does not match required pattern: ${schema.pattern}`);
      }

      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
      }

      if (schema.format === 'email' && !this.isValidEmail(value)) {
        errors.push(`${path} must be a valid email address`);
      }
    }

    // Array validations
    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.minItems && value.length < schema.minItems) {
        errors.push(`${path} must have at least ${schema.minItems} items`);
      }

      if (schema.maxItems && value.length > schema.maxItems) {
        errors.push(`${path} must have at most ${schema.maxItems} items`);
      }

      if (schema.items) {
        value.forEach((item, index) => {
          const itemPath = `${path}[${index}]`;
          const itemValidation = this.validateValue(item, schema.items, itemPath);
          errors.push(...itemValidation.errors);
          warnings.push(...itemValidation.warnings);
        });
      }
    }

    // Object validations
    if (schema.type === 'object') {
      const objectValidation = this.validateObject(value, schema, path);
      errors.push(...objectValidation.errors);
      warnings.push(...objectValidation.warnings);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Simple email validation
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates configuration file structure
   */
  public static validateConfigurationFile(filePath: string, content: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Determine configuration type based on file path
    if (filePath.includes('/environments/')) {
      // Environment configuration file
      if (content.environments) {
        Object.entries(content.environments).forEach(([envName, envConfig]) => {
          const validation = this.validate(envConfig, 'environment');
          errors.push(...validation.errors.map(error => `Environment ${envName}: ${error}`));
          warnings.push(...validation.warnings.map(warning => `Environment ${envName}: ${warning}`));
        });
      } else {
        errors.push('Environment configuration file must contain "environments" object');
      }
    } else if (filePath.includes('/applications/')) {
      // Application configuration file
      const validation = this.validate(content, 'application');
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    } else {
      // Complete configuration file
      const validation = this.validate(content, 'complete');
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Generates a sample configuration that conforms to the schema
   */
  public static generateSampleConfiguration(schemaType: keyof typeof ConfigurationSchemas): any {
    const schema = ConfigurationSchemas[schemaType];
    
    switch (schemaType) {
      case 'platform':
        return {
          region: 'us-east-1',
          account: '123456789012',
          connectionArn: 'arn:aws:codestar-connections:us-east-1:123456789012:connection/sample-id',
          artifactBucketPrefix: 'platform-pipeline',
        };

      case 'environment':
        return {
          name: 'Development',
          account: '123456789012',
          region: 'us-east-1',
          isProd: false,
          requiresApproval: false,
          parameters: {
            logLevel: 'DEBUG',
            retentionDays: '7',
          },
        };

      case 'application':
        return {
          applicationName: 'sample-app',
          team: 'platform-team',
          sourceRepo: {
            owner: 'platform-team',
            repo: 'sample-application',
            branch: 'main',
          },
          buildConfig: {
            runtime: '20',
            commands: ['npm ci', 'npm run test', 'npm run build'],
            environment: {
              NODE_ENV: 'production',
            },
          },
          deploymentTargets: ['dev', 'staging', 'prod'],
          notifications: {
            emailAddresses: ['team@company.com'],
          },
          enabled: true,
        };

      case 'defaults':
        return {
          buildRuntime: '20',
          computeType: 'BUILD_GENERAL1_SMALL',
          buildImage: 'AMAZON_LINUX_2_STANDARD_3_0_ARM',
          cacheEnabled: true,
        };

      default:
        throw new Error(`Unknown schema type: ${schemaType}`);
    }
  }
}
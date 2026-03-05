/**
 * Unit Tests for templatePath Configuration Validation
 * 
 * Task: 3.4 Add configuration validation for templatePath
 * 
 * These tests verify that the ApplicationPipelineConstruct properly validates
 * the templatePath configuration field, catching common misconfigurations early
 * with helpful error messages.
 * 
 * Validates: Requirements 2.3 (Configuration validation)
 */

import * as cdk from 'aws-cdk-lib';
import { ApplicationPipelineConstruct, ApplicationPipelineConfig } from '../lib/constructs/application-pipeline-construct';

describe('ApplicationPipelineConstruct - templatePath Validation', () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
  });

  /**
   * Helper function to create a minimal valid configuration
   */
  function createBaseConfig(templatePath?: string): ApplicationPipelineConfig {
    return {
      applicationName: 'test-app',
      sourceRepo: {
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main'
      },
      deploymentTargets: [
        {
          name: 'dev',
          account: '123456789012',
          region: 'us-east-1',
          stackName: 'test-stack-dev'
        }
      ],
      templatePath: templatePath
    };
  }

  describe('Valid templatePath configurations', () => {
    test('should accept default SAM template path (undefined)', () => {
      const config = createBaseConfig(undefined);
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).not.toThrow();
    });

    test('should accept explicit SAM template path', () => {
      const config = createBaseConfig('template.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).not.toThrow();
    });

    test('should accept CDK template path with directory', () => {
      const config = createBaseConfig('cdk.out/MyStack.template.json');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).not.toThrow();
    });

    test('should accept nested directory paths', () => {
      const config = createBaseConfig('build/output/templates/MyStack.template.json');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).not.toThrow();
    });

    test('should accept template.yml extension', () => {
      const config = createBaseConfig('template.yml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).not.toThrow();
    });
  });

  describe('Invalid templatePath configurations - Empty paths', () => {
    test('should reject empty string', () => {
      const config = createBaseConfig('');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath cannot be empty');
    });

    test('should reject whitespace-only string', () => {
      const config = createBaseConfig('   ');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath cannot be empty');
    });
  });

  describe('Invalid templatePath configurations - Absolute paths', () => {
    test('should reject Unix absolute path', () => {
      const config = createBaseConfig('/absolute/path/template.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath must be a relative path');
    });

    test('should reject Windows absolute path (C:)', () => {
      const config = createBaseConfig('C:\\absolute\\path\\template.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath must be a relative path');
    });

    test('should reject Windows absolute path (D:)', () => {
      const config = createBaseConfig('D:/absolute/path/template.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath must be a relative path');
    });
  });

  describe('Invalid templatePath configurations - Invalid characters', () => {
    test('should reject path with pipe character', () => {
      const config = createBaseConfig('template|invalid.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath contains invalid characters');
    });

    test('should reject path with asterisk', () => {
      const config = createBaseConfig('template*.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath contains invalid characters');
    });

    test('should reject path with question mark', () => {
      const config = createBaseConfig('template?.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath contains invalid characters');
    });

    test('should reject path with angle brackets', () => {
      const config = createBaseConfig('template<test>.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath contains invalid characters');
    });

    test('should reject path with quotes', () => {
      const config = createBaseConfig('template"test".yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath contains invalid characters');
    });
  });

  describe('Invalid templatePath configurations - Path traversal', () => {
    test('should reject parent directory reference', () => {
      const config = createBaseConfig('../template.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath cannot contain parent directory references');
    });

    test('should reject nested parent directory reference', () => {
      const config = createBaseConfig('cdk.out/../../template.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath cannot contain parent directory references');
    });
  });

  describe('Invalid templatePath configurations - Path length', () => {
    test('should reject excessively long paths', () => {
      const longPath = 'a'.repeat(256) + '.yaml';
      const config = createBaseConfig(longPath);
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow('templatePath is too long');
    });

    test('should accept path at maximum length (255 characters)', () => {
      const maxPath = 'a'.repeat(250) + '.yaml'; // 255 characters total
      const config = createBaseConfig(maxPath);
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).not.toThrow();
    });
  });

  describe('Warning cases (non-fatal)', () => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    test('should warn about trailing slash', () => {
      const config = createBaseConfig('cdk.out/');
      
      new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('templatePath ends with a slash')
      );
    });

    test('should warn about missing file extension', () => {
      const config = createBaseConfig('template');
      
      new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not contain a file extension')
      );
    });

    test('should warn about backslashes', () => {
      const config = createBaseConfig('cdk.out\\MyStack.template.json');
      
      new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('contains backslashes')
      );
    });
  });

  describe('Error message quality', () => {
    test('empty path error should provide helpful examples', () => {
      const config = createBaseConfig('');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow(/template\.yaml.*cdk\.out/);
    });

    test('absolute path error should provide example', () => {
      const config = createBaseConfig('/absolute/path/template.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow(/Example:.*cdk\.out/);
    });

    test('invalid characters error should list allowed characters', () => {
      const config = createBaseConfig('template*.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).toThrow(/alphanumeric.*hyphens.*underscores.*dots.*forward slashes/);
    });
  });

  describe('Real-world scenarios', () => {
    test('should accept typical CDK single-stack template path', () => {
      const config = createBaseConfig('cdk.out/ApplicationStack.template.json');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).not.toThrow();
    });

    test('should accept CDK template with hyphens and underscores', () => {
      const config = createBaseConfig('cdk.out/My-Application_Stack.template.json');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).not.toThrow();
    });

    test('should accept SAM template in subdirectory', () => {
      const config = createBaseConfig('sam-build/template.yaml');
      
      expect(() => {
        new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      }).not.toThrow();
    });

    test('should reject common misconfiguration: directory instead of file', () => {
      const config = createBaseConfig('cdk.out/');
      
      // This should create a warning but not throw
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      new ApplicationPipelineConstruct(stack, 'Pipeline', { config });
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });
});

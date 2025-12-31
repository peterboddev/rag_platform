/**
 * Configuration export utilities for the platform pipeline system
 * 
 * This module provides utilities to export configuration in various formats
 * for integration with external tools and documentation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PlatformConfig, ApplicationConfig, EnvironmentConfig } from './platform-config';

/**
 * Configuration export formats
 */
export type ExportFormat = 'json' | 'yaml' | 'env' | 'terraform' | 'cloudformation';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  outputPath?: string;
  includeSecrets?: boolean;
  environmentFilter?: string[];
  applicationFilter?: string[];
  pretty?: boolean;
}

/**
 * Configuration exporter
 */
export class ConfigurationExporter {
  private config: PlatformConfig;

  constructor(config: PlatformConfig) {
    this.config = config;
  }

  /**
   * Exports configuration in the specified format
   */
  public export(options: ExportOptions): string {
    let output: string;

    switch (options.format) {
      case 'json':
        output = this.exportJson(options);
        break;
      case 'yaml':
        output = this.exportYaml(options);
        break;
      case 'env':
        output = this.exportEnvironmentVariables(options);
        break;
      case 'terraform':
        output = this.exportTerraform(options);
        break;
      case 'cloudformation':
        output = this.exportCloudFormation(options);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    // Write to file if output path is specified
    if (options.outputPath) {
      const dir = path.dirname(options.outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(options.outputPath, output, 'utf8');
    }

    return output;
  }

  /**
   * Exports configuration as JSON
   */
  private exportJson(options: ExportOptions): string {
    const filteredConfig = this.filterConfiguration(options);
    
    if (options.pretty !== false) {
      return JSON.stringify(filteredConfig, null, 2);
    } else {
      return JSON.stringify(filteredConfig);
    }
  }

  /**
   * Exports configuration as YAML
   */
  private exportYaml(options: ExportOptions): string {
    const filteredConfig = this.filterConfiguration(options);
    return this.objectToYaml(filteredConfig);
  }

  /**
   * Exports configuration as environment variables
   */
  private exportEnvironmentVariables(options: ExportOptions): string {
    const filteredConfig = this.filterConfiguration(options);
    const envVars: string[] = [];

    // Platform configuration
    envVars.push(`# Platform Configuration`);
    envVars.push(`PLATFORM_REGION=${filteredConfig.platform.region}`);
    envVars.push(`PLATFORM_ACCOUNT=${filteredConfig.platform.account}`);
    
    if (options.includeSecrets) {
      envVars.push(`PLATFORM_CONNECTION_ARN=${filteredConfig.platform.connectionArn}`);
    } else {
      envVars.push(`# PLATFORM_CONNECTION_ARN=<redacted>`);
    }

    if (filteredConfig.platform.artifactBucketPrefix) {
      envVars.push(`PLATFORM_ARTIFACT_BUCKET_PREFIX=${filteredConfig.platform.artifactBucketPrefix}`);
    }

    // Default configuration
    envVars.push(`\n# Default Configuration`);
    envVars.push(`DEFAULT_BUILD_RUNTIME=${filteredConfig.defaults.buildRuntime}`);
    envVars.push(`DEFAULT_COMPUTE_TYPE=${filteredConfig.defaults.computeType}`);
    envVars.push(`DEFAULT_BUILD_IMAGE=${filteredConfig.defaults.buildImage}`);
    envVars.push(`DEFAULT_CACHE_ENABLED=${filteredConfig.defaults.cacheEnabled}`);

    // Environment configurations
    Object.entries(filteredConfig.environments).forEach(([envName, envConfig]) => {
      envVars.push(`\n# Environment: ${envName}`);
      envVars.push(`ENV_${envName.toUpperCase()}_NAME=${envConfig.name}`);
      envVars.push(`ENV_${envName.toUpperCase()}_ACCOUNT=${envConfig.account}`);
      envVars.push(`ENV_${envName.toUpperCase()}_REGION=${envConfig.region}`);
      envVars.push(`ENV_${envName.toUpperCase()}_IS_PROD=${envConfig.isProd || false}`);
      envVars.push(`ENV_${envName.toUpperCase()}_REQUIRES_APPROVAL=${envConfig.requiresApproval || false}`);

      if (envConfig.parameters) {
        Object.entries(envConfig.parameters).forEach(([key, value]) => {
          envVars.push(`ENV_${envName.toUpperCase()}_${key.toUpperCase()}=${value}`);
        });
      }
    });

    // Application configurations
    Object.entries(filteredConfig.applications).forEach(([appName, appConfig]) => {
      envVars.push(`\n# Application: ${appName}`);
      envVars.push(`APP_${appName.toUpperCase()}_NAME=${appConfig.applicationName}`);
      envVars.push(`APP_${appName.toUpperCase()}_TEAM=${appConfig.team}`);
      envVars.push(`APP_${appName.toUpperCase()}_REPO_OWNER=${appConfig.sourceRepo.owner}`);
      envVars.push(`APP_${appName.toUpperCase()}_REPO_NAME=${appConfig.sourceRepo.repo}`);
      envVars.push(`APP_${appName.toUpperCase()}_REPO_BRANCH=${appConfig.sourceRepo.branch}`);
      envVars.push(`APP_${appName.toUpperCase()}_DEPLOYMENT_TARGETS=${appConfig.deploymentTargets.join(',')}`);
      envVars.push(`APP_${appName.toUpperCase()}_ENABLED=${appConfig.enabled !== false}`);
    });

    return envVars.join('\n');
  }

  /**
   * Exports configuration as Terraform variables
   */
  private exportTerraform(options: ExportOptions): string {
    const filteredConfig = this.filterConfiguration(options);
    const tfVars: string[] = [];

    tfVars.push('# Platform Pipeline Configuration - Terraform Variables');
    tfVars.push('# Generated automatically - do not edit manually\n');

    // Platform configuration
    tfVars.push('# Platform Configuration');
    tfVars.push(`platform_region = "${filteredConfig.platform.region}"`);
    tfVars.push(`platform_account = "${filteredConfig.platform.account}"`);
    
    if (options.includeSecrets) {
      tfVars.push(`platform_connection_arn = "${filteredConfig.platform.connectionArn}"`);
    } else {
      tfVars.push(`# platform_connection_arn = "<redacted>"`);
    }

    if (filteredConfig.platform.artifactBucketPrefix) {
      tfVars.push(`platform_artifact_bucket_prefix = "${filteredConfig.platform.artifactBucketPrefix}"`);
    }

    // Environments as a map
    tfVars.push('\n# Environment Configuration');
    tfVars.push('environments = {');
    Object.entries(filteredConfig.environments).forEach(([envName, envConfig]) => {
      tfVars.push(`  ${envName} = {`);
      tfVars.push(`    name               = "${envConfig.name}"`);
      tfVars.push(`    account            = "${envConfig.account}"`);
      tfVars.push(`    region             = "${envConfig.region}"`);
      tfVars.push(`    is_prod            = ${envConfig.isProd || false}`);
      tfVars.push(`    requires_approval  = ${envConfig.requiresApproval || false}`);
      
      if (envConfig.parameters && Object.keys(envConfig.parameters).length > 0) {
        tfVars.push(`    parameters = {`);
        Object.entries(envConfig.parameters).forEach(([key, value]) => {
          tfVars.push(`      ${key} = "${value}"`);
        });
        tfVars.push(`    }`);
      }
      
      tfVars.push(`  }`);
    });
    tfVars.push('}');

    // Applications as a map
    tfVars.push('\n# Application Configuration');
    tfVars.push('applications = {');
    Object.entries(filteredConfig.applications).forEach(([appName, appConfig]) => {
      tfVars.push(`  ${appName} = {`);
      tfVars.push(`    application_name = "${appConfig.applicationName}"`);
      tfVars.push(`    team            = "${appConfig.team}"`);
      tfVars.push(`    source_repo = {`);
      tfVars.push(`      owner  = "${appConfig.sourceRepo.owner}"`);
      tfVars.push(`      repo   = "${appConfig.sourceRepo.repo}"`);
      tfVars.push(`      branch = "${appConfig.sourceRepo.branch}"`);
      tfVars.push(`    }`);
      tfVars.push(`    deployment_targets = [${appConfig.deploymentTargets.map(t => `"${t}"`).join(', ')}]`);
      tfVars.push(`    enabled           = ${appConfig.enabled !== false}`);
      tfVars.push(`  }`);
    });
    tfVars.push('}');

    return tfVars.join('\n');
  }

  /**
   * Exports configuration as CloudFormation parameters
   */
  private exportCloudFormation(options: ExportOptions): string {
    const filteredConfig = this.filterConfiguration(options);
    const cfParams: any = {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: 'Platform Pipeline Configuration Parameters',
      Parameters: {},
      Mappings: {},
    };

    // Platform parameters
    cfParams.Parameters.PlatformRegion = {
      Type: 'String',
      Default: filteredConfig.platform.region,
      Description: 'AWS region for platform resources',
    };

    cfParams.Parameters.PlatformAccount = {
      Type: 'String',
      Default: filteredConfig.platform.account,
      Description: 'AWS account ID for platform resources',
    };

    if (options.includeSecrets) {
      cfParams.Parameters.PlatformConnectionArn = {
        Type: 'String',
        Default: filteredConfig.platform.connectionArn,
        Description: 'CodeConnections connection ARN for GitHub integration',
      };
    }

    // Environment mapping
    cfParams.Mappings.Environments = {};
    Object.entries(filteredConfig.environments).forEach(([envName, envConfig]) => {
      cfParams.Mappings.Environments[envName] = {
        Name: envConfig.name,
        Account: envConfig.account,
        Region: envConfig.region,
        IsProd: envConfig.isProd ? 'true' : 'false',
        RequiresApproval: envConfig.requiresApproval ? 'true' : 'false',
      };
    });

    // Application mapping
    cfParams.Mappings.Applications = {};
    Object.entries(filteredConfig.applications).forEach(([appName, appConfig]) => {
      cfParams.Mappings.Applications[appName] = {
        ApplicationName: appConfig.applicationName,
        Team: appConfig.team,
        RepoOwner: appConfig.sourceRepo.owner,
        RepoName: appConfig.sourceRepo.repo,
        RepoBranch: appConfig.sourceRepo.branch,
        Enabled: appConfig.enabled !== false ? 'true' : 'false',
      };
    });

    return JSON.stringify(cfParams, null, 2);
  }

  /**
   * Filters configuration based on options
   */
  private filterConfiguration(options: ExportOptions): PlatformConfig {
    const filtered: PlatformConfig = JSON.parse(JSON.stringify(this.config));

    // Filter environments
    if (options.environmentFilter && options.environmentFilter.length > 0) {
      const filteredEnvs: { [key: string]: EnvironmentConfig } = {};
      options.environmentFilter.forEach(envName => {
        if (filtered.environments[envName]) {
          filteredEnvs[envName] = filtered.environments[envName];
        }
      });
      filtered.environments = filteredEnvs;
    }

    // Filter applications
    if (options.applicationFilter && options.applicationFilter.length > 0) {
      const filteredApps: { [key: string]: ApplicationConfig } = {};
      options.applicationFilter.forEach(appName => {
        if (filtered.applications[appName]) {
          filteredApps[appName] = filtered.applications[appName];
        }
      });
      filtered.applications = filteredApps;
    }

    return filtered;
  }

  /**
   * Converts object to YAML format (basic implementation)
   */
  private objectToYaml(obj: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          yaml += `${spaces}-\n`;
          yaml += this.objectToYaml(item, indent + 1);
        } else {
          yaml += `${spaces}- ${item}\n`;
        }
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          yaml += `${spaces}${key}:\n`;
          yaml += this.objectToYaml(value, indent + 1);
        } else if (typeof value === 'object' && value !== null) {
          yaml += `${spaces}${key}:\n`;
          yaml += this.objectToYaml(value, indent + 1);
        } else {
          yaml += `${spaces}${key}: ${value}\n`;
        }
      });
    }

    return yaml;
  }

  /**
   * Exports configuration documentation in Markdown format
   */
  public exportDocumentation(): string {
    const doc: string[] = [];

    doc.push('# Platform Pipeline Configuration');
    doc.push('');
    doc.push('This document describes the current platform pipeline configuration.');
    doc.push('');

    // Platform configuration
    doc.push('## Platform Configuration');
    doc.push('');
    doc.push('| Property | Value |');
    doc.push('|----------|-------|');
    doc.push(`| Region | ${this.config.platform.region} |`);
    doc.push(`| Account | ${this.config.platform.account} |`);
    doc.push(`| Connection ARN | ${this.config.platform.connectionArn} |`);
    if (this.config.platform.artifactBucketPrefix) {
      doc.push(`| Artifact Bucket Prefix | ${this.config.platform.artifactBucketPrefix} |`);
    }
    doc.push('');

    // Environments
    doc.push('## Environments');
    doc.push('');
    doc.push('| Name | Account | Region | Production | Requires Approval |');
    doc.push('|------|---------|--------|------------|-------------------|');
    Object.entries(this.config.environments).forEach(([envName, envConfig]) => {
      doc.push(`| ${envConfig.name} | ${envConfig.account} | ${envConfig.region} | ${envConfig.isProd ? 'Yes' : 'No'} | ${envConfig.requiresApproval ? 'Yes' : 'No'} |`);
    });
    doc.push('');

    // Applications
    doc.push('## Applications');
    doc.push('');
    Object.entries(this.config.applications).forEach(([appName, appConfig]) => {
      doc.push(`### ${appConfig.applicationName}`);
      doc.push('');
      doc.push(`- **Team**: ${appConfig.team}`);
      doc.push(`- **Repository**: ${appConfig.sourceRepo.owner}/${appConfig.sourceRepo.repo}`);
      doc.push(`- **Branch**: ${appConfig.sourceRepo.branch}`);
      doc.push(`- **Deployment Targets**: ${appConfig.deploymentTargets.join(', ')}`);
      doc.push(`- **Status**: ${appConfig.enabled !== false ? 'Enabled' : 'Disabled'}`);
      
      if (appConfig.buildConfig?.commands) {
        doc.push(`- **Build Commands**:`);
        appConfig.buildConfig.commands.forEach(cmd => {
          doc.push(`  - \`${cmd}\``);
        });
      }
      
      if (appConfig.notifications?.emailAddresses) {
        doc.push(`- **Notifications**: ${appConfig.notifications.emailAddresses.join(', ')}`);
      }
      
      doc.push('');
    });

    return doc.join('\n');
  }
}

/**
 * Utility functions for configuration export
 */
export class ConfigurationExportUtils {
  /**
   * Exports configuration to multiple formats
   */
  static exportMultipleFormats(
    config: PlatformConfig, 
    outputDir: string, 
    formats: ExportFormat[]
  ): void {
    const exporter = new ConfigurationExporter(config);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    formats.forEach(format => {
      const extension = format === 'env' ? 'env' : format;
      const outputPath = path.join(outputDir, `config.${extension}`);
      
      exporter.export({
        format,
        outputPath,
        pretty: true,
      });
    });

    // Export documentation
    const docPath = path.join(outputDir, 'README.md');
    const documentation = exporter.exportDocumentation();
    fs.writeFileSync(docPath, documentation, 'utf8');
  }

  /**
   * Creates a configuration backup with timestamp
   */
  static createBackup(config: PlatformConfig, backupDir: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `config-backup-${timestamp}.json`);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const exporter = new ConfigurationExporter(config);
    exporter.export({
      format: 'json',
      outputPath: backupPath,
      includeSecrets: true,
      pretty: true,
    });

    return backupPath;
  }
}
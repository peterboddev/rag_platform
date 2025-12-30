#!/usr/bin/env ts-node

/**
 * Testing utilities script
 * 
 * This script provides comprehensive testing capabilities for the CDK platform,
 * including unit tests, integration tests, and CDK-specific testing.
 * 
 * Usage:
 *   npm run test
 *   npx ts-node scripts/test-utilities.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestOptions {
  watch?: boolean;
  coverage?: boolean;
  verbose?: boolean;
  pattern?: string;
  updateSnapshots?: boolean;
  bail?: boolean;
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  coverage?: number;
  details?: string;
}

class TestRunner {
  private options: TestOptions;
  private results: TestResult[] = [];

  constructor(options: TestOptions = {}) {
    this.options = options;
  }

  /**
   * Run all tests
   */
  public async runAllTests(): Promise<boolean> {
    console.log('🧪 Running comprehensive test suite...\n');

    const startTime = Date.now();

    try {
      // 1. Unit tests
      if (!await this.runUnitTests()) {
        if (this.options.bail) return false;
      }

      // 2. CDK tests (snapshot tests)
      if (!await this.runCdkTests()) {
        if (this.options.bail) return false;
      }

      // 3. Integration tests (if they exist)
      if (!await this.runIntegrationTests()) {
        if (this.options.bail) return false;
      }

      // 4. Configuration tests
      if (!await this.runConfigurationTests()) {
        if (this.options.bail) return false;
      }

      const totalTime = Date.now() - startTime;
      this.displayResults(totalTime);

      const allPassed = this.results.every(r => r.passed);
      
      if (allPassed) {
        console.log('\n🎉 All tests passed!');
      } else {
        console.log('\n❌ Some tests failed. See details above.');
      }

      return allPassed;

    } catch (error) {
      console.error('💥 Test execution failed:', error);
      return false;
    }
  }

  /**
   * Run unit tests
   */
  private async runUnitTests(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log('🔬 Running unit tests...');
      
      let command = 'jest';
      const args: string[] = [];

      if (this.options.coverage) {
        args.push('--coverage');
      }

      if (this.options.verbose) {
        args.push('--verbose');
      }

      if (this.options.pattern) {
        args.push('--testNamePattern', this.options.pattern);
      }

      if (this.options.updateSnapshots) {
        args.push('--updateSnapshot');
      }

      if (this.options.watch) {
        args.push('--watch');
      }

      const fullCommand = `npx ${command} ${args.join(' ')}`;
      
      const output = execSync(fullCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });

      // Parse coverage if available
      let coverage: number | undefined;
      if (this.options.coverage && fs.existsSync('coverage/coverage-summary.json')) {
        try {
          const coverageData = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
          coverage = coverageData.total.lines.pct;
        } catch {
          // Coverage parsing failed, continue without it
        }
      }

      this.results.push({
        name: 'Unit Tests',
        passed: true,
        duration: Date.now() - startTime,
        coverage: coverage
      });
      
      console.log('  ✅ Unit tests passed');
      if (coverage !== undefined) {
        console.log(`  📊 Coverage: ${coverage}%`);
      }
      
      return true;
      
    } catch (error: any) {
      this.results.push({
        name: 'Unit Tests',
        passed: false,
        duration: Date.now() - startTime,
        details: error.stdout || error.message
      });
      
      console.error('  ❌ Unit tests failed');
      if (this.options.verbose) {
        console.error('    ', error.stdout || error.message);
      }
      
      return false;
    }
  }

  /**
   * Run CDK-specific tests (snapshot tests)
   */
  private async runCdkTests(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log('🏗️  Running CDK tests...');
      
      // Run CDK tests specifically
      let command = 'jest';
      const args = ['--testMatch', '**/*.test.ts', '--testPathIgnorePatterns', 'integration'];

      if (this.options.updateSnapshots) {
        args.push('--updateSnapshot');
      }

      if (this.options.verbose) {
        args.push('--verbose');
      }

      const fullCommand = `npx ${command} ${args.join(' ')}`;
      
      const output = execSync(fullCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });

      this.results.push({
        name: 'CDK Tests',
        passed: true,
        duration: Date.now() - startTime
      });
      
      console.log('  ✅ CDK tests passed');
      
      return true;
      
    } catch (error: any) {
      this.results.push({
        name: 'CDK Tests',
        passed: false,
        duration: Date.now() - startTime,
        details: error.stdout || error.message
      });
      
      console.error('  ❌ CDK tests failed');
      if (this.options.verbose) {
        console.error('    ', error.stdout || error.message);
      }
      
      return false;
    }
  }

  /**
   * Run integration tests
   */
  private async runIntegrationTests(): Promise<boolean> {
    const startTime = Date.now();
    
    // Check if integration tests exist
    const integrationTestDir = 'test/integration';
    if (!fs.existsSync(integrationTestDir)) {
      console.log('🔗 No integration tests found - skipping');
      return true;
    }

    try {
      console.log('🔗 Running integration tests...');
      
      let command = 'jest';
      const args = ['--testMatch', '**/integration/**/*.test.ts'];

      if (this.options.verbose) {
        args.push('--verbose');
      }

      // Integration tests typically take longer
      args.push('--testTimeout', '30000');

      const fullCommand = `npx ${command} ${args.join(' ')}`;
      
      const output = execSync(fullCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });

      this.results.push({
        name: 'Integration Tests',
        passed: true,
        duration: Date.now() - startTime
      });
      
      console.log('  ✅ Integration tests passed');
      
      return true;
      
    } catch (error: any) {
      this.results.push({
        name: 'Integration Tests',
        passed: false,
        duration: Date.now() - startTime,
        details: error.stdout || error.message
      });
      
      console.error('  ❌ Integration tests failed');
      if (this.options.verbose) {
        console.error('    ', error.stdout || error.message);
      }
      
      return false;
    }
  }

  /**
   * Run configuration validation tests
   */
  private async runConfigurationTests(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log('📋 Running configuration tests...');
      
      // Test configuration validation
      const output = execSync('npm run validate-config', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });

      this.results.push({
        name: 'Configuration Tests',
        passed: true,
        duration: Date.now() - startTime
      });
      
      console.log('  ✅ Configuration tests passed');
      
      return true;
      
    } catch (error: any) {
      this.results.push({
        name: 'Configuration Tests',
        passed: false,
        duration: Date.now() - startTime,
        details: error.stdout || error.message
      });
      
      console.error('  ❌ Configuration tests failed');
      if (this.options.verbose) {
        console.error('    ', error.stdout || error.message);
      }
      
      return false;
    }
  }

  /**
   * Generate test report
   */
  public generateReport(): void {
    console.log('\n📊 Generating test report...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0)
      },
      results: this.results
    };

    // Create reports directory if it doesn't exist
    if (!fs.existsSync('reports')) {
      fs.mkdirSync('reports');
    }

    // Write JSON report
    const reportPath = `reports/test-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`  📄 Test report saved to: ${reportPath}`);

    // Write HTML report (simple)
    const htmlReport = this.generateHtmlReport(report);
    const htmlPath = `reports/test-report-${Date.now()}.html`;
    fs.writeFileSync(htmlPath, htmlReport);

    console.log(`  🌐 HTML report saved to: ${htmlPath}`);
  }

  /**
   * Generate HTML test report
   */
  private generateHtmlReport(report: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>CDK Platform Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e8f4fd; padding: 15px; border-radius: 5px; text-align: center; }
        .passed { background: #d4edda; }
        .failed { background: #f8d7da; }
        .result { margin: 10px 0; padding: 15px; border-radius: 5px; }
        .details { margin-top: 10px; font-family: monospace; background: #f8f9fa; padding: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CDK Platform Test Report</h1>
        <p>Generated: ${report.timestamp}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>${report.summary.total}</h3>
            <p>Total Tests</p>
        </div>
        <div class="metric passed">
            <h3>${report.summary.passed}</h3>
            <p>Passed</p>
        </div>
        <div class="metric failed">
            <h3>${report.summary.failed}</h3>
            <p>Failed</p>
        </div>
        <div class="metric">
            <h3>${report.summary.totalDuration}ms</h3>
            <p>Total Duration</p>
        </div>
    </div>
    
    <h2>Test Results</h2>
    ${report.results.map((result: TestResult) => `
        <div class="result ${result.passed ? 'passed' : 'failed'}">
            <h3>${result.passed ? '✅' : '❌'} ${result.name}</h3>
            <p>Duration: ${result.duration}ms</p>
            ${result.coverage ? `<p>Coverage: ${result.coverage}%</p>` : ''}
            ${result.details ? `<div class="details">${result.details}</div>` : ''}
        </div>
    `).join('')}
</body>
</html>
    `.trim();
  }

  /**
   * Display test results summary
   */
  private displayResults(totalTime: number): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(50));

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = `(${result.duration}ms)`;
      const coverage = result.coverage ? ` - ${result.coverage}% coverage` : '';
      
      console.log(`${status} ${result.name} ${duration}${coverage}`);
    });

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    console.log('='.repeat(50));
    console.log(`📈 Summary: ${passed} passed, ${failed} failed (${totalTime}ms total)`);
  }

  /**
   * Clean test artifacts
   */
  public cleanTestArtifacts(): void {
    console.log('🧹 Cleaning test artifacts...');

    const artifactsToClean = [
      'coverage',
      'reports',
      'test-results.xml',
      'junit.xml',
    ];

    artifactsToClean.forEach(artifact => {
      if (fs.existsSync(artifact)) {
        try {
          if (fs.statSync(artifact).isDirectory()) {
            fs.rmSync(artifact, { recursive: true, force: true });
          } else {
            fs.unlinkSync(artifact);
          }
          console.log(`  🗑️  Removed ${artifact}`);
        } catch (error) {
          console.warn(`  ⚠️  Failed to remove ${artifact}:`, error);
        }
      }
    });

    console.log('✅ Test artifacts cleaned');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: TestOptions = {
    watch: args.includes('--watch') || args.includes('-w'),
    coverage: args.includes('--coverage') || args.includes('-c'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    pattern: args.includes('--pattern') ? args[args.indexOf('--pattern') + 1] : undefined,
    updateSnapshots: args.includes('--updateSnapshot') || args.includes('-u'),
    bail: args.includes('--bail'),
  };

  const runner = new TestRunner(options);

  if (args.includes('--clean')) {
    runner.cleanTestArtifacts();
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Test Utilities

Usage:
  npm test [options]
  npx ts-node scripts/test-utilities.ts [options]

Options:
  --watch, -w           Run tests in watch mode
  --coverage, -c        Generate coverage report
  --verbose, -v         Show detailed output
  --pattern <pattern>   Run tests matching pattern
  --updateSnapshot, -u  Update Jest snapshots
  --bail               Stop on first failure
  --clean              Clean test artifacts
  --help, -h           Show this help message

Examples:
  npm test
  npm test -- --coverage --verbose
  npm test -- --pattern "SecurityStack"
  npm test -- --updateSnapshot
`);
    return;
  }

  const success = await runner.runAllTests();
  
  if (args.includes('--report')) {
    runner.generateReport();
  }
  
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

export { TestRunner };
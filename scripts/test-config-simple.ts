#!/usr/bin/env node

/**
 * Simple configuration loading test
 */

console.log('🔍 Starting simple configuration test...');

try {
  console.log('🔍 Testing basic file system access...');
  const fs = require('fs');
  const path = require('path');
  
  console.log('🔍 Current directory:', process.cwd());
  console.log('🔍 Directory contents:', fs.readdirSync('.'));
  
  // Test cdk.json loading
  console.log('🔍 Testing cdk.json...');
  if (fs.existsSync('cdk.json')) {
    const cdkJson = JSON.parse(fs.readFileSync('cdk.json', 'utf8'));
    const context = cdkJson.context || {};
    console.log('✅ cdk.json loaded');
    console.log('🔍 Environments:', Object.keys(context.environments || {}));
    console.log('🔍 Applications:', Object.keys(context.applications || {}));
  } else {
    console.log('❌ cdk.json not found');
  }
  
  // Test config/applications loading
  console.log('🔍 Testing config/applications...');
  if (fs.existsSync('config/applications')) {
    const files = fs.readdirSync('config/applications');
    console.log('✅ config/applications found');
    console.log('🔍 Files:', files);
    
    files.filter((f: string) => f.endsWith('.json')).forEach((file: string) => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join('config/applications', file), 'utf8'));
        console.log(`✅ ${file}: ${content.applicationName} by ${content.team}`);
      } catch (error) {
        console.log(`❌ ${file}: Failed to parse - ${(error as Error).message}`);
      }
    });
  } else {
    console.log('❌ config/applications not found');
  }
  
  console.log('🔍 Testing TypeScript imports...');
  
  // Test importing the configuration loaders
  const { HybridConfigurationLoader } = require('../lib/config/configuration-loaders');
  console.log('✅ HybridConfigurationLoader imported');
  
  const hybridLoader = new HybridConfigurationLoader();
  console.log('✅ HybridConfigurationLoader created');
  console.log('🔍 Loader description:', hybridLoader.getSourceDescription());
  
  // Test loading platform config
  console.log('🔍 Testing platform config loading...');
  const platformConfig = hybridLoader.loadPlatformConfig();
  console.log('✅ Platform config loaded');
  console.log('🔍 Environments:', Object.keys(platformConfig.environments));
  console.log('🔍 Platform:', platformConfig.platform);
  
  // Test loading application configs
  console.log('🔍 Testing application config loading...');
  const applicationConfigs = hybridLoader.loadApplicationConfigs();
  console.log('✅ Application configs loaded');
  console.log('🔍 Count:', applicationConfigs.length);
  applicationConfigs.forEach((app: any) => {
    console.log(`🔍 Found: ${app.applicationName} by ${app.team}`);
  });
  
  console.log('✅ All tests passed!');
  
} catch (error) {
  console.error('❌ Test failed:', error);
  console.error('❌ Stack trace:', (error as Error).stack);
  process.exit(1);
}
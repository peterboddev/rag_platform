#!/usr/bin/env node

// Simple test to verify configuration loading
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing configuration loading...');
console.log('🔍 Current directory:', process.cwd());
console.log('🔍 Directory contents:', fs.readdirSync('.'));

// Test cdk.json loading
console.log('\n🔍 Testing cdk.json loading...');
if (fs.existsSync('cdk.json')) {
  const cdkJson = JSON.parse(fs.readFileSync('cdk.json', 'utf8'));
  const context = cdkJson.context || {};
  console.log('✅ cdk.json loaded');
  console.log('🔍 Context keys:', Object.keys(context));
  console.log('🔍 Environments:', Object.keys(context.environments || {}));
  console.log('🔍 Applications:', Object.keys(context.applications || {}));
} else {
  console.log('❌ cdk.json not found');
}

// Test config/applications loading
console.log('\n🔍 Testing config/applications loading...');
if (fs.existsSync('config/applications')) {
  const files = fs.readdirSync('config/applications');
  console.log('✅ config/applications directory found');
  console.log('🔍 Files:', files);
  
  files.filter(f => f.endsWith('.json')).forEach(file => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join('config/applications', file), 'utf8'));
      console.log(`✅ ${file}: ${content.applicationName} by ${content.team}`);
    } catch (error) {
      console.log(`❌ ${file}: Failed to parse - ${error.message}`);
    }
  });
} else {
  console.log('❌ config/applications directory not found');
}
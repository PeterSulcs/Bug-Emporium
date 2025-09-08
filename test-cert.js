#!/usr/bin/env node

/**
 * Test script to verify GitLab certificate functionality
 * This script tests the certificate loading logic without making actual API calls
 */

const fs = require('fs');
const https = require('https');

console.log('🔍 Testing GitLab Certificate Functionality\n');

// Test 1: No certificate path provided
console.log('Test 1: No certificate path provided');
let httpsAgent = null;
if (process.env.GITLAB_CA_CERT_PATH && fs.existsSync(process.env.GITLAB_CA_CERT_PATH)) {
  try {
    const caCert = fs.readFileSync(process.env.GITLAB_CA_CERT_PATH);
    httpsAgent = new https.Agent({
      ca: caCert
    });
    console.log(`✅ Using custom CA certificate: ${process.env.GITLAB_CA_CERT_PATH}`);
  } catch (error) {
    console.error(`❌ Failed to load CA certificate from ${process.env.GITLAB_CA_CERT_PATH}:`, error.message);
  }
} else {
  console.log('ℹ️  No custom CA certificate configured (using system certificates)');
}

// Test 2: Certificate path provided but file doesn't exist
console.log('\nTest 2: Certificate path provided but file doesn\'t exist');
process.env.GITLAB_CA_CERT_PATH = '/nonexistent/cert.pem';
httpsAgent = null;
if (process.env.GITLAB_CA_CERT_PATH && fs.existsSync(process.env.GITLAB_CA_CERT_PATH)) {
  try {
    const caCert = fs.readFileSync(process.env.GITLAB_CA_CERT_PATH);
    httpsAgent = new https.Agent({
      ca: caCert
    });
    console.log(`✅ Using custom CA certificate: ${process.env.GITLAB_CA_CERT_PATH}`);
  } catch (error) {
    console.error(`❌ Failed to load CA certificate from ${process.env.GITLAB_CA_CERT_PATH}:`, error.message);
  }
} else {
  console.log('ℹ️  Certificate file not found, using system certificates');
}

// Test 3: Valid certificate path (if provided)
if (process.argv[2]) {
  console.log(`\nTest 3: Testing with provided certificate: ${process.argv[2]}`);
  process.env.GITLAB_CA_CERT_PATH = process.argv[2];
  httpsAgent = null;
  if (process.env.GITLAB_CA_CERT_PATH && fs.existsSync(process.env.GITLAB_CA_CERT_PATH)) {
    try {
      const caCert = fs.readFileSync(process.env.GITLAB_CA_CERT_PATH);
      httpsAgent = new https.Agent({
        ca: caCert
      });
      console.log(`✅ Successfully loaded CA certificate: ${process.env.GITLAB_CA_CERT_PATH}`);
      console.log(`📄 Certificate size: ${caCert.length} bytes`);
    } catch (error) {
      console.error(`❌ Failed to load CA certificate from ${process.env.GITLAB_CA_CERT_PATH}:`, error.message);
    }
  } else {
    console.log('ℹ️  Certificate file not found');
  }
}

console.log('\n🎉 Certificate functionality test completed!');
console.log('\nUsage examples:');
console.log('  node test-cert.js                                    # Test without certificate');
console.log('  node test-cert.js /path/to/your/ca-certificate.pem   # Test with certificate');
console.log('  GITLAB_CA_CERT_PATH=/path/to/cert.pem node test-cert.js  # Test with env var');

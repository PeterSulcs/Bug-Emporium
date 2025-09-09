#!/usr/bin/env node

/**
 * Certificate debugging script for Bug Emporium
 * This script helps debug certificate issues with GitLab instances
 */

const fs = require('fs');
const https = require('https');
const axios = require('axios');

async function debugCertificate() {
  console.log('🔍 Bug Emporium Certificate Debug Tool\n');

  const gitlabEndpoint = process.env.GITLAB_ENDPOINT || 'https://gitlab.com';
  const certPath = process.env.GITLAB_CA_CERT_PATH;
  const token = process.env.GITLAB_TOKEN;
  const groupId = process.env.GITLAB_GROUP_ID;

  console.log('Configuration:');
  console.log(`  GitLab Endpoint: ${gitlabEndpoint}`);
  console.log(`  Certificate Path: ${certPath || 'none'}`);
  console.log(`  Token: ${token ? '***provided***' : 'missing'}`);
  console.log(`  Group ID: ${groupId || 'missing'}\n`);

  // Test 1: Check certificate file
  if (certPath) {
    console.log('Test 1: Certificate File Check');
    if (fs.existsSync(certPath)) {
      try {
        const certContent = fs.readFileSync(certPath);
        console.log(`✅ Certificate file exists: ${certPath}`);
        console.log(`📄 Certificate size: ${certContent.length} bytes`);
        console.log(`📄 Certificate preview: ${certContent.toString().substring(0, 100)}...`);
      } catch (error) {
        console.log(`❌ Error reading certificate: ${error.message}`);
        return;
      }
    } else {
      console.log(`❌ Certificate file not found: ${certPath}`);
      return;
    }
  } else {
    console.log('ℹ️  No certificate path provided, using system certificates');
  }

  // Test 2: Create HTTPS agent
  console.log('\nTest 2: HTTPS Agent Creation');
  let httpsAgent = null;
  if (certPath && fs.existsSync(certPath)) {
    try {
      const caCert = fs.readFileSync(certPath);
      httpsAgent = new https.Agent({
        ca: caCert,
        rejectUnauthorized: true
      });
      console.log('✅ HTTPS agent created with custom certificate');
    } catch (error) {
      console.log(`❌ Failed to create HTTPS agent: ${error.message}`);
      return;
    }
  } else {
    httpsAgent = new https.Agent({
      rejectUnauthorized: true
    });
    console.log('✅ HTTPS agent created with system certificates');
  }

  // Test 3: Test connection
  console.log('\nTest 3: GitLab Connection Test');
  if (!token || !groupId) {
    console.log('⚠️  Skipping connection test - missing token or group ID');
    console.log('   Set GITLAB_TOKEN and GITLAB_GROUP_ID to test connection');
    return;
  }

  try {
    const axiosInstance = axios.create({
      baseURL: `${gitlabEndpoint}/api/v4`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      httpsAgent: httpsAgent,
      timeout: 10000
    });

    console.log('🔄 Testing connection to GitLab...');
    const response = await axiosInstance.get(`/groups/${groupId}`);
    
    console.log('✅ Connection successful!');
    console.log(`📊 Group: ${response.data.name} (${response.data.full_path})`);
    console.log(`🔗 API Version: ${response.headers['x-gitlab-api-version'] || 'unknown'}`);
    
    // Test the group issues endpoint
    console.log('\n🔄 Testing group issues endpoint...');
    try {
      const issuesResponse = await axiosInstance.get(`/groups/${groupId}/issues`, {
        params: {
          per_page: 5,
          state: 'all'
        }
      });
      console.log(`✅ Group issues endpoint working! Found ${issuesResponse.data.length} issues (showing first 5)`);
    } catch (issuesError) {
      console.log(`⚠️  Group issues endpoint test failed: ${issuesError.message}`);
    }

  } catch (error) {
    console.log('❌ Connection failed!');
    console.log(`   Error: ${error.message}`);
    
    if (error.code) {
      console.log(`   Code: ${error.code}`);
    }
    
    if (error.response) {
      console.log(`   HTTP Status: ${error.response.status} ${error.response.statusText}`);
    }

    // Provide specific guidance based on error type
    if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
        error.code === 'CERT_UNTRUSTED' || 
        error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      console.log('\n💡 SSL Certificate Error - Possible Solutions:');
      console.log('   1. Verify your certificate file is correct');
      console.log('   2. Ensure the certificate is in PEM format');
      console.log('   3. Check that the certificate matches your GitLab instance');
      console.log('   4. Try using the full certificate chain');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 DNS Error - Possible Solutions:');
      console.log('   1. Check your GITLAB_ENDPOINT URL');
      console.log('   2. Verify network connectivity');
      console.log('   3. Check if the GitLab instance is accessible');
    } else if (error.response && error.response.status === 401) {
      console.log('\n💡 Authentication Error - Possible Solutions:');
      console.log('   1. Verify your GITLAB_TOKEN is correct');
      console.log('   2. Check token permissions (needs read_api scope)');
      console.log('   3. Ensure token is not expired');
    } else if (error.response && error.response.status === 404) {
      console.log('\n💡 Not Found Error - Possible Solutions:');
      console.log('   1. Verify your GITLAB_GROUP_ID is correct');
      console.log('   2. Check that the group exists and is accessible');
      console.log('   3. Ensure your token has access to the group');
    }
  }
}

// Run the debug function
debugCertificate().catch(console.error);

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Cache configuration
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds
const cache = new Map();

// Cache helper functions
function getCacheKey(endpoint, params = {}) {
  const sortedParams = Object.keys(params).sort().reduce((result, key) => {
    result[key] = params[key];
    return result;
  }, {});
  return `${endpoint}:${JSON.stringify(sortedParams)}`;
}

function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`✅ Cache hit for key: ${key}`);
    return cached.data;
  }
  if (cached) {
    console.log(`⏰ Cache expired for key: ${key}`);
    cache.delete(key);
  }
  return null;
}

function setCachedData(key, data) {
  cache.set(key, {
    data: data,
    timestamp: Date.now()
  });
  console.log(`💾 Cached data for key: ${key}`);
}

function clearCache() {
  cache.clear();
  console.log('🗑️  Cache cleared');
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'public')));

// GitLab configuration
const GITLAB_ENDPOINT = process.env.GITLAB_ENDPOINT;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_GROUP_ID = process.env.GITLAB_GROUP_ID;
const EMPORIUM_LABEL = process.env.EMPORIUM_LABEL || 'emporium';
const PRIORITY_LABEL = process.env.PRIORITY_LABEL || 'priority';
const FUNHOUSE_LABEL = process.env.FUNHOUSE_LABEL || 'funhouse';
const GITLAB_CA_CERT_PATH = process.env.GITLAB_CA_CERT_PATH;

// Create HTTPS agent with custom CA certificate if provided
let httpsAgent = null;
if (GITLAB_CA_CERT_PATH && fs.existsSync(GITLAB_CA_CERT_PATH)) {
  try {
    const caCert = fs.readFileSync(GITLAB_CA_CERT_PATH);
    
    // Try to parse the certificate to validate it
    const certString = caCert.toString();
    if (!certString.includes('-----BEGIN CERTIFICATE-----')) {
      console.warn(`⚠️  Certificate file may not be in PEM format: ${GITLAB_CA_CERT_PATH}`);
    }
    
    httpsAgent = new https.Agent({
      ca: caCert,
      rejectUnauthorized: true,
      // Additional options for better certificate handling
      keepAlive: true,
      maxSockets: 1
    });
    console.log(`✅ Using custom CA certificate: ${GITLAB_CA_CERT_PATH}`);
    console.log(`📄 Certificate size: ${caCert.length} bytes`);
  } catch (error) {
    console.error(`❌ Failed to load CA certificate from ${GITLAB_CA_CERT_PATH}:`, error.message);
    console.log('⚠️  Falling back to system certificates');
  }
} else if (GITLAB_CA_CERT_PATH) {
  console.log(`⚠️  Certificate path provided but file not found: ${GITLAB_CA_CERT_PATH}`);
  console.log('⚠️  Using system certificates');
} else {
  console.log('ℹ️  No custom CA certificate configured, using system certificates');
}

// GitLab API helper
const gitlabApi = axios.create({
  baseURL: `${GITLAB_ENDPOINT}/api/v4`,
  headers: {
    'Authorization': `Bearer ${GITLAB_TOKEN}`,
    'Content-Type': 'application/json'
  },
  httpsAgent: httpsAgent,
  timeout: 30000 // 30 second timeout
});

// Cached GitLab API helper
async function cachedGitlabApiCall(endpoint, params = {}) {
  const cacheKey = getCacheKey(`gitlab:${endpoint}`, params);
  const cachedData = getCachedData(cacheKey);
  
  if (cachedData) {
    return cachedData;
  }
  
  console.log(`🌐 Making GitLab API call: ${endpoint}`);
  const response = await gitlabApi.get(endpoint, { params });
  setCachedData(cacheKey, response.data);
  return response.data;
}

// Helper function to categorize issues
function categorizeIssues(issues) {
  const forSale = [];
  const sold = [];
  const delivered = [];

  issues.forEach(issue => {
    // Ensure labels is an array
    const labels = Array.isArray(issue.labels) ? issue.labels : [];
    
    if (issue.state === 'closed') {
      delivered.push(issue);
    } else if (issue.assignee) {
      sold.push(issue);
    } else {
      forSale.push(issue);
    }
  });

  // Sort each category by priority label and creation date
  const sortIssues = (issues) => {
    return issues.sort((a, b) => {
      const aLabels = Array.isArray(a.labels) ? a.labels : [];
      const bLabels = Array.isArray(b.labels) ? b.labels : [];
      
      const aHasPriority = aLabels.includes(PRIORITY_LABEL);
      const bHasPriority = bLabels.includes(PRIORITY_LABEL);
      
      if (aHasPriority && !bHasPriority) return -1;
      if (!aHasPriority && bHasPriority) return 1;
      
      return new Date(b.created_at) - new Date(a.created_at);
    });
  };

  return {
    forSale: sortIssues(forSale),
    sold: sortIssues(sold),
    delivered: sortIssues(delivered)
  };
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get configuration
app.get('/api/config', (req, res) => {
  res.json({
    emporiumLabel: EMPORIUM_LABEL,
    priorityLabel: PRIORITY_LABEL,
    funhouseLabel: FUNHOUSE_LABEL,
    gitlabEndpoint: GITLAB_ENDPOINT,
    hasCustomCert: !!httpsAgent,
    certPath: GITLAB_CA_CERT_PATH || null
  });
});

// Clear cache endpoint
app.post('/api/cache/clear', (req, res) => {
  try {
    clearCache();
    res.json({ 
      success: true, 
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear cache',
      details: error.message
    });
  }
});

// Get cache status endpoint
app.get('/api/cache/status', (req, res) => {
  const cacheEntries = Array.from(cache.entries()).map(([key, value]) => ({
    key: key,
    timestamp: value.timestamp,
    age: Date.now() - value.timestamp,
    ttl: CACHE_TTL,
    expiresIn: Math.max(0, CACHE_TTL - (Date.now() - value.timestamp))
  }));
  
  res.json({
    totalEntries: cache.size,
    ttl: CACHE_TTL,
    entries: cacheEntries
  });
});

// Test GitLab connectivity
app.get('/api/test-gitlab', async (req, res) => {
  try {
    if (!GITLAB_TOKEN || !GITLAB_GROUP_ID) {
      return res.status(500).json({ 
        error: 'GitLab configuration missing. Please check your environment variables.' 
      });
    }

    console.log('Testing GitLab connectivity...');
    console.log(`Endpoint: ${GITLAB_ENDPOINT}`);
    console.log(`Using custom cert: ${!!httpsAgent}`);
    console.log(`Cert path: ${GITLAB_CA_CERT_PATH || 'none'}`);

    // Test with a simple API call to get group info
    const response = await gitlabApi.get(`/groups/${GITLAB_GROUP_ID}`, {
      timeout: 10000
    });

    res.json({
      success: true,
      message: 'GitLab connection successful',
      groupName: response.data.name,
      groupPath: response.data.full_path,
      endpoint: GITLAB_ENDPOINT,
      hasCustomCert: !!httpsAgent
    });

  } catch (error) {
    console.error('GitLab connectivity test failed:', error);
    
    let errorDetails = error.message;
    if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
        error.code === 'CERT_UNTRUSTED' || 
        error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      errorDetails = `SSL Certificate error: ${error.message}. Please check your GITLAB_CA_CERT_PATH configuration.`;
    } else if (error.code === 'ENOTFOUND') {
      errorDetails = `DNS resolution failed: ${error.message}. Please check your GITLAB_ENDPOINT.`;
    } else if (error.response) {
      errorDetails = `GitLab API error: ${error.response.status} ${error.response.statusText}`;
    }

    res.status(500).json({
      success: false,
      error: 'GitLab connection failed',
      details: errorDetails,
      code: error.code || 'UNKNOWN_ERROR',
      endpoint: GITLAB_ENDPOINT,
      hasCustomCert: !!httpsAgent,
      certPath: GITLAB_CA_CERT_PATH || 'none'
    });
  }
});

// Get all issues from the GitLab group
app.get('/api/issues', async (req, res) => {
  try {
    if (!GITLAB_TOKEN || !GITLAB_GROUP_ID) {
      return res.status(500).json({ 
        error: 'GitLab configuration missing. Please check your environment variables.' 
      });
    }

    // Check cache first
    const cacheKey = getCacheKey('issues', { groupId: GITLAB_GROUP_ID, label: EMPORIUM_LABEL });
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    console.log(`Fetching issues for group ${GITLAB_GROUP_ID} with label '${EMPORIUM_LABEL}'`);

    // Fetch all issues from the group using the efficient group issues endpoint
    const allIssues = [];
    let page = 1;
    const perPage = 100;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        const issues = await cachedGitlabApiCall(`/groups/${GITLAB_GROUP_ID}/issues`, {
          labels: EMPORIUM_LABEL,
          state: 'all', // Get both open and closed issues
          per_page: perPage,
          page: page,
          include_subgroups: true,
          order_by: 'created_at',
          sort: 'desc'
        });

        allIssues.push(...issues);

        // Check if there are more pages
        hasMorePages = issues.length === perPage;
        page++;

        console.log(`Fetched page ${page - 1}: ${issues.length} issues (total so far: ${allIssues.length})`);

      } catch (error) {
        console.error(`Error fetching page ${page}:`, error.message);
        // If we get an error on a specific page, break the loop but return what we have
        break;
      }
    }

    console.log(`Total issues fetched: ${allIssues.length}`);

    // Fetch project names for all unique project IDs
    const projectIds = [...new Set(allIssues.map(issue => issue.project_id))];
    const projectNames = {};
    
    console.log(`Fetching project names for ${projectIds.length} projects...`);
    
    for (const projectId of projectIds) {
      try {
        const projectData = await cachedGitlabApiCall(`/projects/${projectId}`, {
          simple: true // Only get basic project info
        });
        projectNames[projectId] = projectData.name;
      } catch (error) {
        console.warn(`Failed to fetch project name for project ${projectId}:`, error.message);
        projectNames[projectId] = `Project ${projectId}`;
      }
    }

    // Add project names to issues
    allIssues.forEach(issue => {
      issue.project_name = projectNames[issue.project_id] || `Project ${issue.project_id}`;
    });

    const categorizedIssues = categorizeIssues(allIssues);
    
    const responseData = {
      issues: categorizedIssues,
      total: allIssues.length,
      timestamp: new Date().toISOString()
    };

    // Cache the response
    setCachedData(cacheKey, responseData);
    
    res.json(responseData);

  } catch (error) {
    console.error('Error fetching issues:', error);
    
    // Provide more detailed error information for debugging
    let errorDetails = error.message;
    if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
        error.code === 'CERT_UNTRUSTED' || 
        error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      errorDetails = `SSL Certificate error: ${error.message}. Please check your GITLAB_CA_CERT_PATH configuration.`;
    } else if (error.code === 'ENOTFOUND') {
      errorDetails = `DNS resolution failed: ${error.message}. Please check your GITLAB_ENDPOINT.`;
    } else if (error.response) {
      errorDetails = `GitLab API error: ${error.response.status} ${error.response.statusText}`;
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch issues from GitLab',
      details: errorDetails,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Helper function to extract issue IDs from description and comments
async function extractLinkedIssueIds(issue, gitlabApi) {
  const linkedIds = new Set();
  
  // Extract from description
  if (issue.description) {
    const descMatches = issue.description.match(/#(\d+)/g);
    if (descMatches) {
      descMatches.forEach(match => {
        const id = parseInt(match.substring(1));
        if (id && id !== issue.iid) {
          linkedIds.add(id);
        }
      });
    }
  }
  
  // Extract from comments/notes
  try {
    const notesData = await cachedGitlabApiCall(`/projects/${issue.project_id}/issues/${issue.iid}/notes`);
    notesData.forEach(note => {
      if (note.body) {
        const noteMatches = note.body.match(/#(\d+)/g);
        if (noteMatches) {
          noteMatches.forEach(match => {
            const id = parseInt(match.substring(1));
            if (id && id !== issue.iid) {
              linkedIds.add(id);
            }
          });
        }
      }
    });
  } catch (error) {
    console.warn(`Failed to fetch notes for issue ${issue.iid}:`, error.message);
  }
  
  return Array.from(linkedIds);
}

// Helper function to spider through linked issues
async function spiderLinkedIssues(issue, gitlabApi, visited = new Set(), rootIssueId = null, depth = 0, maxDepth = 5) {
  // Set root issue ID on first call
  if (rootIssueId === null) {
    rootIssueId = issue.iid;
  }
  
  // Prevent infinite recursion and circular references
  if (depth >= maxDepth || visited.has(issue.iid)) {
    return { issue, linkedIssues: [] };
  }
  
  visited.add(issue.iid);
  
  try {
    const linkedIds = await extractLinkedIssueIds(issue, gitlabApi);
    const linkedIssues = [];
    
    for (const linkedId of linkedIds) {
      // Skip if this is the root feature issue or already visited
      if (linkedId === rootIssueId || visited.has(linkedId)) {
        continue;
      }
      
      try {
        const linkedIssue = await cachedGitlabApiCall(`/projects/${issue.project_id}/issues/${linkedId}`);
        
        // Recursively spider this linked issue, passing the same visited set and root issue ID
        const spideredIssue = await spiderLinkedIssues(linkedIssue, gitlabApi, visited, rootIssueId, depth + 1, maxDepth);
        linkedIssues.push(spideredIssue);
      } catch (error) {
        console.warn(`Failed to fetch linked issue ${linkedId}:`, error.message);
      }
    }
    
    return { issue, linkedIssues };
  } catch (error) {
    console.warn(`Failed to spider issue ${issue.iid}:`, error.message);
    return { issue, linkedIssues: [] };
  }
}

// Get Feature Funhouse data
app.get('/api/funhouse', async (req, res) => {
  try {
    if (!GITLAB_TOKEN || !GITLAB_GROUP_ID) {
      return res.status(500).json({ 
        error: 'GitLab configuration missing. Please check your environment variables.' 
      });
    }

    // Check cache first
    const cacheKey = getCacheKey('funhouse', { groupId: GITLAB_GROUP_ID, label: FUNHOUSE_LABEL });
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    console.log(`Fetching funhouse features for group ${GITLAB_GROUP_ID} with label '${FUNHOUSE_LABEL}'`);

    // Fetch all funhouse issues
    const allFeatures = [];
    let page = 1;
    const perPage = 100;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        const features = await cachedGitlabApiCall(`/groups/${GITLAB_GROUP_ID}/issues`, {
          labels: FUNHOUSE_LABEL,
          state: 'all',
          per_page: perPage,
          page: page,
          include_subgroups: true,
          order_by: 'created_at',
          sort: 'desc'
        });

        allFeatures.push(...features);

        hasMorePages = features.length === perPage;
        page++;

        console.log(`Fetched funhouse page ${page - 1}: ${features.length} features (total so far: ${allFeatures.length})`);

      } catch (error) {
        console.error(`Error fetching funhouse page ${page}:`, error.message);
        break;
      }
    }

    console.log(`Total funhouse features fetched: ${allFeatures.length}`);

    // Fetch project names for all unique project IDs
    const projectIds = [...new Set(allFeatures.map(feature => feature.project_id))];
    const projectNames = {};
    
    console.log(`Fetching project names for ${projectIds.length} projects...`);
    
    for (const projectId of projectIds) {
      try {
        const projectData = await cachedGitlabApiCall(`/projects/${projectId}`, {
          simple: true
        });
        projectNames[projectId] = projectData.name;
      } catch (error) {
        console.warn(`Failed to fetch project name for project ${projectId}:`, error.message);
        projectNames[projectId] = `Project ${projectId}`;
      }
    }

    // Add project names to features
    allFeatures.forEach(feature => {
      feature.project_name = projectNames[feature.project_id] || `Project ${feature.project_id}`;
    });

    // Spider through each feature to build the tree
    console.log('Spidering through linked issues...');
    const featureTrees = [];
    
    for (const feature of allFeatures) {
      try {
        const featureTree = await spiderLinkedIssues(feature, gitlabApi);
        featureTrees.push(featureTree);
      } catch (error) {
        console.warn(`Failed to spider feature ${feature.iid}:`, error.message);
        featureTrees.push({ issue: feature, linkedIssues: [] });
      }
    }

    // Function to recursively add project names to all issues in the tree
    function addProjectNamesToTree(tree) {
      if (tree.issue && !tree.issue.project_name) {
        tree.issue.project_name = projectNames[tree.issue.project_id] || `Project ${tree.issue.project_id}`;
      }
      
      if (tree.linkedIssues && tree.linkedIssues.length > 0) {
        tree.linkedIssues.forEach(linkedIssue => {
          addProjectNamesToTree(linkedIssue);
        });
      }
    }

    // Add project names to all issues in the feature trees
    console.log('Adding project names to all linked issues...');
    featureTrees.forEach(featureTree => {
      addProjectNamesToTree(featureTree);
    });

    // Categorize features as Active or Complete
    const activeFeatures = featureTrees.filter(tree => tree.issue.state === 'opened');
    const completeFeatures = featureTrees.filter(tree => tree.issue.state === 'closed');

    const responseData = {
      features: {
        active: activeFeatures,
        complete: completeFeatures
      },
      total: allFeatures.length,
      timestamp: new Date().toISOString()
    };

    // Cache the response
    setCachedData(cacheKey, responseData);

    res.json(responseData);

  } catch (error) {
    console.error('Error fetching funhouse features:', error);
    
    let errorDetails = error.message;
    if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
        error.code === 'CERT_UNTRUSTED' || 
        error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      errorDetails = `SSL Certificate error: ${error.message}. Please check your GITLAB_CA_CERT_PATH configuration.`;
    } else if (error.code === 'ENOTFOUND') {
      errorDetails = `DNS resolution failed: ${error.message}. Please check your GITLAB_ENDPOINT.`;
    } else if (error.response) {
      errorDetails = `GitLab API error: ${error.response.status} ${error.response.statusText}`;
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch funhouse features from GitLab',
      details: errorDetails,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Bug Emporium API server running on port ${PORT}`);
  console.log(`GitLab Endpoint: ${GITLAB_ENDPOINT}`);
  console.log(`Emporium Label: ${EMPORIUM_LABEL}`);
  console.log(`Priority Label: ${PRIORITY_LABEL}`);
});

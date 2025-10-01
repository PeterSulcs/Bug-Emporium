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
const PROJECT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for project names (they rarely change)
const USER_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for user names (they almost never change)
const cache = new Map();

// Cache helper functions
function getCacheKey(endpoint, params = {}) {
  const sortedParams = Object.keys(params).sort().reduce((result, key) => {
    result[key] = params[key];
    return result;
  }, {});
  return `${endpoint}:${JSON.stringify(sortedParams)}`;
}

function getCachedData(key, ttl = CACHE_TTL) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    console.log(`✅ Cache hit for key: ${key}`);
    return cached.data;
  }
  if (cached) {
    console.log(`⏰ Cache expired for key: ${key}`);
    cache.delete(key);
  }
  return null;
}

function setCachedData(key, data, ttl = CACHE_TTL) {
  cache.set(key, {
    data: data,
    timestamp: Date.now(),
    ttl: ttl
  });
  console.log(`💾 Cached data for key: ${key} (TTL: ${ttl / 1000 / 60} minutes)`);
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
const IGNORE_LABELS = process.env.IGNORE_LABELS ? process.env.IGNORE_LABELS.split(',').map(label => label.trim()) : ['renovate', 'dependabot'];
// Amazing Race configuration
const RACE_LABEL = process.env.RACE_LABEL || 'amazing::race';
const TEAM_LABELS = (process.env.TEAM_LABELS ? process.env.TEAM_LABELS.split(',') : ['alpha','bravo','whiskey','tango','foxtrot']).map(l => l.trim()).filter(Boolean);
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
async function cachedGitlabApiCall(endpoint, params = {}, ttl = CACHE_TTL) {
  const cacheKey = getCacheKey(`gitlab:${endpoint}`, params);
  const cachedData = getCachedData(cacheKey, ttl);
  
  if (cachedData) {
    return cachedData;
  }
  
  console.log(`🌐 Making GitLab API call: ${endpoint}`);
  const response = await gitlabApi.get(endpoint, { params });
  setCachedData(cacheKey, response.data, ttl);
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
    raceLabel: RACE_LABEL,
    teamLabels: TEAM_LABELS,
    ignoreLabels: IGNORE_LABELS,
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
    
    console.log(`Fetching project names for ${projectIds.length} projects in parallel...`);
    
    // Fetch project names in parallel batches for better performance
    const projectPromises = projectIds.map(async (projectId) => {
      try {
        const projectData = await cachedGitlabApiCall(`/projects/${projectId}`, {
          simple: true // Only get basic project info
        }, PROJECT_CACHE_TTL);
        return { projectId, name: projectData.name };
      } catch (error) {
        console.warn(`Failed to fetch project name for project ${projectId}:`, error.message);
        return { projectId, name: `Project ${projectId}` };
      }
    });
    
    const projectResults = await Promise.all(projectPromises);
    projectResults.forEach(({ projectId, name }) => {
      projectNames[projectId] = name;
    });

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

// Get all merge requests from the GitLab group
app.get('/api/merge-requests', async (req, res) => {
  try {
    if (!GITLAB_TOKEN || !GITLAB_GROUP_ID) {
      return res.status(500).json({ 
        error: 'GitLab configuration missing. Please check your environment variables.' 
      });
    }

    // Check cache first
    const cacheKey = getCacheKey('merge-requests', { 
      groupId: GITLAB_GROUP_ID, 
      ignoreLabels: IGNORE_LABELS.join(','),
      notLabels: IGNORE_LABELS.join(',')
    });
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    console.log(`Fetching merge requests for group ${GITLAB_GROUP_ID}`);

    // Fetch all merge requests from the group
    const allMergeRequests = [];
    let page = 1;
    const perPage = 100;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        // Build API parameters with ignore labels filtering
        const apiParams = {
          state: 'opened', // Only get open merge requests
          per_page: perPage,
          page: page,
          include_subgroups: true,
          order_by: 'created_at',
          sort: 'desc',
          with_merge_status_recheck: true
        };

        // Add ignore labels filtering at API level
        if (IGNORE_LABELS.length > 0) {
          // GitLab API supports not[labels] parameter to exclude labels
          apiParams['not[labels]'] = IGNORE_LABELS.join(',');
        }

        const mergeRequests = await cachedGitlabApiCall(`/groups/${GITLAB_GROUP_ID}/merge_requests`, apiParams);

        allMergeRequests.push(...mergeRequests);

        // Check if there are more pages
        hasMorePages = mergeRequests.length === perPage;
        page++;

        console.log(`Fetched MR page ${page - 1}: ${mergeRequests.length} merge requests (total so far: ${allMergeRequests.length})`);

      } catch (error) {
        console.error(`Error fetching MR page ${page}:`, error.message);
        break;
      }
    }

    console.log(`Total merge requests fetched: ${allMergeRequests.length} (already filtered at API level)`);

    // Fetch project details and user names for all unique IDs
    const projectIds = [...new Set(allMergeRequests.map(mr => mr.project_id))];
    const userIds = [...new Set(allMergeRequests.flatMap(mr => [
      ...(mr.assignees || []).map(a => a.id),
      ...(mr.reviewers || []).map(r => r.id),
      mr.author?.id
    ].filter(Boolean)))];
    
    const projectDetails = {};
    const userNames = {};
    
    console.log(`Fetching project details for ${projectIds.length} projects and user names for ${userIds.length} users in parallel...`);
    
    // Fetch project details in parallel
    const projectPromises = projectIds.map(async (projectId) => {
      try {
        const projectData = await cachedGitlabApiCall(`/projects/${projectId}`, {
          simple: true
        }, PROJECT_CACHE_TTL);
        return { 
          projectId, 
          name: projectData.name,
          path_with_namespace: projectData.path_with_namespace,
          namespace: projectData.namespace
        };
      } catch (error) {
        console.warn(`Failed to fetch project details for project ${projectId}:`, error.message);
        return { 
          projectId, 
          name: `Project ${projectId}`,
          path_with_namespace: `project-${projectId}`,
          namespace: { full_path: 'unknown' }
        };
      }
    });
    
    // Fetch user names in parallel
    const userPromises = userIds.map(async (userId) => {
      try {
        const userData = await cachedGitlabApiCall(`/users/${userId}`, {}, USER_CACHE_TTL);
        return { userId, name: userData.name, username: userData.username };
      } catch (error) {
        console.warn(`Failed to fetch user name for user ${userId}:`, error.message);
        return { userId, name: `User ${userId}`, username: `user${userId}` };
      }
    });
    
    const [projectResults, userResults] = await Promise.all([
      Promise.all(projectPromises),
      Promise.all(userPromises)
    ]);
    
    projectResults.forEach(({ projectId, name, path_with_namespace, namespace }) => {
      projectDetails[projectId] = { name, path_with_namespace, namespace };
    });
    
    userResults.forEach(({ userId, name, username }) => {
      userNames[userId] = { name, username };
    });

    // Enrich merge requests with additional data (approvals are already included in the API response)
    console.log('Enriching merge requests with additional data...');
    const enrichedMergeRequests = [];
    
    for (const mr of allMergeRequests) {
      try {
        // Approvals are already included in the merge request response, no need for separate API call
        
        // Extract linked issue IDs from description (but don't fetch the full issue data)
        const linkedIssueIds = [];
        if (mr.description) {
          const issueMatches = mr.description.match(/#(\d+)/g);
          if (issueMatches) {
            linkedIssueIds.push(...issueMatches.map(match => parseInt(match.substring(1))));
          }
        }

        // Get review app URL from environment variables or MR description
        let reviewAppUrl = null;
        if (mr.description) {
          const reviewAppMatch = mr.description.match(/review[_-]?app[:\s]+(https?:\/\/[^\s]+)/i);
          if (reviewAppMatch) {
            reviewAppUrl = reviewAppMatch[1];
          }
        }

        // Get project details
        const project = projectDetails[mr.project_id] || { 
          name: `Project ${mr.project_id}`, 
          path_with_namespace: `project-${mr.project_id}`,
          namespace: { full_path: 'unknown' }
        };

        // Enrich assignees and reviewers with user names
        const enrichedAssignees = (mr.assignees || []).map(assignee => ({
          ...assignee,
          name: userNames[assignee.id]?.name || assignee.name || `User ${assignee.id}`,
          username: userNames[assignee.id]?.username || assignee.username || `user${assignee.id}`
        }));

        const enrichedReviewers = (mr.reviewers || []).map(reviewer => ({
          ...reviewer,
          name: userNames[reviewer.id]?.name || reviewer.name || `User ${reviewer.id}`,
          username: userNames[reviewer.id]?.username || reviewer.username || `user${reviewer.id}`
        }));

        const enrichedAuthor = mr.author ? {
          ...mr.author,
          name: userNames[mr.author.id]?.name || mr.author.name || `User ${mr.author.id}`,
          username: userNames[mr.author.id]?.username || mr.author.username || `user${mr.author.id}`
        } : null;

        const enrichedMR = {
          ...mr,
          // Remove the old assignee field, use assignees array instead
          assignee: undefined,
          assignees: enrichedAssignees,
          reviewers: enrichedReviewers,
          author: enrichedAuthor,
          project_name: project.name,
          project_path: project.path_with_namespace,
          project_namespace: project.namespace.full_path,
          // Approvals data is already included in the merge request response
          approvals: mr.approvals || {
            approved: false,
            approvals_required: 0,
            approvals_left: 0,
            approvers: [],
            approved_by: []
          },
          linked_issue_ids: linkedIssueIds,
          review_app_url: reviewAppUrl,
          is_draft: mr.draft || mr.title.toLowerCase().includes('[draft]') || mr.title.toLowerCase().includes('wip:'),
          created_at: mr.created_at,
          labels: mr.labels || []
        };

        enrichedMergeRequests.push(enrichedMR);
      } catch (error) {
        console.warn(`Failed to enrich MR ${mr.iid}:`, error.message);
        // Add basic MR data even if enrichment fails
        const project = projectDetails[mr.project_id] || { 
          name: `Project ${mr.project_id}`, 
          path_with_namespace: `project-${mr.project_id}`,
          namespace: { full_path: 'unknown' }
        };
        
        enrichedMergeRequests.push({
          ...mr,
          assignee: undefined,
          assignees: mr.assignees || [],
          reviewers: mr.reviewers || [],
          author: mr.author,
          project_name: project.name,
          project_path: project.path_with_namespace,
          project_namespace: project.namespace.full_path,
          approvals: mr.approvals || { approved: false, approvals_required: 0, approvals_left: 0, approvers: [], approved_by: [] },
          linked_issue_ids: [],
          review_app_url: null,
          is_draft: mr.draft || mr.title.toLowerCase().includes('[draft]') || mr.title.toLowerCase().includes('wip:'),
          created_at: mr.created_at,
          labels: mr.labels || []
        });
      }
    }

    const responseData = {
      merge_requests: enrichedMergeRequests,
      total: enrichedMergeRequests.length,
      timestamp: new Date().toISOString()
    };

    // Cache the response
    setCachedData(cacheKey, responseData);
    
    res.json(responseData);

  } catch (error) {
    console.error('Error fetching merge requests:', error);
    
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
      error: 'Failed to fetch merge requests from GitLab',
      details: errorDetails,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

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
    
    console.log(`Fetching project names for ${projectIds.length} projects in parallel...`);
    
    // Fetch project names in parallel batches for better performance
    const projectPromises = projectIds.map(async (projectId) => {
      try {
        const projectData = await cachedGitlabApiCall(`/projects/${projectId}`, {
          simple: true
        }, PROJECT_CACHE_TTL);
        return { projectId, name: projectData.name };
      } catch (error) {
        console.warn(`Failed to fetch project name for project ${projectId}:`, error.message);
        return { projectId, name: `Project ${projectId}` };
      }
    });
    
    const projectResults = await Promise.all(projectPromises);
    projectResults.forEach(({ projectId, name }) => {
      projectNames[projectId] = name;
    });

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

// Amazing Race endpoint
app.get('/api/race', async (req, res) => {
  try {
    if (!GITLAB_TOKEN || !GITLAB_GROUP_ID) {
      return res.status(500).json({ 
        error: 'GitLab configuration missing. Please check your environment variables.' 
      });
    }

    // Cache first
    const cacheKey = getCacheKey('race', { groupId: GITLAB_GROUP_ID, raceLabel: RACE_LABEL, teamLabels: TEAM_LABELS.join(',') });
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    console.log(`Fetching race issues for group ${GITLAB_GROUP_ID} with race label '${RACE_LABEL}'`);

    // Fetch all race issues (open and closed) with the race label
    const raceIssues = [];
    let page = 1;
    const perPage = 100;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        const issues = await cachedGitlabApiCall(`/groups/${GITLAB_GROUP_ID}/issues`, {
          labels: RACE_LABEL,
          state: 'all',
          per_page: perPage,
          page: page,
          include_subgroups: true,
          order_by: 'created_at',
          sort: 'desc'
        });

        raceIssues.push(...issues);
        hasMorePages = issues.length === perPage;
        page++;
      } catch (error) {
        console.error(`Error fetching race page ${page}:`, error.message);
        break;
      }
    }

    // Fetch project names
    const projectIds = [...new Set(raceIssues.map(issue => issue.project_id))];
    const projectNames = {};
    const projectPromises = projectIds.map(async (projectId) => {
      try {
        const projectData = await cachedGitlabApiCall(`/projects/${projectId}`, { simple: true }, PROJECT_CACHE_TTL);
        return { projectId, name: projectData.name };
      } catch (_e) {
        return { projectId, name: `Project ${projectId}` };
      }
    });
    const projectResults = await Promise.all(projectPromises);
    projectResults.forEach(({ projectId, name }) => { projectNames[projectId] = name; });
    raceIssues.forEach(issue => { issue.project_name = projectNames[issue.project_id] || `Project ${issue.project_id}`; });

    // Build leaderboard based on closed issues per team label
    const teamStats = TEAM_LABELS.map(label => ({ team: label, closed: 0, total: 0 }));
    const labelToStats = Object.fromEntries(teamStats.map(s => [s.team, s]));

    raceIssues.forEach(issue => {
      const labels = Array.isArray(issue.labels) ? issue.labels : [];
      const teamMatches = TEAM_LABELS.filter(t => labels.includes(t));
      if (teamMatches.length > 0) {
        teamMatches.forEach(team => {
          labelToStats[team].total += 1;
          if (issue.state === 'closed') {
            labelToStats[team].closed += 1;
          }
        });
      }
    });

    // Sort leaderboard: closed desc, then total asc, then team name
    const leaderboard = teamStats
      .map(s => ({ ...s, remaining: Math.max(0, s.total - s.closed) }))
      .sort((a, b) => {
        if (b.closed !== a.closed) return b.closed - a.closed;
        if (a.total !== b.total) return a.total - b.total;
        return a.team.localeCompare(b.team);
      });

    // Group issues by team for UI convenience
    const issuesByTeam = {};
    TEAM_LABELS.forEach(t => { issuesByTeam[t] = { open: [], closed: [] }; });
    raceIssues.forEach(issue => {
      const labels = Array.isArray(issue.labels) ? issue.labels : [];
      const teamMatches = TEAM_LABELS.filter(t => labels.includes(t));
      if (teamMatches.length === 0) return;
      teamMatches.forEach(team => {
        if (issue.state === 'closed') {
          issuesByTeam[team].closed.push(issue);
        } else {
          issuesByTeam[team].open.push(issue);
        }
      });
    });

    const responseData = {
      leaderboard,
      issuesByTeam,
      total: raceIssues.length,
      raceLabel: RACE_LABEL,
      teamLabels: TEAM_LABELS,
      timestamp: new Date().toISOString()
    };

    setCachedData(cacheKey, responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Error fetching race issues:', error);
    let errorDetails = error.message;
    if (error.response) {
      errorDetails = `GitLab API error: ${error.response.status} ${error.response.statusText}`;
    }
    res.status(500).json({ 
      error: 'Failed to fetch race issues from GitLab',
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
  console.log(`Ignore Labels: ${IGNORE_LABELS.join(', ')}`);
});

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// GitLab configuration
const GITLAB_ENDPOINT = process.env.GITLAB_ENDPOINT;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_GROUP_ID = process.env.GITLAB_GROUP_ID;
const EMPORIUM_LABEL = process.env.EMPORIUM_LABEL || 'emporium';
const PRIORITY_LABEL = process.env.PRIORITY_LABEL || 'priority';

// GitLab API helper
const gitlabApi = axios.create({
  baseURL: `${GITLAB_ENDPOINT}/api/v4`,
  headers: {
    'Authorization': `Bearer ${GITLAB_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Helper function to categorize issues
function categorizeIssues(issues) {
  const forSale = [];
  const sold = [];
  const delivered = [];

  issues.forEach(issue => {
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
      const aHasPriority = a.labels.includes(PRIORITY_LABEL);
      const bHasPriority = b.labels.includes(PRIORITY_LABEL);
      
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
    gitlabEndpoint: GITLAB_ENDPOINT
  });
});

// Get all issues from the GitLab group
app.get('/api/issues', async (req, res) => {
  try {
    if (!GITLAB_TOKEN || !GITLAB_GROUP_ID) {
      return res.status(500).json({ 
        error: 'GitLab configuration missing. Please check your environment variables.' 
      });
    }

    // Get all projects in the group
    const projectsResponse = await gitlabApi.get(`/groups/${GITLAB_GROUP_ID}/projects`, {
      params: {
        include_subgroups: true,
        per_page: 100
      }
    });

    const projects = projectsResponse.data;
    const allIssues = [];

    // Fetch issues from each project
    for (const project of projects) {
      try {
        const issuesResponse = await gitlabApi.get(`/projects/${project.id}/issues`, {
          params: {
            labels: EMPORIUM_LABEL,
            state: 'opened',
            per_page: 100
          }
        });
        
        // Add project information to each issue
        const projectIssues = issuesResponse.data.map(issue => ({
          ...issue,
          project_name: project.name,
          project_path: project.path_with_namespace,
          project_url: project.web_url
        }));
        
        allIssues.push(...projectIssues);
      } catch (error) {
        console.warn(`Failed to fetch issues from project ${project.name}:`, error.message);
      }
    }

    // Also fetch closed issues
    for (const project of projects) {
      try {
        const closedIssuesResponse = await gitlabApi.get(`/projects/${project.id}/issues`, {
          params: {
            labels: EMPORIUM_LABEL,
            state: 'closed',
            per_page: 100
          }
        });
        
        const projectClosedIssues = closedIssuesResponse.data.map(issue => ({
          ...issue,
          project_name: project.name,
          project_path: project.path_with_namespace,
          project_url: project.web_url
        }));
        
        allIssues.push(...projectClosedIssues);
      } catch (error) {
        console.warn(`Failed to fetch closed issues from project ${project.name}:`, error.message);
      }
    }

    const categorizedIssues = categorizeIssues(allIssues);
    
    res.json({
      issues: categorizedIssues,
      total: allIssues.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ 
      error: 'Failed to fetch issues from GitLab',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Bug Emporium API server running on port ${PORT}`);
  console.log(`GitLab Endpoint: ${GITLAB_ENDPOINT}`);
  console.log(`Emporium Label: ${EMPORIUM_LABEL}`);
  console.log(`Priority Label: ${PRIORITY_LABEL}`);
});

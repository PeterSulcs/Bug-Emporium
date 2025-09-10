import { useState, useMemo, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

/**
 * MR Medic Component
 * 
 * Displays all open merge requests with filtering capabilities:
 * - Draft status filter
 * - Assignee filter  
 * - Approval status filter
 * 
 * Shows for each MR:
 * - MR name/title
 * - Assignees
 * - Approvals (if any)
 * - Associated issues
 * - Review app link (if available)
 * - Draft status
 * - GitLab project name
 */
function MRMedic({ mergeRequests, loading, error, onRefresh }) {
  const [filters, setFilters] = useState({
    draftStatus: 'all', // 'all', 'draft', 'ready'
    assignees: [], // Array of selected assignees
    approvalStatus: 'all', // 'all', 'approved', 'needs_approval', 'no_approval_required'
    projects: [], // Array of selected project paths
    sortBy: 'desc' // 'desc' for newest first, 'asc' for oldest first
  });

  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [showDraftDropdown, setShowDraftDropdown] = useState(false);
  const [showApprovalDropdown, setShowApprovalDropdown] = useState(false);

  // Get unique assignees for filter dropdown
  const assignees = useMemo(() => {
    const assigneeSet = new Set();
    mergeRequests?.merge_requests?.forEach(mr => {
      if (mr.assignees && mr.assignees.length > 0) {
        mr.assignees.forEach(assignee => {
          assigneeSet.add(assignee.name || assignee.username);
        });
      }
    });
    return Array.from(assigneeSet).sort();
  }, [mergeRequests]);

  // Get unique projects for filter dropdown
  const projects = useMemo(() => {
    const projectSet = new Set();
    mergeRequests?.merge_requests?.forEach(mr => {
      if (mr.project_path) {
        projectSet.add(mr.project_path);
      }
    });
    return Array.from(projectSet).sort();
  }, [mergeRequests]);

  // Filter projects based on search
  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects;
    return projects.filter(project => 
      project.toLowerCase().includes(projectSearch.toLowerCase())
    );
  }, [projects, projectSearch]);

  // Filter assignees based on search
  const filteredAssignees = useMemo(() => {
    if (!assigneeSearch.trim()) return assignees;
    return assignees.filter(assignee => 
      assignee.toLowerCase().includes(assigneeSearch.toLowerCase())
    );
  }, [assignees, assigneeSearch]);

  // Filter and sort merge requests based on current filters
  const filteredMergeRequests = useMemo(() => {
    if (!mergeRequests?.merge_requests) return [];

    const filtered = mergeRequests.merge_requests.filter(mr => {
      // Draft status filter
      if (filters.draftStatus === 'draft' && !mr.is_draft) return false;
      if (filters.draftStatus === 'ready' && mr.is_draft) return false;

      // Assignee filter
      if (filters.assignees.length > 0) {
        const hasAssignee = mr.assignees && mr.assignees.some(a => 
          filters.assignees.includes(a.name || a.username)
        );
        if (!hasAssignee) return false;
      }

      // Project filter
      if (filters.projects.length > 0) {
        if (!filters.projects.includes(mr.project_path)) return false;
      }

      // Approval status filter
      if (filters.approvalStatus === 'approved' && !mr.approvals.approved) return false;
      if (filters.approvalStatus === 'needs_approval' && (mr.approvals.approved || mr.approvals.approvals_required === 0)) return false;
      if (filters.approvalStatus === 'no_approval_required' && mr.approvals.approvals_required > 0) return false;

      return true;
    });

    // Sort by creation date
    return filtered.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      
      if (filters.sortBy === 'asc') {
        return dateA - dateB; // Oldest first
      } else {
        return dateB - dateA; // Newest first (default)
      }
    });
  }, [mergeRequests, filters]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleProjectFilterChange = (projectPath, isSelected) => {
    setFilters(prev => ({
      ...prev,
      projects: isSelected 
        ? [...prev.projects, projectPath]
        : prev.projects.filter(p => p !== projectPath)
    }));
  };

  const handleAssigneeFilterChange = (assignee, isSelected) => {
    setFilters(prev => ({
      ...prev,
      assignees: isSelected 
        ? [...prev.assignees, assignee]
        : prev.assignees.filter(a => a !== assignee)
    }));
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProjectDropdown && !event.target.closest('.project-selector')) {
        setShowProjectDropdown(false);
      }
      if (showAssigneeDropdown && !event.target.closest('.assignee-selector')) {
        setShowAssigneeDropdown(false);
      }
      if (showDraftDropdown && !event.target.closest('.draft-selector')) {
        setShowDraftDropdown(false);
      }
      if (showApprovalDropdown && !event.target.closest('.approval-selector')) {
        setShowApprovalDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProjectDropdown, showAssigneeDropdown, showDraftDropdown, showApprovalDropdown]);

  const getApprovalStatusBadge = (approvals) => {
    if (approvals.approvals_required === 0) {
      return <span className="badge badge-info">No Approval Required</span>;
    }
    if (approvals.approved) {
      return <span className="badge badge-success">✅ Approved</span>;
    }
    if (approvals.approvals_left > 0) {
      return <span className="badge badge-warning">⏳ Needs {approvals.approvals_left} more</span>;
    }
    return <span className="badge badge-secondary">Pending</span>;
  };

  const getDraftStatusBadge = (isDraft) => {
    return isDraft ? 
      <span className="badge badge-warning">📝 Draft</span> : 
      <span className="badge badge-success">✅ Ready</span>;
  };

  if (loading) {
    return (
      <div className="mr-medic">
        <div className="header">
          <div className="header-content">
            <h1>🏥 MR Medic</h1>
            <p>Merge request health check and management</p>
          </div>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mr-medic">
        <div className="header">
          <div className="header-content">
            <h1>🏥 MR Medic</h1>
            <p>Merge request health check and management</p>
          </div>
        </div>
        <ErrorMessage error={error} onRetry={onRefresh} />
      </div>
    );
  }

  const totalMRs = mergeRequests?.total || 0;
  const draftCount = mergeRequests?.merge_requests?.filter(mr => mr.is_draft).length || 0;
  const readyCount = totalMRs - draftCount;
  const approvedCount = mergeRequests?.merge_requests?.filter(mr => mr.approvals.approved).length || 0;
  const needsApprovalCount = mergeRequests?.merge_requests?.filter(mr => 
    !mr.approvals.approved && mr.approvals.approvals_required > 0
  ).length || 0;

  return (
    <div className="mr-medic">
      <div className="header">
        <div className="header-content">
          <h1>🏥 MR Medic</h1>
          <p>Merge request health check and management</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="stat-card">
          <div className="stat-number">{totalMRs}</div>
          <div className="stat-label">Total MRs</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{readyCount}</div>
          <div className="stat-label">Ready</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{draftCount}</div>
          <div className="stat-label">Draft</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{approvedCount}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{needsApprovalCount}</div>
          <div className="stat-label">Needs Approval</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <label>Draft Status:</label>
          <div className="draft-selector">
            <button
              type="button"
              className="draft-selector-button"
              onClick={() => setShowDraftDropdown(!showDraftDropdown)}
            >
              {filters.draftStatus === 'all' ? 'All' : 
               filters.draftStatus === 'draft' ? 'Draft Only' : 'Ready Only'}
              <span className="dropdown-arrow">▼</span>
            </button>

            {showDraftDropdown && (
              <div className="draft-dropdown">
                <div className="draft-option" onClick={() => {
                  handleFilterChange('draftStatus', 'all');
                  setShowDraftDropdown(false);
                }}>
                  All
                </div>
                <div className="draft-option" onClick={() => {
                  handleFilterChange('draftStatus', 'draft');
                  setShowDraftDropdown(false);
                }}>
                  Draft Only
                </div>
                <div className="draft-option" onClick={() => {
                  handleFilterChange('draftStatus', 'ready');
                  setShowDraftDropdown(false);
                }}>
                  Ready Only
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="filter-group">
          <label>Assignees:</label>
          <div className="assignee-multiselect">
            <div className="assignee-selector">
              <button 
                type="button"
                className="assignee-selector-button"
                onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
              >
                {filters.assignees.length === 0 
                  ? 'All Assignees' 
                  : `${filters.assignees.length} assignee${filters.assignees.length === 1 ? '' : 's'} selected`
                }
                <span className="dropdown-arrow">▼</span>
              </button>
              
              {showAssigneeDropdown && (
                <div className="assignee-dropdown">
                  <div className="assignee-dropdown-header">
                    <input
                      type="text"
                      placeholder="Search assignees..."
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      className="assignee-search"
                    />
                    <button
                      type="button"
                      className="clear-all-assignees"
                      onClick={() => setFilters(prev => ({ ...prev, assignees: [] }))}
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="assignee-list">
                    {filteredAssignees.map(assignee => (
                      <label key={assignee} className="assignee-option">
                        <input
                          type="checkbox"
                          checked={filters.assignees.includes(assignee)}
                          onChange={(e) => handleAssigneeFilterChange(assignee, e.target.checked)}
                        />
                        <span className="assignee-name">{assignee}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="filter-group">
          <label>Approval Status:</label>
          <div className="approval-selector">
            <button
              type="button"
              className="approval-selector-button"
              onClick={() => setShowApprovalDropdown(!showApprovalDropdown)}
            >
              {filters.approvalStatus === 'all' ? 'All' : 
               filters.approvalStatus === 'approved' ? 'Approved' :
               filters.approvalStatus === 'needs_approval' ? 'Needs Approval' : 'No Approval Required'}
              <span className="dropdown-arrow">▼</span>
            </button>

            {showApprovalDropdown && (
              <div className="approval-dropdown">
                <div className="approval-option" onClick={() => {
                  handleFilterChange('approvalStatus', 'all');
                  setShowApprovalDropdown(false);
                }}>
                  All
                </div>
                <div className="approval-option" onClick={() => {
                  handleFilterChange('approvalStatus', 'approved');
                  setShowApprovalDropdown(false);
                }}>
                  Approved
                </div>
                <div className="approval-option" onClick={() => {
                  handleFilterChange('approvalStatus', 'needs_approval');
                  setShowApprovalDropdown(false);
                }}>
                  Needs Approval
                </div>
                <div className="approval-option" onClick={() => {
                  handleFilterChange('approvalStatus', 'no_approval_required');
                  setShowApprovalDropdown(false);
                }}>
                  No Approval Required
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="filter-group">
          <label>Sort:</label>
          <button
            type="button"
            className="sort-toggle-button"
            onClick={() => handleFilterChange('sortBy', filters.sortBy === 'desc' ? 'asc' : 'desc')}
            title={filters.sortBy === 'desc' ? 'Currently: Newest First - Click for Oldest First' : 'Currently: Oldest First - Click for Newest First'}
          >
            <span className="sort-icon">
              {filters.sortBy === 'desc' ? '↓' : '↑'}
            </span>
            <span className="sort-text">
              {filters.sortBy === 'desc' ? 'Newest' : 'Oldest'}
            </span>
          </button>
        </div>

        <div className="filter-group">
          <label>Projects:</label>
          <div className="project-multiselect">
            <div className="project-selector">
              <button 
                type="button"
                className="project-selector-button"
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              >
                {filters.projects.length === 0 
                  ? 'All Projects' 
                  : `${filters.projects.length} project${filters.projects.length === 1 ? '' : 's'} selected`
                }
                <span className="dropdown-arrow">▼</span>
              </button>
              
              {showProjectDropdown && (
                <div className="project-dropdown">
                  <div className="project-dropdown-header">
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="project-search"
                    />
                    <button
                      type="button"
                      className="clear-all-projects"
                      onClick={() => setFilters(prev => ({ ...prev, projects: [] }))}
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="project-list">
                    {filteredProjects.map(project => (
                      <label key={project} className="project-option">
                        <input
                          type="checkbox"
                          checked={filters.projects.includes(project)}
                          onChange={(e) => handleProjectFilterChange(project, e.target.checked)}
                        />
                        <span className="project-name">{project}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="results-info">
        Showing {filteredMergeRequests.length} of {totalMRs} merge requests
      </div>

      {/* Merge Requests List */}
      <div className="merge-requests-list">
        {filteredMergeRequests.length === 0 ? (
          <div className="no-results">
            <p>No merge requests match the current filters.</p>
          </div>
        ) : (
          filteredMergeRequests.map(mr => (
            <div key={mr.id} className="merge-request-card">
              <div className="mr-header">
                <div className="mr-title">
                  <a 
                    href={mr.web_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mr-link"
                  >
                    {mr.title}
                  </a>
                  <span className="mr-iid">!{mr.iid}</span>
                </div>
                <div className="mr-badges">
                  {getDraftStatusBadge(mr.is_draft)}
                  {getApprovalStatusBadge(mr.approvals)}
                </div>
              </div>

              <div className="mr-details">
                <div className="mr-main-content">
                  <div className="mr-meta">
                  <div className="mr-project">
                    <span className="project-path" title={mr.project_namespace}>
                      {mr.project_path}
                    </span>
                  </div>
                  
                  <div className="mr-people">
                    {mr.assignees && mr.assignees.length > 0 && (
                      <span className="mr-assignees">
                        <span className="meta-label">👥</span>
                        {mr.assignees.map((assignee, index) => (
                          <span key={assignee.id}>
                            <a 
                              href={`${mr.web_url.split('/merge_requests')[0]}/-/project_members`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="assignee-link"
                              title={assignee.username}
                            >
                              {assignee.name || assignee.username}
                            </a>
                            {index < mr.assignees.length - 1 && ', '}
                          </span>
                        ))}
                      </span>
                    )}

                    {mr.author && (
                      <span className="mr-author">
                        <span className="meta-label">✍️</span>
                        <a 
                          href={`${mr.web_url.split('/merge_requests')[0]}/-/project_members`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="author-link"
                          title={mr.author.username}
                        >
                          {mr.author.name || mr.author.username}
                        </a>
                      </span>
                    )}
                  </div>

                  <div className="mr-meta-row">
                    {mr.created_at && (
                      <span className="mr-created">
                        <span className="meta-label">📅</span>
                        {new Date(mr.created_at).toISOString().split('T')[0]}
                      </span>
                    )}

                    <span className="mr-approvals">
                      <span className="meta-label">✅</span>
                      {mr.approvals.approved_by.length}/{mr.approvals.approvals_required}
                    </span>
                  </div>

                  {mr.labels && mr.labels.length > 0 && (
                    <div className="mr-labels">
                      {mr.labels.map((label, _index) => (
                        <span key={label} className="label-badge">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  </div>
                </div>

                {mr.linked_issue_ids && mr.linked_issue_ids.length > 0 && (
                  <div className="mr-linked-issues-pane">
                    <div className="linked-issues-header">
                      <span className="meta-label">🔗</span>
                      <span className="linked-issues-count">{mr.linked_issue_ids.length}</span>
                    </div>
                    <div className="linked-issues-list">
                      {mr.linked_issue_ids.map(issueId => (
                        <a 
                          key={issueId}
                          href={`${mr.web_url.split('/merge_requests')[0]}/-/issues/${issueId}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="issue-link-compact"
                          title={`Issue #${issueId}`}
                        >
                          #{issueId}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {mr.review_app_url && (
                  <div className="mr-review-app">
                    <strong>Review App:</strong>
                    <a 
                      href={mr.review_app_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="review-app-link"
                    >
                      🔗 Open Review App
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default MRMedic;

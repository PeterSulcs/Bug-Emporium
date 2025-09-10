import { useState, useMemo } from 'react';
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
    assignee: 'all',
    approvalStatus: 'all' // 'all', 'approved', 'needs_approval', 'no_approval_required'
  });

  // Get unique assignees for filter dropdown
  const assignees = useMemo(() => {
    const assigneeSet = new Set();
    mergeRequests?.merge_requests?.forEach(mr => {
      if (mr.assignee) {
        assigneeSet.add(mr.assignee.username);
      }
      if (mr.assignees && mr.assignees.length > 0) {
        mr.assignees.forEach(assignee => assigneeSet.add(assignee.username));
      }
    });
    return Array.from(assigneeSet).sort();
  }, [mergeRequests]);

  // Filter merge requests based on current filters
  const filteredMergeRequests = useMemo(() => {
    if (!mergeRequests?.merge_requests) return [];

    return mergeRequests.merge_requests.filter(mr => {
      // Draft status filter
      if (filters.draftStatus === 'draft' && !mr.is_draft) return false;
      if (filters.draftStatus === 'ready' && mr.is_draft) return false;

      // Assignee filter
      if (filters.assignee !== 'all') {
        const hasAssignee = mr.assignee?.username === filters.assignee ||
          (mr.assignees && mr.assignees.some(a => a.username === filters.assignee));
        if (!hasAssignee) return false;
      }

      // Approval status filter
      if (filters.approvalStatus === 'approved' && !mr.approvals.approved) return false;
      if (filters.approvalStatus === 'needs_approval' && (mr.approvals.approved || mr.approvals.approvals_required === 0)) return false;
      if (filters.approvalStatus === 'no_approval_required' && mr.approvals.approvals_required > 0) return false;

      return true;
    });
  }, [mergeRequests, filters]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

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
          <label htmlFor="draft-filter">Draft Status:</label>
          <select 
            id="draft-filter"
            value={filters.draftStatus} 
            onChange={(e) => handleFilterChange('draftStatus', e.target.value)}
          >
            <option value="all">All</option>
            <option value="draft">Draft Only</option>
            <option value="ready">Ready Only</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="assignee-filter">Assignee:</label>
          <select 
            id="assignee-filter"
            value={filters.assignee} 
            onChange={(e) => handleFilterChange('assignee', e.target.value)}
          >
            <option value="all">All</option>
            {assignees.map(assignee => (
              <option key={assignee} value={assignee}>@{assignee}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="approval-filter">Approval Status:</label>
          <select 
            id="approval-filter"
            value={filters.approvalStatus} 
            onChange={(e) => handleFilterChange('approvalStatus', e.target.value)}
          >
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="needs_approval">Needs Approval</option>
            <option value="no_approval_required">No Approval Required</option>
          </select>
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
                <div className="mr-meta">
                  <div className="mr-project">
                    <strong>Project:</strong> {mr.project_name}
                  </div>
                  
                  {mr.assignee && (
                    <div className="mr-assignee">
                      <strong>Assignee:</strong> 
                      <a 
                        href={`${mr.web_url.split('/merge_requests')[0]}/-/project_members`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="assignee-link"
                      >
                        @{mr.assignee.username}
                      </a>
                    </div>
                  )}

                  {mr.assignees && mr.assignees.length > 0 && (
                    <div className="mr-assignees">
                      <strong>Assignees:</strong>
                      {mr.assignees.map((assignee, index) => (
                        <span key={assignee.id}>
                          <a 
                            href={`${mr.web_url.split('/merge_requests')[0]}/-/project_members`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="assignee-link"
                          >
                            @{assignee.username}
                          </a>
                          {index < mr.assignees.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mr-approvals">
                    <strong>Approvals:</strong> {mr.approvals.approved_by.length}/{mr.approvals.approvals_required}
                    {mr.approvals.approved_by.length > 0 && (
                      <span className="approvers">
                        {' '}({mr.approvals.approved_by.map(approver => approver.user.username).join(', ')})
                      </span>
                    )}
                  </div>
                </div>

                {mr.linked_issue_ids && mr.linked_issue_ids.length > 0 && (
                  <div className="mr-linked-issues">
                    <strong>Linked Issues:</strong>
                    <ul>
                      {mr.linked_issue_ids.map(issueId => (
                        <li key={issueId}>
                          <a 
                            href={`${mr.web_url.split('/merge_requests')[0]}/-/issues/${issueId}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="issue-link"
                          >
                            #{issueId}
                          </a>
                        </li>
                      ))}
                    </ul>
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

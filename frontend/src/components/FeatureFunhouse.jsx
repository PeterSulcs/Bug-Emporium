import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

function FeatureCard({ feature, config: _config, isDarkMode: _isDarkMode }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAssigneeName = (assignee) => {
    if (!assignee) return null;
    return assignee.name || assignee.username || 'Unknown';
  };

  const renderLinkedIssue = (linkedIssue, depth = 0) => {
    const isClosed = linkedIssue.issue.state === 'closed';
    const indentStyle = { marginLeft: `${depth * 20}px` };
    
    return (
      <div key={linkedIssue.issue.id} className="linked-issue" style={indentStyle}>
        <div className={`linked-issue-card ${isClosed ? 'closed' : 'open'}`}>
          <div className="linked-issue-header">
            <span className="linked-issue-number">#{linkedIssue.issue.iid}</span>
            <h4 className="linked-issue-title">
              <a 
                href={linkedIssue.issue.web_url} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                {linkedIssue.issue.title}
              </a>
            </h4>
            <span className={`linked-issue-status ${isClosed ? 'closed' : 'open'}`}>
              {isClosed ? '✅' : '🔄'}
            </span>
          </div>
          
          <div className="linked-issue-meta">
            {linkedIssue.issue.project_name && (
              <span className="linked-issue-project">
                {linkedIssue.issue.project_name}
              </span>
            )}
            {linkedIssue.issue.assignees && linkedIssue.issue.assignees.length > 0 && (
              <span className="linked-issue-assignees">
                {linkedIssue.issue.assignees.map((assignee, index) => (
                  <span key={assignee.id} className="linked-issue-assignee">
                    <img 
                      src={assignee.avatar_url} 
                      alt={getAssigneeName(assignee)}
                      className="linked-issue-avatar"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'inline';
                      }}
                    />
                    <span className="linked-issue-avatar-fallback" style={{ display: 'none' }}>👤</span>
                    {getAssigneeName(assignee)}
                    {index < linkedIssue.issue.assignees.length - 1 && <span className="assignee-separator">, </span>}
                  </span>
                ))}
              </span>
            )}
            <span className="linked-issue-date">
              📅 {formatDate(linkedIssue.issue.created_at)}
            </span>
          </div>
        </div>
        
        {/* Recursively render nested linked issues */}
        {linkedIssue.linkedIssues && linkedIssue.linkedIssues.length > 0 && (
          <div className="nested-issues">
            {linkedIssue.linkedIssues.map(nestedIssue => 
              renderLinkedIssue(nestedIssue, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  // Recursive function to count all linked issues in the tree
  const countAllLinkedIssues = (linkedIssues) => {
    if (!linkedIssues || linkedIssues.length === 0) return 0;
    
    let total = linkedIssues.length;
    linkedIssues.forEach(linkedIssue => {
      if (linkedIssue.linkedIssues && linkedIssue.linkedIssues.length > 0) {
        total += countAllLinkedIssues(linkedIssue.linkedIssues);
      }
    });
    return total;
  };

  // Recursive function to count closed linked issues in the tree
  const countClosedLinkedIssues = (linkedIssues) => {
    if (!linkedIssues || linkedIssues.length === 0) return 0;
    
    let closed = 0;
    linkedIssues.forEach(linkedIssue => {
      if (linkedIssue.issue.state === 'closed') {
        closed++;
      }
      if (linkedIssue.linkedIssues && linkedIssue.linkedIssues.length > 0) {
        closed += countClosedLinkedIssues(linkedIssue.linkedIssues);
      }
    });
    return closed;
  };

  const isActive = feature.issue.state === 'opened';
  const totalLinkedIssues = countAllLinkedIssues(feature.linkedIssues);
  const closedLinkedIssues = countClosedLinkedIssues(feature.linkedIssues);

  return (
    <div className={`feature-card ${isActive ? 'active' : 'complete'}`}>
      <div className="feature-header">
        <div className="feature-title-section">
          <span className="feature-number">#{feature.issue.iid}</span>
          <h3 className="feature-title">
            <a 
              href={feature.issue.web_url} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {feature.issue.title}
            </a>
          </h3>
          <span className={`feature-status ${isActive ? 'active' : 'complete'}`}>
            {isActive ? '🎪 Active' : '🎭 Complete'}
          </span>
        </div>
        
        <div className="feature-stats">
          <div className="feature-stat">
            <span className="stat-number">{totalLinkedIssues}</span>
            <span className="stat-label">Total Tasks</span>
          </div>
          <div className="feature-stat">
            <span className="stat-number">{closedLinkedIssues}</span>
            <span className="stat-label">Completed</span>
          </div>
          <div className="feature-stat">
            <span className="stat-number">{totalLinkedIssues - closedLinkedIssues}</span>
            <span className="stat-label">Remaining</span>
          </div>
        </div>
      </div>

      <div className="feature-meta">
        {feature.issue.project_name && (
          <span className="feature-project">
            🎪 {feature.issue.project_name}
          </span>
        )}
        {feature.issue.assignees && feature.issue.assignees.length > 0 && (
          <span className="feature-assignees">
            {feature.issue.assignees.map((assignee, index) => (
              <span key={assignee.id} className="feature-assignee">
                <img 
                  src={assignee.avatar_url} 
                  alt={getAssigneeName(assignee)}
                  className="feature-avatar"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'inline';
                  }}
                />
                <span className="feature-avatar-fallback" style={{ display: 'none' }}>👤</span>
                {getAssigneeName(assignee)}
                {index < feature.issue.assignees.length - 1 && <span className="assignee-separator">, </span>}
              </span>
            ))}
          </span>
        )}
        <span className="feature-date">
          📅 {formatDate(feature.issue.created_at)}
        </span>
        {feature.issue.state === 'closed' && (
          <span className="feature-closed-date">
            ✅ Closed {formatDate(feature.issue.closed_at)}
          </span>
        )}
      </div>

      {feature.linkedIssues && feature.linkedIssues.length > 0 && (
        <div className="linked-issues">
          <h4 className="linked-issues-title">🎯 Linked Tasks</h4>
          {feature.linkedIssues.map(linkedIssue => renderLinkedIssue(linkedIssue))}
        </div>
      )}
    </div>
  );
}

function FeatureFunhouse({ isDarkMode, onToggleDarkMode: _onToggleDarkMode, features, config, loading, error, onRefresh }) {

  if (loading) {
    return (
      <>
        <div className="header">
          <div className="header-content">
            <h1>🎪 Feature Funhouse</h1>
            <p>Welcome to the Circus!</p>
          </div>
        </div>
        <LoadingSpinner />
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="header">
          <div className="header-content">
            <h1>🎪 Feature Funhouse</h1>
            <p>Welcome to the Circus!</p>
          </div>
        </div>
        <ErrorMessage error={error} onRetry={onRefresh} />
      </>
    );
  }

  const activeFeatures = features?.features?.active || [];
  const completeFeatures = features?.features?.complete || [];
  const totalFeatures = features?.total || 0;

  return (
    <>
      <div className="header">
        <div className="header-content">
          <h1>🎪 Feature Funhouse</h1>
          <p>Welcome to the Circus!</p>
          {config && (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Showing features with <strong>{config.funhouseLabel}</strong> label
            </p>
          )}
        </div>
      </div>


      <div className="funhouse-stats">
        <div className="funhouse-stat-card">
          <div className="stat-number">{totalFeatures}</div>
          <div className="stat-label">Total Features</div>
        </div>
        <div className="funhouse-stat-card active">
          <div className="stat-number">{activeFeatures.length}</div>
          <div className="stat-label">🎪 Active</div>
        </div>
        <div className="funhouse-stat-card complete">
          <div className="stat-number">{completeFeatures.length}</div>
          <div className="stat-label">🎭 Complete</div>
        </div>
      </div>

      <div className="funhouse-sections">
        <div className="funhouse-section active-section">
          <div className="section-header">
            <h2 className="section-title">🎪 Active Features</h2>
            <span className="section-count">{activeFeatures.length}</span>
          </div>
          
          <div className="feature-list">
            {activeFeatures.length === 0 ? (
              <div className="empty-state">
                No active features in the funhouse
              </div>
            ) : (
              activeFeatures.map((feature) => (
                <FeatureCard 
                  key={feature.issue.id} 
                  feature={feature} 
                  config={config}
                  isDarkMode={isDarkMode}
                />
              ))
            )}
          </div>
        </div>

        <div className="funhouse-section complete-section">
          <div className="section-header">
            <h2 className="section-title">🎭 Complete Features</h2>
            <span className="section-count">{completeFeatures.length}</span>
          </div>
          
          <div className="feature-list">
            {completeFeatures.length === 0 ? (
              <div className="empty-state">
                No completed features yet
              </div>
            ) : (
              completeFeatures.map((feature) => (
                <FeatureCard 
                  key={feature.issue.id} 
                  feature={feature} 
                  config={config}
                  isDarkMode={isDarkMode}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default FeatureFunhouse;

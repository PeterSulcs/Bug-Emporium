// React import not needed with JSX Transform

function IssueCard({ issue, priorityLabel }) {
  const isPriority = priorityLabel && issue.labels.includes(priorityLabel);
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

  return (
    <div className={`issue-card ${isPriority ? 'priority' : ''}`}>
      <h3 className="issue-title">
        <a 
          href={issue.web_url} 
          target="_blank" 
          rel="noopener noreferrer"
        >
          {issue.title}
        </a>
      </h3>
      
      <div className="issue-meta">
        <span className="issue-project">
          {issue.project_name}
        </span>
        {issue.assignee && (
          <span className="issue-assignee">
            👤 {getAssigneeName(issue.assignee)}
          </span>
        )}
        <span>
          📅 {formatDate(issue.created_at)}
        </span>
        {issue.state === 'closed' && (
          <span style={{ color: '#28a745', fontWeight: '500' }}>
            ✅ Closed {formatDate(issue.closed_at)}
          </span>
        )}
      </div>


      {issue.labels && issue.labels.length > 0 && (
        <div className="issue-labels">
          {issue.labels.map((label, index) => (
            <span 
              key={index}
              className={`label ${
                label === priorityLabel ? 'priority' : 
                label === 'emporium' ? 'emporium' : ''
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default IssueCard;

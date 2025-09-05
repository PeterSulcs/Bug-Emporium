// React import not needed with JSX Transform
import IssueCard from './IssueCard';

function IssueSection({ title, issues, className, priorityLabel }) {
  return (
    <div className={`section ${className}`}>
      <div className="section-header">
        <div className="section-icon">
          {title.includes('For Sale') ? '🛒' : title.includes('Sold') ? '💰' : '✅'}
        </div>
        <h2 className="section-title">{title}</h2>
        <span style={{ 
          background: '#e9ecef', 
          color: '#6c757d', 
          padding: '0.25rem 0.5rem', 
          borderRadius: '12px', 
          fontSize: '0.8rem',
          fontWeight: '500'
        }}>
          {issues.length}
        </span>
      </div>
      
      <div className="issue-list">
        {issues.length === 0 ? (
          <div className="empty-state">
            No issues in this category
          </div>
        ) : (
          issues.map((issue) => (
            <IssueCard 
              key={issue.id} 
              issue={issue} 
              priorityLabel={priorityLabel}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default IssueSection;

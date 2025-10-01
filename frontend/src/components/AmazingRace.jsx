import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

function AmazingRace({ race, config, loading, error, onRefresh }) {
  if (loading) {
    return (
      <>
        <div className="header">
          <div className="header-content">
            <h1>🏁 Amazing Race</h1>
            <p>Teams race to close issues!</p>
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
            <h1>🏁 Amazing Race</h1>
            <p>Teams race to close issues!</p>
          </div>
        </div>
        <ErrorMessage error={error} onRetry={onRefresh} />
      </>
    );
  }

  const leaderboard = race?.leaderboard || [];
  const issuesByTeam = race?.issuesByTeam || {};

  return (
    <>
      <div className="header">
        <div className="header-content">
          <h1>🏁 Amazing Race</h1>
          <p>Teams race to close issues!</p>
          {race && (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Showing issues with <strong>{race.raceLabel}</strong> label
            </p>
          )}
        </div>
      </div>

      <div className="funhouse-stats">
        <div className="funhouse-stat-card">
          <div className="stat-number">{race?.total || 0}</div>
          <div className="stat-label">Total Race Issues</div>
        </div>
      </div>

      <div className="funhouse-sections">
        <div className="funhouse-section active-section">
          <div className="section-header">
            <h2 className="section-title">🏆 Leaderboard</h2>
            <span className="section-count">{leaderboard.length}</span>
          </div>

          <div className="feature-list">
            {leaderboard.length === 0 ? (
              <div className="empty-state">No teams configured</div>
            ) : (
              leaderboard.map((entry, index) => (
                <div key={entry.team} className={`feature-card ${index === 0 ? 'active' : ''}`}>
                  <div className="feature-header">
                    <div className="feature-title-section">
                      <h3 className="feature-title">{index + 1}. Team {entry.team.toUpperCase()}</h3>
                      <span className={`feature-status ${index === 0 ? 'active' : 'complete'}`}>
                        {entry.closed} closed / {entry.total} total
                      </span>
                    </div>
                    <div className="feature-stats">
                      <div className="feature-stat">
                        <span className="stat-number">{entry.closed}</span>
                        <span className="stat-label">Closed</span>
                      </div>
                      <div className="feature-stat">
                        <span className="stat-number">{entry.remaining}</span>
                        <span className="stat-label">Remaining</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="funhouse-section complete-section">
          <div className="section-header">
            <h2 className="section-title">🗺️ Teams & Issues</h2>
            <span className="section-count">{Object.keys(issuesByTeam).length}</span>
          </div>

          <div className="feature-list">
            {Object.keys(issuesByTeam).length === 0 ? (
              <div className="empty-state">No team issues yet</div>
            ) : (
              Object.entries(issuesByTeam).map(([team, lists]) => (
                <div key={team} className="feature-card">
                  <div className="feature-header">
                    <div className="feature-title-section">
                      <h3 className="feature-title">Team {team.toUpperCase()}</h3>
                      <span className="feature-status active">
                        {lists.closed.length} closed / {lists.open.length + lists.closed.length} total
                      </span>
                    </div>
                  </div>

                  <div className="linked-issues">
                    <h4 className="linked-issues-title">Open</h4>
                    {lists.open.length === 0 ? (
                      <div className="empty-state">No open issues</div>
                    ) : (
                      <ul style={{ paddingLeft: '1rem', margin: 0 }}>
                        {lists.open.map(issue => (
                          <li key={issue.id} style={{ marginBottom: '0.25rem' }}>
                            <a href={issue.web_url} target="_blank" rel="noopener noreferrer">#{issue.iid} {issue.title}</a>
                            {issue.project_name && <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>({issue.project_name})</span>}
                          </li>
                        ))}
                      </ul>
                    )}

                    <h4 className="linked-issues-title" style={{ marginTop: '0.75rem' }}>Closed</h4>
                    {lists.closed.length === 0 ? (
                      <div className="empty-state">No closed issues yet</div>
                    ) : (
                      <ul style={{ paddingLeft: '1rem', margin: 0 }}>
                        {lists.closed.map(issue => (
                          <li key={issue.id} style={{ marginBottom: '0.25rem' }}>
                            <a href={issue.web_url} target="_blank" rel="noopener noreferrer">#{issue.iid} {issue.title}</a>
                            {issue.project_name && <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>({issue.project_name})</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default AmazingRace;



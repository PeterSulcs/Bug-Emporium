import React, { useState, useEffect } from 'react';
import axios from 'axios';
import IssueSection from './components/IssueSection';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';

function App() {
  const [issues, setIssues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [issuesResponse, configResponse] = await Promise.all([
        axios.get('/api/issues'),
        axios.get('/api/config')
      ]);
      
      setIssues(issuesResponse.data);
      setConfig(configResponse.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const handleRefresh = () => {
    fetchIssues();
  };

  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <h1>🐛 Bug Emporium</h1>
          <p>Your one-stop shop for issue triage</p>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="header">
          <h1>🐛 Bug Emporium</h1>
          <p>Your one-stop shop for issue triage</p>
        </div>
        <ErrorMessage error={error} onRetry={handleRefresh} />
      </div>
    );
  }

  const totalIssues = issues?.total || 0;
  const forSaleCount = issues?.issues?.forSale?.length || 0;
  const soldCount = issues?.issues?.sold?.length || 0;
  const deliveredCount = issues?.issues?.delivered?.length || 0;

  return (
    <div className="app">
      <div className="header">
        <h1>🐛 Bug Emporium</h1>
        <p>Your one-stop shop for issue triage</p>
        {config && (
          <p style={{ fontSize: '0.9rem', color: '#7f8c8d', marginTop: '0.5rem' }}>
            Showing issues with <strong>{config.emporiumLabel}</strong> label
            {config.priorityLabel && (
              <span> • Priority label: <strong>{config.priorityLabel}</strong></span>
            )}
          </p>
        )}
      </div>

      <button 
        className="refresh-btn" 
        onClick={handleRefresh}
        disabled={loading}
      >
        {loading ? 'Refreshing...' : '🔄 Refresh Issues'}
      </button>

      <div className="stats">
        <div className="stat-card">
          <div className="stat-number">{totalIssues}</div>
          <div className="stat-label">Total Issues</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{forSaleCount}</div>
          <div className="stat-label">For Sale</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{soldCount}</div>
          <div className="stat-label">Sold</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{deliveredCount}</div>
          <div className="stat-label">Delivered</div>
        </div>
      </div>

      <div className="sections">
        <IssueSection
          title="🛒 For Sale"
          issues={issues?.issues?.forSale || []}
          className="for-sale"
          priorityLabel={config?.priorityLabel}
        />
        <IssueSection
          title="💰 Sold"
          issues={issues?.issues?.sold || []}
          className="sold"
          priorityLabel={config?.priorityLabel}
        />
        <IssueSection
          title="✅ Delivered"
          issues={issues?.issues?.delivered || []}
          className="delivered"
          priorityLabel={config?.priorityLabel}
        />
      </div>
    </div>
  );
}

export default App;
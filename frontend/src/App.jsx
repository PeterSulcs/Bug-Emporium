import { useState, useEffect } from 'react';
import axios from 'axios';
import IssueSection from './components/IssueSection';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import FeatureFunhouse from './components/FeatureFunhouse';

function App() {
  const [issues, setIssues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [currentPage, setCurrentPage] = useState('emporium');

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

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const navigateToPage = (page) => {
    setCurrentPage(page);
  };

  const handleRefresh = () => {
    fetchIssues();
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const Navigation = () => (
    <nav className="main-navigation">
      <button 
        className={`nav-button ${currentPage === 'emporium' ? 'active' : ''}`}
        onClick={() => navigateToPage('emporium')}
      >
        🐛 Bug Emporium
      </button>
      <button 
        className={`nav-button ${currentPage === 'funhouse' ? 'active' : ''}`}
        onClick={() => navigateToPage('funhouse')}
      >
        🎪 Feature Funhouse
      </button>
    </nav>
  );

  if (loading && currentPage === 'emporium') {
    return (
      <div className="app">
        <Navigation />
        <div className="header">
          <div className="header-top">
            <div className="header-content">
              <h1>🐛 Bug Emporium</h1>
              <p>Your one-stop shop for issue triage</p>
            </div>
            <button 
              className="theme-toggle" 
              onClick={toggleDarkMode}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  if (error && currentPage === 'emporium') {
    return (
      <div className="app">
        <Navigation />
        <div className="header">
          <div className="header-top">
            <div className="header-content">
              <h1>🐛 Bug Emporium</h1>
              <p>Your one-stop shop for issue triage</p>
            </div>
            <button 
              className="theme-toggle" 
              onClick={toggleDarkMode}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        <ErrorMessage error={error} onRetry={handleRefresh} />
      </div>
    );
  }

  // Render Feature Funhouse page
  if (currentPage === 'funhouse') {
    return <FeatureFunhouse isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />;
  }

  // Render Bug Emporium page
  const totalIssues = issues?.total || 0;
  const forSaleCount = issues?.issues?.forSale?.length || 0;
  const soldCount = issues?.issues?.sold?.length || 0;
  const deliveredCount = issues?.issues?.delivered?.length || 0;

  return (
    <div className="app">
      <Navigation />
      <div className="header">
        <div className="header-top">
          <div className="header-content">
            <h1>🐛 Bug Emporium</h1>
            <p>Your one-stop shop for issue triage</p>
            {config && (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Showing issues with <strong>{config.emporiumLabel}</strong> label
                {config.priorityLabel && (
                  <span> • Priority label: <strong>{config.priorityLabel}</strong></span>
                )}
              </p>
            )}
          </div>
          <button 
            className="theme-toggle" 
            onClick={toggleDarkMode}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
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
        <div 
          className="stat-card clickable" 
          onClick={() => scrollToSection('for-sale-section')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-number">{forSaleCount}</div>
          <div className="stat-label">For Sale</div>
        </div>
        <div 
          className="stat-card clickable" 
          onClick={() => scrollToSection('sold-section')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-number">{soldCount}</div>
          <div className="stat-label">Sold</div>
        </div>
        <div 
          className="stat-card clickable" 
          onClick={() => scrollToSection('delivered-section')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-number">{deliveredCount}</div>
          <div className="stat-label">Delivered</div>
        </div>
      </div>

      <div className="sections">
        <div id="for-sale-section">
          <IssueSection
            title="🛒 For Sale"
            issues={issues?.issues?.forSale || []}
            className="for-sale"
            priorityLabel={config?.priorityLabel}
          />
        </div>
        <div id="sold-section">
          <IssueSection
            title="💰 Sold"
            issues={issues?.issues?.sold || []}
            className="sold"
            priorityLabel={config?.priorityLabel}
          />
        </div>
        <div id="delivered-section">
          <IssueSection
            title="✅ Delivered"
            issues={issues?.issues?.delivered || []}
            className="delivered"
            priorityLabel={config?.priorityLabel}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
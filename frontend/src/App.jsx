import { useState, useEffect } from 'react';
import axios from 'axios';
import IssueSection from './components/IssueSection';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import FeatureFunhouse from './components/FeatureFunhouse';

/**
 * Bug Emporium App with Deep Linking Support
 * 
 * Deep Linking URLs:
 * - Bug Emporium: /?page=emporium or /#emporium
 * - Feature Funhouse: /?page=funhouse or /#funhouse
 * 
 * The app supports both query parameters (?page=) and hash fragments (#)
 * for maximum compatibility with different sharing scenarios.
 */
function App() {
  const [issues, setIssues] = useState(null);
  const [features, setFeatures] = useState(null);
  // Independent loading/error states
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesError, setIssuesError] = useState(null);
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [featuresError, setFeaturesError] = useState(null);
  const [_configLoading, setConfigLoading] = useState(true);
  const [_configError, setConfigError] = useState(null);
  const [config, setConfig] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [currentPage, setCurrentPage] = useState('emporium');
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Initialize page from URL on component mount
  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove the # symbol
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    
    // Check URL parameters first, then hash, then default to emporium
    const pageFromUrl = pageParam || hash || 'emporium';
    
    if (pageFromUrl === 'funhouse' || pageFromUrl === 'emporium') {
      setCurrentPage(pageFromUrl);
    }
  }, []);

  // Update URL when page changes
  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('page', currentPage);
    // Update URL without causing a page reload
    window.history.replaceState({}, '', url.toString());
  }, [currentPage]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = urlParams.get('page');
      const hash = window.location.hash.slice(1);
      
      const pageFromUrl = pageParam || hash || 'emporium';
      if (pageFromUrl === 'funhouse' || pageFromUrl === 'emporium') {
        setCurrentPage(pageFromUrl);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchAllData = async () => {
    // reset loading/errors
    setIssuesLoading(true);
    setIssuesError(null);
    setFeaturesLoading(true);
    setFeaturesError(null);
    setConfigLoading(true);
    setConfigError(null);

    const [issuesResult, featuresResult, configResult] = await Promise.allSettled([
      axios.get('/api/issues'),
      axios.get('/api/funhouse'),
      axios.get('/api/config')
    ]);

    // issues
    if (issuesResult.status === 'fulfilled') {
      setIssues(issuesResult.value.data);
      setIssuesError(null);
    } else {
      console.error('Error fetching issues:', issuesResult.reason);
      setIssuesError(issuesResult.reason?.response?.data?.error || 'Failed to fetch issues');
    }
    setIssuesLoading(false);

    // funhouse
    if (featuresResult.status === 'fulfilled') {
      setFeatures(featuresResult.value.data);
      setFeaturesError(null);
    } else {
      console.error('Error fetching funhouse:', featuresResult.reason);
      setFeaturesError(featuresResult.reason?.response?.data?.error || 'Failed to fetch funhouse');
    }
    setFeaturesLoading(false);

    // config
    if (configResult.status === 'fulfilled') {
      setConfig(configResult.value.data);
      setConfigError(null);
    } else {
      console.error('Error fetching config:', configResult.reason);
      setConfigError(configResult.reason?.response?.data?.error || 'Failed to fetch config');
    }
    setConfigLoading(false);
  };

  useEffect(() => {
    fetchAllData();
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

  // Utility function to get shareable URL for current page
  const _getShareableUrl = (page = currentPage) => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?page=${page}`;
  };

  const handleRefresh = () => {
    fetchAllData();
  };

  const handleClearCache = async () => {
    try {
      await axios.post('/api/cache/clear');
      // Refresh data after clearing cache
      fetchAllData();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
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

  const UserMenu = () => (
    <div className="user-menu">
      <button 
        className="user-menu-toggle"
        onClick={() => setShowUserMenu(!showUserMenu)}
        title="User Menu"
      >
        👤
      </button>
      {showUserMenu && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <h4>User Menu</h4>
            <button 
              className="user-menu-close"
              onClick={() => setShowUserMenu(false)}
            >
              ✕
            </button>
          </div>
          <div className="user-menu-content">
            <button 
              className="user-menu-item"
              onClick={toggleDarkMode}
            >
              {isDarkMode ? '☀️' : '🌙'} {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button 
              className="user-menu-item"
              onClick={handleRefresh}
              disabled={issuesLoading || featuresLoading}
            >
              🔄 Refresh Data
            </button>
            <button 
              className="user-menu-item"
              onClick={handleClearCache}
            >
              🗑️ Clear Server Cache
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (issuesLoading && currentPage === 'emporium') {
    return (
      <div className="app">
        <Navigation />
        <div className="header">
          <div className="header-content">
            <h1>🐛 Bug Emporium</h1>
            <p>Your one-stop shop for issue triage</p>
          </div>
        </div>
        <UserMenu />
        <LoadingSpinner />
      </div>
    );
  }

  if (issuesError && currentPage === 'emporium') {
    return (
      <div className="app">
        <Navigation />
        <div className="header">
          <div className="header-content">
            <h1>🐛 Bug Emporium</h1>
            <p>Your one-stop shop for issue triage</p>
          </div>
        </div>
        <UserMenu />
        <ErrorMessage error={issuesError} onRetry={handleRefresh} />
      </div>
    );
  }

  // Render Feature Funhouse page
  if (currentPage === 'funhouse') {
    return (
      <div className="app">
        <Navigation />
        <UserMenu />
        <FeatureFunhouse 
          isDarkMode={isDarkMode} 
          onToggleDarkMode={toggleDarkMode}
          features={features}
          config={config}
          loading={featuresLoading}
          error={featuresError}
          onRefresh={handleRefresh}
        />
      </div>
    );
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
      </div>

      <UserMenu />

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
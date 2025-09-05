// React import not needed with JSX Transform

function LoadingSpinner() {
  return (
    <div className="loading">
      <div style={{ 
        display: 'inline-block',
        width: '40px',
        height: '40px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '1rem'
      }}></div>
      <p>Loading issues from GitLab...</p>
    </div>
  );
}

export default LoadingSpinner;

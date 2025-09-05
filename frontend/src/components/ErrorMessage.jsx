import React from 'react';

function ErrorMessage({ error, onRetry }) {
  return (
    <div className="error">
      <h3 style={{ marginTop: 0, color: '#721c24' }}>⚠️ Error Loading Issues</h3>
      <p>{error}</p>
      <button 
        className="refresh-btn" 
        onClick={onRetry}
        style={{ 
          background: '#dc3545',
          marginTop: '1rem'
        }}
      >
        🔄 Try Again
      </button>
    </div>
  );
}

export default ErrorMessage;

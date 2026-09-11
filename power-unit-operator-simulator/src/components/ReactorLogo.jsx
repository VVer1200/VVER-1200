import React from 'react';
import './ReactorLogo.css';

export default function ReactorLogo({ compact = false }) {
  return (
    <div className={`reactor-logo ${compact ? 'compact' : ''}`}>
      <div className="atom">
        <i />
        <i />
        <i />
        <b>1200</b>
      </div>
      {!compact && (
        <div>
          <strong>ВВЭР-1200</strong>
          <span>OPERATOR SIMULATOR</span>
        </div>
      )}
    </div>
  );
}

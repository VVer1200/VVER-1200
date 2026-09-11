import React from 'react';import './StatusBadge.css';export default function StatusBadge({type='normal',children}){return <span className={`status-badge ${type}`}>{children}</span>}

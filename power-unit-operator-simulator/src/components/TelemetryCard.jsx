// Назначение файла: Карточка измерительного канала с текущим значением и нормативом.
import React from 'react';
import './TelemetryCard.css';
export default function TelemetryCard({ label, value, unit, range, state = 'normal' }) {
    const numeric = Number(value);
    const safe = Number.isFinite(numeric);
    const amount = safe ? Math.max(4, Math.min(100, Math.abs(numeric) % 101)) : 42;
    return (<div className={`telemetry-card instrument-interactive ${state}`}>
      <div className="telemetry-label">
        <span>{label}</span>
        <span className={`telemetry-state-dot ${state}`} role="img" aria-label={state === 'normal' ? 'Норма' : state === 'warning' ? 'Предупреждение' : 'Критическое состояние'}/>
      </div>
      <div className="telemetry-value">{value}<small>{unit}</small></div>
      <div className="telemetry-track"><span style={{ width: `${amount}%` }}/></div>
      <div className="telemetry-range">{range}</div>
    </div>);
}


import React from 'react';
import './Topbar.css';

export default function Topbar({ title, subtitle }) {
  return (
    <header className="topbar">
      <div className="topbar-copy">
        <div className="breadcrumb">ЛАЭС / ТРЕНАЖЕР ВВЭР-1200 / {title.toUpperCase()}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="top-right">
        <div className="plant-state">
          <span />
          <div>
            <b>Энергоблок в учебном режиме</b>
            <small>Телеметрия обновляется в реальном времени</small>
          </div>
        </div>
        <div className="instructor-mark">ИН</div>
        <div className="instructor-meta">
          <b>Рабочее место инструктора</b>
          <small>Блочный щит управления</small>
        </div>
      </div>
    </header>
  );
}

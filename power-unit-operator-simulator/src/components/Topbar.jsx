import React from 'react';
import './Topbar.css';

export default function Topbar({ title, subtitle, connectionStatus = 'disconnected' }) {
  const statusInfo = {
    connected: ['Энергоблок ВВЭР-1200 в сети', 'Телеметрия в реальном времени (20 Гц)'],
    connecting: ['Подключение к симулятору...', 'Ожидание ответа WebSocket (порт 3000)'],
    disconnected: ['Симулятор не подключен', 'Запустите сервер симулятора (порт 3000)'],
  };

  const [stateText, stateSub] = statusInfo[connectionStatus] || statusInfo.disconnected;

  return (
    <header className="topbar">
      <div className="topbar-copy">
        <div className="breadcrumb">ЛАЭС / ТРЕНАЖЕР ВВЭР-1200 / {title.toUpperCase()}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="top-right">
        <div className="plant-state">
          <span className={connectionStatus} />
          <div>
            <b>{stateText}</b>
            <small>{stateSub}</small>
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

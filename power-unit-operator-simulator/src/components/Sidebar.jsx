import React from 'react';
import './Sidebar.css';
import ReactorLogo from './ReactorLogo';

const navigation = [
  ['dashboard', '▦', 'Главная'],
  ['create', '＋', 'Планирование'],
  ['live', '◌', 'Мониторинг'],
  ['journal', '≡', 'Журнал действий'],
  ['results', '▤', 'Результаты'],
  ['scenarios', '◇', 'Сценарии'],
];

export default function Sidebar({ page, setPage }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <ReactorLogo />
      </div>
      <div className="role-tag">ПАНЕЛЬ ИНСТРУКТОРА БЩУ</div>
      <nav>
        {navigation.map(([id, icon, text]) => (
          <button
            key={id}
            className={page === id ? 'active' : ''}
            onClick={() => setPage(id)}
          >
            <span>{icon}</span>
            <b>{text}</b>
            {id === 'live' && <i />}
          </button>
        ))}
      </nav>
      <div className="side-system">
        <div className="system-card">
          <span className="status-dot" />
          <div>
            <b>Симулятор подключен</b>
            <small>Учебный контур · DEMO</small>
          </div>
        </div>
        <div className="unit-label">ЛАЭС · ЭНЕРГОБЛОК ВВЭР-1200</div>
      </div>
    </aside>
  );
}

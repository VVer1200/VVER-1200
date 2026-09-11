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

export default function Sidebar({ page, setPage, connectionStatus = 'disconnected' }) {
  const statusLabels = {
    connected: ['Симулятор онлайн', 'Телеметрия 20 Гц (ВВЭР-1200)'],
    connecting: ['Подключение...', 'ws://localhost:3000'],
    disconnected: ['Симулятор: нет связи', 'Запустите сервер (порт 3000)'],
  };

  const [statusTitle, statusSub] = statusLabels[connectionStatus] || statusLabels.disconnected;

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
          <span className={`status-dot ${connectionStatus}`} />
          <div>
            <b>{statusTitle}</b>
            <small>{statusSub}</small>
          </div>
        </div>
        <div className="unit-label">ЛАЭС · ЭНЕРГОБЛОК ВВЭР-1200</div>
      </div>
    </aside>
  );
}

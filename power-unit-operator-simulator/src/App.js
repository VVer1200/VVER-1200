import React, { useEffect, useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import DashboardPage from './pages/DashboardPage';
import CreateTrainingPage from './pages/CreateTrainingPage';
import LiveMonitorPage from './pages/LiveMonitorPage';
import JournalPage from './pages/JournalPage';
import ResultsPage from './pages/ResultsPage';
import ScenariosPage from './pages/ScenariosPage';
import { operators, scenarios, initialJournal, results } from './data/mockData';
import { nowTime } from './utils/formatters';

const titles = {
  dashboard: ['Главная', 'Текущие показатели энергоблока и состояние учебной сессии'],
  create: ['Планирование сессии', 'Создание тренировки или экзамена для оператора'],
  live: ['Мониторинг тренировки', 'Контроль параметров энергоблока и действий оператора'],
  journal: ['Журнал действий', 'Хронология действий оператора, инструктора и системных событий'],
  results: ['Результаты', 'Архив тренировок, экзаменов и итоговых оценок'],
  scenarios: ['Сценарии', 'Библиотека учебных и внештатных ситуаций'],
};

const initialSession = {
  active: true,
  mode: 'Тренировка',
  difficulty: 'Средняя',
  operatorId: 1,
  scenarioId: 'rcp',
  elapsed: 367,
};

const initialTelemetry = {
  power: 92.6,
  primaryPressure: 16.14,
  outletTemp: 326.8,
  sgLevel: 2.31,
  electric: 1089,
  rpm: 3000,
  freq: 50.0,
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [journal, setJournal] = useState(
    () => JSON.parse(localStorage.getItem('vver-journal') || 'null') || initialJournal
  );
  const [session, setSession] = useState(
    () => JSON.parse(localStorage.getItem('vver-session') || 'null') || initialSession
  );
  const [telemetry, setTelemetry] = useState(initialTelemetry);

  useEffect(() => {
    localStorage.setItem('vver-journal', JSON.stringify(journal));
  }, [journal]);

  useEffect(() => {
    localStorage.setItem('vver-session', JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (!session.active) return undefined;

    const timer = setInterval(() => {
      setSession((current) => ({ ...current, elapsed: current.elapsed + 1 }));
      setTelemetry((current) => ({
        ...current,
        power: +(current.power + (Math.random() - 0.5) * 0.08).toFixed(2),
        primaryPressure: +(current.primaryPressure + (Math.random() - 0.5) * 0.01).toFixed(2),
        outletTemp: +(current.outletTemp + (Math.random() - 0.5) * 0.05).toFixed(1),
        sgLevel: +(current.sgLevel + (Math.random() - 0.5) * 0.01).toFixed(2),
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [session.active]);

  const operator = operators.find((item) => item.id === session.operatorId) || operators[0];
  const scenario = scenarios.find((item) => item.id === session.scenarioId) || scenarios[0];

  const addLog = (type, text) => {
    setJournal((current) => [...current, { time: nowTime(), type, text }]);
  };

  const startSession = (data) => {
    setSession({ ...data, active: true, elapsed: 0 });
    setJournal([
      {
        time: nowTime(),
        type: 'system',
        text: `${data.mode} запущен. Включена полная фиксация событий учебной сессии.`,
      },
    ]);
    setPage('live');
  };

  const finishSession = () => {
    addLog('system', `${session.mode} завершен. Журнал сохранен для последующего разбора.`);
    setSession((current) => ({ ...current, active: false }));
    setPage('results');
  };

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />
      <div className="main-area">
        <Topbar title={titles[page][0]} subtitle={titles[page][1]} />
        <main className="content">
          {page === 'dashboard' && (
            <DashboardPage
              session={session}
              operator={operator}
              scenario={scenario}
              journal={journal}
              telemetry={telemetry}
              setPage={setPage}
            />
          )}
          {page === 'create' && (
            <CreateTrainingPage scenarios={scenarios} onStart={startSession} />
          )}
          {page === 'live' && (
            <LiveMonitorPage
              session={session}
              operator={operator}
              scenario={scenario}
              telemetry={telemetry}
              addLog={addLog}
              onFinish={finishSession}
            />
          )}
          {page === 'journal' && (
            <JournalPage
              journal={journal}
              session={session}
              operator={operator}
              scenario={scenario}
            />
          )}
          {page === 'results' && <ResultsPage rows={results} />}
          {page === 'scenarios' && <ScenariosPage scenarios={scenarios} setPage={setPage} />}
        </main>
      </div>
    </div>
  );
}

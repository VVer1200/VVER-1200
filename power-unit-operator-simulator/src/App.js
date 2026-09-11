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
import simulatorService from './services/simulatorService';

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
  power: 100.0,
  powerMW: 3200.0,
  primaryPressure: 16.20,
  outletTemp: 328.9,
  inletTemp: 298.2,
  deltaT: 30.7,
  sgLevel: 2.40,
  secondaryPressure: 7.00,
  electric: 1190,
  rpm: 3000,
  freq: 50.0,
  flowPrimKgS: 17600,
  levelPzrM: 8.52,
  rcpStates: [true, true, true, true],
  rcpCountActive: 4,
  scramActive: false,
  turbineStopValvesOpen: true,
  gridBreakerClosed: true,
  lamps: {},
  isRealData: false,
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
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    localStorage.setItem('vver-journal', JSON.stringify(journal));
  }, [journal]);

  useEffect(() => {
    localStorage.setItem('vver-session', JSON.stringify(session));
  }, [session]);

  // Подключение к серверу симулятора ВВЭР-1200 и подписка на события
  useEffect(() => {
    simulatorService.connect();

    const unsubTelemetry = simulatorService.onTelemetry((realTel) => {
      setTelemetry(realTel);
    });

    const unsubStatus = simulatorService.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    const unsubAlarm = simulatorService.onAlarm(({ text }) => {
      setJournal((current) => [
        ...current,
        { time: nowTime(), type: 'alarm', text: `Сигнализация БЩУ: ${text}` },
      ]);
    });

    return () => {
      unsubTelemetry();
      unsubStatus();
      unsubAlarm();
    };
  }, []);

  // Таймер учебной сессии
  useEffect(() => {
    if (!session.active) return undefined;

    const timer = setInterval(() => {
      setSession((current) => ({ ...current, elapsed: current.elapsed + 1 }));
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
    // Сброс математической модели в исходное состояние для новой сессии
    simulatorService.resetSim();

    setJournal([
      {
        time: nowTime(),
        type: 'system',
        text: `${data.mode} запущен. Подключение к математической модели энергоблока активно.`,
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
      <Sidebar page={page} setPage={setPage} connectionStatus={connectionStatus} />
      <div className="main-area">
        <Topbar
          title={titles[page][0]}
          subtitle={titles[page][1]}
          connectionStatus={connectionStatus}
        />
        <main className="content">
          {page === 'dashboard' && (
            <DashboardPage
              session={session}
              operator={operator}
              scenario={scenario}
              journal={journal}
              telemetry={telemetry}
              setPage={setPage}
              connectionStatus={connectionStatus}
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

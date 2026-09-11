import React, { useState } from 'react';
import './CreateTrainingPage.css';
import Panel from '../components/Panel';

export default function CreateTrainingPage({ scenarios, onStart }) {
  const [mode, setMode] = useState('Тренировка');
  const [difficulty, setDifficulty] = useState('Средняя');
  const [scenarioId, setScenarioId] = useState('rcp');
  const [plannedDate, setPlannedDate] = useState('2026-09-15');
  const [plannedTime, setPlannedTime] = useState('14:00');
  const scenario = scenarios.find((item) => item.id === scenarioId);

  return (
    <div className="create-layout">
      <Panel title="Параметры учебной сессии">
        <div className="create-form">
          <div className="form-block">
            <label>01 · Режим проведения</label>
            <div className="mode-switch">
              {['Тренировка', 'Экзамен'].map((item) => (
                <button className={mode === item ? 'active' : ''} onClick={() => setMode(item)} key={item}>
                  <b>{item === 'Тренировка' ? '◌' : '✓'}</b>
                  <span>
                    {item}
                    <small>{item === 'Тренировка' ? 'Допускаются подсказки и вмешательство инструктора' : 'Полная фиксация действий без подсказок оператору'}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-block">
              <label>02 · Подключение оператора</label>
              <div className="connected-operator">
                <span className="connected-dot" />
                <div>
                  <b>Оператор подключён через Unity</b>
                  <small>Рабочее место оператора · компьютер №1</small>
                </div>
              </div>
            </div>
            <div className="form-block">
              <label>03 · Дата и время</label>
              <div className="date-time-row">
                <input type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} />
                <input type="time" value={plannedTime} onChange={(event) => setPlannedTime(event.target.value)} />
              </div>
            </div>
          </div>

          <div className="form-block">
            <label>04 · Уровень сложности</label>
            <div className="difficulty-switch">
              {['Начальная', 'Средняя', 'Сложная', 'Экспертная'].map((item) => (
                <button className={difficulty === item ? 'active' : ''} onClick={() => setDifficulty(item)} key={item}>{item}</button>
              ))}
            </div>
          </div>

          <div className="form-block">
            <label>05 · Учебный сценарий</label>
            <div className="scenario-options">
              {scenarios.map((item) => (
                <button className={scenarioId === item.id ? 'active' : ''} key={item.id} onClick={() => setScenarioId(item.id)}>
                  <i>{item.category}</i>
                  <b>{item.title}</b>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="session-submit">
            <div>
              <small>Запланировано</small>
              <b>{plannedDate} · {plannedTime}</b>
            </div>
            <button className="primary start-btn" onClick={() => onStart({ mode, operatorId: 1, difficulty, scenarioId, plannedDate, plannedTime })}>
              ▶ ЗАПУСТИТЬ {mode.toUpperCase()}
            </button>
          </div>
        </div>
      </Panel>

      <aside className="create-aside">
        <Panel title="Паспорт сценария">
          <div className="scenario-passport">
            <div className="passport-icon">⚛</div>
            <small>{scenario.category}</small>
            <h3>{scenario.title}</h3>
            <p>{scenario.description}</p>
            <dl>
              <div><dt>Рекомендуемая сложность</dt><dd>{scenario.level}</dd></div>
              <div><dt>Контроль действий</dt><dd>Полный журнал событий</dd></div>
              <div><dt>Источник данных</dt><dd>Unity / симулятор энергоблока</dd></div>
            </dl>
          </div>
        </Panel>
        <div className={`exam-note ${mode === 'Экзамен' ? 'show' : ''}`}>
          <b>ЭКЗАМЕНАЦИОННЫЙ РЕЖИМ</b>
          <p>Все действия оператора, изменения параметров, сигнализации и вмешательства инструктора сохраняются для последующего разбора.</p>
        </div>
      </aside>
    </div>
  );
}

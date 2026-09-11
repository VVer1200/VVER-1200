import React, { useState } from 'react';
import './LiveMonitorPage.css';
import TelemetryCard from '../components/TelemetryCard';
import Panel from '../components/Panel';
import PlantMimic from '../components/PlantMimic';
import StatusBadge from '../components/StatusBadge';
import { formatTime } from '../utils/formatters';
import simulatorService, { ALARM_NAMES } from '../services/simulatorService';

export default function LiveMonitorPage({ session, operator, scenario, telemetry, addLog, onFinish }) {
  const [modal, setModal] = useState(false);

  const events = [
    { label: 'Отключение ГЦН-2', desc: 'Снижение циркуляции в петле №2' },
    { label: 'Рост давления первого контура', desc: 'Перевод КД в ручной режим, ТЭН на 100%' },
    { label: 'Снижение уровня в ПГ', desc: 'Уменьшение подачи питательной воды' },
    { label: 'Отключение генератора от сети', desc: 'Сброс выключателя генератора' },
  ];

  const inject = (label) => {
    simulatorService.injectEvent(label);
    addLog('instructor', `Инструктор инициировал воздействие на модель: ${label}.`);
    setModal(false);
  };

  const handleTripAz = () => {
    if (window.confirm('ВНИМАНИЕ: Сбросить аварийную защиту АЗ-1? Все стержни СУЗ упадут в активную зону!')) {
      simulatorService.tripAz();
      addLog('instructor', 'Инструктор активировал сброс аварийной защиты АЗ-1.');
    }
  };

  const handleResetSim = () => {
    if (window.confirm('Сбросить энергоблок в исходный номинальный стационарный режим 100%?')) {
      simulatorService.resetSim();
      addLog('system', 'Энергоблок сброшен в исходный режим 100% Nnom.');
    }
  };

  // Активные аварийные и предупредительные лампы из 29 ламп сервера
  const activeAlarms = Object.entries(telemetry.lamps || {})
    .filter(([lampId, active]) => active && ALARM_NAMES[lampId])
    .map(([lampId]) => ({ id: lampId, text: ALARM_NAMES[lampId] }));

  return (
    <>
      <div className="live-bar">
        <div>
          <StatusBadge type="live">● LIVE</StatusBadge>
          <b>{operator.name}</b>
          <span>{session.mode} · {scenario.short} · {session.difficulty}</span>
        </div>
        <div>
          <strong>◷ {formatTime(session.elapsed)}</strong>
          <button className="warning-btn" onClick={() => setModal(true)}>⚠ СОЗДАТЬ СОБЫТИЕ</button>
          <button className="danger-btn" onClick={onFinish}>■ ЗАВЕРШИТЬ</button>
        </div>
      </div>

      {activeAlarms.length > 0 && (
        <div className="annunciator-banner">
          <div className="annunciator-banner-title">
            <span>🚨 СРАБОТАВШИЕ ЗАЩИТЫ И СИГНАЛИЗАЦИИ БЩУ ({activeAlarms.length}):</span>
          </div>
          <div className="annunciator-pills">
            {activeAlarms.map((alm) => {
              const isCrit = alm.id.startsWith('LAMP_AZ') || alm.id.startsWith('LAMP_CRIT') || alm.id.endsWith('_TRIP');
              return (
                <span key={alm.id} className={`alarm-pill ${isCrit ? 'crit' : 'warn'}`}>
                  <b>{isCrit ? 'АЗ' : 'ПРЕДУПР'}</b> {alm.text}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="telemetry-grid">
        <TelemetryCard
          label="Мощность реактора"
          value={telemetry.power}
          unit="%"
          range="Диапазон 95–105%"
          state={telemetry.scramActive ? 'danger' : telemetry.power < 95 ? 'warning' : 'normal'}
        />
        <TelemetryCard
          label="Давление I контура"
          value={telemetry.primaryPressure}
          unit="МПа"
          range="Норма 15.5–16.6"
          state={telemetry.primaryPressure > 16.6 || telemetry.primaryPressure < 15.0 ? 'warning' : 'normal'}
        />
        <TelemetryCard
          label="T на выходе АЗ"
          value={telemetry.outletTemp}
          unit="°C"
          range="Предельное 335°C"
          state={telemetry.outletTemp > 330 ? 'warning' : 'normal'}
        />
        <TelemetryCard
          label="Уровень ПГ"
          value={telemetry.sgLevel}
          unit="м"
          range="Норма 2.2–2.6"
          state={telemetry.sgLevel < 2.2 || telemetry.sgLevel > 2.6 ? 'warning' : 'normal'}
        />
        <TelemetryCard
          label="Эл. мощность"
          value={telemetry.electric}
          unit="МВт"
          range={telemetry.gridBreakerClosed ? 'Генератор в сети' : 'ОТКЛЮЧЕН ОТ СЕТИ'}
          state={!telemetry.gridBreakerClosed ? 'danger' : 'normal'}
        />
        <TelemetryCard
          label="Частота"
          value={typeof telemetry.freq === 'number' ? telemetry.freq.toFixed(2) : telemetry.freq}
          unit="Гц"
          range="Номинал 50 Гц"
        />
      </div>

      <div className="live-grid mt">
        <Panel
          title="Состояние технологической схемы"
          meta={
            telemetry.isRealData ? (
              <StatusBadge type="live">● МОДЕЛЬ ОНЛАЙН (20 Гц)</StatusBadge>
            ) : (
              <StatusBadge type="warning">ДЕМО ТЕЛЕМЕТРИЯ</StatusBadge>
            )
          }
        >
          <PlantMimic telemetry={telemetry} />
        </Panel>

        <Panel title="Воздействия инструктора">
          <div className="instructor-actions">
            <p>Команды инструктора транслируются в математическую модель энергоблока в реальном времени.</p>
            {events.map((e) => (
              <button onClick={() => inject(e.label)} key={e.label}>
                <span>⚠</span>
                <b>{e.label}</b>
                <i>＋</i>
              </button>
            ))}

            <div className="quick-commands-row">
              <button className="quick-btn az-btn" onClick={handleTripAz}>
                🚨 Сброс АЗ-1
              </button>
              <button className="quick-btn reset-btn" onClick={handleResetSim}>
                ↺ Сброс в 100%
              </button>
            </div>

            <button
              className="ghost wide mock-action"
              onClick={() => addLog('student', 'Оператор выполнил действие на пульте БЩУ.')}
            >
              ＋ Имитировать действие оператора
            </button>
          </div>
        </Panel>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="event-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-symbol">⚠</div>
            <small>ВНЕШТАТНОЕ СОБЫТИЕ</small>
            <h3>Создать воздействие</h3>
            <p>Выберите событие для передачи в активную математическую модель.</p>
            {events.map((e) => (
              <button onClick={() => inject(e.label)} key={e.label}>
                {e.label}
                <span>→</span>
              </button>
            ))}
            <button className="ghost wide" onClick={() => setModal(false)}>Отмена</button>
          </div>
        </div>
      )}
    </>
  );
}

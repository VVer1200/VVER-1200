// Назначение файла: Мониторинг энергоблока и управление воздействиями инструктора.
import React, { useState } from 'react';
import './LiveMonitorPage.css';
import TelemetryCard from '../components/TelemetryCard';
import Panel from '../components/Panel';
import PlantMimic from '../components/PlantMimic';
import StatusBadge from '../components/StatusBadge';
import { formatTime } from '../utils/formatters';
import simulatorService, { ALARM_NAMES } from '../services/simulatorService';
import AZConfirmModal from '../components/AZConfirmModal';
import UiIcon from '../components/UiIcon';
export default function LiveMonitorPage({ session, operator, scenario, telemetry, addLog, onFinish }) {
    const [modal, setModal] = useState(false);
    const [azModal, setAzModal] = useState(false);
    const [mockModal, setMockModal] = useState(false);
    const [mockAction, setMockAction] = useState('Нажатие кнопки на БЩУ');
    const [mockNotice, setMockNotice] = useState(false);
    const events = [
        { label: 'Отключение ГЦН-2', desc: 'Снижение циркуляции в петле №2' },
        { label: 'Рост давления первого контура', desc: 'Перевод КД в ручной режим, ТЭН на 100%' },
        { label: 'Снижение уровня в ПГ', desc: 'Уменьшение подачи питательной воды' },
        { label: 'Отключение генератора от сети', desc: 'Сброс выключателя генератора' },
    ];
    // Отправляем воздействие серверу и регистрируем запрос инструктора в журнале.
    const inject = (label) => {
        simulatorService.injectEvent(label);
        addLog('instructor', `Инструктор инициировал воздействие на модель: ${label}.`);
        setModal(false);
    };
    const handleTripAz = () => {
        setAzModal(true);
    };
    const handleConfirmAz = () => {
        setAzModal(false);
        simulatorService.tripAz();
        addLog('instructor', 'Оператор подтвердил экстренный сброс аварийной защиты АЗ-1.');
    };
    const handleResetSim = () => {
        if (window.confirm('Сбросить энергоблок в исходный номинальный стационарный режим 100%?')) {
            simulatorService.resetSim();
            addLog('system', 'Энергоблок сброшен в исходный режим 100% Nnom.');
        }
    };
    // Активные аварийные и предупредительные лампы из 29 ламп сервера
    // Показываем только активные сигналы, названия которых известны интерфейсу.
    const activeAlarms = Object.entries(telemetry.lamps || {})
        .filter(([lampId, active]) => active && ALARM_NAMES[lampId])
        .map(([lampId]) => ({ id: lampId, text: ALARM_NAMES[lampId] }));
    return (<div className="workspace live-workspace">
      <div className="workspace-kicker"><span className="serial-number">02 / МОНИТОРИНГ</span><span>ПУЛЬТ УПРАВЛЕНИЯ · АКТИВНАЯ СЕССИЯ</span></div>
      <div className="live-bar">
        <div>
          <StatusBadge type="live">LIVE</StatusBadge>
          <b>{operator.name}</b>
          <span>{session.mode} · {scenario.short} · {session.difficulty}</span>
        </div>
        <div>
          <strong>{formatTime(session.elapsed)}</strong>
          <button className="warning-btn" onClick={() => setModal(true)}><UiIcon name="alert" size={16}/> СОЗДАТЬ СОБЫТИЕ</button>
          <button className="danger-btn" onClick={onFinish}><UiIcon name="x" size={16}/> ЗАВЕРШИТЬ</button>
        </div>
      </div>

      {activeAlarms.length > 0 && (<div className="annunciator-banner">
          <div className="annunciator-banner-title">
            <span>СРАБОТАВШИЕ ЗАЩИТЫ И СИГНАЛИЗАЦИИ БЩУ ({activeAlarms.length}):</span>
          </div>
          <div className="annunciator-pills">
            {activeAlarms.map((alm) => {
                const isCrit = alm.id.startsWith('LAMP_AZ') || alm.id.startsWith('LAMP_CRIT') || alm.id.endsWith('_TRIP');
                return (<span key={alm.id} className={`alarm-pill ${isCrit ? 'crit' : 'warn'}`}>
                  <b>{isCrit ? 'АЗ' : 'ПРЕДУПР'}</b> {alm.text}
                </span>);
            })}
          </div>
        </div>)}

      <section className="console-visual-banner" aria-label="Визуализация пульта управления">
        <img src="/assets/control-console.webp" alt="Футуристическая иллюстрация приборной панели"/>
        <div className="console-banner-shade"/>
        <div className="console-banner-content">
          <span className="console-kicker">CONTROL SYSTEM / VVER-1200</span>
          <strong>Цифровой пульт энергоблока</strong>
          <span>Визуализация состояния энергоблока · показания измерительных каналов ниже</span>
        </div>
        <div className="console-live-readout"><span>РЕАКТОР</span><b>{telemetry.power}%</b><small>{telemetry.isRealData ? 'ТЕЛЕМЕТРИЯ ОНЛАЙН' : 'ОЖИДАНИЕ ТЕЛЕМЕТРИИ'}</small></div>
      </section>
      <div className="section-heading"><div><span className="section-index">02.1</span><h3>Измерительные каналы</h3></div><span className="section-meta">ОБНОВЛЕНИЕ ПО WEBSOCKET</span></div>
      <div className="telemetry-grid">
        <TelemetryCard label="Мощность реактора" value={telemetry.power} unit="%" range="Диапазон 95–105%" state={telemetry.scramActive ? 'danger' : telemetry.power < 95 ? 'warning' : 'normal'}/>
        <TelemetryCard label="Давление I контура" value={telemetry.primaryPressure} unit="МПа" range="Норма 15.5–16.6" state={telemetry.primaryPressure > 16.6 || telemetry.primaryPressure < 15.0 ? 'warning' : 'normal'}/>
        <TelemetryCard label="T на выходе АЗ" value={telemetry.outletTemp} unit="°C" range="Предельное 335°C" state={telemetry.outletTemp > 330 ? 'warning' : 'normal'}/>
        <TelemetryCard label="Уровень ПГ" value={telemetry.sgLevel} unit="м" range="Норма 2.2–2.6" state={telemetry.sgLevel < 2.2 || telemetry.sgLevel > 2.6 ? 'warning' : 'normal'}/>
        <TelemetryCard label="Эл. мощность" value={telemetry.electric} unit="МВт" range={telemetry.gridBreakerClosed ? 'Генератор в сети' : 'ОТКЛЮЧЕН ОТ СЕТИ'} state={!telemetry.gridBreakerClosed ? 'danger' : 'normal'}/>
        <TelemetryCard label="Частота" value={typeof telemetry.freq === 'number' ? telemetry.freq.toFixed(2) : telemetry.freq} unit="Гц" range="Номинал 50 Гц"/>
      </div>

      <div className="section-heading"><div><span className="section-index">02.2</span><h3>Мнемосхема и воздействия</h3></div><span className="section-meta">УПРАВЛЕНИЕ МОДЕЛЬЮ</span></div>
      <div className="live-grid mt">
        <Panel title="Состояние технологической схемы" meta={telemetry.isRealData ? (<StatusBadge type="live">МОДЕЛЬ ПОДКЛЮЧЕНА</StatusBadge>) : (<StatusBadge type="warning">НЕТ СВЯЗИ С МОДЕЛЬЮ</StatusBadge>)}>
          <PlantMimic telemetry={telemetry}/>
        </Panel>

        <Panel title="Воздействия инструктора">
          <div className="instructor-actions">
            <p>Команды инструктора транслируются в математическую модель энергоблока в реальном времени.</p>
            {events.map((e) => (<button onClick={() => inject(e.label)} key={e.label}>
                <UiIcon name="alert" size={18}/>
                <b>{e.label}</b>
                <UiIcon name="plus" size={17}/>
              </button>))}

            <div className="quick-commands-row">
              <button className="quick-btn az-btn" onClick={handleTripAz}>
                <UiIcon name="alert" size={16}/> Сброс АЗ-1
              </button>
              <button className="quick-btn reset-btn" onClick={handleResetSim}>
                <UiIcon name="activity" size={16}/> Сброс в 100%
              </button>
            </div>

            <button className="ghost wide mock-action ux-action-centered" onClick={() => setMockModal(true)}>
              <UiIcon name="plus" size={17}/> Имитировать действие оператора
            </button>
          </div>
        </Panel>
      </div>

      {modal && (<div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="event-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-symbol"><UiIcon name="alert" size={24}/></div>
            <small>ВНЕШТАТНОЕ СОБЫТИЕ</small>
            <h3>Создать воздействие</h3>
            <p>Выберите событие для передачи в активную математическую модель.</p>
            {events.map((e) => (<button onClick={() => inject(e.label)} key={e.label}>
                {e.label}
                <UiIcon name="plus" size={16}/>
              </button>))}
            <button className="ghost wide" onClick={() => setModal(false)}>Отмена</button>
          </div>
        </div>)}

      {mockNotice && <div role="status" className="mock-feedback">Демонстрационное действие добавлено в журнал <button onClick={() => setMockNotice(false)} aria-label="Закрыть уведомление"><UiIcon name="x" size={15}/></button></div>}
      {mockModal && <div className="modal-backdrop" onClick={() => setMockModal(false)}><div className="event-modal mock-dialog" role="dialog" aria-modal="true" aria-labelledby="mock-title" onClick={e => e.stopPropagation()}>
        <div className="modal-symbol"><UiIcon name="gamepad" size={24}/></div><small>УЧЕБНАЯ ИМИТАЦИЯ</small><h3 id="mock-title">Действие оператора</h3><p>Выберите действие для демонстрационной записи в журнал. Команда в Unity не отправляется.</p>
        <label htmlFor="mock-action-select">Действие на пульте</label><select id="mock-action-select" value={mockAction} onChange={e => setMockAction(e.target.value)}>{['Нажатие кнопки на БЩУ', 'Подтверждение сигнала тревоги', 'Переключение режима управления', 'Проверка показаний приборов', 'Отключение насоса оператором'].map(x => <option key={x}>{x}</option>)}</select>
        <button className="ux-primary" onClick={() => { addLog('student', `ДЕМО: ${mockAction}.`); setMockModal(false); setMockNotice(true); }}><UiIcon name="check" size={17}/> Добавить в журнал</button>
        <button className="ghost wide" onClick={() => setMockModal(false)}>Отмена</button>
      </div></div>}
      <AZConfirmModal isOpen={azModal} onConfirm={handleConfirmAz} onCancel={() => setAzModal(false)}/>
    </div>);
}


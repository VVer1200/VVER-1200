// Назначение файла: Главный обзор энергоблока: показатели, мнемосхема и события.
import React, { useState } from 'react';
import './DashboardPage.css';
import StatusBadge from '../components/StatusBadge';
import EventRow from '../components/EventRow';
import PlantMimic from '../components/PlantMimic';
import TelemetryCard from '../components/TelemetryCard';
import { formatTime } from '../utils/formatters';
export default function DashboardPage({ session, operator, scenario, journal, telemetry, setPage, connectionStatus = 'disconnected' }) {
    const [immersive, setImmersive] = useState(true);
    const freqFormatted = typeof telemetry.freq === 'number' ? telemetry.freq.toFixed(2) : (telemetry.freq || '50.00');
    const power = Number(telemetry.power) || 0;
    // Готовим измерительные каналы и состояния предупреждений для отображения.
    const readings = [
        ['Давление I контура', telemetry.primaryPressure, 'МПа', '15.5–16.6', telemetry.primaryPressure > 16.6 || telemetry.primaryPressure < 15 ? 'warning' : 'normal'],
        ['Температура на выходе АЗ', telemetry.outletTemp, '°C', 'до 335', telemetry.outletTemp > 330 ? 'warning' : 'normal'],
        ['Уровень парогенератора', telemetry.sgLevel, 'м', '2.2–2.6', telemetry.sgLevel < 2.2 || telemetry.sgLevel > 2.6 ? 'warning' : 'normal'],
        ['Электрическая мощность', telemetry.electric, 'МВт', 'генератор', !telemetry.gridBreakerClosed ? 'danger' : 'normal'],
        ['Частота генератора', freqFormatted, 'Гц', '50.00', 'normal'],
    ];
    return (<div className="workspace dashboard-workspace">
      <div className="workspace-kicker"><span className="serial-number">01 / ОБЗОР</span><span>ТЕХНОЛОГИЧЕСКОЕ СОСТОЯНИЕ · ВВЭР-1200</span></div>
      <section className={`command-hero neon-hero ${immersive ? "immersive-on" : "immersive-off"}`}>
        <div className="hero-copy">
          <span className="eyebrow">● ЦЕНТР КОНТРОЛЯ / ЭНЕРГОБЛОК</span>
          <h2>Энергия.<br /><em>Точность.</em><br />Контроль.</h2>
          <p>{connectionStatus === 'connected' ? 'Получаем телеметрию математической модели в реальном времени.' : 'Панель контроля учебной модели. Для реальной телеметрии подключите сервер.'}</p>
          <div className="hero-actions"><button className="primary" onClick={() => setPage('live')}>Открыть пульт мониторинга </button><button className="ghost" onClick={() => setPage('create')}>Новая сессия +</button></div>
        </div>
        <div className={`hero-reactor hologram-stage ${telemetry.scramActive ? 'reactor-alert' : ''}`}>
          <img className="reactor-art" src="/assets/reactor-hologram.webp" alt="Голографическая иллюстрация реакторной установки"/>
          <div className="hologram-scan" aria-hidden="true"/>
          <button type="button" className="visual-motion-toggle" onClick={() => setImmersive(v => !v)} aria-pressed={immersive}>{immersive ? "◉ АНИМАЦИЯ ВКЛ" : "◎ АНИМАЦИЯ ВЫКЛ"}</button>
          
          <div className="reactor-core"><span>МОЩНОСТЬ РЕАКТОРА</span><strong>{telemetry.power}<small>%</small></strong><span>{telemetry.scramActive ? 'АЗ-1 АКТИВНА' : 'N / NНОМ'}</span></div>
          <span className="orbit-label orbit-label-top">VVER—1200</span><span className="orbit-label orbit-label-bottom">{telemetry.scramActive ? 'АВАРИЙНАЯ ЗАЩИТА' : power < 95 ? 'ОТКЛОНЕНИЕ МОЩНОСТИ' : 'НОМИНАЛЬНЫЙ РЕЖИМ'}</span>
        </div>
      </section>
      <div className="section-heading"><div><span className="section-index">01.1</span><h3>Параметры энергоблока</h3></div><span className="section-meta">{telemetry.isRealData ? 'МОДЕЛЬ ПОДКЛЮЧЕНА' : 'НЕТ СВЯЗИ С МОДЕЛЬЮ'}</span></div>
      <section className="instrument-strip">{readings.map(([label, value, unit, range, state], i) => <div className={`instrument ${state}`} key={label}><div className="instrument-top"><span>{String(i + 1).padStart(2, '0')}</span><i /></div><div className="instrument-label">{label}</div><div className="instrument-value">{value}<small>{unit}</small></div><div className="instrument-foot">Ориентир: {range}</div></div>)}</section>
      <div className="dashboard-main-grid">
        <section className="schematic-stage"><div className="stage-heading"><div><span className="eyebrow">02 / МНЕМОСХЕМА</span><h3>Технологическая цепочка</h3></div><span className="stage-chip">ПРИНЦИПИАЛЬНАЯ СХЕМА</span></div><PlantMimic telemetry={telemetry}/></section>
        <section className="session-stage"><div className="stage-heading"><div><span className="eyebrow">03 / СЕССИЯ</span><h3>Рабочая смена</h3></div><StatusBadge type="live">● LIVE</StatusBadge></div><div className="session-identity"><span className="operator-avatar">OP</span><div><strong>{operator.name}</strong><span>{operator.group} · оператор энергоблока</span></div></div><div className="session-details"><div><span>Режим</span><b>{session.mode}</b></div><div><span>Сценарий</span><b>{scenario.short}</b></div><div><span>Сложность</span><b>{session.difficulty}</b></div><div><span>Время</span><b className="mono">{formatTime(session.elapsed)}</b></div></div><button className="session-link" onClick={() => setPage('live')}>Перейти к управлению </button></section>
      </div>
      <section className="activity-stage"><div className="stage-heading"><div><span className="eyebrow">04 / ЖУРНАЛ</span><h3>Последние события</h3></div><button className="text-action" onClick={() => setPage('journal')}>Все события</button></div><div className="activity-list">{journal.slice(-4).reverse().map((event, i) => <EventRow event={event} key={`${event.time}-${i}`}/>)}</div></section>
    </div>);
}


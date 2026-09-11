import React from 'react';
import './DashboardPage.css';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import EventRow from '../components/EventRow';
import PlantMimic from '../components/PlantMimic';
import TelemetryCard from '../components/TelemetryCard';
import { formatTime } from '../utils/formatters';

export default function DashboardPage({ session, operator, scenario, journal, telemetry, setPage }) {
  return (
    <>
      <div className="section-title">
        <div>
          <h2>Текущее состояние энергоблока</h2>
          <p>Основные технологические параметры учебной модели ВВЭР-1200</p>
        </div>
        <button className="primary" onClick={() => setPage('create')}>＋ ЗАПЛАНИРОВАТЬ СЕССИЮ</button>
      </div>

      <div className="dashboard-telemetry">
        <TelemetryCard label="Мощность реактора" value={telemetry.power} unit="%" range="Рабочий диапазон 95–105%" state={telemetry.power < 95 ? 'warning' : 'normal'} />
        <TelemetryCard label="Давление I контура" value={telemetry.primaryPressure} unit="МПа" range="Норма 15.5–16.6 МПа" />
        <TelemetryCard label="T на выходе активной зоны" value={telemetry.outletTemp} unit="°C" range="Предельное значение 335°C" />
        <TelemetryCard label="Уровень в парогенераторе" value={telemetry.sgLevel} unit="м" range="Норма 2.2–2.6 м" />
        <TelemetryCard label="Электрическая мощность" value={telemetry.electric} unit="МВт" range="Генератор подключен к сети" />
        <TelemetryCard label="Частота генератора" value={telemetry.freq.toFixed(2)} unit="Гц" range="Номинальная частота 50 Гц" />
      </div>

      <div className="grid-2 mt">
        <Panel title="Активная учебная сессия" meta={<StatusBadge type="live">● LIVE</StatusBadge>}>
          <div className="active-session">
            <div className="operator-head">
              <div className="operator-symbol">OP</div>
              <div className="operator-copy">
                <b>{operator.name}</b>
                <span>{operator.group} · оператор энергоблока</span>
              </div>
              <button className="ghost" onClick={() => setPage('live')}>Открыть мониторинг</button>
            </div>
            <div className="session-kpi">
              <div><small>Режим</small><b>{session.mode}</b></div>
              <div><small>Сложность</small><b>{session.difficulty}</b></div>
              <div><small>Сценарий</small><b>{scenario.short}</b></div>
              <div><small>Время</small><b className="mono">{formatTime(session.elapsed)}</b></div>
            </div>
          </div>
        </Panel>

        <Panel title="Контроль состояния" meta={<StatusBadge type={telemetry.power < 95 ? 'warning' : 'normal'}>{telemetry.power < 95 ? 'ОТКЛОНЕНИЕ ПАРАМЕТРА' : 'ПАРАМЕТРЫ СТАБИЛЬНЫ'}</StatusBadge>}>
          <div className="reactor-summary">
            <div className="reactor-gauge">
              <b>{telemetry.power}%</b>
              <span>мощность реактора</span>
            </div>
            <div className="summary-values">
              <p><span>Давление I контура</span><b>{telemetry.primaryPressure} МПа</b></p>
              <p><span>Температура на выходе АЗ</span><b>{telemetry.outletTemp} °C</b></p>
              <p><span>Частота сети</span><b>{telemetry.freq.toFixed(2)} Гц</b></p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid-2 mt">
        <Panel title="Технологическая схема энергоблока">
          <PlantMimic telemetry={telemetry} />
        </Panel>
        <Panel title="Последние события" meta={<button className="dash-link" onClick={() => setPage('journal')}>Открыть журнал</button>}>
          <div className="events-wrap">
            {journal.slice(-5).reverse().map((event, index) => <EventRow event={event} key={`${event.time}-${index}`} />)}
          </div>
        </Panel>
      </div>
    </>
  );
}

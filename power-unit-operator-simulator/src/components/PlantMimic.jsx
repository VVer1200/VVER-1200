// Назначение файла: Интерактивная технологическая схема энергоблока и его узлов.
import React, { useState } from 'react';
import './PlantMimic.css';
import UiIcon from './UiIcon';
const stages = [
    { id: 'reactor', name: 'Реактор', code: '01 / АКТИВНАЯ ЗОНА', icon: 'activity', desc: 'Тепловая мощность реактора' },
    { id: 'steam', name: 'Парогенератор', code: '02 / ТЕПЛООБМЕН', icon: 'gauge', desc: 'Уровень воды в парогенераторе' },
    { id: 'turbine', name: 'Турбина', code: '03 / МЕХАНИКА', icon: 'pump', desc: 'Частота вращения турбины' },
    { id: 'generator', name: 'Генератор', code: '04 / ЭЛЕКТРОСЕТЬ', icon: 'bolt', desc: 'Электрическая мощность генератора' }
];
export default function PlantMimic({ telemetry = {} }) {
    const [selected, setSelected] = useState('reactor'), [flow, setFlow] = useState(true);
    const pumps = telemetry.rcpStates || [true, true, true, true];
    const values = { reactor: `${telemetry.power ?? '—'} %`, steam: `${telemetry.sgLevel ?? '—'} м`, turbine: `${telemetry.rpm ?? '—'} об/мин`, generator: `${telemetry.electric ?? '—'} МВт` };
    const offline = { reactor: !!telemetry.scramActive, steam: false, turbine: telemetry.turbineStopValvesOpen === false, generator: telemetry.gridBreakerClosed === false };
    const active = stages.find(n => n.id === selected) || stages[0];
    return <div className={`plant-visual plant-v3 ${flow ? 'flow-on' : 'flow-off'}`}>
 <div className="plant-visual-toolbar"><span><i className="visual-live-dot"/> DIGITAL TWIN <b>/</b> ТЕХНОЛОГИЧЕСКИЙ КОНТУР</span><button type="button" onClick={() => setFlow(v => !v)}><UiIcon name={flow ? 'pause' : 'play'} size={16}/>{flow ? 'Остановить анимацию' : 'Запустить анимацию'}</button></div>
 <div className="plant-v3-flow"><div className="plant-v3-track" aria-hidden="true"/>{stages.map((n, i) => <React.Fragment key={n.id}><button type="button" className={`plant-v3-node ${selected === n.id ? 'selected' : ''} ${offline[n.id] ? 'offline' : ''}`} onClick={() => setSelected(n.id)} aria-pressed={selected === n.id}>
 <span className="plant-v3-code">{n.code}</span><span className="plant-v3-orb"><UiIcon name={n.icon} size={40}/><span className="plant-v3-orbit"/></span><strong>{n.name}</strong><span className="plant-v3-value">{values[n.id]}</span><span className="plant-v3-status"><i />{offline[n.id] ? 'Отключён' : 'Номинальный режим'}</span></button>{i < stages.length - 1 && <div className="plant-v3-link" aria-hidden="true"><span>{['I КОНТУР', 'ПАР', 'ВАЛ'][i]}</span><div className="plant-v3-line"><i /></div></div>}</React.Fragment>)}</div>
 <div className="plant-v3-bottom"><div className="plant-v3-inspect"><span className="ux-eyebrow">ВЫБРАННЫЙ УЗЕЛ / {active.code}</span><h3>{active.name}</h3><p>{active.desc}</p><strong>{values[active.id]}</strong></div><div className="plant-v3-pumps"><span className="ux-eyebrow">ГЛАВНЫЕ ЦИРКУЛЯЦИОННЫЕ НАСОСЫ</span><div>{pumps.map((running, i) => <div className={`plant-v3-pump ${running ? 'running' : 'stopped'}`} key={i}><UiIcon name="pump" size={19}/><strong>ГЦН-{i + 1}</strong><small>{running ? 'В работе' : 'Отключён'}</small></div>)}</div></div></div>
 </div>;
}


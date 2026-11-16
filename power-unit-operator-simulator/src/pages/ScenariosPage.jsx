// Назначение файла: Каталог учебных сценариев с выбором и подробным описанием.
import React, { useState } from 'react';
import './ScenariosPage.css';
import UiIcon from '../components/UiIcon';
const symbols = { rcp: 'pump', pressure: 'gauge', sg: 'activity', grid: 'bolt' };
const images = ['/assets/main_coolant_pump_shutdown.png', '/assets/primary_circuit_pressure_increase.png', '/assets/steam_generator_water_level_decrease.png', '/assets/generator_disconnection_from_the_power_grid.png'];
export default function ScenariosPage({ scenarios = [], setPage }) {
    const [selected, setSelected] = useState(null);
    const [category, setCategory] = useState('all');
    const filtered = scenarios.filter(s => category === 'all' || s.category === category);
    return <div className="ux-page scenario-rebuild">
   <header className="ux-heading"><div><span className="ux-eyebrow">SCENARIO LIBRARY / 06</span><h2>Библиотека сценариев</h2><p>Откройте карточку, чтобы изучить условия учебного события</p></div><div className="ux-heading-symbol"><UiIcon name="layers" size={34}/></div></header>
   <div className="scenario-visual-header"><img src="/assets/neon-waves.webp" alt="Неоновая визуализация энергетического потока"/><div><span>VVER-1200 / TRAINING LAB</span><strong>Сценарное моделирование</strong><p>Выбор условий, анализ и запуск учебной сессии</p></div></div>
   <div className="ux-scenario-filters">{['all', ...new Set(scenarios.map(s => s.category))].map(c => <button type="button" className={category === c ? 'selected' : ''} onClick={() => { setCategory(c); setSelected(null); }} key={c}>{c === 'all' ? 'Все сценарии' : c}</button>)}</div>
   <div className="scenario-cards-v4">{filtered.map((sc, i) => <article key={sc.id} className={`scenario-card-v4 ${selected === sc.id ? 'open' : ''}`}>
     <div className="scenario-card-v4-art"><img src={images[scenarios.indexOf(sc) % images.length]} alt="Тематическая иллюстрация сценария"/><span>SCN / {String(scenarios.indexOf(sc) + 1).padStart(2, '0')}</span><UiIcon name={symbols[sc.id] || 'activity'} size={24}/></div>
     <div className="scenario-card-v4-body"><small>{sc.category} · {sc.level}</small><h3>{sc.title}</h3><p>{sc.description}</p>
     <button type="button" className="scenario-details-button" aria-expanded={selected === sc.id} onClick={() => setSelected(selected === sc.id ? null : sc.id)}><UiIcon name="eye" size={18}/>{selected === sc.id ? 'Скрыть подробности' : 'Подробнее о сценарии'}</button>
     {selected === sc.id && <div className="scenario-inline-details"><h4>Паспорт учебного события</h4><dl><div><dt>Система</dt><dd>{sc.category}</dd></div><div><dt>Сложность</dt><dd>{sc.level}</dd></div><div><dt>Описание</dt><dd>{sc.description}</dd></div></dl><p>Событие будет доступно для выбора при создании тренировки. Конкретные действия оператора оцениваются серверной логикой, если она подключена.</p><button type="button" className="ux-primary ux-action-centered" onClick={() => setPage('create')}><UiIcon name="plus" size={18}/> Создать сессию</button></div>}
     </div></article>)}</div>
 </div>;
}


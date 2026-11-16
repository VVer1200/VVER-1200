// Назначение файла: Журнал событий: поиск, фильтры и экспорт записей.
import React, { useMemo, useState } from 'react';
import './JournalPage.css';
import UiIcon from '../components/UiIcon';
import { formatTime, typeLabel } from '../utils/formatters';
const filters = [['all', 'Все события'], ['student', 'Оператор'], ['instructor', 'Инструктор'], ['alarm', 'Сигнализация'], ['system', 'Система']];
const iconMap = { student: 'activity', instructor: 'shield', alarm: 'alert', system: 'info' };
export default function JournalPage({ journal = [], session = {}, operator = {}, scenario = {} }) {
    const [filter, setFilter] = useState('all'), [query, setQuery] = useState(''), [reverse, setReverse] = useState(true);
    const filtered = useMemo(() => journal.filter(e => (filter === 'all' || e.type === filter) && `${e.text} ${e.time}`.toLowerCase().includes(query.toLowerCase())), [journal, filter, query]);
    const list = reverse ? [...filtered].reverse() : filtered;
    const counts = Object.fromEntries(filters.map(([id]) => [id, id === 'all' ? journal.length : journal.filter(e => e.type === id).length]));
    const exportCsv = () => { const csv = '\uFEFFВремя;Тип;Событие\n' + filtered.map(e => [e.time, typeLabel(e.type), e.text].map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(';')).join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'journal-vver1200.csv'; a.click(); URL.revokeObjectURL(url); };
    return <div className="ux-page"><header className="ux-heading"><div><span className="ux-eyebrow">EVENT STREAM / 04</span><h2>Хронология действий</h2><p>Отслеживание событий и реакций в рамках учебной сессии</p></div><button className="ux-secondary" onClick={exportCsv}><UiIcon name="download" size={17}/> Экспорт CSV</button></header>
 <div className="ux-journal-stats"><div><UiIcon name="list"/><span>Всего событий</span><strong>{journal.length}</strong></div><div><UiIcon name="alert"/><span>Сигнализации</span><strong>{counts.alarm}</strong></div><div><UiIcon name="clock"/><span>Время сессии</span><strong>{formatTime(session.elapsed || 0)}</strong></div></div>
 <div className="ux-journal-layout"><aside className="ux-surface ux-journal-side"><span className="ux-eyebrow">ИСТОЧНИКИ СОБЫТИЙ</span><div className="ux-filter-stack">{filters.map(([id, label]) => <button key={id} className={filter === id ? 'selected' : ''} onClick={() => setFilter(id)}><UiIcon name={iconMap[id] || 'filter'} size={17}/><span>{label}</span><b>{counts[id]}</b></button>)}</div><div className="ux-session-info"><small>Сценарий</small><strong>{scenario.title}</strong><small>Оператор</small><strong>{operator.name}</strong></div></aside>
 <section className="ux-surface ux-journal-feed"><div className="ux-feed-tools"><label className="ux-search"><UiIcon name="search" size={18}/><input placeholder="Поиск по событиям..." value={query} onChange={e => setQuery(e.target.value)}/></label><button className="ux-secondary" onClick={() => setReverse(v => !v)}><UiIcon name="filter" size={16}/>{reverse ? 'Сначала новые' : 'Сначала старые'}</button></div><div className="ux-event-stream">{list.length ? list.map((e, i) => <article className={`ux-event ux-event-${e.type}`} key={`${e.time}-${i}`}><div className="ux-event-symbol"><UiIcon name={iconMap[e.type] || 'info'} size={18}/></div><div><div className="ux-event-meta"><span>{typeLabel(e.type)}</span><time>{e.time}</time></div><p>{e.text}</p></div></article>) : <div className="ux-empty">Событий по выбранным условиям нет</div>}</div></section></div></div>;
}


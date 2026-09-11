import React from 'react';import './Panel.css';
export default function Panel({title,meta,children,className=''}){return <section className={`panel ${className}`}><div className="panel-head"><div><i className="panel-line"/><h3>{title}</h3></div>{meta}</div>{children}</section>}

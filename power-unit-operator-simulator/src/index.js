// Назначение файла: Точка входа React: подключает стили и монтирует приложение в HTML.
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './theme.css';
import './design-system.css';
import './control-room.css';
import './studio-layout.css';
import './neon-experience.css';
import './immersive-visuals.css';
import './interface-v3.css';
import './interface-v4.css';
import App from './App';
import './interface-v5.css';
import './interface-v6.css';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);


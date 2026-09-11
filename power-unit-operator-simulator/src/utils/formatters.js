export const formatTime=(sec)=>`${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`;
export const nowTime=()=>new Date().toLocaleTimeString('ru-RU',{hour12:false});
export const typeLabel=(t)=>({student:'Действие оператора',instructor:'Действие инструктора',alarm:'Сигнализация',system:'Система'})[t]||t;

import React from 'react';
import './PlantMimic.css';

function FlowArrow({ label, steam = false }) {
  return (
    <div className={`flow-link ${steam ? 'steam' : ''}`}>
      <span>{label}</span>
      <div className="flow-line" />
      <b>›</b>
    </div>
  );
}

export default function PlantMimic({ telemetry }) {
  return (
    <div className="mimic">
      <div className="mimic-title">УПРОЩЕННАЯ ТЕХНОЛОГИЧЕСКАЯ СХЕМА ЭНЕРГОБЛОКА</div>
      <div className="mimic-chain">
        <div className="unit reactor">
          <span>РЕАКТОР</span>
          <b>{telemetry.power}%</b>
          <i>ВВЭР-1200</i>
        </div>
        <FlowArrow label="I КОНТУР" />
        <div className="unit sg">
          <span>ПАРОГЕНЕРАТОР</span>
          <b>{telemetry.sgLevel} м</b>
          <i>уровень</i>
        </div>
        <FlowArrow label="ПАР" steam />
        <div className="unit turbine">
          <span>ТУРБИНА</span>
          <b>{telemetry.rpm}</b>
          <i>об/мин</i>
        </div>
        <FlowArrow label="ВАЛ" />
        <div className="unit generator">
          <span>ГЕНЕРАТОР</span>
          <b>{telemetry.electric}</b>
          <i>МВт</i>
        </div>
      </div>
      <div className="pump-strip">
        {[1, 2, 3, 4].map((number) => (
          <div className={number === 2 ? 'pump off' : 'pump'} key={number}>
            <i />
            <b>{`ГЦН-${number}`}</b>
            <span>{number === 2 ? 'ОТКЛЮЧЕН' : 'РАБОТА'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

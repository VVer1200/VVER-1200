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
  const rcpStates = telemetry.rcpStates || [true, true, true, true];
  const isScram = telemetry.scramActive;
  const isGridOff = telemetry.gridBreakerClosed === false;
  const isTurbineTripped = telemetry.turbineStopValvesOpen === false;

  return (
    <div className="mimic">
      <div className="mimic-title">УПРОЩЕННАЯ ТЕХНОЛОГИЧЕСКАЯ СХЕМА ЭНЕРГОБЛОКА</div>
      <div className="mimic-chain">
        <div className={`unit reactor ${isScram ? 'scram' : ''}`}>
          <span>РЕАКТОР</span>
          <b>{telemetry.power}%</b>
          <i>{isScram ? 'АЗ-1 СРАБОТАЛА' : 'ВВЭР-1200'}</i>
        </div>
        <FlowArrow label="I КОНТУР" />
        <div className="unit sg">
          <span>ПАРОГЕНЕРАТОР</span>
          <b>{telemetry.sgLevel} м</b>
          <i>{telemetry.secondaryPressure ? `${telemetry.secondaryPressure} МПа` : 'уровень'}</i>
        </div>
        <FlowArrow label="ПАР" steam />
        <div className={`unit turbine ${isTurbineTripped ? 'offline' : ''}`}>
          <span>ТУРБИНА</span>
          <b>{telemetry.rpm}</b>
          <i>{isTurbineTripped ? 'СК ПОСАЖЕНЫ' : 'об/мин'}</i>
        </div>
        <FlowArrow label="ВАЛ" />
        <div className={`unit generator ${isGridOff ? 'offline' : ''}`}>
          <span>ГЕНЕРАТОР</span>
          <b>{telemetry.electric}</b>
          <i>{isGridOff ? 'СЕТЬ ОТКЛЮЧЕНА' : 'МВт'}</i>
        </div>
      </div>
      <div className="pump-strip">
        {[1, 2, 3, 4].map((number) => {
          const isOff = rcpStates[number - 1] === false;
          return (
            <div className={isOff ? 'pump off' : 'pump'} key={number}>
              <i />
              <b>{`ГЦН-${number}`}</b>
              <span>{isOff ? 'ОТКЛЮЧЕН' : 'РАБОТА'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

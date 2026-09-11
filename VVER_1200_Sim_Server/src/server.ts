/**
 * @file server.ts
 * @description Интеграционный сервер реального времени для ВВЭР-1200.
 * Обеспечивает WebSocket-стриминг телеметрии (20 Гц) и прием команд управления от Unity / панели экзаменатора.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { ReactorEngine } from './simulation/reactor-engine.js';
import { ControlInputs } from './core/types.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const engine = new ReactorEngine();

// Исходное стационарное состояние органов управления (100% Nnom)
function getDefaultInputs(): ControlInputs {
  return {
    rodPositionTarget: 0.70,
    rodControlMode: 'MANUAL',
    boronInjectionRate: 0.0,
    boronPumpActive: false,
    pureWaterPumpActive: false,
    turbineValveTarget: 1.00,
    turbineStopValvesOpen: true,
    feedwaterControlMode: 'AUTO',
    feedwaterFlowTarget: 1773.25,
    pzrControlMode: 'AUTO',
    pzrSprayValveTarget: 0.0,
    pzrHeaterPowerTarget: 0.18,
    rcpActive: [true, true, true, true],
    rcpSpeedTarget: 1.0,
    bruKTarget: -1, // -1 = AUTO
    bruATarget: -1, // -1 = AUTO
    gridConnected: true,
    manualScram: false
  };
}

let currentInputs: ControlInputs = getDefaultInputs();

// Функция применения управляющих команд
function applyCommand(cmd: { action: string; [key: string]: any }) {
  switch (cmd.action) {
    // 1. Воздействия сценариев инструктора / экзаменатора
    case 'INJECT_FAULT': {
      const fault = cmd.fault || cmd.value;
      console.log(`[SERVER] Инструктор инициировал воздействие: ${fault}`);
      switch (fault) {
        case 'RCP2_TRIP':
        case 'Отключение ГЦН-2':
          currentInputs.rcpActive[1] = false;
          break;
        case 'PRESSURE_SURGE':
        case 'Рост давления первого контура':
          currentInputs.pzrControlMode = 'MANUAL';
          currentInputs.pzrHeaterPowerTarget = 2.52; // Максимальная мощность ТЭН
          currentInputs.pzrSprayValveTarget = 0.0;  // Закрыт впрыск
          break;
        case 'SG_LEVEL_DROP':
        case 'Снижение уровня в ПГ':
          currentInputs.feedwaterControlMode = 'MANUAL';
          currentInputs.feedwaterFlowTarget = 400.0; // Снижение расхода питательной воды
          break;
        case 'GRID_LOSS':
        case 'Отключение генератора от сети':
          currentInputs.gridConnected = false;
          break;
        case 'AZ_TRIP':
        case 'Аварийная защита':
          currentInputs.manualScram = true;
          break;
      }
      break;
    }

    // 2. СУЗ и реактивность
    case 'SET_ROD_TARGET':
      currentInputs.rodPositionTarget = Math.max(0.0, Math.min(1.0, Number(cmd.value)));
      break;
    case 'SET_ROD_MODE':
      currentInputs.rodControlMode = cmd.value === 'AUTO' ? 'AUTO' : 'MANUAL';
      break;
    case 'SET_BORON_PUMP':
      currentInputs.boronPumpActive = Boolean(cmd.value);
      if (currentInputs.boronPumpActive) currentInputs.pureWaterPumpActive = false;
      break;
    case 'SET_PURE_WATER_PUMP':
      currentInputs.pureWaterPumpActive = Boolean(cmd.value);
      if (currentInputs.pureWaterPumpActive) currentInputs.boronPumpActive = false;
      break;
    case 'SET_BORON_RATE':
      currentInputs.boronInjectionRate = Number(cmd.value);
      break;
    case 'TRIP_AZ':
      currentInputs.manualScram = true;
      console.log('[SERVER] СРАБОТАЛА АВАРИЙНАЯ ЗАЩИТА АЗ-1 (РУЧНОЙ СБРОС СТЕРЖНЕЙ)!');
      break;

    // 3. Главные циркуляционные насосы (4 петли)
    case 'TOGGLE_RCP': {
      const pumpIdx = Number(cmd.index);
      if (pumpIdx >= 0 && pumpIdx < 4) {
        currentInputs.rcpActive[pumpIdx] = Boolean(cmd.value);
        console.log(`[SERVER] ГЦН-${pumpIdx + 1}: ${currentInputs.rcpActive[pumpIdx] ? 'ВКЛ' : 'ОТКЛ'}`);
      }
      break;
    }
    case 'SET_RCP_SPEED':
      currentInputs.rcpSpeedTarget = Math.max(0.2, Math.min(1.0, Number(cmd.value)));
      break;

    // 4. Компенсатор давления
    case 'SET_PZR_MODE':
      currentInputs.pzrControlMode = cmd.value === 'AUTO' ? 'AUTO' : 'MANUAL';
      break;
    case 'SET_PZR_SPRAY':
      currentInputs.pzrSprayValveTarget = Math.max(0.0, Math.min(1.0, Number(cmd.value)));
      break;
    case 'SET_PZR_HEATERS':
      currentInputs.pzrHeaterPowerTarget = Math.max(0.0, Math.min(2.52, Number(cmd.value)));
      break;

    // 5. Парогенераторы и питательная вода
    case 'SET_FW_MODE':
      currentInputs.feedwaterControlMode = cmd.value === 'AUTO' ? 'AUTO' : 'MANUAL';
      break;
    case 'SET_FW_FLOW':
      currentInputs.feedwaterFlowTarget = Math.max(0.0, Math.min(2400.0, Number(cmd.value)));
      break;

    // 6. Турбоустановка и редукционные установки
    case 'SET_TURBINE_VALVE':
      currentInputs.turbineValveTarget = Math.max(0.0, Math.min(1.1, Number(cmd.value)));
      break;
    case 'TRIP_TURBINE':
      currentInputs.turbineStopValvesOpen = Boolean(cmd.value);
      console.log(`[SERVER] Стопорные клапаны турбины (СК ТП): ${currentInputs.turbineStopValvesOpen ? 'ОТКРЫТЫ' : 'ПОСАЖЕНЫ (ТРИП ТУРБИНЫ)'}`);
      break;
    case 'SET_BRU_K':
      currentInputs.bruKTarget = Number(cmd.value);
      break;
    case 'SET_BRU_A':
      currentInputs.bruATarget = Number(cmd.value);
      break;
    case 'TOGGLE_GRID':
      currentInputs.gridConnected = Boolean(cmd.value);
      console.log(`[SERVER] Генератор: ${currentInputs.gridConnected ? 'ПОДКЛЮЧЕН К СЕТИ' : 'ОТКЛЮЧЕН ОТ СЕТИ'}`);
      break;

    // 7. Сброс блока в номинал 100%
    case 'RESET':
      currentInputs = getDefaultInputs();
      engine.reset();
      console.log('[SERVER] Энергоблок сброшен в исходный стационарный режим 100%');
      break;

    default:
      console.warn('[SERVER] Неизвестная команда:', cmd);
  }
}

// 1. Создаем HTTP сервер с CORS и REST-эндпоинтами
const server = http.createServer((req, res) => {
  // Настройка CORS для взаимодействия с панелью React
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);

  if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
    const htmlPath = path.resolve('TEST_DASHBOARD.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(htmlPath).pipe(res);
      return;
    }
  }

  if (parsedUrl.pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'online',
      simTime: engine.getState().simulationTime,
      inputs: currentInputs,
      isSteadyState: engine.getState().diagnostics.isSteadyState
    }));
    return;
  }

  if (parsedUrl.pathname === '/api/command' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const cmd = JSON.parse(body);
        applyCommand(cmd);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found. Open http://localhost:3000/');
});

// 2. Создаем WebSocket сервер поверх HTTP
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  console.log('[SERVER] Клиент подключился (панель экзаменатора / Unity 3D / пульт)');

  ws.on('message', (data: string) => {
    try {
      const cmd = JSON.parse(data.toString());
      applyCommand(cmd);
    } catch (e) {
      console.error('[SERVER] Ошибка разбора команды WebSocket:', e);
    }
  });

  ws.on('close', () => {
    console.log('[SERVER] Клиент отключился');
  });
});

// 3. Главный физический цикл симуляции Real-Time (20 Гц: dt = 0.05 с = 50 мс)
const DT = 0.05;
setInterval(() => {
  const state = engine.step(DT, currentInputs);

  const telemetry = {
    type: 'TELEMETRY',
    time: state.simulationTime,

    // Нейтроника и тепло
    powerMW: state.derived.Q_thermal,
    powerPct: state.derived.powerPercent,
    qFissMW: state.derived.Q_fiss,
    fuelTempC: state.derived.T_fuel_C,
    periodSec: state.derived.reactor_period_s,
    boronPpm: state.internal.C_boron,

    // Реактивность
    reactivityTotalPcm: state.derived.reactivity_total_pcm,
    reactivityDopplerPcm: state.derived.reactivity_doppler_pcm,
    reactivityCoolantPcm: state.derived.reactivity_coolant_pcm,
    reactivityRodsPcm: state.derived.reactivity_rods_pcm,
    reactivityBoronPcm: state.derived.reactivity_boron_pcm,

    // Первый контур
    pPrimMPa: state.derived.P_prim_MPa,
    coreInTempC: state.derived.T_core_in_C,
    coreOutTempC: state.derived.T_core_out_C,
    deltaTC: state.derived.deltaT_core,
    tCoolAvgC: state.derived.T_cool_avg_C,
    flowPrimKgS: state.internal.W_prim,
    levelPzrM: state.derived.level_pzr_m,
    pzrHeaterPowerMW: state.equipment.pzrHeaterPowerActual,
    pzrHeaterGroups: state.equipment.pzrHeaterGroupsActive,
    pzrSprayFlowKgS: state.equipment.pzrSprayFlowActual,

    // Главные насосы (4 петли)
    rcpStates: state.equipment.rcpStates,
    rcpCountActive: state.equipment.rcpCountActive,
    rcpSpeed: state.equipment.rcpSpeedActual,

    // Второй контур и ПГ
    pSecMPa: state.derived.P_sec_MPa,
    steamFlowKgS: state.derived.D_steam_total,
    turbFlowKgS: state.derived.D_turb,
    bruKFlowKgS: state.derived.D_bruK,
    bruAFlowKgS: state.derived.D_bruA,
    levelSgM: state.derived.level_sg_m,

    // Турбогенератор
    electricMW: state.derived.P_electric,
    turbMechMW: state.derived.N_turb_mech,
    turbRpm: (state.internal.omega_turb * 60) / (2 * Math.PI),
    freqHz: state.derived.frequency_Hz,
    turbineStopValvesOpen: state.equipment.turbineStopValvesOpen,
    gridBreakerClosed: state.equipment.gridBreakerClosed,

    // Органы управления
    rodPosActual: state.equipment.rodPositionActual,
    rodPosTarget: currentInputs.rodPositionTarget,
    valveActual: state.equipment.turbineValveActual,
    valveTarget: currentInputs.turbineValveTarget,
    pzrControlMode: currentInputs.pzrControlMode,
    fwControlMode: currentInputs.feedwaterControlMode,
    boronPumpRunning: state.equipment.boronPumpRunning,
    pureWaterPumpRunning: state.equipment.pureWaterPumpRunning,
    scramActive: state.equipment.scramActive,

    // 29 Сигнальных Ламп / Табло БЩУ
    lamps: state.alarms.lamps,

    // Диагностика
    diagnostics: {
      isSteadyState: state.diagnostics.isSteadyState,
      energyErrorMW: state.diagnostics.energyBalanceErrorMW,
      energyRelPct: state.diagnostics.energyBalanceRelPercent,
      numericalStable: state.diagnostics.numericalStable
    }
  };

  const message = JSON.stringify(telemetry);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}, DT * 1000);

server.listen(PORT, () => {
  console.log('========================================================================');
  console.log(`  [VVER-1200 SIM SERVER] СЕРВЕР СИМУЛЯЦИИ УСПЕШНО ЗАПУЩЕН!`);
  console.log(`  Порт: ${PORT}`);
  console.log(`  HTTP API: http://localhost:${PORT}/api/status`);
  console.log(`  WebSocket телеметрия (20 Гц): ws://localhost:${PORT}`);
  console.log(`  Тестовый веб-пульт: http://localhost:${PORT}`);
  console.log('========================================================================\n');
});

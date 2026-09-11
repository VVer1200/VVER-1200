/**
 * @file simulatorService.js
 * @description Модуль WebSocket связи клиентской панели экзаменатора с сервером симулятора ВВЭР-1200.
 */

const DEFAULT_WS_URL = process.env.REACT_APP_SIM_WS_URL || 'ws://localhost:3000';

export const ALARM_NAMES = {
  LAMP_AZ1: 'Срабатывание аварийной защиты АЗ-1 (сброс стержней СУЗ)',
  LAMP_AZ2: 'Срабатывание аварийной защиты АЗ-2',
  LAMP_PZ1: 'Срабатывание предупредительной защиты ПЗ-1',
  LAMP_CRIT_POWER: 'Превышение критической мощности > 107%',
  LAMP_CRIT_PERIOD: 'Критический период реактора < 10 с',
  LAMP_P_PRIM_HIGH_TRIP: 'Аварийное давление 1-го контура > 17.6 МПа',
  LAMP_P_PRIM_LOW_TRIP: 'Аварийное падение давления 1-го контура < 14.5 МПа',
  LAMP_T_OUT_HIGH_TRIP: 'Аварийная температура на выходе АЗ > 335 °C',
  LAMP_SG_LEVEL_LOW_TRIP: 'Аварийный уровень в парогенераторе < 1.8 м',
  LAMP_TURBINE_TRIPPED: 'Срабатывание стопорных клапанов турбины (СК ТП)',
  LAMP_GRID_DISCONNECT: 'Отключение генератора от энергосистемы',
  LAMP_POWER_WARN: 'Предупредительная сигнализация: мощность > 104%',
  LAMP_PERIOD_WARN: 'Предупредительная сигнализация: период < 20 с',
  LAMP_P_PRIM_WARN: 'Предупредительная сигнализация: давление P1 > 16.6 МПа',
  LAMP_P_SEC_WARN: 'Предупредительная сигнализация: давление P2 > 7.5 МПа',
  LAMP_SG_LEVEL_HIGH: 'Предупредительная сигнализация: высокий уровень в ПГ',
  LAMP_RCP1_OFF: 'Отключение ГЦН-1',
  LAMP_RCP2_OFF: 'Отключение ГЦН-2',
  LAMP_RCP3_OFF: 'Отключение ГЦН-3',
  LAMP_RCP4_OFF: 'Отключение ГЦН-4',
  LAMP_BRU_K_OPEN: 'Открытие сбросных клапанов БРУ-К',
  LAMP_BRU_A_OPEN: 'Открытие сбросных клапанов БРУ-А',
  LAMP_PZR_HEATERS_FULL: 'ТЭН компенсатора давления включены на максимум',
  LAMP_PZR_SPRAY_ON: 'Впрыск в компенсатор давления включен',
  LAMP_BORON_INJECTION: 'Подача борного концентрата в 1-й контур',
  LAMP_PURE_WATER: 'Подача чистой воды (дилюция)',
};

class SimulatorService {
  constructor() {
    this.ws = null;
    this.url = DEFAULT_WS_URL;
    this.status = 'disconnected'; // 'connected' | 'connecting' | 'disconnected'
    this.reconnectTimer = null;
    this.telemetryListeners = new Set();
    this.statusListeners = new Set();
    this.alarmListeners = new Set();
    this.lastLamps = {};
    this.lastTelemetry = null;
    this.lastUpdateTimestamp = 0;
  }

  connect(url = DEFAULT_WS_URL) {
    this.url = url;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this._setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this._setStatus('connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onclose = () => {
        this._setStatus('disconnected');
        this._scheduleReconnect();
      };

      this.ws.onerror = () => {
        this._setStatus('disconnected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TELEMETRY') {
            this._handleTelemetry(data);
          }
        } catch (e) {
          console.error('[SimulatorService] Ошибка парсинга сообщения:', e);
        }
      };
    } catch (e) {
      this._setStatus('disconnected');
      this._scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._setStatus('disconnected');
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.url);
    }, 2000);
  }

  _setStatus(status) {
    if (this.status !== status) {
      this.status = status;
      this.statusListeners.forEach((listener) => listener(status));
    }
  }

  _handleTelemetry(data) {
    // Проверка новых аварийных ламп
    if (data.lamps) {
      for (const [lampId, active] of Object.entries(data.lamps)) {
        if (active && !this.lastLamps[lampId] && ALARM_NAMES[lampId]) {
          const alarmText = ALARM_NAMES[lampId];
          this.alarmListeners.forEach((listener) => listener({ id: lampId, text: alarmText }));
        }
      }
      this.lastLamps = { ...data.lamps };
    }

    // Нормализация параметров для UI
    const mapped = {
      power: Number(data.powerPct.toFixed(2)),
      powerMW: Number(data.powerMW.toFixed(1)),
      primaryPressure: Number(data.pPrimMPa.toFixed(2)),
      outletTemp: Number(data.coreOutTempC.toFixed(1)),
      inletTemp: Number(data.coreInTempC.toFixed(1)),
      deltaT: Number(data.deltaTC.toFixed(1)),
      sgLevel: Number(data.levelSgM.toFixed(2)),
      secondaryPressure: Number(data.pSecMPa.toFixed(2)),
      electric: Math.round(data.electricMW),
      rpm: Math.round(data.turbRpm),
      freq: Number(data.freqHz.toFixed(2)),
      flowPrimKgS: Math.round(data.flowPrimKgS),
      levelPzrM: Number(data.levelPzrM.toFixed(2)),
      rcpStates: Array.isArray(data.rcpStates) ? data.rcpStates : [true, true, true, true],
      rcpCountActive: data.rcpCountActive ?? 4,
      rodPosActual: Number((data.rodPosActual * 100).toFixed(1)),
      rodPosTarget: Number((data.rodPosTarget * 100).toFixed(1)),
      valveActual: Number((data.valveActual * 100).toFixed(1)),
      scramActive: Boolean(data.scramActive),
      turbineStopValvesOpen: Boolean(data.turbineStopValvesOpen),
      gridBreakerClosed: Boolean(data.gridBreakerClosed),
      boronPpm: Number(data.boronPpm.toFixed(1)),
      fuelTempC: Number(data.fuelTempC.toFixed(1)),
      reactivityTotalPcm: Number(data.reactivityTotalPcm.toFixed(1)),
      lamps: data.lamps || {},
      diagnostics: data.diagnostics || {},
      simTime: data.time || 0,
      isRealData: true,
    };

    this.lastTelemetry = mapped;

    // Ограничение частоты обновления слушателей React до 10-15 раз в секунду (плавный UI без перегрузки CPU)
    const now = Date.now();
    if (now - this.lastUpdateTimestamp >= 70) {
      this.lastUpdateTimestamp = now;
      this.telemetryListeners.forEach((listener) => listener(mapped));
    }
  }

  // Подписки
  onTelemetry(listener) {
    this.telemetryListeners.add(listener);
    if (this.lastTelemetry) listener(this.lastTelemetry);
    return () => this.telemetryListeners.delete(listener);
  }

  onStatusChange(listener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  onAlarm(listener) {
    this.alarmListeners.add(listener);
    return () => this.alarmListeners.delete(listener);
  }

  // Отправка управляющих команд на сервер
  sendCmd(action, value) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = typeof value === 'object' ? { action, ...value } : { action, value };
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    console.warn('[SimulatorService] Команда не отправлена: нет соединения с сервером');
    return false;
  }

  // Специфические воздействия экзаменатора
  injectEvent(label) {
    switch (label) {
      case 'Отключение ГЦН-2':
        return this.tripRcp(1);
      case 'Рост давления первого контура':
        return this.injectPressureSurge();
      case 'Снижение уровня в ПГ':
        return this.injectSgLevelDrop();
      case 'Отключение генератора от сети':
        return this.tripGrid();
      case 'Сброс АЗ-1':
        return this.tripAz();
      default:
        return this.sendCmd('INJECT_FAULT', { fault: label });
    }
  }

  tripRcp(index = 1) {
    return this.sendCmd('TOGGLE_RCP', { index, value: false });
  }

  restoreRcp(index = 1) {
    return this.sendCmd('TOGGLE_RCP', { index, value: true });
  }

  injectPressureSurge() {
    this.sendCmd('SET_PZR_MODE', 'MANUAL');
    this.sendCmd('SET_PZR_HEATERS', 2.52);
    return this.sendCmd('SET_PZR_SPRAY', 0.0);
  }

  injectSgLevelDrop() {
    this.sendCmd('SET_FW_MODE', 'MANUAL');
    return this.sendCmd('SET_FW_FLOW', 400.0);
  }

  tripGrid() {
    return this.sendCmd('TOGGLE_GRID', false);
  }

  tripAz() {
    return this.sendCmd('TRIP_AZ', true);
  }

  resetSim() {
    return this.sendCmd('RESET', true);
  }
}

export const simulatorService = new SimulatorService();
export default simulatorService;

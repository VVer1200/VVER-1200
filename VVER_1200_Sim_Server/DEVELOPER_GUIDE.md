# Руководство разработчика по интеграции с симулятором ВВЭР-1200
*(Developer & Integration Guide: VVER-1200 Simulation Engine)*

Данный документ предназначен для разработчиков клиентских приложений (**Unity 3D**, **React / Web БЩУ**, аналитических систем), подключающихся к математическому движку энергоблока ВВЭР-1200.

Документ описывает архитектуру системы, протокол сетевого взаимодействия, структуру данных телеметрии, систему светосигнальных табло, команды управления и содержит готовые примеры кода для **C# (Unity)** и **TypeScript (React/Web)**.

Базовый справочник сигналов и уставок: [`DATA_DICTIONARY_VVER1200.txt`](./DATA_DICTIONARY_VVER1200.txt).

---

## 1. Архитектура и принцип работы системы

```
+-------------------------------------------------------------------------+
|                  VVER-1200 SIMULATION ENGINE (Node.js / TS)             |
|                                                                         |
|   +-----------------------+     dt=0.05s     +----------------------+   |
|   | 6-group Point Kinetics| -------------->  | Thermohydraulics     |   |
|   | & Decay Heat (ODE)    |                  | (Core, Loops, PZR)   |   |
|   +-----------------------+                  +----------------------+   |
|               ^                                          |              |
|               | Feedbacks (Doppler, Coolant, Boron)       v              |
|   +-----------------------+                  +----------------------+   |
|   | Protection & Lamps    | <--------------  | Steam Generators     |   |
|   | (AZ-1, PZ-1, Alarms)  |                  | & Turbine Generator  |   |
|   +-----------------------+                  +----------------------+   |
|                               |                                         |
|                   Broadcast (20 Hz, JSON)                               |
|                               v                                         |
|                 WebSocket Server (Port 3000)                            |
+-------------------------------------------------------------------------+
              |                                            |
              | ws://localhost:3000                        | ws://localhost:3000
              v                                            v
+---------------------------+                +----------------------------+
|     UNITY 3D CLIENT       |                |     REACT / WEB DASHBOARD  |
|  * 3D Лампочки и табло    |                |  * Цифровые индикаторы     |
|  * Анимация стержней СУЗ  |                |  * Мнемосхема энергоблока  |
|  * Органы управления БЩУ  |                |  * Графики переходных проц.|
+---------------------------+                +----------------------------+
```

### Ключевые особенности движка:
1. **Строгая причинно-следственная физика**: Модель не использует визуальных «фейков» или мгновенных скачков. Все изменения (мощность, температура топлива, давление пара, выбег ротора) рассчитываются через систему обыкновенных дифференциальных уравнений (ОДУ).
2. **Детерминизм и такт расчета**: Шаг дискретизации составляет Delta t = 0.05$ с ($50$ мс).
3. **Частота обновления по сети**: 20 кадров в секунду ($20$ Гц).
4. **Двусторонний обмен (Full-Duplex)**: Клиент слушает широковещательный поток телеметрии и в любой момент может отправить JSON-команду на изменение органов управления.

---

## 2. Быстрый старт

### Требования к окружению:
* Node.js версии **18.0+** или **20.0+**
* Менеджер пакетов `npm`

### Запуск симулятора:
```bash
# 1. Установка зависимостей проекта (если еще не установлены)
npm install

# 2. Запуск валидационных тестов физики (16 автоматических тестов)
npm run simulation:test

# 3. Запуск сервера симуляции в режиме реального времени
npm run TEST:SERVER
```

После запуска:
* **HTTP Веб-пульт оператора**: откройте в браузере `http://localhost:3000`
* **WebSocket эндпоинт для Unity/клиентов**: `ws://localhost:3000`

---

## 3. Сетевой протокол обмена (WebSocket API)

* **Транспорт**: WebSocket (RFC 6455)
* **URL по умолчанию**: `ws://localhost:3000` (порт задается переменной среды `PORT`)
* **Формат сообщений**: UTF-8 текстовые строки в формате JSON

---

## 4. Телеметрия от сервера (Пакет `TELEMETRY`)

Каждые $50$ мс сервер рассылает всем подключенным клиентам JSON следующего вида:

```json
{
  "type": "TELEMETRY",
  "time": 12.45,

  "powerMW": 3200.0,
  "powerPct": 100.0,
  "qFissMW": 3008.0,
  "fuelTempC": 600.0,
  "periodSec": 999.0,
  "boronPpm": 550.0,

  "reactivityTotalPcm": 0.0,
  "reactivityDopplerPcm": -5.2,
  "reactivityCoolantPcm": 2.1,
  "reactivityRodsPcm": 0.0,
  "reactivityBoronPcm": 0.0,

  "pPrimMPa": 16.20,
  "coreInTempC": 298.2,
  "coreOutTempC": 328.6,
  "deltaTC": 30.4,
  "tCoolAvgC": 313.4,
  "flowPrimKgS": 17600.0,
  "levelPzrM": 7.85,
  "pzrHeaterPowerMW": 0.45,
  "pzrHeaterGroups": 1,
  "pzrSprayFlowKgS": 0.0,

  "rcpStates": [true, true, true, true],
  "rcpCountActive": 4,
  "rcpSpeed": 1.0,

  "pSecMPa": 7.00,
  "steamFlowKgS": 1773.25,
  "turbFlowKgS": 1773.25,
  "bruKFlowKgS": 0.0,
  "bruAFlowKgS": 0.0,
  "levelSgM": 2.40,

  "electricMW": 1185.7,
  "turbMechMW": 1209.9,
  "turbRpm": 3000.0,
  "freqHz": 50.0,
  "turbineStopValvesOpen": true,
  "gridBreakerClosed": true,

  "rodPosActual": 0.70,
  "rodPosTarget": 0.70,
  "valveActual": 1.00,
  "valveTarget": 1.00,
  "pzrControlMode": "AUTO",
  "fwControlMode": "AUTO",
  "boronPumpRunning": false,
  "pureWaterPumpRunning": false,
  "scramActive": false,

  "lamps": {
    "LAMP_AZ1": false,
    "LAMP_AZ2": false,
    "LAMP_PZ1": false,
    "LAMP_CRIT_POWER": false,
    "LAMP_CRIT_PERIOD": false,
    "LAMP_P_PRIM_HIGH_TRIP": false,
    "LAMP_P_PRIM_LOW_TRIP": false,
    "LAMP_T_OUT_HIGH_TRIP": false,
    "LAMP_SG_LEVEL_LOW_TRIP": false,
    "LAMP_TURBINE_TRIPPED": false,
    "LAMP_GRID_DISCONNECT": false,

    "LAMP_POWER_WARN": false,
    "LAMP_PERIOD_WARN": false,
    "LAMP_P_PRIM_WARN": false,
    "LAMP_P_SEC_WARN": false,
    "LAMP_SG_LEVEL_HIGH": false,
    "LAMP_RCP1_OFF": false,
    "LAMP_RCP2_OFF": false,
    "LAMP_RCP3_OFF": false,
    "LAMP_RCP4_OFF": false,
    "LAMP_BRU_K_OPEN": false,
    "LAMP_BRU_A_OPEN": false,
    "LAMP_PZR_HEATERS_FULL": false,
    "LAMP_PZR_SPRAY_ON": false,
    "LAMP_BORON_INJECTION": false,
    "LAMP_PURE_WATER": false,

    "LAMP_STEADY_STATE": true,
    "LAMP_GRID_SYNC": true,
    "LAMP_ROD_TOP": false,
    "LAMP_ROD_BOTTOM": false,
    "LAMP_AUTO_PRESSURE": true,
    "LAMP_AUTO_LEVEL_SG": true
  }
}
```

---

## 5. Светосигнальные лампы и табло (Объект `lamps`)

Объект `lamps` содержит **29 дискретных булевых флагов**. В 3D-модели пульта БЩУ рекомендуется назначать материалам соответствующие эмиссионные цвета:

### 🔴 Красные аварийные табло (Emergency Trips)
*Цвет свечения: Ярко-красный (`#FF2222`), пульсация при срабатывании + звуковой сигнал сирены.*

1. `LAMP_AZ1` — Срабатывание Аварийной Защиты 1-го рода (АЗ-1, сброс стержней СУЗ).
2. `LAMP_AZ2` — Срабатывание Аварийной Защиты 2-го рода (АЗ-2).
3. `LAMP_PZ1` — Срабатывание Предупредительной Защиты (ПЗ-1).
4. `LAMP_CRIT_POWER` — Аварийная мощность реактора ($> 107\%$ / $> 3424$ МВт).
5. `LAMP_CRIT_PERIOD` — Аварийно малый период разгона ($0 < T_{per} < 10$ с).
6. `LAMP_P_PRIM_HIGH_TRIP` — Аварийно высокое давление 1 контура ($> 17.6$ МПа).
7. `LAMP_P_PRIM_LOW_TRIP` — Аварийно низкое давление 1 контура ($< 14.5$ МПа).
8. `LAMP_T_OUT_HIGH_TRIP` — Аварийная температура на выходе ($> 335.0^\circ$C).
9. `LAMP_SG_LEVEL_LOW_TRIP` — Аварийно низкий уровень в ПГ ($< 1.8$ м).
10. `LAMP_TURBINE_TRIPPED` — Аварийный останов турбины (ТСК захлопнуты).
11. `LAMP_GRID_DISCONNECT` — Разрыв связи генератора с энергосистемой.

### 🟡 Желтые предупредительные табло (Warnings & Off-normal)
*Цвет свечения: Янтарно-желтый (`#FFB300`).*

12. `LAMP_POWER_WARN` — Предупреждение по мощности ($> 104\%$).
13. `LAMP_PERIOD_WARN` — Предупреждение по периоду ($0 < T_{per} < 20$ с).
14. `LAMP_P_PRIM_WARN` — Давление 1 контура выше нормы ($> 16.6$ МПа).
15. `LAMP_P_SEC_WARN` — Давление пара выше нормы ($> 7.5$ МПа).
16. `LAMP_SG_LEVEL_HIGH` — Высокий уровень воды в ПГ ($> 2.6$ м).
17. `LAMP_RCP1_OFF` — Отключен ГЦН петли №1.
18. `LAMP_RCP2_OFF` — Отключен ГЦН петли №2.
19. `LAMP_RCP3_OFF` — Отключен ГЦН петли №3.
20. `LAMP_RCP4_OFF` — Отключен ГЦН петли №4.
21. `LAMP_BRU_K_OPEN` — Открыт сброс пара в конденсатор (БРУ-К).
22. `LAMP_BRU_A_OPEN` — Открыт сброс пара в атмосферу (БРУ-А).
23. `LAMP_PZR_HEATERS_FULL` — Включены все группы ТЭН КД (100%).
24. `LAMP_PZR_SPRAY_ON` — Работает впрыск холодной воды в КД.
25. `LAMP_BORON_INJECTION` — Включен насос концентрированного бора.
26. `LAMP_PURE_WATER` — Включен насос чистой воды (деборирование).

### 🟢 Зеленые и синие индикаторы состояния (Normal Status)
*Цвет свечения: Зеленый (`#00E676`) или Холодно-белый/Синий (`#29B6F6`).*

27. `LAMP_STEADY_STATE` — Реакторная установка стабильна (производные параметров близки к 0).
28. `LAMP_GRID_SYNC` — Генератор синхронизирован с сетью 50 Гц.
29. `LAMP_ROD_TOP` — Стержни СУЗ на верхнем концевике ($100\%$).
30. `LAMP_ROD_BOTTOM` — Стержни СУЗ на нижнем концевике ($0\%$).
31. `LAMP_AUTO_PRESSURE` — Работает авторегулятор давления 1 контура.
32. `LAMP_AUTO_LEVEL_SG` — Работает авторегулятор уровня парогенератора.

---

## 6. Команды управления (От клиента к серверу)

Клиент отправляет команды в формате JSON через тот же сокет:
`ws.send(JSON.stringify({ type: "...", ... }))`.

### Реактор и СУЗ
* **Перемещение стержней СУЗ**:
  `{ "type": "SET_RODS", "value": 0.75 }`
  `value`: число от `0.0` (полностью погружены) до `1.0` (полностью извлечены).
* **Кнопка АЗ-1 (Аварийная защита)**:
  `{ "type": "TRIP_AZ" }`
  Сбрасывает все стержни вниз под действием гравитации за $2.5$ с.

### Главные циркуляционные насосы (4 петли)
* **Пуск / Останов конкретного ГЦН**:
  `{ "type": "TOGGLE_RCP", "index": 0, "value": false }`
  `index`: номер насоса от `0` до `3` (`0` = ГЦН-1, `1` = ГЦН-2, `2` = ГЦН-3, `3` = ГЦН-4).
  `value`: `true` (включить) или `false` (отключить).
* **Скорость вращения ГЦН**:
  `{ "type": "SET_RCP_SPEED", "value": 0.8 }` (`value`: от `0.2` до `1.0`).

### Компенсатор давления (КД)
* **Режим регулятора давления**:
  `{ "type": "SET_PZR_MODE", "value": "MANUAL" }` (значения: `"AUTO"` или `"MANUAL"`).
* **Управление ТЭН (в ручном режиме)**:
  `{ "type": "SET_PZR_HEATERS", "value": 2.52 }` (мощность в МВт от `0.0` до `2.52`).
* **Управление впрыском (в ручном режиме)**:
  `{ "type": "SET_PZR_SPRAY", "value": 0.5 }` (открытие клапана от `0.0` до `1.0`).

### Парогенераторы и питательная вода
* **Режим регулятора питательной воды**:
  `{ "type": "SET_FW_MODE", "value": "MANUAL" }` (значения: `"AUTO"` или `"MANUAL"`).
* **Расход питательной воды (в ручном режиме)**:
  `{ "type": "SET_FW_FLOW", "value": 1900.0 }` (расход в кг/с от `0.0` до `2400.0`).

### Турбина и генератор
* **Регулирующий клапан турбины**:
  `{ "type": "SET_TURBINE_VALVE", "value": 0.95 }` (от `0.0` до `1.1`).
* **Аварийный сброс турбины (ТСК)**:
  `{ "type": "TRIP_TURBINE", "value": false }` (`false` = закрыть ТСК, `true` = открыть).
* **Связь генератора с энергосетью**:
  `{ "type": "TOGGLE_GRID", "value": false }` (`true` = в сети, `false` = отключен).

### Борное регулирование
* **Насос борного концентрата**:
  `{ "type": "SET_BORON_PUMP", "value": true }` (`true` = пуск, `false` = стоп).
* **Насос чистой воды (дилюция)**:
  `{ "type": "SET_PURE_WATER_PUMP", "value": true }` (`true` = пуск, `false` = стоп).
* **Скорость ввода бора**:
  `{ "type": "SET_BORON_RATE", "value": 0.5 }` (ppm/с, от `-2.0` до `+2.0`).

### Сбросные устройства пара
* **Клапан БРУ-К (сброс в конденсатор)**:
  `{ "type": "SET_BRU_K", "value": 0.4 }` (от `0.0` до `1.0`, `-1` = автомат).
* **Клапан БРУ-А (сброс в атмосферу)**:
  `{ "type": "SET_BRU_A", "value": 0.2 }` (от `0.0` до `1.0`, `-1` = автомат).

### Сброс модели к исходному состоянию
* **Сброс в 100% номинал**:
  `{ "type": "RESET" }`

---

## 7. Пример интеграции в Unity 3D (C#)

Ниже приведен готовый компонент `VVER1200Client.cs` для Unity, использующий стандартный `System.Net.WebSockets.ClientWebSocket`:

```csharp
using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Net.WebSockets;
using UnityEngine;

[Serializable]
public class AnnunciatorLampsData {
    public bool LAMP_AZ1;
    public bool LAMP_AZ2;
    public bool LAMP_PZ1;
    public bool LAMP_CRIT_POWER;
    public bool LAMP_CRIT_PERIOD;
    public bool LAMP_P_PRIM_HIGH_TRIP;
    public bool LAMP_P_PRIM_LOW_TRIP;
    public bool LAMP_T_OUT_HIGH_TRIP;
    public bool LAMP_SG_LEVEL_LOW_TRIP;
    public bool LAMP_TURBINE_TRIPPED;
    public bool LAMP_GRID_DISCONNECT;

    public bool LAMP_POWER_WARN;
    public bool LAMP_PERIOD_WARN;
    public bool LAMP_P_PRIM_WARN;
    public bool LAMP_P_SEC_WARN;
    public bool LAMP_SG_LEVEL_HIGH;
    public bool LAMP_RCP1_OFF;
    public bool LAMP_RCP2_OFF;
    public bool LAMP_RCP3_OFF;
    public bool LAMP_RCP4_OFF;
    public bool LAMP_BRU_K_OPEN;
    public bool LAMP_BRU_A_OPEN;
    public bool LAMP_PZR_HEATERS_FULL;
    public bool LAMP_PZR_SPRAY_ON;
    public bool LAMP_BORON_INJECTION;
    public bool LAMP_PURE_WATER;

    public bool LAMP_STEADY_STATE;
    public bool LAMP_GRID_SYNC;
    public bool LAMP_ROD_TOP;
    public bool LAMP_ROD_BOTTOM;
    public bool LAMP_AUTO_PRESSURE;
    public bool LAMP_AUTO_LEVEL_SG;
}

[Serializable]
public class TelemetryPacket {
    public string type;
    public double time;

    public float powerMW;
    public float powerPct;
    public float fuelTempC;
    public float periodSec;
    public float boronPpm;

    public float pPrimMPa;
    public float coreInTempC;
    public float coreOutTempC;
    public float deltaTC;
    public float flowPrimKgS;
    public float levelPzrM;

    public bool[] rcpStates;
    public int rcpCountActive;

    public float pSecMPa;
    public float steamFlowKgS;
    public float levelSgM;

    public float electricMW;
    public float turbRpm;
    public float freqHz;
    public bool turbineStopValvesOpen;

    public float rodPosActual;
    public float rodPosTarget;

    public AnnunciatorLampsData lamps;
}

public class VVER1200Client : MonoBehaviour {
    [Header("Network Settings")]
    [SerializeField] private string serverUrl = "ws://localhost:3000";

    [Header("Current Live Telemetry")]
    public TelemetryPacket latestTelemetry;

    private ClientWebSocket _ws;
    private CancellationTokenSource _cts;

    public event Action<TelemetryPacket> OnTelemetryReceived;

    async void Start() {
        _cts = new CancellationTokenSource();
        await ConnectToServer();
    }

    private async Task ConnectToServer() {
        _ws = new ClientWebSocket();
        try {
            Debug.Log($"[VVER1200] Подключение к симулятору: {serverUrl}...");
            await _ws.ConnectAsync(new Uri(serverUrl), _cts.Token);
            Debug.Log("[VVER1200] Успешно подключено к WebSocket серверу!");
            _ = ReceiveLoop();
        } catch (Exception ex) {
            Debug.LogError($"[VVER1200] Ошибка подключения: {ex.Message}");
        }
    }

    private async Task ReceiveLoop() {
        var buffer = new byte[16384];
        while (_ws.State == WebSocketState.Open && !_cts.IsCancellationRequested) {
            try {
                var result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), _cts.Token);
                if (result.MessageType == WebSocketMessageType.Close) {
                    await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, CancellationToken.None);
                    break;
                }

                string json = Encoding.UTF8.GetString(buffer, 0, result.Count);
                var packet = JsonUtility.FromJson<TelemetryPacket>(json);
                if (packet != null && packet.type == "TELEMETRY") {
                    latestTelemetry = packet;
                    OnTelemetryReceived?.Invoke(packet);
                }
            } catch (Exception ex) {
                Debug.LogWarning($"[VVER1200] Ошибка чтения сокета: {ex.Message}");
                break;
            }
        }
    }

    // --- Методы отправки команд управления ---

    public async void SendCommand(string jsonCommand) {
        if (_ws != null && _ws.State == WebSocketState.Open) {
            byte[] bytes = Encoding.UTF8.GetBytes(jsonCommand);
            await _ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, _cts.Token);
        }
    }

    public void SetRodPosition(float target0to1) {
        SendCommand($"{{\"type\":\"SET_RODS\",\"value\":{target0to1:F3}}}");
    }

    public void TripAZ1() {
        SendCommand("{\"type\":\"TRIP_AZ\"}");
    }

    public void ToggleRCP(int pumpIndex, bool active) {
        SendCommand($"{{\"type\":\"TOGGLE_RCP\",\"index\":{pumpIndex},\"value\":{active.ToString().ToLower()}}}");
    }

    public void SetPzrMode(bool autoMode) {
        string mode = autoMode ? "AUTO" : "MANUAL";
        SendCommand($"{{\"type\":\"SET_PZR_MODE\",\"value\":\"{mode}\"}}");
    }

    public void SetFeedwaterMode(bool autoMode) {
        string mode = autoMode ? "AUTO" : "MANUAL";
        SendCommand($"{{\"type\":\"SET_FW_MODE\",\"value\":\"{mode}\"}}");
    }

    public void TripTurbine(bool tripped) {
        // false = закрыть ТСК (трип), true = открыть ТСК
        SendCommand($"{{\"type\":\"TRIP_TURBINE\",\"value\":{(!tripped).ToString().ToLower()}}}");
    }

    public void ResetSimulation() {
        SendCommand("{\"type\":\"RESET\"}");
    }

    void OnDestroy() {
        _cts?.Cancel();
        _ws?.Dispose();
    }
}
```

### Скрипт 3D-лампочки на пульте Unity (`AnnunciatorBulb.cs`):
```csharp
using UnityEngine;

public class AnnunciatorBulb : MonoBehaviour {
    [SerializeField] private MeshRenderer bulbMesh;
    [SerializeField] private Light bulbLight;
    [SerializeField] private Color emissionColor = Color.red;

    public void SetActive(bool isActive) {
        if (bulbLight != null) bulbLight.enabled = isActive;
        if (bulbMesh != null) {
            Material mat = bulbMesh.material;
            if (isActive) {
                mat.EnableKeyword("_EMISSION");
                mat.SetColor("_EmissionColor", emissionColor * 2.5f);
            } else {
                mat.DisableKeyword("_EMISSION");
                mat.SetColor("_EmissionColor", Color.black);
            }
        }
    }
}
```

---

## 8. Пример интеграции в React / Web (TypeScript)

Хук `useReactorTelemetry.ts`:

```typescript
import { useEffect, useState, useRef } from 'react';

export function useReactorTelemetry(url = 'ws://localhost:3000') {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'TELEMETRY') {
          setTelemetry(data);
        }
      } catch (err) {
        console.error('Ошибка парсинга телеметрии:', err);
      }
    };

    return () => ws.close();
  }, [url]);

  const sendCommand = (cmd: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    }
  };

  return { telemetry, connected, sendCommand };
}
```

---

## 9. Руководство по модификации физического ядра

Если требуется расширить математическую модель или добавить новые параметры, соблюдайте модульную структуру каталога `src/`:

1. `src/core/types.ts` — Добавление новых переменных состояния, параметров телеметрии или ламп.
2. `src/core/parameters.ts` — Реестр физических констант энергоблока ВВЭР-1200.
3. `src/neutronics/neutronics-subsystem.ts` — Точечная кинетика нейтронов (6 групп), остаточное тепловыделение и баланс реактивностей.
4. `src/thermal/thermal-subsystem.ts` — Теплопередача в активной зоне (двухузловая модель: топливо + теплоноситель).
5. `src/primary/primary-loop-subsystem.ts` — Термогидравлика 4 петель, ГЦН, гидродинамика и компенсатор давления.
6. `src/secondary/steam-generator-subsystem.ts` — Парогенераторы ПГВ-1000МКП, кипение, уровень и давление свежего пара.
7. `src/turbine/turbine-generator-subsystem.ts` — Турбина, конус Стодолы, инерция вала и генератор.
8. `src/protection/protection-subsystem.ts` — Уставки срабатывания АЗ/ПЗ и расчет всех 29 ламп сигнализатора.
9. `src/simulation/reactor-engine.ts` — Главный координатор шага симуляции (`engine.step(dt, inputs)`).
10. `src/validation/run-tests.ts` — Набор из 16 автоматических регрессионных физических тестов.

> **Важное правило:** После любых изменений в физических подсистемах **обязательно** запускайте валидацию:
> ```bash
> npm run simulation:test
> ```
> Все 16 тестов должны проходить успешно со статусом `PASS`.

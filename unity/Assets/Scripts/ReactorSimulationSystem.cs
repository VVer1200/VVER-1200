using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// Central simulation engine for the nuclear reactor control room.
/// Integrates with the VVER-1200 real-time Node.js/TypeScript simulation server on localhost:3000
/// with automatic offline physics fallback.
/// </summary>
public class ReactorSimulationSystem : MonoBehaviour
{
    public static ReactorSimulationSystem Instance { get; private set; }

    [Header("VVER-1200 Server Integration")]
    public string serverBaseUrl = "http://localhost:3000";
    public bool isConnectedToServer = false;
    public string serverStatusString = "Инициализация...";

    [Header("Reactor Core State")]
    [Range(0f, 3600f)] public float thermalPower = 3200f; // MW(th)
    [Range(0f, 100f)] public float controlRodsPosition = 30f; // % inserted (0% = extracted, 100% = inserted)
    public float reactivity = 0f; // pcm
    public float fuelTemperature = 850f; // °C
    public float reactorPeriod = 9999f; // sec
    public float targetPower = 3200f;
    public bool isAutomaticControl = true;
    public bool isScramActive = false; // AZ-1 / AZ-5 emergency scram

    [Header("Primary Cooling Loop (Loop 1)")]
    public float primaryPressure = 16.2f; // MPa (nominal 16.2)
    public float coolantTempIn = 298.2f; // °C
    public float coolantTempOut = 328.9f; // °C
    public float totalCoolantFlow = 86000f; // kg/s
    public float pzrLevel = 8.45f; // m
    public float[] pumpSpeeds = new float[4] { 100f, 100f, 100f, 100f }; // %
    public bool[] pumpActive = new bool[4] { true, true, true, true };

    [Header("Secondary Loop & Turbine (Loop 2)")]
    public float secondaryPressure = 7.0f; // MPa
    public float steamFlow = 1773f; // kg/s
    public float turbineRPM = 3000f; // RPM
    public float electricPower = 1200f; // MW(e)
    public float gridFrequency = 50.0f; // Hz
    public bool turbineOnline = true;
    public bool gridConnected = true;

    [Header("Radiation & Safety")]
    public float radiationControlRoom = 12f; // uR/h (safe background)
    public float radiationReactorHall = 18f; // uR/h
    public bool safetyECCS = true; // САОЗ
    public bool containmentSealed = true; // Гермооболочка

    [Header("Event Log")]
    public List<string> eventLog = new List<string>();
    public event Action OnStateChanged;

    private Coroutine _syncCoroutine;
    private float _timeSinceLastUpdate = 0f;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    private void Start()
    {
        LogEvent($"[{GetTimestamp()}] Симулятор ВВЭР-1200 инициализирован.");
        _syncCoroutine = StartCoroutine(SyncWithVverServerCoroutine());
    }

    private void OnDestroy()
    {
        if (_syncCoroutine != null) StopCoroutine(_syncCoroutine);
    }

    private void Update()
    {
        if (!isConnectedToServer)
        {
            // Fallback: run simplified local physics loop if server is not reachable
            RunLocalPhysicsFallback();
        }

        _timeSinceLastUpdate += Time.deltaTime;
        if (_timeSinceLastUpdate >= 0.1f)
        {
            _timeSinceLastUpdate = 0f;
            OnStateChanged?.Invoke();
        }
    }

    #region VVER-1200 Server Networking

    private IEnumerator SyncWithVverServerCoroutine()
    {
        var wait = new WaitForSeconds(0.08f); // 12-15 Hz sync

        while (true)
        {
            using (UnityWebRequest req = UnityWebRequest.Get($"{serverBaseUrl}/api/telemetry"))
            {
                req.timeout = 2;
                yield return req.SendWebRequest();

                if (req.result == UnityWebRequest.Result.Success)
                {
                    string json = req.downloadHandler.text;
                    ParseTelemetry(json);
                    if (!isConnectedToServer)
                    {
                        isConnectedToServer = true;
                        serverStatusString = "<color=green>СЕРВЕР ВВЭР-1200: ОНЛАЙН (3000)</color>";
                        LogEvent($"[{GetTimestamp()}] Соединение с сервером ВВЭР-1200 (localhost:3000) УСТАНОВЛЕНО.");
                    }
                }
                else
                {
                    if (isConnectedToServer)
                    {
                        isConnectedToServer = false;
                        serverStatusString = "<color=yellow>СЕРВЕР: АВТОНОМНЫЙ РЕЖИМ (Связь потеряна)</color>";
                        LogEvent($"[{GetTimestamp()}] Потеря связи с сервером ВВЭР-1200. Переход в автономный режим.");
                    }
                }
            }

            yield return wait;
        }
    }

    private void ParseTelemetry(string json)
    {
        try
        {
            VverTelemetryData data = JsonUtility.FromJson<VverTelemetryData>(json);
            if (data == null || data.powerMW <= 0.01f && data.pPrimMPa <= 0.01f) return;

            thermalPower = data.powerMW;
            fuelTemperature = data.fuelTempC;
            reactorPeriod = data.periodSec;
            reactivity = data.reactivityTotalPcm;

            // In server: rodPosActual is 0.0 (in) to 1.0 (out)
            controlRodsPosition = Mathf.Clamp((1.0f - data.rodPosActual) * 100f, 0f, 100f);

            primaryPressure = data.pPrimMPa;
            coolantTempIn = data.coreInTempC;
            coolantTempOut = data.coreOutTempC;
            totalCoolantFlow = data.flowPrimKgS;
            pzrLevel = data.levelPzrM;

            secondaryPressure = data.pSecMPa;
            steamFlow = data.steamFlowKgS;
            electricPower = data.electricMW;
            turbineRPM = data.turbRpm;
            gridFrequency = data.freqHz > 0 ? data.freqHz : 50f;
            turbineOnline = data.turbineStopValvesOpen;
            gridConnected = data.gridBreakerClosed;
            isScramActive = data.scramActive;

            if (data.rcpStates != null && data.rcpStates.Length >= 4)
            {
                for (int i = 0; i < 4; i++) pumpActive[i] = data.rcpStates[i];
            }

            serverStatusString = $"<color=green>СЕРВЕР ВВЭР-1200: 20 Гц | t={data.time:F1}с</color>";
        }
        catch (Exception ex)
        {
            Debug.LogWarning($"[VVER-1200] Telemetry parse error: {ex.Message}");
        }
    }

    public void SendServerCommand(string action, object value = null, int index = -1)
    {
        StartCoroutine(PostCommandCoroutine(action, value, index));
    }

    private IEnumerator PostCommandCoroutine(string action, object value, int index)
    {
        string jsonBody;
        if (index >= 0)
        {
            jsonBody = $"{{\"action\":\"{action}\",\"index\":{index},\"value\":{value.ToString().ToLower()}}}";
        }
        else if (value != null)
        {
            if (value is float || value is int || value is double)
            {
                jsonBody = $"{{\"action\":\"{action}\",\"value\":{((float)Convert.ToDouble(value)).ToString(System.Globalization.CultureInfo.InvariantCulture)}}}";
            }
            else if (value is bool b)
            {
                jsonBody = $"{{\"action\":\"{action}\",\"value\":{(b ? "true" : "false")}}}";
            }
            else
            {
                jsonBody = $"{{\"action\":\"{action}\",\"value\":\"{value}\"}}";
            }
        }
        else
        {
            jsonBody = $"{{\"action\":\"{action}\"}}";
        }

        using (UnityWebRequest req = new UnityWebRequest($"{serverBaseUrl}/api/command", "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
            req.uploadHandler = new UploadHandlerRaw(bodyRaw);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.timeout = 2;

            yield return req.SendWebRequest();
            if (req.result != UnityWebRequest.Result.Success)
            {
                Debug.LogWarning($"[VVER-1200] Failed to send command {action}: {req.error}");
            }
        }
    }

    #endregion

    #region Operator Controls API

    public void TriggerEmergencyScram()
    {
        isScramActive = true;
        controlRodsPosition = 100f;
        LogEvent($"[{GetTimestamp()}] <b><color=red>ВНИМАНИЕ! НАЖАТА КНОПКА АЗ-1 / АЗ-5! АВАРИЙНЫЙ СБРОС ВСЕХ СТЕРЖНЕЙ!</color></b>");
        SendServerCommand("TRIP_AZ");
        OnStateChanged?.Invoke();
    }

    public void TriggerAZ5() => TriggerEmergencyScram();
    public void ResetAZ5() => ResetPlant();

    public void SetControlRods(float percentInserted)
    {
        if (isScramActive) return;
        controlRodsPosition = Mathf.Clamp(percentInserted, 0f, 100f);
        // Convert to server: 1.0 = extracted (0% inserted), 0.0 = inserted (100% inserted)
        float targetOut = (100f - controlRodsPosition) / 100f;
        SendServerCommand("SET_ROD_TARGET", targetOut);
        LogEvent($"[{GetTimestamp()}] Задание положения стержней СУЗ: {controlRodsPosition:F1}%");
        OnStateChanged?.Invoke();
    }

    public void AdjustRods(float deltaPercent)
    {
        SetControlRods(controlRodsPosition + deltaPercent);
    }

    public void TogglePump(int pumpIndex)
    {
        if (pumpIndex < 0 || pumpIndex >= 4) return;
        bool newState = !pumpActive[pumpIndex];
        pumpActive[pumpIndex] = newState;
        SendServerCommand("TOGGLE_RCP", newState, pumpIndex);
        LogEvent($"[{GetTimestamp()}] ГЦН-{pumpIndex + 1}: {(newState ? "<color=green>ВКЛЮЧЕН</color>" : "<color=red>ОТКЛЮЧЕН</color>")}");
        OnStateChanged?.Invoke();
    }

    public void SetPumpSpeed(int pumpIndex, float speedPercent)
    {
        float speedNorm = Mathf.Clamp(speedPercent / 100f, 0.2f, 1.0f);
        SendServerCommand("SET_RCP_SPEED", speedNorm);
        OnStateChanged?.Invoke();
    }

    public void ToggleTurbine()
    {
        bool newState = !turbineOnline;
        turbineOnline = newState;
        SendServerCommand("TRIP_TURBINE", newState);
        LogEvent($"[{GetTimestamp()}] Стопорные клапаны турбины (СК ТП): {(newState ? "<color=green>ОТКРЫТЫ</color>" : "<color=red>ПОСАЖЕНЫ</color>")}");
        OnStateChanged?.Invoke();
    }

    public void ToggleGrid()
    {
        bool newState = !gridConnected;
        gridConnected = newState;
        SendServerCommand("TOGGLE_GRID", newState);
        LogEvent($"[{GetTimestamp()}] Синхронизация с энергосистемой: {(newState ? "<color=green>ВКЛЮЧЕНА</color>" : "<color=yellow>ОТКЛЮЧЕНА</color>")}");
        OnStateChanged?.Invoke();
    }

    public void ResetPlant()
    {
        SendServerCommand("RESET");
        isScramActive = false;
        controlRodsPosition = 30f;
        LogEvent($"[{GetTimestamp()}] <b><color=cyan>Сброс энергоблока ВВЭР-1200 в исходный номинал (100% мощности)</color></b>");
        OnStateChanged?.Invoke();
    }

    public void ToggleSafetySystem(int index)
    {
        if (index == 0)
        {
            safetyECCS = !safetyECCS;
            LogEvent($"[{GetTimestamp()}] САОЗ (Аварийное охлаждение зоны): {(safetyECCS ? "АКТИВНА" : "ОТКЛЮЧЕНА")}");
        }
        else if (index == 1)
        {
            containmentSealed = !containmentSealed;
            LogEvent($"[{GetTimestamp()}] Гермооболочка реактора: {(containmentSealed ? "ЗАКРЫТА" : "РАЗГЕРМЕТИЗИРОВАНА")}");
        }
        OnStateChanged?.Invoke();
    }

    public void LogEvent(string text)
    {
        eventLog.Insert(0, text);
        if (eventLog.Count > 30) eventLog.RemoveAt(eventLog.Count - 1);
    }

    private string GetTimestamp()
    {
        int t = (int)Time.time;
        return $"{t / 60:00}:{t % 60:00}";
    }

    #endregion

    #region Local Physics Fallback

    private void RunLocalPhysicsFallback()
    {
        float dt = Time.deltaTime;
        if (isScramActive)
        {
            thermalPower = Mathf.MoveTowards(thermalPower, 40f, 250f * dt);
            controlRodsPosition = 100f;
        }
        else
        {
            float targetTherm = (100f - controlRodsPosition) * 32f;
            thermalPower = Mathf.MoveTowards(thermalPower, targetTherm, 80f * dt);
        }

        coolantTempOut = Mathf.MoveTowards(coolantTempOut, coolantTempIn + (thermalPower / 3200f) * 32f, 2f * dt);
        if (turbineOnline)
        {
            electricPower = Mathf.MoveTowards(electricPower, (thermalPower / 3200f) * 1200f, 60f * dt);
            turbineRPM = Mathf.MoveTowards(turbineRPM, 3000f, 150f * dt);
        }
        else
        {
            electricPower = Mathf.MoveTowards(electricPower, 0f, 150f * dt);
            turbineRPM = Mathf.MoveTowards(turbineRPM, 0f, 80f * dt);
        }
    }

    #endregion
}

[System.Serializable]
public class VverTelemetryData
{
    public float time;
    public float powerMW;
    public float powerPct;
    public float fuelTempC;
    public float periodSec;
    public float boronPpm;
    public float reactivityTotalPcm;
    public float pPrimMPa;
    public float coreInTempC;
    public float coreOutTempC;
    public float flowPrimKgS;
    public float levelPzrM;
    public float pSecMPa;
    public float steamFlowKgS;
    public float electricMW;
    public float turbRpm;
    public float freqHz;
    public bool turbineStopValvesOpen;
    public bool gridBreakerClosed;
    public float rodPosActual;
    public bool scramActive;
    public bool[] rcpStates;
}

/// <summary>
/// CCTV Security & Process Camera system for the VVER-1200 containment hall.
/// Renders real-time camera views of the reactor vessel, Cherenkov glow, and MCP pumps to a RenderTexture,
/// displayed on the Far Right desk monitor and in the fullscreen UI.
/// </summary>
public class ReactorCCTVSystem : MonoBehaviour
{
    public static ReactorCCTVSystem Instance { get; private set; }

    [Header("Render Texture")]
    public RenderTexture cctvRenderTexture;
    public Camera cctvCamera;

    [Header("Camera Angles")]
    public int currentCameraIndex = 0;
    private readonly Vector3[] _camPositions = new Vector3[]
    {
        new Vector3(-24.5f, 4.8f, -6.5f), // CAM-01: Верхний общий ракурс на реактор и петли
        new Vector3(-22.0f, 3.0f, -0.5f), // CAM-02: Фокус на главные насосы ГЦН
        new Vector3(-20.77f, 6.0f, -2.99f) // CAM-03: Вид сверху вниз на активную зону
    };

    private readonly Vector3[] _camEulerAngles = new Vector3[]
    {
        new Vector3(28f, 46f, 0f),   // CAM-01
        new Vector3(25f, 180f, 0f),  // CAM-02
        new Vector3(88f, 0f, 0f)     // CAM-03 (вид вертикально вниз)
    };

    public readonly string[] cameraNames = new string[]
    {
        "CAM-01 [РЕАКТОРНЫЙ ЗАЛ: ОБЩИЙ ВИД]",
        "CAM-02 [КОНТУР 1: ПЕТЛИ И НАСОСЫ ГЦН]",
        "CAM-03 [ШАХТА РЕАКТОРА: АКТИВНАЯ ЗОНА]"
    };

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;

        EnsureRenderTexture();
        EnsureCamera();
    }

    private void EnsureRenderTexture()
    {
        if (cctvRenderTexture == null)
        {
            cctvRenderTexture = new RenderTexture(1024, 640, 16, RenderTextureFormat.ARGB32)
            {
                name = "ReactorCCTV_RT",
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };
            cctvRenderTexture.Create();
        }
    }

    private void EnsureCamera()
    {
        if (cctvCamera == null)
        {
            GameObject camGo = GameObject.Find("ReactorCCTVCamera");
            if (camGo == null)
            {
                camGo = new GameObject("ReactorCCTVCamera");
            }

            cctvCamera = camGo.GetComponent<Camera>();
            if (cctvCamera == null)
            {
                cctvCamera = camGo.AddComponent<Camera>();
            }

            cctvCamera.clearFlags = CameraClearFlags.Skybox;
            cctvCamera.fieldOfView = 65f;
            cctvCamera.nearClipPlane = 0.3f;
            cctvCamera.farClipPlane = 100f;
            cctvCamera.targetTexture = cctvRenderTexture;
            cctvCamera.enabled = true;
        }

        SetCameraAngle(currentCameraIndex);
    }

    public void SwitchCameraNext()
    {
        currentCameraIndex = (currentCameraIndex + 1) % _camPositions.Length;
        SetCameraAngle(currentCameraIndex);
    }

    public void SetCameraAngle(int index)
    {
        currentCameraIndex = Mathf.Clamp(index, 0, _camPositions.Length - 1);
        if (cctvCamera != null)
        {
            cctvCamera.transform.position = _camPositions[currentCameraIndex];
            cctvCamera.transform.rotation = Quaternion.Euler(_camEulerAngles[currentCameraIndex]);
        }
    }

    public string GetCameraStatusOverlay()
    {
        var sim = ReactorSimulationSystem.Instance;
        float rad = sim != null ? sim.radiationReactorHall : 18.0f;
        string dt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        string scramWarning = (sim != null && sim.isScramActive) ? " <color=red>[ТРЕВОГА АЗ-1]</color>" : " [НОРМА]";
        return $"{cameraNames[currentCameraIndex]}\n{dt} | РАД: {rad:F1} мкР/ч{scramWarning}";
    }
}


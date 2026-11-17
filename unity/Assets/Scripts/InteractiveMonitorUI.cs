using System;
using System.Text;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Controls the UI and interactive elements of each individual computer monitor.
/// Reacts to changes in ReactorSimulationSystem and sends player inputs to the reactor.
/// </summary>
public class InteractiveMonitorUI : MonoBehaviour
{
    public enum MonitorType
    {
        CoreAndRods,       // Screen 1: Control Rods, Thermal Power, AZ-5
        PrimaryLoop,       // Screen 2: Coolant Pressure, Temps, 4x MCP Pumps
        CoreHeatmap,       // Screen 3: Core Temperature Distribution, Fuel Diagnostics
        TurbineGenerator,  // Screen 4: Turbine RPM, Electric Power, Grid Frequency
        SafetyAndLogs      // Screen 5: Radiation, Containment, Realtime Event Log
    }

    [Header("Configuration")]
    public MonitorType monitorType;
    public string stationTitle = "БЛОЧНЫЙ ПУЛЬТ УПРАВЛЕНИЯ";

    [Header("UI Element References")]
    public TextMeshProUGUI titleText;
    public TextMeshProUGUI primaryValueText;
    public TextMeshProUGUI secondaryTelemetryText;
    public Slider mainSlider;
    public Button actionButton1;
    public Button actionButton2;
    public Button az5Button;
    public Image statusLight;
    public RawImage cctvImage;
    public TextMeshProUGUI cctvOsdText;

    [Header("Analog Gauges & Instruments")]
    public AnalogDialUI dial1 = new AnalogDialUI();
    public AnalogDialUI dial2 = new AnalogDialUI();
    public SegmentedBarUI barGraph = new SegmentedBarUI();
    public RectTransform[] pumpRotorIcons;

    private ReactorSimulationSystem sim => ReactorSimulationSystem.Instance;

    private void Start()
    {
        Canvas c = GetComponent<Canvas>();
        if (c != null && c.worldCamera == null)
        {
            c.worldCamera = Camera.main;
        }

        if (sim != null)
        {
            sim.OnStateChanged += RefreshUI;
        }
        SetupEventHandlers();
        RefreshUI();
    }

    private void OnDestroy()
    {
        if (sim != null)
        {
            sim.OnStateChanged -= RefreshUI;
        }
    }

    private void Update()
    {
        if (sim == null) return;

        switch (monitorType)
        {
            case MonitorType.CoreAndRods:
                dial1.UpdateValue(sim.thermalPower, "F0", "МВт");
                dial2.UpdateValue(sim.fuelTemperature, "F0", "°C");
                barGraph.UpdateValue(sim.controlRodsPosition, 0f, 100f, "F1", "%");
                break;

            case MonitorType.PrimaryLoop:
                dial1.UpdateValue(sim.primaryPressure, "F2", "МПа");
                dial2.UpdateValue(sim.totalCoolantFlow, "F0", "кг/с");
                barGraph.UpdateValue(sim.pzrLevel, 0f, 12f, "F2", "м");
                if (pumpRotorIcons != null)
                {
                    for (int p = 0; p < pumpRotorIcons.Length && p < 4; p++)
                    {
                        if (pumpRotorIcons[p] != null && sim.pumpActive[p])
                        {
                            float spd = (sim.pumpSpeeds != null && p < sim.pumpSpeeds.Length) ? sim.pumpSpeeds[p] : 100f;
                            pumpRotorIcons[p].Rotate(0f, 0f, -360f * (spd / 100f) * Time.deltaTime);
                        }
                    }
                }
                break;

            case MonitorType.CoreHeatmap:
                float dnbr = (sim.thermalPower > 100f) ? Mathf.Clamp(2.18f * (3200f / Mathf.Max(100f, sim.thermalPower)), 0.8f, 3.5f) : 3.5f;
                dial1.UpdateValue(dnbr, "F2", "DNBR");
                dial2.UpdateValue(sim.coolantTempOut, "F1", "°C");
                break;

            case MonitorType.TurbineGenerator:
                dial1.UpdateValue(sim.turbineRPM, "F0", "об/мин");
                dial2.UpdateValue(sim.electricPower, "F0", "МВт(э)");
                barGraph.UpdateValue(sim.gridFrequency, 48f, 52f, "F2", "Гц");
                break;

            case MonitorType.SafetyAndLogs:
                dial1.UpdateValue(sim.radiationReactorHall, "F1", "мкР/ч");
                if (cctvOsdText != null && ReactorCCTVSystem.Instance != null)
                {
                    cctvOsdText.text = ReactorCCTVSystem.Instance.GetCameraStatusOverlay();
                }
                break;
        }
    }

    private void SetupEventHandlers()
    {
        switch (monitorType)
        {
            case MonitorType.CoreAndRods:
                if (mainSlider != null)
                {
                    mainSlider.onValueChanged.AddListener((val) => {
                        sim?.SetControlRods(val);
                    });
                }
                if (actionButton1 != null)
                {
                    actionButton1.onClick.AddListener(() => sim?.AdjustRods(5f)); // Ввести стержни (+5%)
                }
                if (az5Button != null)
                {
                    az5Button.onClick.AddListener(() => {
                        if (sim != null)
                        {
                            if (sim.isScramActive) sim.ResetPlant();
                            else sim.TriggerEmergencyScram();
                        }
                    });
                }
                break;

            case MonitorType.PrimaryLoop:
                if (actionButton1 != null)
                {
                    actionButton1.onClick.AddListener(() => sim?.TogglePump(0));
                }
                if (actionButton2 != null)
                {
                    actionButton2.onClick.AddListener(() => sim?.TogglePump(1));
                }
                if (mainSlider != null)
                {
                    mainSlider.onValueChanged.AddListener((val) => {
                        sim?.SetPumpSpeed(0, val);
                        sim?.SetPumpSpeed(1, val);
                        sim?.SetPumpSpeed(2, val);
                        sim?.SetPumpSpeed(3, val);
                    });
                }
                break;

            case MonitorType.CoreHeatmap:
                if (actionButton1 != null)
                {
                    actionButton1.onClick.AddListener(() => sim?.ResetPlant()); // Сброс в 100%
                }
                if (actionButton2 != null)
                {
                    actionButton2.onClick.AddListener(() => sim?.AdjustRods(-5f)); // Извлечь стержни (-5%)
                }
                break;

            case MonitorType.TurbineGenerator:
                if (actionButton1 != null)
                {
                    actionButton1.onClick.AddListener(() => sim?.ToggleTurbine());
                }
                if (actionButton2 != null)
                {
                    actionButton2.onClick.AddListener(() => sim?.ToggleGrid());
                }
                break;

            case MonitorType.SafetyAndLogs:
                if (actionButton1 != null)
                {
                    actionButton1.onClick.AddListener(() => {
                        ReactorCCTVSystem.Instance?.SwitchCameraNext();
                    });
                }
                break;
        }
    }

    public void RefreshUI()
    {
        if (sim == null) return;

        string srvBadge = sim.isConnectedToServer ? "<color=#00FF88>[ВВЭР-1200 СЕРВЕР]</color>" : "<color=#FFAA00>[АВТОНОМНО]</color>";

        switch (monitorType)
        {
            case MonitorType.CoreAndRods:
                dial1.UpdateValue(sim.thermalPower, "F0", "МВт");
                dial2.UpdateValue(sim.fuelTemperature, "F0", "°C");
                barGraph.UpdateValue(sim.controlRodsPosition, 0f, 100f, "F1", "%");
                if (titleText) titleText.text = $"СУЗ: СТЕРЖНИ И МОЩНОСТЬ | {srvBadge}";
                if (primaryValueText)
                {
                    string color = sim.isScramActive ? "#FF3333" : (sim.thermalPower > 3300f ? "#FFAA00" : "#33FF77");
                    primaryValueText.text = $"<color={color}>МОЩНОСТЬ: {sim.thermalPower:F0} МВт</color>\n" +
                                           $"<size=75%>СТЕРЖНИ СУЗ: {sim.controlRodsPosition:F1}% ПОГРУЖЕНО | Т_топл: {sim.fuelTemperature:F0} °C</size>";
                }
                if (secondaryTelemetryText)
                {
                    string status = sim.isScramActive ? "<color=red>АЗ-1 СРАБОТАЛА (СБРОС)</color>" : "<color=green>РЕЖИМ: СТАЦИОНАР 100%</color>";
                    secondaryTelemetryText.text = $"Статус: {status}\n" +
                                                  $"Реактивность: {sim.reactivity:+0.0;-0.0;0.0} pcm\n" +
                                                  $"Период реактора: T = {(sim.reactorPeriod > 1000 ? "> 9999" : sim.reactorPeriod.ToString("F0"))} сек\n" +
                                                  $"Связь с сервером: {sim.serverStatusString}";
                }
                bool isInteracting = UnityEngine.EventSystems.EventSystem.current != null && 
                                     UnityEngine.EventSystems.EventSystem.current.currentSelectedGameObject == (mainSlider ? mainSlider.gameObject : null);
                if (mainSlider && !isInteracting)
                {
                    mainSlider.SetValueWithoutNotify(sim.controlRodsPosition);
                }
                if (statusLight)
                {
                    statusLight.color = sim.isScramActive ? Color.red : Color.green;
                }
                break;

            case MonitorType.PrimaryLoop:
                dial1.UpdateValue(sim.primaryPressure, "F2", "МПа");
                dial2.UpdateValue(sim.totalCoolantFlow, "F0", "кг/с");
                barGraph.UpdateValue(sim.pzrLevel, 0f, 12f, "F2", "м");
                if (titleText) titleText.text = $"ПЕРВЫЙ КОНТУР И НАСОСЫ (ГЦН) | {srvBadge}";
                if (primaryValueText)
                {
                    string pCol = (sim.primaryPressure > 16.6f || sim.primaryPressure < 15.5f) ? "#FFAA00" : "#33CCFF";
                    primaryValueText.text = $"<color={pCol}>ДАВЛЕНИЕ: {sim.primaryPressure:F2} МПа</color>\n" +
                                           $"<size=75%>РАСХОД: {sim.totalCoolantFlow:F0} кг/с | КД Уровень: {sim.pzrLevel:F2} м</size>";
                }
                if (secondaryTelemetryText)
                {
                    secondaryTelemetryText.text = $"Температура входа: {sim.coolantTempIn:F1} °C\n" +
                                                  $"Температура выхода: {sim.coolantTempOut:F1} °C (ΔT = {sim.coolantTempOut - sim.coolantTempIn:F1} °C)\n" +
                                                  $"ГЦН-1: {(sim.pumpActive[0] ? "<color=green>ВКЛ</color>" : "<color=red>ОТКЛ</color>")}   " +
                                                  $"ГЦН-2: {(sim.pumpActive[1] ? "<color=green>ВКЛ</color>" : "<color=red>ОТКЛ</color>")}\n" +
                                                  $"ГЦН-3: {(sim.pumpActive[2] ? "<color=green>ВКЛ</color>" : "<color=red>ОТКЛ</color>")}   " +
                                                  $"ГЦН-4: {(sim.pumpActive[3] ? "<color=green>ВКЛ</color>" : "<color=red>ОТКЛ</color>")}";
                }
                if (statusLight)
                {
                    statusLight.color = (sim.primaryPressure > 16.8f || sim.primaryPressure < 15.0f) ? Color.red : Color.cyan;
                }
                break;

            case MonitorType.CoreHeatmap:
                float dnbrVal = (sim.thermalPower > 100f) ? Mathf.Clamp(2.18f * (3200f / Mathf.Max(100f, sim.thermalPower)), 0.8f, 3.5f) : 3.5f;
                dial1.UpdateValue(dnbrVal, "F2", "DNBR");
                dial2.UpdateValue(sim.coolantTempOut, "F1", "°C");
                barGraph.UpdateValue(1.18f, 1.0f, 2.0f, "F2", "Kz");
                if (titleText) titleText.text = $"АКТИВНАЯ ЗОНА: КАРТА И ДИАГНОСТИКА | {srvBadge}";
                if (primaryValueText)
                {
                    primaryValueText.text = $"<color=#00FFAA>СРЕДНЯЯ ТЕМПЕРАТУРА: {(sim.coolantTempOut + sim.coolantTempIn) / 2f:F1} °C</color>\n" +
                                           $"<size=75%>ТОПЛИВО МАКС: {sim.fuelTemperature:F1} °C | Т_вых: {sim.coolantTempOut:F1} °C</size>";
                }
                if (secondaryTelemetryText)
                {
                    secondaryTelemetryText.text = $"Сектор А: {sim.coolantTempOut - 2.5f:F1} °C [НОРМА]\n" +
                                                  $"Сектор B: {sim.coolantTempOut + 1.2f:F1} °C [НОРМА]\n" +
                                                  $"Сектор C: {sim.coolantTempOut + 3.1f:F1} °C [НОРМА]\n" +
                                                  $"Сектор D: {sim.coolantTempOut - 1.8f:F1} °C [НОРМА]\n" +
                                                  $"Запас до кризиса DNBR: 2.18 (Норма > 1.30)\n" +
                                                  $"Коэффициент неравномерности Kz: 1.18";
                }
                if (statusLight)
                {
                    statusLight.color = Color.green;
                }
                break;

            case MonitorType.TurbineGenerator:
                dial1.UpdateValue(sim.turbineRPM, "F0", "об/мин");
                dial2.UpdateValue(sim.electricPower, "F0", "МВт(э)");
                barGraph.UpdateValue(sim.gridFrequency, 48f, 52f, "F2", "Гц");
                if (titleText) titleText.text = $"ТУРБОГЕНЕРАТОР ТГ-1 И СЕТЬ | {srvBadge}";
                if (primaryValueText)
                {
                    string tCol = sim.turbineOnline ? "#FFEE33" : "#FF5533";
                    primaryValueText.text = $"<color={tCol}>ВЫРАБОТКА: {sim.electricPower:F0} МВт(э)</color>\n" +
                                           $"<size=75%>ОБОРОТЫ: {sim.turbineRPM:F0} ОБ/МИН | СЕТЬ: {sim.gridFrequency:F2} Гц</size>";
                }
                if (secondaryTelemetryText)
                {
                    secondaryTelemetryText.text = $"Давление пара 2 контура: {sim.secondaryPressure:F2} МПа\n" +
                                                  $"Расход свежего пара: {sim.steamFlow:F0} кг/с\n" +
                                                  $"Стопорные клапаны (СК ТП): {(sim.turbineOnline ? "<color=green>ОТКРЫТЫ</color>" : "<color=red>ПОСАЖЕНЫ</color>")}\n" +
                                                  $"Генераторный выключатель: {(sim.gridConnected ? "<color=green>ВКЛЮЧЕН В СЕТЬ</color>" : "<color=yellow>ОТКЛЮЧЕН</color>")}\n" +
                                                  $"Вакуум в конденсаторе: -0.096 МПа (НОРМА)";
                }
                if (statusLight)
                {
                    statusLight.color = sim.turbineOnline ? Color.yellow : Color.red;
                }
                break;

            case MonitorType.SafetyAndLogs:
                if (titleText) titleText.text = $"ВИДЕОНАБЛЮДЕНИЕ РЕАКТОРА (CCTV) | {srvBadge}";
                if (cctvImage != null && ReactorCCTVSystem.Instance != null && cctvImage.texture == null)
                {
                    cctvImage.texture = ReactorCCTVSystem.Instance.cctvRenderTexture;
                }
                if (cctvOsdText != null && ReactorCCTVSystem.Instance != null)
                {
                    cctvOsdText.text = ReactorCCTVSystem.Instance.GetCameraStatusOverlay();
                }
                if (primaryValueText)
                {
                    primaryValueText.text = $"<color=#00FFAA>КАМЕРА РЕАКТОРНОГО ЗАЛА</color>\n" +
                                           $"<size=75%>РАДИАЦИЯ В ЗАЛЕ: {sim.radiationReactorHall:F1} мкР/ч | БЩУ: {sim.radiationControlRoom:F1} мкР/ч</size>";
                }
                if (secondaryTelemetryText)
                {
                    secondaryTelemetryText.text = $"Гермооболочка: {(sim.containmentSealed ? "<color=green>ГЕРМЕТИЧНА</color>" : "<color=red>РАЗГЕРМЕТИЗАЦИЯ</color>")}\n" +
                                                  $"САОЗ (аварийное охлаждение): {(sim.safetyECCS ? "<color=green>ГОТОВНОСТЬ</color>" : "<color=red>ОТКЛ</color>")}\n" +
                                                  $"[Нажмите кнопку ниже или E для перехода к полной панели]";
                }
                if (statusLight)
                {
                    statusLight.color = Color.green;
                }
                break;
        }
    }
}

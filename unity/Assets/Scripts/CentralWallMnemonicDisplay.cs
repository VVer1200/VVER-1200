using System;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

[Serializable]
public class AnalogDialUI
{
    public RectTransform needleRect;
    public TextMeshProUGUI valueText;
    public TextMeshProUGUI labelText;
    public float minValue = 0f;
    public float maxValue = 100f;
    public float minAngle = 135f;
    public float maxAngle = -135f;
    private float _curVal = 0f;

    public void UpdateValue(float targetVal, string format = "F0", string unit = "")
    {
        _curVal = Mathf.Lerp(_curVal, targetVal, Time.deltaTime * 8f);
        float norm = Mathf.Clamp01((_curVal - minValue) / (maxValue - minValue));
        if (needleRect != null)
        {
            needleRect.localEulerAngles = new Vector3(0f, 0f, Mathf.Lerp(minAngle, maxAngle, norm));
        }
        if (valueText != null)
        {
            valueText.text = $"{_curVal.ToString(format)} {unit}";
        }
    }
}

[Serializable]
public class SegmentedBarUI
{
    public Image[] segments;
    public TextMeshProUGUI valueText;
    public Color normalColor = new Color(0f, 0.95f, 0.45f);
    public Color warningColor = new Color(1.0f, 0.8f, 0.1f);
    public Color alarmColor = new Color(0.95f, 0.15f, 0.15f);

    public void UpdateValue(float current, float min, float max, string format = "F1", string unit = "")
    {
        if (segments == null || segments.Length == 0) return;
        float norm = Mathf.Clamp01((current - min) / (max - min));
        int litCount = Mathf.RoundToInt(norm * segments.Length);

        for (int i = 0; i < segments.Length; i++)
        {
            if (segments[i] == null) continue;
            if (i < litCount)
            {
                float segNorm = (float)i / segments.Length;
                Color col = segNorm < 0.70f ? normalColor : (segNorm < 0.88f ? warningColor : alarmColor);
                segments[i].color = col;
            }
            else
            {
                segments[i].color = new Color(0.08f, 0.12f, 0.16f, 0.5f);
            }
        }

        if (valueText != null)
        {
            valueText.text = $"{current.ToString(format)} {unit}";
        }
    }
}

/// <summary>
/// Big Central Wall Mnemonic Display (Главный настенный мнемощит БЩУ ВВЭР-1200)
/// mounted on the front wall screen (Cube 4). Displays circular analog gauges,
/// segmented level bars, the primary reactor loop mimic diagram, pump statuses,
/// and an illuminated annunciator alarm matrix.
/// </summary>
public class CentralWallMnemonicDisplay : MonoBehaviour
{
    private ReactorSimulationSystem sim => ReactorSimulationSystem.Instance;

    [Header("Top Header")]
    public TextMeshProUGUI headerText;

    [Header("Analog Circular Dial Gauges")]
    public AnalogDialUI powerDial = new AnalogDialUI { minValue = 0, maxValue = 4000 };
    public AnalogDialUI pressureDial = new AnalogDialUI { minValue = 0, maxValue = 20 };
    public AnalogDialUI tempDial = new AnalogDialUI { minValue = 200, maxValue = 360 };
    public AnalogDialUI turbineDial = new AnalogDialUI { minValue = 0, maxValue = 3600 };
    public AnalogDialUI electricDial = new AnalogDialUI { minValue = 0, maxValue = 1400 };

    [Header("Segmented Level Bargraphs")]
    public SegmentedBarUI pzrLevelBar = new SegmentedBarUI();
    public SegmentedBarUI rodsBar = new SegmentedBarUI();

    [Header("MCP Pumps Status & Animation")]
    public Image[] pumpLamps = new Image[4];
    public TextMeshProUGUI[] pumpLabels = new TextMeshProUGUI[4];
    public RectTransform[] pumpRotors = new RectTransform[4];

    [Header("Annunciator Alarm Matrix (12 Tiles)")]
    public Image[] annunciatorTiles = new Image[12];
    public TextMeshProUGUI[] annunciatorTexts = new TextMeshProUGUI[12];

    [Header("Alarm Banner")]
    public GameObject alarmBanner;
    public TextMeshProUGUI alarmBannerText;

    [Header("Mimic Loop Flow Pulsation")]
    public Image[] flowPulseDots;

    private float _blinkTimer = 0f;
    private float _flowTimer = 0f;

    private void Start()
    {
        if (sim != null)
        {
            sim.OnStateChanged += RefreshDisplay;
        }
        RefreshDisplay();
    }

    private void OnDestroy()
    {
        if (sim != null)
        {
            sim.OnStateChanged -= RefreshDisplay;
        }
    }

    private void Update()
    {
        _blinkTimer += Time.deltaTime;
        _flowTimer += Time.deltaTime;

        if (sim != null)
        {
            // Smooth needle animation
            powerDial.UpdateValue(sim.thermalPower, "F0", "МВт");
            pressureDial.UpdateValue(sim.primaryPressure, "F2", "МПа");
            tempDial.UpdateValue(sim.coolantTempOut, "F1", "°C");
            turbineDial.UpdateValue(sim.turbineRPM, "F0", "об/мин");
            electricDial.UpdateValue(sim.electricPower, "F0", "МВт(э)");

            pzrLevelBar.UpdateValue(sim.pzrLevel, 0f, 12f, "F2", "м");
            rodsBar.UpdateValue(sim.controlRodsPosition, 0f, 100f, "F1", "%");

            // Spin MCP pump rotors
            for (int p = 0; p < 4; p++)
            {
                if (pumpRotors != null && p < pumpRotors.Length && pumpRotors[p] != null)
                {
                    if (sim.pumpActive[p])
                    {
                        float spd = (sim.pumpSpeeds != null && p < sim.pumpSpeeds.Length) ? sim.pumpSpeeds[p] : 100f;
                        pumpRotors[p].Rotate(0f, 0f, -360f * (spd / 100f) * Time.deltaTime);
                    }
                }
            }

            // Animate flow dots on coolant loops
            if (flowPulseDots != null)
            {
                float flowPhase = Mathf.Repeat(_flowTimer * 2f, 1f);
                for (int d = 0; d < flowPulseDots.Length; d++)
                {
                    if (flowPulseDots[d] != null)
                    {
                        float alpha = Mathf.Sin((flowPhase + (float)d / flowPulseDots.Length) * Mathf.PI * 2f) * 0.4f + 0.6f;
                        Color c = flowPulseDots[d].color;
                        c.a = alpha;
                        flowPulseDots[d].color = c;
                    }
                }
            }

            // SCRAM Alarm banner blink
            if (sim.isScramActive)
            {
                if (alarmBanner != null)
                {
                    alarmBanner.SetActive(Mathf.Repeat(_blinkTimer * 3f, 1f) > 0.4f);
                }
            }
            else
            {
                if (alarmBanner != null && alarmBanner.activeSelf)
                {
                    alarmBanner.SetActive(false);
                }
            }
        }
    }

    public void RefreshDisplay()
    {
        if (sim == null) return;

        // 1. Header
        if (headerText)
        {
            string srv = sim.isConnectedToServer ? "<color=#00FF88>СЕРВЕР ВВЭР-1200: ОНЛАЙН (3000)</color>" : "<color=#FFAA00>АВТОНОМНЫЙ РЕЖИМ</color>";
            headerText.text = $"ЭНЕРГОБЛОК №1 ВВЭР-1200 | ГЛАВНЫЙ МНЕМОЩИТ БЩУ | {srv}";
        }

        // 2. Pumps Status
        for (int i = 0; i < 4; i++)
        {
            if (pumpLamps != null && i < pumpLamps.Length && pumpLamps[i] != null)
            {
                bool active = sim.pumpActive[i];
                pumpLamps[i].color = active ? new Color(0f, 0.95f, 0.4f) : new Color(0.9f, 0.15f, 0.15f);
                if (pumpLabels != null && i < pumpLabels.Length && pumpLabels[i] != null)
                {
                    pumpLabels[i].text = $"ГЦН-{i + 1}\n{(active ? "ВКЛ" : "ОТКЛ")}";
                }
            }
        }

        // 3. Annunciator Light Matrix (12 Tiles)
        UpdateAnnunciatorMatrix();

        // 4. Alarm banner text
        if (alarmBannerText)
        {
            alarmBannerText.text = "⚠️ ВНИМАНИЕ! СРАБОТАЛА АВАРИЙНАЯ ЗАЩИТА АЗ-1 (СБРОС СТЕРЖНЕЙ СУЗ) ⚠️";
        }
    }

    private void UpdateAnnunciatorMatrix()
    {
        if (annunciatorTiles == null || annunciatorTiles.Length < 12) return;

        // Tile 0: АЗ-1 ГОТОВНОСТЬ
        SetTile(0, !sim.isScramActive, "АЗ-1: ГОТОВНОСТЬ", new Color(0f, 0.85f, 0.35f), "АЗ-1: СБРОС СТЕРЖНЕЙ", Color.red);

        // Tile 1: ДАВЛЕНИЕ КД
        bool pOk = sim.primaryPressure >= 15.5f && sim.primaryPressure <= 16.6f;
        SetTile(1, pOk, "ДАВЛЕНИЕ I: НОРМА", new Color(0f, 0.85f, 0.35f), "ДАВЛЕНИЕ: ОТКЛОНЕНИЕ", Color.yellow);

        // Tile 2..5: ГЦН 1..4
        for (int p = 0; p < 4; p++)
        {
            SetTile(2 + p, sim.pumpActive[p], $"ГЦН-{p + 1}: РАБОТА", new Color(0f, 0.85f, 0.35f), $"ГЦН-{p + 1}: ОТКЛЮЧЕН", new Color(0.85f, 0.2f, 0.2f));
        }

        // Tile 6: ТУРБОГЕНЕРАТОР
        SetTile(6, sim.turbineOnline, "ТГ-1: 3000 ОБ/МИН", new Color(0f, 0.85f, 0.35f), "ТГ-1: СТОП", Color.red);

        // Tile 7: СЕТЬ 50 Гц
        SetTile(7, sim.gridConnected, "СЕТЬ: СИНХРОНИЗИРОВАНО", new Color(0f, 0.85f, 0.35f), "СЕТЬ: ОТКЛЮЧЕНА", Color.yellow);

        // Tile 8: САОЗ
        SetTile(8, sim.safetyECCS, "САОЗ: ДЕЖУРСТВО", new Color(0f, 0.85f, 0.35f), "САОЗ: НЕГОТОВА", Color.red);

        // Tile 9: ГЕРМООБОЛОЧКА
        SetTile(9, sim.containmentSealed, "ГЕРМООБЪЕМ: НОРМА", new Color(0f, 0.85f, 0.35f), "РАЗГЕРМЕТИЗАЦИЯ", Color.red);

        // Tile 10: РАДИАЦИЯ
        bool radOk = sim.radiationReactorHall < 100f;
        SetTile(10, radOk, "РАДИАЦИЯ: ФОН НОРМА", new Color(0f, 0.85f, 0.35f), "РАДИАЦИЯ: ПРЕВЫШЕНИЕ", Color.red);

        // Tile 11: ПИТАТЕЛЬНАЯ ВОДА
        SetTile(11, sim.steamFlow > 100f, "ПИТ. ВОДА: РАСХОД НОРМА", new Color(0f, 0.85f, 0.35f), "ПИТ. ВОДА: НЕТ РАСХОДА", Color.yellow);
    }

    private void SetTile(int index, bool isNormal, string normalText, Color normalCol, string alarmText, Color alarmCol)
    {
        if (index >= annunciatorTiles.Length || annunciatorTiles[index] == null) return;
        annunciatorTiles[index].color = isNormal ? normalCol * 0.85f : alarmCol;
        if (annunciatorTexts != null && index < annunciatorTexts.Length && annunciatorTexts[index] != null)
        {
            annunciatorTexts[index].text = isNormal ? normalText : alarmText;
        }
    }
}

using System;
using System.Text;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Fullscreen Nuclear Power Plant Control Room (БЩУ ВВЭР-1200) interface.
/// Opens on pressing [E], opening the specific section corresponding to the monitor the operator is viewing.
/// Includes high-resolution SCADA graphics, animated gauges, live CCTV camera stream from the reactor hall,
/// and full VVER-1200 real-time controls.
/// </summary>
public class ControlRoomFullscreenUI : MonoBehaviour
{
    public static ControlRoomFullscreenUI Instance { get; private set; }

    [Header("State")]
    public bool isOpen = false;
    public int currentTab = 0; // 0=Core, 1=Loops/Pumps, 2=Heatmap, 3=Turbine, 4=CCTV/Safety

    [Header("Keybindings")]
    public KeyCode toggleKey = KeyCode.E;
    public KeyCode secondaryToggleKey = KeyCode.Tab;

    private Canvas _canvas;
    private FirstPersonController _fpc;
    private ReactorSimulationSystem sim => ReactorSimulationSystem.Instance;

    // UI references
    private GameObject _panelRoot;
    private TextMeshProUGUI _headerTitleText;
    private TextMeshProUGUI _headerSubText;
    private Button[] _tabButtons = new Button[5];
    private GameObject[] _tabPanels = new GameObject[5];

    // Tab 1: Core & Rods
    private TextMeshProUGUI _tab1PowerText;
    private TextMeshProUGUI _tab1RodsText;
    private Slider _tab1RodsSlider;
    private Image _tab1PowerBar;
    private Button _tab1BtnUp;
    private Button _tab1BtnDown;
    private Button _tab1BtnAz5;
    private Image _tab1Az5Img;

    // Tab 2: Primary Loop & Pumps
    private TextMeshProUGUI _tab2PressureText;
    private TextMeshProUGUI _tab2FlowText;
    private Image _tab2PressureBar;
    private Button[] _tab2PumpButtons = new Button[4];
    private TextMeshProUGUI[] _tab2PumpButtonTexts = new TextMeshProUGUI[4];
    private Image[] _tab2PumpIcons = new Image[4];

    // Tab 3: Heatmap & Core diagnostics
    private TextMeshProUGUI _tab3HeatmapText;
    private Button _tab3BtnReset;

    // Tab 4: Turbine & Grid
    private TextMeshProUGUI _tab4TurbineText;
    private Image _tab4TurbineBar;
    private Button _tab4BtnTurbine;
    private Button _tab4BtnGrid;

    // Tab 5: CCTV Reactor Camera & Safety
    private RawImage _tab5CctvImage;
    private TextMeshProUGUI _tab5CctvOverlayText;
    private Button _tab5BtnSwitchCam;
    private TextMeshProUGUI _tab5SafetyText;
    private TextMeshProUGUI _tab5LogText;
    private Button _tab5BtnFaultRcp;
    private Button _tab5BtnFaultGrid;
    private Button _tab5BtnFaultPress;
    private Button _tab5BtnResetAll;

    // Current focused monitor hint
    public string currentLookMonitorHint = "";

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;

        _fpc = FindFirstObjectByType<FirstPersonController>();
        _canvas = GetComponent<Canvas>();
        if (_canvas == null)
        {
            _canvas = gameObject.AddComponent<Canvas>();
        }
        _canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        _canvas.sortingOrder = 999;

        if (GetComponent<CanvasScaler>() == null)
        {
            var cs = gameObject.AddComponent<CanvasScaler>();
            cs.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            cs.referenceResolution = new Vector2(1920, 1080);
            cs.matchWidthOrHeight = 0.5f;
        }

        if (GetComponent<GraphicRaycaster>() == null)
        {
            gameObject.AddComponent<GraphicRaycaster>();
        }
    }

    private void Start()
    {
        BuildFullscreenUI();
        SetOpen(false);

        if (sim != null)
        {
            sim.OnStateChanged += RefreshActiveTab;
        }
    }

    private void OnDestroy()
    {
        if (sim != null)
        {
            sim.OnStateChanged -= RefreshActiveTab;
        }
    }

    private void Update()
    {
        // Detect which monitor player is looking at when closed
        if (!isOpen)
        {
            CheckPlayerLookingAtMonitor();
        }

        if (Input.GetKeyDown(toggleKey) || Input.GetKeyDown(secondaryToggleKey))
        {
            Toggle();
        }
        else if (isOpen && Input.GetKeyDown(KeyCode.Escape))
        {
            SetOpen(false);
        }

        if (isOpen)
        {
            RefreshActiveTab();
            AnimateUI();
        }
    }

    private void CheckPlayerLookingAtMonitor()
    {
        Camera cam = Camera.main;
        if (cam == null) return;

        int hitSection = -1;
        string hint = "";

        // Check if aiming at any of the 5 monitor positions
        Vector3[] monPositions = new Vector3[]
        {
            new Vector3(-2.478f, 1.132f, -0.999f), // Mon 1: Core
            new Vector3(-0.825f, 1.132f, -1.435f), // Mon 2: Pumps
            new Vector3(0.088f, 1.132f, -1.514f),  // Mon 3: Heatmap
            new Vector3(0.998f, 1.132f, -1.435f),  // Mon 4: Turbine
            new Vector3(2.559f, 1.132f, -0.722f)   // Mon 5: CCTV
        };

        string[] monNames = new string[]
        {
            "СУЗ и Мощность реактора",
            "Первый контур и насосы ГЦН",
            "Карта активной зоны",
            "Турбогенератор ТГ-1 и Сеть",
            "Камера реактора (CCTV)"
        };

        float bestAngle = 35f;
        for (int i = 0; i < monPositions.Length; i++)
        {
            Vector3 dirToMon = (monPositions[i] - cam.transform.position).normalized;
            float angle = Vector3.Angle(cam.transform.forward, dirToMon);
            float dist = Vector3.Distance(cam.transform.position, monPositions[i]);
            if (angle < bestAngle && dist < 4.5f)
            {
                bestAngle = angle;
                hitSection = i;
                hint = $"[E] Открыть: {monNames[i]}";
            }
        }

        if (hitSection >= 0)
        {
            currentLookMonitorHint = hint;
            _pendingOpenSection = hitSection;
        }
        else
        {
            currentLookMonitorHint = "[E] Открыть пульт управления ВВЭР-1200";
        }
    }

    private int _pendingOpenSection = 0;

    public void Toggle()
    {
        if (!isOpen)
        {
            OpenSection(_pendingOpenSection);
        }
        else
        {
            SetOpen(false);
        }
    }

    public void OpenSection(int sectionIndex)
    {
        currentTab = Mathf.Clamp(sectionIndex, 0, 4);
        SetOpen(true);
        SwitchTab(currentTab);
    }

    public void SetOpen(bool open)
    {
        isOpen = open;
        if (_panelRoot != null)
        {
            _panelRoot.SetActive(isOpen);
        }

        if (isOpen)
        {
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
            if (_fpc != null) _fpc.enabled = false;
            RefreshActiveTab();
        }
        else
        {
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
            if (_fpc != null) _fpc.enabled = true;
        }
    }

    private void OnGUI()
    {
        if (!isOpen)
        {
            GUIStyle style = new GUIStyle(GUI.skin.box);
            style.fontSize = 15;
            style.fontStyle = FontStyle.Bold;
            style.normal.textColor = Color.white;
            style.alignment = TextAnchor.MiddleCenter;

            GUI.backgroundColor = new Color(0.04f, 0.16f, 0.28f, 0.90f);
            GUI.Box(new Rect((Screen.width - 560) / 2, Screen.height - 65, 560, 44), currentLookMonitorHint, style);
        }
    }

    #region UI Construction

    private void BuildFullscreenUI()
    {
        _panelRoot = CreateUI("FullscreenPanel", transform);
        Image bg = _panelRoot.AddComponent<Image>();
        bg.color = new Color(0.04f, 0.06f, 0.09f, 0.98f);
        SetStretch(_panelRoot.GetComponent<RectTransform>());

        // Top Header Bar
        GameObject header = CreateUI("TopHeader", _panelRoot.transform);
        Image headerImg = header.AddComponent<Image>();
        headerImg.color = new Color(0.07f, 0.11f, 0.16f);
        RectTransform hrt = header.GetComponent<RectTransform>();
        hrt.anchorMin = new Vector2(0f, 0.92f);
        hrt.anchorMax = Vector2.one;
        hrt.offsetMin = Vector2.zero; hrt.offsetMax = Vector2.zero;

        GameObject titleGo = CreateUI("Title", header.transform);
        _headerTitleText = titleGo.AddComponent<TextMeshProUGUI>();
        _headerTitleText.text = "БЛОЧНЫЙ ЩИТ УПРАВЛЕНИЯ | АЭС С РЕАКТОРОМ ВВЭР-1200";
        _headerTitleText.fontSize = 24f;
        _headerTitleText.fontStyle = FontStyles.Bold;
        _headerTitleText.color = new Color(0.0f, 0.9f, 1.0f);
        _headerTitleText.alignment = TextAlignmentOptions.MidlineLeft;
        RectTransform titlert = titleGo.GetComponent<RectTransform>();
        titlert.anchorMin = new Vector2(0.02f, 0.45f);
        titlert.anchorMax = new Vector2(0.75f, 1f);
        titlert.offsetMin = Vector2.zero; titlert.offsetMax = Vector2.zero;

        GameObject subGo = CreateUI("SubTitle", header.transform);
        _headerSubText = subGo.AddComponent<TextMeshProUGUI>();
        _headerSubText.text = "СЕРВЕР ВВЭР-1200 (localhost:3000) | РЕАЛЬНОЕ ВРЕМЯ: 20 Гц";
        _headerSubText.fontSize = 17f;
        _headerSubText.color = new Color(0.7f, 0.82f, 0.92f);
        _headerSubText.alignment = TextAlignmentOptions.MidlineLeft;
        RectTransform subrt = subGo.GetComponent<RectTransform>();
        subrt.anchorMin = new Vector2(0.02f, 0.05f);
        subrt.anchorMax = new Vector2(0.75f, 0.5f);
        subrt.offsetMin = Vector2.zero; subrt.offsetMax = Vector2.zero;

        GameObject closeBtnGo = CreateButton("BtnClose", header.transform, "✕ ЗАКРЫТЬ [E / ESC]",
            new Vector2(0.85f, 0.15f), new Vector2(0.98f, 0.85f), new Color(0.65f, 0.15f, 0.15f));
        closeBtnGo.GetComponent<Button>().onClick.AddListener(() => SetOpen(false));

        // Tab Navigation Bar
        GameObject navBar = CreateUI("NavBar", _panelRoot.transform);
        Image navImg = navBar.AddComponent<Image>();
        navImg.color = new Color(0.05f, 0.08f, 0.12f);
        RectTransform nrt = navBar.GetComponent<RectTransform>();
        nrt.anchorMin = new Vector2(0f, 0.86f);
        nrt.anchorMax = new Vector2(1f, 0.92f);
        nrt.offsetMin = Vector2.zero; nrt.offsetMax = Vector2.zero;

        string[] tabNames = new string[] {
            "МОНИТОР 1: СУЗ И МОЩНОСТЬ",
            "МОНИТОР 2: 1 КОНТУР И ГЦН",
            "МОНИТОР 3: АКТИВНАЯ ЗОНА",
            "МОНИТОР 4: ТУРБИНА И СЕТЬ",
            "МОНИТОР 5: КАМЕРА РЕАКТОРА (CCTV)"
        };

        for (int i = 0; i < 5; i++)
        {
            int idx = i;
            float step = 1.0f / 5.0f;
            GameObject tabBtn = CreateButton("Tab_" + i, navBar.transform, tabNames[i],
                new Vector2(idx * step + 0.005f, 0.08f), new Vector2((idx + 1) * step - 0.005f, 0.92f),
                i == 0 ? new Color(0.12f, 0.45f, 0.65f) : new Color(0.09f, 0.13f, 0.18f));
            _tabButtons[i] = tabBtn.GetComponent<Button>();
            _tabButtons[i].onClick.AddListener(() => SwitchTab(idx));
        }

        // Content Area
        GameObject contentArea = CreateUI("ContentArea", _panelRoot.transform);
        RectTransform cart = contentArea.GetComponent<RectTransform>();
        cart.anchorMin = new Vector2(0.02f, 0.02f);
        cart.anchorMax = new Vector2(0.98f, 0.85f);
        cart.offsetMin = Vector2.zero; cart.offsetMax = Vector2.zero;

        BuildTab1(contentArea.transform);
        BuildTab2(contentArea.transform);
        BuildTab3(contentArea.transform);
        BuildTab4(contentArea.transform);
        BuildTab5(contentArea.transform);

        SwitchTab(0);
    }

    public void SwitchTab(int tabIndex)
    {
        currentTab = tabIndex;
        for (int i = 0; i < 5; i++)
        {
            if (_tabPanels[i] != null) _tabPanels[i].SetActive(i == currentTab);
            if (_tabButtons[i] != null)
            {
                Color c = (i == currentTab) ? new Color(0.12f, 0.55f, 0.8f) : new Color(0.09f, 0.13f, 0.18f);
                _tabButtons[i].GetComponent<Image>().color = c;
            }
        }
        RefreshActiveTab();
    }

    #endregion

    #region Tab Builders

    private void BuildTab1(Transform parent)
    {
        GameObject p = CreateUI("Panel_Tab1", parent);
        SetStretch(p.GetComponent<RectTransform>());
        _tabPanels[0] = p;

        GameObject card1 = CreateCard("Card_Power", p.transform, new Vector2(0f, 0.52f), new Vector2(1f, 1f));
        _tab1PowerText = CreateText("PowerText", card1.transform, "ТЕПЛОВАЯ МОЩНОСТЬ: 3200 МВт [100.0%]", 32f);
        SetStretchMargins(_tab1PowerText.GetComponent<RectTransform>(), 30, 30, 30, 50);

        // Power Progress Bar
        GameObject pbBg = CreateUI("PowerBarBg", card1.transform);
        Image pbBgImg = pbBg.AddComponent<Image>();
        pbBgImg.color = new Color(0.12f, 0.16f, 0.22f);
        RectTransform pbrt = pbBg.GetComponent<RectTransform>();
        pbrt.anchorMin = new Vector2(0.02f, 0.08f);
        pbrt.anchorMax = new Vector2(0.98f, 0.22f);
        pbrt.offsetMin = Vector2.zero; pbrt.offsetMax = Vector2.zero;

        GameObject pbFill = CreateUI("Fill", pbBg.transform);
        _tab1PowerBar = pbFill.AddComponent<Image>();
        _tab1PowerBar.color = new Color(0f, 0.9f, 0.45f);
        SetStretch(pbFill.GetComponent<RectTransform>());

        GameObject card2 = CreateCard("Card_Controls", p.transform, new Vector2(0f, 0f), new Vector2(1f, 0.48f));
        _tab1RodsText = CreateText("RodsTitle", card2.transform, "<b>РЕГУЛИРУЮЩАЯ ГРУППА СТЕРЖНЕЙ СУЗ:</b> 30.0% ПОГРУЖЕНО", 24f);
        RectTransform rt1 = _tab1RodsText.GetComponent<RectTransform>();
        rt1.anchorMin = new Vector2(0.04f, 0.72f);
        rt1.anchorMax = new Vector2(0.65f, 0.95f);
        rt1.offsetMin = Vector2.zero; rt1.offsetMax = Vector2.zero;

        GameObject sGo = CreateSlider("RodsSlider", card2.transform, new Vector2(0.04f, 0.45f), new Vector2(0.65f, 0.68f));
        _tab1RodsSlider = sGo.GetComponent<Slider>();
        _tab1RodsSlider.minValue = 0f;
        _tab1RodsSlider.maxValue = 100f;
        _tab1RodsSlider.value = 30f;
        _tab1RodsSlider.onValueChanged.AddListener((val) => sim?.SetControlRods(val));

        GameObject b1 = CreateButton("BtnUp", card2.transform, "▲ ВВЕСТИ (+5%)", new Vector2(0.04f, 0.15f), new Vector2(0.32f, 0.38f), new Color(0.15f, 0.45f, 0.25f));
        _tab1BtnUp = b1.GetComponent<Button>();
        _tab1BtnUp.onClick.AddListener(() => sim?.AdjustRods(5f));

        GameObject b2 = CreateButton("BtnDown", card2.transform, "▼ ИЗВЛЕЧЬ (-5%)", new Vector2(0.36f, 0.15f), new Vector2(0.65f, 0.38f), new Color(0.5f, 0.38f, 0.1f));
        _tab1BtnDown = b2.GetComponent<Button>();
        _tab1BtnDown.onClick.AddListener(() => sim?.AdjustRods(-5f));

        GameObject azGo = CreateButton("BtnAZ5", card2.transform, "АЗ-1 / АЗ-5\nАВАРИЙНЫЙ СБРОС", new Vector2(0.72f, 0.15f), new Vector2(0.96f, 0.85f), new Color(0.85f, 0.12f, 0.12f));
        _tab1BtnAz5 = azGo.GetComponent<Button>();
        _tab1Az5Img = azGo.GetComponent<Image>();
        _tab1BtnAz5.onClick.AddListener(() => {
            if (sim != null)
            {
                if (sim.isScramActive) sim.ResetPlant();
                else sim.TriggerEmergencyScram();
            }
        });
    }

    private void BuildTab2(Transform parent)
    {
        GameObject p = CreateUI("Panel_Tab2", parent);
        SetStretch(p.GetComponent<RectTransform>());
        _tabPanels[1] = p;

        GameObject card1 = CreateCard("Card_LoopTelemetry", p.transform, new Vector2(0f, 0.52f), new Vector2(1f, 1f));
        _tab2PressureText = CreateText("PressureText", card1.transform, "ДАВЛЕНИЕ 1 КОНТУРА: 16.20 МПа (НОРМА)", 30f);
        SetStretchMargins(_tab2PressureText.GetComponent<RectTransform>(), 30, 30, 30, 50);

        GameObject prBg = CreateUI("PressureBarBg", card1.transform);
        Image prBgImg = prBg.AddComponent<Image>();
        prBgImg.color = new Color(0.12f, 0.16f, 0.22f);
        RectTransform prrt = prBg.GetComponent<RectTransform>();
        prrt.anchorMin = new Vector2(0.02f, 0.08f);
        prrt.anchorMax = new Vector2(0.98f, 0.22f);
        prrt.offsetMin = Vector2.zero; prrt.offsetMax = Vector2.zero;

        GameObject prFill = CreateUI("Fill", prBg.transform);
        _tab2PressureBar = prFill.AddComponent<Image>();
        _tab2PressureBar.color = new Color(0f, 0.75f, 1.0f);
        SetStretch(prFill.GetComponent<RectTransform>());

        GameObject card2 = CreateCard("Card_Pumps", p.transform, new Vector2(0f, 0f), new Vector2(1f, 0.48f));
        _tab2FlowText = CreateText("PumpsTitle", card2.transform, "<b>ГЛАВНЫЕ ЦИРКУЛЯЦИОННЫЕ НАСОСЫ (4 ПЕТЛИ ГЦН):</b>", 24f);
        RectTransform rt = _tab2FlowText.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(0.04f, 0.75f);
        rt.anchorMax = new Vector2(0.96f, 0.95f);
        rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;

        for (int i = 0; i < 4; i++)
        {
            int pIdx = i;
            float step = 0.92f / 4.0f;
            GameObject btnGo = CreateButton("BtnPump_" + i, card2.transform, $"ГЦН-{i + 1}\nВКЛ",
                new Vector2(0.04f + i * step, 0.18f), new Vector2(0.04f + (i + 1) * step - 0.02f, 0.68f),
                new Color(0.12f, 0.45f, 0.65f));
            _tab2PumpButtons[i] = btnGo.GetComponent<Button>();
            _tab2PumpButtonTexts[i] = btnGo.GetComponentInChildren<TextMeshProUGUI>();
            _tab2PumpButtons[i].onClick.AddListener(() => sim?.TogglePump(pIdx));
        }
    }

    private void BuildTab3(Transform parent)
    {
        GameObject p = CreateUI("Panel_Tab3", parent);
        SetStretch(p.GetComponent<RectTransform>());
        _tabPanels[2] = p;

        GameObject card1 = CreateCard("Card_Heatmap", p.transform, new Vector2(0f, 0.25f), new Vector2(1f, 1f));
        _tab3HeatmapText = CreateText("HeatmapText", card1.transform, "КАРТА РАСПРЕДЕЛЕНИЯ ТЕМПЕРАТУР ПО 163 ТВС ВВЭР-1200...", 24f);
        SetStretchMargins(_tab3HeatmapText.GetComponent<RectTransform>(), 30, 30, 30, 30);

        GameObject card2 = CreateCard("Card_Actions", p.transform, new Vector2(0f, 0f), new Vector2(1f, 0.22f));
        GameObject resetBtn = CreateButton("BtnReset", card2.transform, "СБРОС ЭНЕРГОБЛОКА В НОМИНАЛ (100% МОЩНОСТИ)",
            new Vector2(0.2f, 0.15f), new Vector2(0.8f, 0.85f), new Color(0.12f, 0.55f, 0.35f));
        _tab3BtnReset = resetBtn.GetComponent<Button>();
        _tab3BtnReset.onClick.AddListener(() => sim?.ResetPlant());
    }

    private void BuildTab4(Transform parent)
    {
        GameObject p = CreateUI("Panel_Tab4", parent);
        SetStretch(p.GetComponent<RectTransform>());
        _tabPanels[3] = p;

        GameObject card1 = CreateCard("Card_Turbine", p.transform, new Vector2(0f, 0.4f), new Vector2(1f, 1f));
        _tab4TurbineText = CreateText("TurbineText", card1.transform, "ТУРБОГЕНЕРАТОР ТГ-1 (1200 МВт эл., 3000 об/мин)", 28f);
        SetStretchMargins(_tab4TurbineText.GetComponent<RectTransform>(), 30, 30, 30, 50);

        GameObject tbBg = CreateUI("TurbineBarBg", card1.transform);
        Image tbBgImg = tbBg.AddComponent<Image>();
        tbBgImg.color = new Color(0.12f, 0.16f, 0.22f);
        RectTransform tbrt = tbBg.GetComponent<RectTransform>();
        tbrt.anchorMin = new Vector2(0.02f, 0.08f);
        tbrt.anchorMax = new Vector2(0.98f, 0.22f);
        tbrt.offsetMin = Vector2.zero; tbrt.offsetMax = Vector2.zero;

        GameObject tbFill = CreateUI("Fill", tbBg.transform);
        _tab4TurbineBar = tbFill.AddComponent<Image>();
        _tab4TurbineBar.color = new Color(1.0f, 0.85f, 0.2f);
        SetStretch(tbFill.GetComponent<RectTransform>());

        GameObject card2 = CreateCard("Card_TurbineBtns", p.transform, new Vector2(0f, 0f), new Vector2(1f, 0.36f));

        GameObject b1 = CreateButton("BtnTurbine", card2.transform, "СТОПОРНЫЕ КЛАПАНЫ ТУРБИНЫ (СК ТП)",
            new Vector2(0.08f, 0.2f), new Vector2(0.48f, 0.8f), new Color(0.55f, 0.45f, 0.12f));
        _tab4BtnTurbine = b1.GetComponent<Button>();
        _tab4BtnTurbine.onClick.AddListener(() => sim?.ToggleTurbine());

        GameObject b2 = CreateButton("BtnGrid", card2.transform, "ГЕНЕРАТОРНЫЙ ВЫКЛЮЧАТЕЛЬ СЕТИ",
            new Vector2(0.52f, 0.2f), new Vector2(0.92f, 0.8f), new Color(0.15f, 0.45f, 0.65f));
        _tab4BtnGrid = b2.GetComponent<Button>();
        _tab4BtnGrid.onClick.AddListener(() => sim?.ToggleGrid());
    }

    private void BuildTab5(Transform parent)
    {
        GameObject p = CreateUI("Panel_Tab5", parent);
        SetStretch(p.GetComponent<RectTransform>());
        _tabPanels[4] = p;

        // Left Card: Live CCTV Camera Stream
        GameObject card1 = CreateCard("Card_CCTV", p.transform, new Vector2(0f, 0f), new Vector2(0.58f, 1f));

        GameObject cctvRaw = CreateUI("CCTV_Display", card1.transform);
        _tab5CctvImage = cctvRaw.AddComponent<RawImage>();
        var cctvSys = ReactorCCTVSystem.Instance;
        if (cctvSys != null && cctvSys.cctvRenderTexture != null)
        {
            _tab5CctvImage.texture = cctvSys.cctvRenderTexture;
        }
        RectTransform cctvRt = cctvRaw.GetComponent<RectTransform>();
        cctvRt.anchorMin = new Vector2(0.02f, 0.15f);
        cctvRt.anchorMax = new Vector2(0.98f, 0.98f);
        cctvRt.offsetMin = Vector2.zero; cctvRt.offsetMax = Vector2.zero;

        // CCTV OSD text overlay
        GameObject osdGo = CreateUI("CCTV_OSD", cctvRaw.transform);
        _tab5CctvOverlayText = osdGo.AddComponent<TextMeshProUGUI>();
        _tab5CctvOverlayText.fontSize = 20f;
        _tab5CctvOverlayText.fontStyle = FontStyles.Bold;
        _tab5CctvOverlayText.color = new Color(0f, 1f, 0.4f);
        _tab5CctvOverlayText.alignment = TextAlignmentOptions.TopLeft;
        SetStretchMargins(osdGo.GetComponent<RectTransform>(), 15, 15, 15, 15);

        // Switch Camera Angle button
        GameObject switchBtn = CreateButton("BtnSwitchCam", card1.transform, "🎥 СМЕНИТЬ РАКУРС КАМЕРЫ",
            new Vector2(0.05f, 0.02f), new Vector2(0.95f, 0.12f), new Color(0.15f, 0.45f, 0.65f));
        _tab5BtnSwitchCam = switchBtn.GetComponent<Button>();
        _tab5BtnSwitchCam.onClick.AddListener(() => {
            ReactorCCTVSystem.Instance?.SwitchCameraNext();
        });

        // Right Card: Safety & Instructor Fault Scenarios
        GameObject card2 = CreateCard("Card_Safety_Faults", p.transform, new Vector2(0.60f, 0f), new Vector2(1f, 1f));

        _tab5SafetyText = CreateText("SafetyTitle", card2.transform, "<b>СИСТЕМЫ БЕЗОПАСНОСТИ РЕАКТОРА:</b>", 22f);
        RectTransform srt = _tab5SafetyText.GetComponent<RectTransform>();
        srt.anchorMin = new Vector2(0.05f, 0.72f);
        srt.anchorMax = new Vector2(0.95f, 0.96f);
        srt.offsetMin = Vector2.zero; srt.offsetMax = Vector2.zero;

        var faultTitle = CreateText("FaultTitle", card2.transform, "<b>ИНСТРУКТОРСКИЕ СЦЕНАРИИ:</b>", 21f);
        RectTransform ftr = faultTitle.GetComponent<RectTransform>();
        ftr.anchorMin = new Vector2(0.05f, 0.58f);
        ftr.anchorMax = new Vector2(0.95f, 0.70f);
        ftr.offsetMin = Vector2.zero; ftr.offsetMax = Vector2.zero;

        GameObject f1 = CreateButton("Fault_RCP", card2.transform, "⚠️ ОТКЛЮЧЕНИЕ ГЦН-2 (RCP2_TRIP)",
            new Vector2(0.05f, 0.42f), new Vector2(0.95f, 0.55f), new Color(0.6f, 0.35f, 0.1f));
        _tab5BtnFaultRcp = f1.GetComponent<Button>();
        _tab5BtnFaultRcp.onClick.AddListener(() => sim?.SendServerCommand("INJECT_FAULT", "RCP2_TRIP"));

        GameObject f2 = CreateButton("Fault_Grid", card2.transform, "⚡ ОТКЛЮЧЕНИЕ ОТ СЕТИ (GRID_LOSS)",
            new Vector2(0.05f, 0.27f), new Vector2(0.95f, 0.40f), new Color(0.6f, 0.25f, 0.1f));
        _tab5BtnFaultGrid = f2.GetComponent<Button>();
        _tab5BtnFaultGrid.onClick.AddListener(() => sim?.SendServerCommand("INJECT_FAULT", "GRID_LOSS"));

        GameObject f3 = CreateButton("Fault_Press", card2.transform, "📈 РОСТ ДАВЛЕНИЯ В 1 КОНТУРЕ",
            new Vector2(0.05f, 0.12f), new Vector2(0.95f, 0.25f), new Color(0.65f, 0.15f, 0.15f));
        _tab5BtnFaultPress = f3.GetComponent<Button>();
        _tab5BtnFaultPress.onClick.AddListener(() => sim?.SendServerCommand("INJECT_FAULT", "PRESSURE_SURGE"));

        GameObject f4 = CreateButton("Reset_All", card2.transform, "🔄 СБРОСИТЬ ВСЕ В НОМИНАЛ (100%)",
            new Vector2(0.05f, 0.01f), new Vector2(0.95f, 0.10f), new Color(0.12f, 0.55f, 0.35f));
        _tab5BtnResetAll = f4.GetComponent<Button>();
        _tab5BtnResetAll.onClick.AddListener(() => sim?.ResetPlant());
    }

    #endregion

    #region Data Binding & Smooth Animation

    private void RefreshActiveTab()
    {
        if (sim == null || !isOpen) return;

        if (_headerSubText)
        {
            _headerSubText.text = $"{sim.serverStatusString} | Тепловая мощность: {sim.thermalPower:F0} МВт | P1: {sim.primaryPressure:F2} МПа | Nэл: {sim.electricPower:F0} МВт";
        }

        switch (currentTab)
        {
            case 0:
                if (_tab1PowerText)
                {
                    string col = sim.isScramActive ? "#FF3333" : "#33FF88";
                    _tab1PowerText.text = $"<color={col}>ТЕПЛОВАЯ МОЩНОСТЬ: {sim.thermalPower:F0} МВт ({(sim.thermalPower / 3200f) * 100f:F1} %)</color>\n" +
                                          $"<size=75%>Температура топлива: {sim.fuelTemperature:F1} °C | Реактивность: {sim.reactivity:+0.0;-0.0;0.0} pcm | Период: T = {(sim.reactorPeriod > 1000 ? "> 9999" : sim.reactorPeriod.ToString("F0"))} с</size>";
                }
                if (_tab1RodsText)
                {
                    string st = sim.isScramActive ? "<color=red>[АЗ-1 СРАБОТАЛА]</color>" : "<color=green>[РЕЖИМ: СТАЦИОНАР]</color>";
                    _tab1RodsText.text = $"<b>РЕГУЛИРУЮЩАЯ ГРУППА СТЕРЖНЕЙ СУЗ:</b> {sim.controlRodsPosition:F1}% ПОГРУЖЕНО  {st}";
                }
                bool isInteracting = UnityEngine.EventSystems.EventSystem.current != null &&
                                     UnityEngine.EventSystems.EventSystem.current.currentSelectedGameObject == (_tab1RodsSlider ? _tab1RodsSlider.gameObject : null);
                if (_tab1RodsSlider && !isInteracting)
                {
                    _tab1RodsSlider.SetValueWithoutNotify(sim.controlRodsPosition);
                }
                if (_tab1Az5Img)
                {
                    _tab1Az5Img.color = sim.isScramActive ? new Color(0.95f, 0.4f, 0.1f) : new Color(0.85f, 0.12f, 0.12f);
                }
                break;

            case 1:
                if (_tab2PressureText)
                {
                    string pCol = (sim.primaryPressure > 16.6f || sim.primaryPressure < 15.5f) ? "#FFAA00" : "#33CCFF";
                    _tab2PressureText.text = $"<color={pCol}>ДАВЛЕНИЕ 1 КОНТУРА: {sim.primaryPressure:F2} МПа</color>\n" +
                                             $"<size=75%>Расход теплоносителя: {sim.totalCoolantFlow:F0} кг/с | Уровень в КД: {sim.pzrLevel:F2} м\n" +
                                             $"Вход в реактор: {sim.coolantTempIn:F1} °C | Выход: {sim.coolantTempOut:F1} °C (ΔT = {sim.coolantTempOut - sim.coolantTempIn:F1} °C)</size>";
                }
                for (int i = 0; i < 4; i++)
                {
                    if (_tab2PumpButtons[i] != null)
                    {
                        bool on = sim.pumpActive[i];
                        _tab2PumpButtons[i].GetComponent<Image>().color = on ? new Color(0.12f, 0.45f, 0.25f) : new Color(0.55f, 0.15f, 0.15f);
                        if (_tab2PumpButtonTexts[i])
                        {
                            _tab2PumpButtonTexts[i].text = $"ГЦН-{i + 1}\n{(on ? "<color=green>ВКЛ</color>" : "<color=red>ОТКЛ</color>")}";
                        }
                    }
                }
                break;

            case 2:
                if (_tab3HeatmapText)
                {
                    _tab3HeatmapText.text = $"<b>ТЕПЛОВАЯ КАРТА АКТИВНОЙ ЗОНЫ ВВЭР-1200:</b>\n" +
                                            $"Средняя температура теплоносителя в зоне: {(sim.coolantTempOut + sim.coolantTempIn) / 2f:F1} °C\n" +
                                            $"Максимальная температура оболочки ТВС: {sim.fuelTemperature:F1} °C\n\n" +
                                            $"• Сектор 1 (Петля А): {sim.coolantTempOut - 1.8f:F1} °C  [НОРМАЛЬНЫЙ ТЕПЛОСЪЕМ]\n" +
                                            $"• Сектор 2 (Петля B): {sim.coolantTempOut + 0.9f:F1} °C  [НОРМАЛЬНЫЙ ТЕПЛОСЪЕМ]\n" +
                                            $"• Сектор 3 (Петля C): {sim.coolantTempOut + 2.1f:F1} °C  [НОРМАЛЬНЫЙ ТЕПЛОСЪЕМ]\n" +
                                            $"• Сектор 4 (Петля D): {sim.coolantTempOut - 1.2f:F1} °C  [НОРМАЛЬНЫЙ ТЕПЛОСЪЕМ]\n\n" +
                                            $"Запас до кризиса теплоотдачи (DNBR): 2.18 (Норматив ПБЯ > 1.30)\n" +
                                            $"Коэффициент радиальной неравномерности Kr: 1.14";
                }
                break;

            case 3:
                if (_tab4TurbineText)
                {
                    string tCol = sim.turbineOnline ? "#FFDD33" : "#FF5533";
                    _tab4TurbineText.text = $"<color={tCol}>ЭЛЕКТРИЧЕСКАЯ МОЩНОСТЬ: {sim.electricPower:F0} МВт (эл.)</color>\n" +
                                            $"<size=75%>Обороты валопровода турбины: {sim.turbineRPM:F0} ОБ/МИН | Частота сети: {sim.gridFrequency:F2} Гц\n" +
                                            $"Давление пара 2 контура: {sim.secondaryPressure:F2} МПа | Расход пара на турбину: {sim.steamFlow:F0} кг/с\n" +
                                            $"Стопорные клапаны: {(sim.turbineOnline ? "<color=green>ОТКРЫТЫ</color>" : "<color=red>ПОСАЖЕНЫ (ТРИП)</color>")} | " +
                                            $"Генератор: {(sim.gridConnected ? "<color=green>В СЕТИ</color>" : "<color=yellow>ОТКЛЮЧЕН</color>")}</size>";
                }
                if (_tab4BtnTurbine)
                {
                    _tab4BtnTurbine.GetComponent<Image>().color = sim.turbineOnline ? new Color(0.15f, 0.45f, 0.25f) : new Color(0.6f, 0.35f, 0.1f);
                }
                if (_tab4BtnGrid)
                {
                    _tab4BtnGrid.GetComponent<Image>().color = sim.gridConnected ? new Color(0.12f, 0.45f, 0.65f) : new Color(0.5f, 0.2f, 0.2f);
                }
                break;

            case 4:
                if (_tab5CctvImage && ReactorCCTVSystem.Instance != null && _tab5CctvImage.texture == null)
                {
                    _tab5CctvImage.texture = ReactorCCTVSystem.Instance.cctvRenderTexture;
                }
                if (_tab5CctvOverlayText && ReactorCCTVSystem.Instance != null)
                {
                    _tab5CctvOverlayText.text = ReactorCCTVSystem.Instance.GetCameraStatusOverlay();
                }
                if (_tab5SafetyText)
                {
                    _tab5SafetyText.text = $"<b>СИСТЕМЫ БЕЗОПАСНОСТИ РЕАКТОРА:</b>\n" +
                                           $"• Радиационный фон БЩУ: {sim.radiationControlRoom:F1} мкР/ч [НОРМА]\n" +
                                           $"• Радиационный фон реакторного отделения: {sim.radiationReactorHall:F1} мкР/ч [НОРМА]\n" +
                                           $"• Гермооболочка: {(sim.containmentSealed ? "<color=green>ГЕРМЕТИЧНА</color>" : "<color=red>РАЗГЕРМЕТИЗАЦИЯ</color>")}\n" +
                                           $"• САОЗ: {(sim.safetyECCS ? "<color=green>ГОТОВНОСТЬ</color>" : "<color=red>ОТКЛЮЧЕНА</color>")}";
                }
                break;
        }
    }

    private void AnimateUI()
    {
        if (sim == null) return;
        float dt = Time.deltaTime;

        // Smooth fill bars
        if (_tab1PowerBar != null)
        {
            float target = Mathf.Clamp01(sim.thermalPower / 3200f);
            RectTransform rt = _tab1PowerBar.rectTransform;
            rt.anchorMax = new Vector2(Mathf.MoveTowards(rt.anchorMax.x, target, dt * 2f), 1f);
        }

        if (_tab2PressureBar != null)
        {
            float target = Mathf.Clamp01(sim.primaryPressure / 20.0f);
            RectTransform rt = _tab2PressureBar.rectTransform;
            rt.anchorMax = new Vector2(Mathf.MoveTowards(rt.anchorMax.x, target, dt * 2f), 1f);
        }

        if (_tab4TurbineBar != null)
        {
            float target = Mathf.Clamp01(sim.electricPower / 1200f);
            RectTransform rt = _tab4TurbineBar.rectTransform;
            rt.anchorMax = new Vector2(Mathf.MoveTowards(rt.anchorMax.x, target, dt * 2f), 1f);
        }
    }

    #endregion

    #region Helper Factory Methods

    private GameObject CreateUI(string name, Transform parent)
    {
        GameObject go = new GameObject(name);
        go.transform.SetParent(parent, false);
        go.AddComponent<RectTransform>();
        return go;
    }

    private GameObject CreateCard(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax)
    {
        GameObject card = CreateUI(name, parent);
        Image img = card.AddComponent<Image>();
        img.color = new Color(0.08f, 0.11f, 0.16f, 0.95f);
        RectTransform rt = card.GetComponent<RectTransform>();
        rt.anchorMin = anchorMin;
        rt.anchorMax = anchorMax;
        rt.offsetMin = new Vector2(8, 8);
        rt.offsetMax = new Vector2(-8, -8);
        return card;
    }

    private TMP_FontAsset _cyrillicFont = null;
    private TMP_FontAsset GetCyrillicFont()
    {
        if (_cyrillicFont != null) return _cyrillicFont;
        _cyrillicFont = Resources.Load<TMP_FontAsset>("Arial_Dynamic_SDF");
        return _cyrillicFont;
    }

    private TextMeshProUGUI CreateText(string name, Transform parent, string text, float fontSize)
    {
        GameObject go = CreateUI(name, parent);
        var tmp = go.AddComponent<TextMeshProUGUI>();
        var f = GetCyrillicFont();
        if (f != null) tmp.font = f;
        tmp.text = text;
        tmp.fontSize = fontSize;
        tmp.color = Color.white;
        tmp.alignment = TextAlignmentOptions.MidlineLeft;
        return tmp;
    }

    private GameObject CreateButton(string name, Transform parent, string label, Vector2 anchorMin, Vector2 anchorMax, Color col)
    {
        GameObject btnObj = CreateUI(name, parent);
        Image img = btnObj.AddComponent<Image>();
        img.color = col;
        Button btn = btnObj.AddComponent<Button>();

        ColorBlock cb = btn.colors;
        cb.normalColor = col;
        cb.highlightedColor = col * 1.25f;
        cb.pressedColor = col * 0.75f;
        btn.colors = cb;

        RectTransform rt = btnObj.GetComponent<RectTransform>();
        rt.anchorMin = anchorMin;
        rt.anchorMax = anchorMax;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;

        GameObject txtObj = CreateUI("Label", btnObj.transform);
        var tmp = txtObj.AddComponent<TextMeshProUGUI>();
        var f = GetCyrillicFont();
        if (f != null) tmp.font = f;
        tmp.text = label;
        tmp.fontSize = 20f;
        tmp.fontStyle = FontStyles.Bold;
        tmp.color = Color.white;
        tmp.alignment = TextAlignmentOptions.Center;

        SetStretch(txtObj.GetComponent<RectTransform>());
        return btnObj;
    }

    private GameObject CreateSlider(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax)
    {
        GameObject sliderGo = CreateUI(name, parent);
        RectTransform srt = sliderGo.GetComponent<RectTransform>();
        srt.anchorMin = anchorMin;
        srt.anchorMax = anchorMax;
        srt.offsetMin = Vector2.zero;
        srt.offsetMax = Vector2.zero;

        Slider slider = sliderGo.AddComponent<Slider>();

        GameObject bgObj = CreateUI("Background", sliderGo.transform);
        Image bgImg = bgObj.AddComponent<Image>();
        bgImg.color = new Color(0.12f, 0.16f, 0.22f);
        RectTransform bgrt = bgObj.GetComponent<RectTransform>();
        bgrt.anchorMin = new Vector2(0f, 0.35f);
        bgrt.anchorMax = new Vector2(1f, 0.65f);
        bgrt.offsetMin = Vector2.zero;
        bgrt.offsetMax = Vector2.zero;

        GameObject fillArea = CreateUI("Fill Area", sliderGo.transform);
        RectTransform fart = fillArea.GetComponent<RectTransform>();
        fart.anchorMin = new Vector2(0f, 0.35f);
        fart.anchorMax = new Vector2(1f, 0.65f);
        fart.offsetMin = Vector2.zero;
        fart.offsetMax = Vector2.zero;

        GameObject fill = CreateUI("Fill", fillArea.transform);
        Image fillImg = fill.AddComponent<Image>();
        fillImg.color = new Color(0.12f, 0.75f, 0.45f);
        SetStretch(fill.GetComponent<RectTransform>());
        slider.fillRect = fill.GetComponent<RectTransform>();

        GameObject handleArea = CreateUI("Handle Slide Area", sliderGo.transform);
        SetStretch(handleArea.GetComponent<RectTransform>());

        GameObject handle = CreateUI("Handle", handleArea.transform);
        Image handleImg = handle.AddComponent<Image>();
        handleImg.color = Color.white;
        RectTransform hrt = handle.GetComponent<RectTransform>();
        hrt.sizeDelta = new Vector2(28f, 0f);
        hrt.anchorMin = new Vector2(0f, 0.1f);
        hrt.anchorMax = new Vector2(0f, 0.9f);
        slider.handleRect = hrt;
        slider.targetGraphic = handleImg;

        return sliderGo;
    }

    private void SetStretch(RectTransform rt)
    {
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }

    private void SetStretchMargins(RectTransform rt, float left, float right, float top, float bottom)
    {
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = new Vector2(left, bottom);
        rt.offsetMax = new Vector2(-right, -top);
    }

    #endregion
}

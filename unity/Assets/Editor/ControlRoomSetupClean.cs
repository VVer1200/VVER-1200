using System;
using UnityEngine;
using UnityEngine.UI;
using UnityEditor;
using TMPro;

[InitializeOnLoad]
public static class ControlRoomSetupClean
{
    private static bool _executed = false;

    static ControlRoomSetupClean()
    {
        EditorApplication.delayCall += () =>
        {
            if (!_executed)
            {
                _executed = true;
                BuildCleanControlRoom();
            }
        };
    }

    [MenuItem("Tools/Control Room/Build Interactive Control Room")]
    public static void BuildCleanControlRoom()
    {
        try
        {
            CleanupOldArtifacts();
            SetupRealisticPBRMaterials();
            FixMaterialsAndLighting();
            EnsureSimulationSystem();
            SetupReactorHallEffects();
            SetupCentralWallMnemonic();
            SetupFullscreenUI();
            SetupInteractiveMonitors();

            UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(UnityEngine.SceneManagement.SceneManager.GetActiveScene());
            AssetDatabase.SaveAssets();

            Debug.Log("<color=green><b>[ControlRoom]</b> VVER-1200 Control Room rebuilt with 4K PBR Normal Maps, 3D relief, active SCADA dials, and flush monitors!</color>");
        }
        catch (Exception ex)
        {
            Debug.LogError($"Error in ControlRoomSetupClean: {ex}");
        }
    }

    private static void CleanupOldArtifacts()
    {
        GameObject room1 = GameObject.Find("room1");
        if (room1 == null) return;

        Transform floatingBox = room1.transform.Find("DeskInclineConsole");
        if (floatingBox != null) UnityEngine.Object.DestroyImmediate(floatingBox.gameObject);

        Transform wallBoard = room1.transform.Find("WallAnnunciatorBoard");
        if (wallBoard != null) UnityEngine.Object.DestroyImmediate(wallBoard.gameObject);

        var strayConsoles = GameObject.FindObjectsByType<Transform>(FindObjectsSortMode.None);
        foreach (var t in strayConsoles)
        {
            if (t != null && (t.name == "DeskInclineConsole" || t.name == "WallAnnunciatorBoard"))
            {
                UnityEngine.Object.DestroyImmediate(t.gameObject);
            }
        }

        var allCanvases = Resources.FindObjectsOfTypeAll<Canvas>();
        foreach (var c in allCanvases)
        {
            if (c != null && c.gameObject != null && c.gameObject.name.StartsWith("MonitorInteractiveCanvas") && !EditorUtility.IsPersistent(c.gameObject))
            {
                UnityEngine.Object.DestroyImmediate(c.gameObject);
            }
        }

        GameObject cube4 = GameObject.Find("Cube (4)");
        if (cube4 != null)
        {
            var btm = cube4.GetComponent("BrowserToMonitor");
            if (btm != null) UnityEngine.Object.DestroyImmediate(btm);
            var ci = cube4.GetComponent("ComputerInteraction");
            if (ci != null) UnityEngine.Object.DestroyImmediate(ci);
        }
    }

    private static void EnsureNormalMapImporter(string assetPath)
    {
        var importer = AssetImporter.GetAtPath(assetPath) as TextureImporter;
        if (importer != null && importer.textureType != TextureImporterType.NormalMap)
        {
            importer.textureType = TextureImporterType.NormalMap;
            importer.SaveAndReimport();
        }
    }

    private static void SetupRealisticPBRMaterials()
    {
        Shader standardShader = Shader.Find("Standard");

        // 1. Ensure all 4K Normal Maps are imported as NormalMap
        EnsureNormalMapImporter("Assets/Materials/tiles_0013_normal_directx_4k.png");
        EnsureNormalMapImporter("Assets/Materials/Tiles040_4K-JPG_NormalDX.jpg");
        EnsureNormalMapImporter("Assets/Materials/Metal033_4K-JPG_NormalDX.jpg");
        EnsureNormalMapImporter("Assets/Materials/Leather039_4K-JPG_NormalDX.jpg");
        EnsureNormalMapImporter("Assets/Materials/keyboard_mat_Normal.jpg");
        EnsureNormalMapImporter("Assets/Materials/ikea_markus_mat_Normal.jpg");

        // 2. High-Quality 4K Floor Material (плитка на полу с 3D рельефом и отражениями)
        Material plitkaMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/materials/plitka.mat");
        if (plitkaMat != null)
        {
            plitkaMat.shader = standardShader;
            var colTex = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Materials/tiles_0013_color_4k.jpg");
            var normTex = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Materials/tiles_0013_normal_directx_4k.png");
            var metTex = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Materials/tiles_0013_metallic_4k.jpg");
            var aoTex = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Materials/tiles_0013_ao_4k.jpg");

            if (colTex != null) plitkaMat.mainTexture = colTex;
            if (normTex != null)
            {
                plitkaMat.SetTexture("_BumpMap", normTex);
                plitkaMat.EnableKeyword("_NORMALMAP");
                plitkaMat.SetFloat("_BumpScale", 1.35f);
            }
            if (metTex != null)
            {
                plitkaMat.SetTexture("_MetallicGlossMap", metTex);
                plitkaMat.EnableKeyword("_METALLICGLOSSMAP");
            }
            if (aoTex != null)
            {
                plitkaMat.SetTexture("_OcclusionMap", aoTex);
                plitkaMat.SetFloat("_OcclusionStrength", 1.0f);
            }

            plitkaMat.mainTextureScale = new Vector2(6f, 6f);
            plitkaMat.SetTextureScale("_BumpMap", new Vector2(6f, 6f));
            plitkaMat.SetFloat("_Glossiness", 0.72f);
            plitkaMat.SetFloat("_Metallic", 0.25f);
            EditorUtility.SetDirty(plitkaMat);
        }

        // 3. Brushed Metal 4K Material (металл пультов, стоек и стеновых каркасов)
        Material metalMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/materials/metall.mat");
        if (metalMat != null)
        {
            metalMat.shader = standardShader;
            var mCol = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Materials/Metal033_4K-JPG_Color.jpg");
            var mNorm = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Materials/Metal033_4K-JPG_NormalDX.jpg");
            var mMet = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Materials/Metal033_4K-JPG_Metalness.jpg");

            if (mCol != null) metalMat.mainTexture = mCol;
            if (mNorm != null)
            {
                metalMat.SetTexture("_BumpMap", mNorm);
                metalMat.EnableKeyword("_NORMALMAP");
                metalMat.SetFloat("_BumpScale", 1.1f);
            }
            metalMat.SetFloat("_Metallic", 0.88f);
            metalMat.SetFloat("_Glossiness", 0.65f);
            EditorUtility.SetDirty(metalMat);
        }

        // 4. Operator Chairs Leather 4K Material (кожа кресел с рельефом и швами)
        Material chairMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/materials/ikea.mat");
        if (chairMat != null)
        {
            chairMat.shader = standardShader;
            var cCol = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Materials/Leather039_4K-JPG_Color.jpg");
            var cNorm = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Materials/Leather039_4K-JPG_NormalDX.jpg");

            if (cCol != null) chairMat.mainTexture = cCol;
            if (cNorm != null)
            {
                chairMat.SetTexture("_BumpMap", cNorm);
                chairMat.EnableKeyword("_NORMALMAP");
                chairMat.SetFloat("_BumpScale", 1.4f);
            }
            chairMat.mainTextureScale = new Vector2(3f, 3f);
            if (cNorm != null) chairMat.SetTextureScale("_BumpMap", new Vector2(3f, 3f));
            chairMat.color = new Color(0.22f, 0.20f, 0.18f);
            chairMat.SetFloat("_Glossiness", 0.45f);
            chairMat.SetFloat("_Metallic", 0.05f);
            EditorUtility.SetDirty(chairMat);
        }

        // 5. Keyboards Material with Keycap Normal Map
        Material kbMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/materials/keyboard.mat");
        if (kbMat != null)
        {
            kbMat.shader = standardShader;
            var kbCol = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Materials/keyboard_mat_BaseColor.jpg");
            var kbNorm = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Materials/keyboard_mat_Normal.jpg");

            if (kbCol != null) kbMat.mainTexture = kbCol;
            if (kbNorm != null)
            {
                kbMat.SetTexture("_BumpMap", kbNorm);
                kbMat.EnableKeyword("_NORMALMAP");
                kbMat.SetFloat("_BumpScale", 1.0f);
            }
            kbMat.SetFloat("_Glossiness", 0.55f);
            kbMat.SetFloat("_Metallic", 0.20f);
            EditorUtility.SetDirty(kbMat);
        }
    }

    private static void FixMaterialsAndLighting()
    {
        Shader standardShader = Shader.Find("Standard");
        GameObject room1 = GameObject.Find("room1");
        if (room1 == null) return;

        // 1. Clean light industrial wall material
        Material wallMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/materials/stena.mat");
        if (wallMat != null)
        {
            wallMat.shader = standardShader;
            wallMat.color = new Color(0.72f, 0.76f, 0.74f);
            wallMat.SetFloat("_Glossiness", 0.25f);
            wallMat.SetFloat("_Metallic", 0.05f);
            EditorUtility.SetDirty(wallMat);
        }

        // 2. Monitor glass backing (sleek dark bezel behind canvas)
        Material winMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/materials/windows.mat");
        if (winMat != null)
        {
            winMat.shader = standardShader;
            winMat.mainTexture = null;
            winMat.color = new Color(0.02f, 0.03f, 0.04f);
            winMat.SetFloat("_Glossiness", 0.90f);
            winMat.SetFloat("_Metallic", 0.15f);
            EditorUtility.SetDirty(winMat);
        }

        Material browserMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/materials/Browser.mat");
        if (browserMat != null)
        {
            browserMat.shader = standardShader;
            browserMat.mainTexture = null;
            browserMat.color = new Color(0.02f, 0.03f, 0.04f);
            browserMat.SetFloat("_Glossiness", 0.90f);
            EditorUtility.SetDirty(browserMat);
        }

        // 3. Partition wall behind desk (Cube, Cube (1), Cube (2), Cube (3))
        Material partitionMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/materials/PartitionWall.mat");
        if (partitionMat == null)
        {
            partitionMat = new Material(standardShader);
            AssetDatabase.CreateAsset(partitionMat, "Assets/Materials/materials/PartitionWall.mat");
        }
        partitionMat.shader = standardShader;
        var pNorm = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Materials/Metal033_4K-JPG_NormalDX.jpg");
        if (pNorm != null)
        {
            partitionMat.SetTexture("_BumpMap", pNorm);
            partitionMat.EnableKeyword("_NORMALMAP");
            partitionMat.SetFloat("_BumpScale", 0.8f);
            partitionMat.SetTextureScale("_BumpMap", new Vector2(4f, 2f));
        }
        partitionMat.color = new Color(0.24f, 0.28f, 0.32f);
        partitionMat.SetFloat("_Glossiness", 0.55f);
        partitionMat.SetFloat("_Metallic", 0.65f);
        EditorUtility.SetDirty(partitionMat);

        foreach (Transform child in room1.transform)
        {
            if (child.name == "Cube" || child.name == "Cube (1)" || child.name == "Cube (2)" || child.name == "Cube (3)")
            {
                var mr = child.GetComponent<MeshRenderer>();
                if (mr != null) mr.sharedMaterial = partitionMat;
            }
        }

        // 4. Cube (4) - The giant central wall monitor panel
        GameObject cube4 = GameObject.Find("Cube (4)");
        if (cube4 != null)
        {
            var mr = cube4.GetComponent<MeshRenderer>();
            if (mr != null)
            {
                Material screenBackMat = new Material(standardShader)
                {
                    color = new Color(0.015f, 0.02f, 0.03f),
                    name = "CentralWallScreenMat"
                };
                screenBackMat.SetFloat("_Glossiness", 0.85f);
                mr.sharedMaterial = screenBackMat;
            }
        }

        // 5. Control Room Lighting & Reflection Probe for realistic PBR reflections
        Transform oldLight = room1.transform.Find("Point Light");
        if (oldLight != null)
        {
            Light l = oldLight.GetComponent<Light>();
            if (l != null)
            {
                l.color = new Color(0.95f, 0.98f, 1.0f);
                l.intensity = 1.4f;
                l.range = 16f;
                l.shadows = LightShadows.Soft;
            }
        }

        EnsureCeilingLight(room1, "CeilingLight_Desk", new Vector3(9.74f, 2.0f, 2.5f), 1.35f, 12f);
        EnsureCeilingLight(room1, "CeilingLight_BackWall", new Vector3(9.74f, 2.0f, -0.8f), 1.45f, 14f);

        // Reflection Probe in room1 for real-time metallic & floor specular reflections
        Transform probeTrans = room1.transform.Find("ControlRoom_ReflectionProbe");
        ReflectionProbe probe;
        if (probeTrans == null)
        {
            GameObject pGo = new GameObject("ControlRoom_ReflectionProbe");
            pGo.transform.SetParent(room1.transform);
            pGo.transform.position = new Vector3(0.0f, 1.8f, 0.0f);
            probe = pGo.AddComponent<ReflectionProbe>();
        }
        else
        {
            probe = probeTrans.GetComponent<ReflectionProbe>();
            probeTrans.position = new Vector3(0.0f, 1.8f, 0.0f);
        }
        probe.size = new Vector3(18f, 8f, 18f);
        probe.mode = UnityEngine.Rendering.ReflectionProbeMode.Realtime;
        probe.refreshMode = UnityEngine.Rendering.ReflectionProbeRefreshMode.OnAwake;
        probe.intensity = 1.0f;

        // Ambient lighting
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(0.40f, 0.44f, 0.48f);
        RenderSettings.ambientEquatorColor = new Color(0.28f, 0.32f, 0.30f);
        RenderSettings.ambientGroundColor = new Color(0.20f, 0.20f, 0.22f);

        // Main camera HDR
        Camera mainCam = Camera.main;
        if (mainCam != null)
        {
            mainCam.allowHDR = true;
        }
    }

    private static void EnsureCeilingLight(GameObject parent, string name, Vector3 localPos, float intensity, float range)
    {
        Transform existing = parent.transform.Find(name);
        Light l;
        if (existing == null)
        {
            GameObject go = new GameObject(name);
            go.transform.SetParent(parent.transform);
            go.transform.localPosition = localPos;
            l = go.AddComponent<Light>();
        }
        else
        {
            l = existing.GetComponent<Light>();
            existing.localPosition = localPos;
        }

        l.type = LightType.Point;
        l.color = new Color(0.96f, 0.98f, 1.0f);
        l.intensity = intensity;
        l.range = range;
        l.shadows = LightShadows.Soft;
    }

    private static void EnsureSimulationSystem()
    {
        GameObject simObj = GameObject.Find("ReactorSimulationManager");
        if (simObj == null)
        {
            simObj = new GameObject("ReactorSimulationManager");
            simObj.AddComponent<ReactorSimulationSystem>();
        }
        else if (simObj.GetComponent<ReactorSimulationSystem>() == null)
        {
            simObj.AddComponent<ReactorSimulationSystem>();
        }
    }

    private static void SetupFullscreenUI()
    {
        GameObject hudGo = GameObject.Find("ControlRoomHUD_Manager");
        if (hudGo == null)
        {
            hudGo = new GameObject("ControlRoomHUD_Manager");
        }

        if (hudGo.GetComponent<ControlRoomFullscreenUI>() == null)
        {
            hudGo.AddComponent<ControlRoomFullscreenUI>();
        }

        GameObject player = GameObject.Find("Player");
        if (player != null && player.GetComponent<PlayerInteractManager>() == null)
        {
            player.AddComponent<PlayerInteractManager>();
        }
    }

    private static TMP_FontAsset _cachedCyrillicFont = null;

    public static TMP_FontAsset GetOrCreateCyrillicFont()
    {
        if (_cachedCyrillicFont != null) return _cachedCyrillicFont;

        _cachedCyrillicFont = AssetDatabase.LoadAssetAtPath<TMP_FontAsset>("Assets/Resources/Arial_Dynamic_SDF.asset");
        if (_cachedCyrillicFont != null) return _cachedCyrillicFont;

        _cachedCyrillicFont = AssetDatabase.LoadAssetAtPath<TMP_FontAsset>("Assets/Fonts/Arial_Dynamic_SDF.asset");
        if (_cachedCyrillicFont != null) return _cachedCyrillicFont;

        Font arial = AssetDatabase.LoadAssetAtPath<Font>("Assets/Fonts/arial.ttf");
        if (arial != null)
        {
            _cachedCyrillicFont = TMP_FontAsset.CreateFontAsset(arial);
            if (_cachedCyrillicFont != null)
            {
                _cachedCyrillicFont.name = "Arial_Dynamic_SDF";
                _cachedCyrillicFont.atlasPopulationMode = AtlasPopulationMode.Dynamic;
                if (!AssetDatabase.IsValidFolder("Assets/Resources"))
                {
                    AssetDatabase.CreateFolder("Assets", "Resources");
                }
                AssetDatabase.CreateAsset(_cachedCyrillicFont, "Assets/Resources/Arial_Dynamic_SDF.asset");
                AssetDatabase.SaveAssets();
            }
        }
        return _cachedCyrillicFont;
    }

    private static TextMeshProUGUI AddCyrillicText(GameObject go, string text = "", float fontSize = 20f, FontStyles fontStyle = FontStyles.Normal, TextAlignmentOptions align = TextAlignmentOptions.TopLeft)
    {
        var tmp = go.AddComponent<TextMeshProUGUI>();
        var font = GetOrCreateCyrillicFont();
        if (font != null) tmp.font = font;
        tmp.text = text;
        tmp.fontSize = fontSize;
        tmp.fontStyle = fontStyle;
        tmp.alignment = align;
        tmp.color = Color.white;
        return tmp;
    }

    private static void SetupReactorHallEffects()
    {
        GameObject reaktor = GameObject.Find("reaktor2_0");
        if (reaktor == null) return;

        EnsureReactorLight(reaktor, "FloodLight_Containment_1", new Vector3(-20.77f, 7.5f, -2.99f), LightType.Point, 2.5f, 32f, new Color(0.85f, 0.93f, 1.0f));
        EnsureReactorLight(reaktor, "FloodLight_Containment_2", new Vector3(-25.0f, 6.0f, -7.0f), LightType.Point, 2.0f, 26f, new Color(0.88f, 0.95f, 1.0f));
        EnsureReactorLight(reaktor, "FloodLight_Pumps", new Vector3(-17.0f, 4.5f, -2.99f), LightType.Point, 1.8f, 22f, new Color(0.90f, 0.96f, 1.0f));

        Transform coreSpot = reaktor.transform.Find("FloodLight_CoreSpot");
        Light spotL;
        if (coreSpot == null)
        {
            GameObject spotGo = new GameObject("FloodLight_CoreSpot");
            spotGo.transform.SetParent(reaktor.transform);
            spotGo.transform.position = new Vector3(-20.77f, 8.5f, -2.99f);
            spotGo.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
            spotL = spotGo.AddComponent<Light>();
        }
        else
        {
            spotL = coreSpot.GetComponent<Light>();
            coreSpot.position = new Vector3(-20.77f, 8.5f, -2.99f);
            coreSpot.rotation = Quaternion.Euler(90f, 0f, 0f);
        }
        spotL.type = LightType.Spot;
        spotL.spotAngle = 65f;
        spotL.innerSpotAngle = 45f;
        spotL.intensity = 3.5f;
        spotL.range = 24f;
        spotL.color = new Color(0.75f, 0.92f, 1.0f);
        spotL.shadows = LightShadows.Hard;

        GameObject cctvCamGo = GameObject.Find("ReactorCCTVCamera");
        if (cctvCamGo == null)
        {
            cctvCamGo = new GameObject("ReactorCCTVCamera");
        }
        cctvCamGo.transform.position = new Vector3(-24.5f, 4.8f, -6.5f);
        cctvCamGo.transform.rotation = Quaternion.Euler(28f, 46f, 0f);

        Camera cctvCam = cctvCamGo.GetComponent<Camera>();
        if (cctvCam == null) cctvCam = cctvCamGo.AddComponent<Camera>();
        cctvCam.clearFlags = CameraClearFlags.SolidColor;
        cctvCam.backgroundColor = new Color(0.04f, 0.07f, 0.12f);
        cctvCam.fieldOfView = 65f;
        cctvCam.nearClipPlane = 0.3f;
        cctvCam.farClipPlane = 100f;
        cctvCam.enabled = true;

        RenderTexture cctvRT = GetOrCreateCCTVRenderTexture();
        cctvCam.targetTexture = cctvRT;
        cctvCam.Render();

        var fx = reaktor.GetComponent<ReactorRoomVisualEffects>();
        if (fx == null) fx = reaktor.AddComponent<ReactorRoomVisualEffects>();
        fx.InitializeComponents();
    }

    private static RenderTexture _cachedCctvRT = null;

    public static RenderTexture GetOrCreateCCTVRenderTexture()
    {
        if (_cachedCctvRT != null && _cachedCctvRT.IsCreated()) return _cachedCctvRT;

        _cachedCctvRT = AssetDatabase.LoadAssetAtPath<RenderTexture>("Assets/Resources/ReactorCCTV_RT.renderTexture");
        if (_cachedCctvRT == null)
        {
            _cachedCctvRT = new RenderTexture(1024, 640, 16, RenderTextureFormat.ARGB32)
            {
                name = "ReactorCCTV_RT",
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };
            _cachedCctvRT.Create();
            if (!AssetDatabase.IsValidFolder("Assets/Resources"))
            {
                AssetDatabase.CreateFolder("Assets", "Resources");
            }
            AssetDatabase.CreateAsset(_cachedCctvRT, "Assets/Resources/ReactorCCTV_RT.renderTexture");
            AssetDatabase.SaveAssets();
        }
        return _cachedCctvRT;
    }

    private static void EnsureReactorLight(GameObject parent, string name, Vector3 pos, LightType type, float intensity, float range, Color color)
    {
        Transform existing = parent.transform.Find(name);
        Light l;
        if (existing == null)
        {
            GameObject go = new GameObject(name);
            go.transform.SetParent(parent.transform);
            go.transform.position = pos;
            l = go.AddComponent<Light>();
        }
        else
        {
            l = existing.GetComponent<Light>();
            existing.position = pos;
        }

        l.type = type;
        l.color = color;
        l.intensity = intensity;
        l.range = range;
        l.shadows = LightShadows.Soft;
    }

    private static void SetupCentralWallMnemonic()
    {
        GameObject room1 = GameObject.Find("room1");
        if (room1 == null) return;

        Transform oldWall = room1.transform.Find("CentralWallMnemonicCanvas");
        if (oldWall != null) UnityEngine.Object.DestroyImmediate(oldWall.gameObject);

        GameObject wallGo = new GameObject("CentralWallMnemonicCanvas");
        wallGo.transform.SetParent(room1.transform);
        wallGo.transform.position = new Vector3(0.0269f, 2.35f, -2.985f);
        wallGo.transform.rotation = Quaternion.Euler(0f, 180f, 0f);

        float worldW = 5.68f;
        float worldH = 2.85f;
        wallGo.transform.localScale = new Vector3(worldW / 1920f, worldH / 960f, 0.001f);

        Canvas canvas = wallGo.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.WorldSpace;
        Camera mainCam = Camera.main;
        if (mainCam != null) canvas.worldCamera = mainCam;

        var cs = wallGo.AddComponent<CanvasScaler>();
        cs.dynamicPixelsPerUnit = 10f;
        wallGo.AddComponent<GraphicRaycaster>();

        RectTransform crt = wallGo.GetComponent<RectTransform>();
        crt.sizeDelta = new Vector2(1920f, 960f);

        var display = wallGo.AddComponent<CentralWallMnemonicDisplay>();

        GameObject bgObj = CreateUIElement("Background", wallGo.transform);
        Image bgImg = bgObj.AddComponent<Image>();
        bgImg.color = new Color(0.04f, 0.06f, 0.09f, 1f);
        SetStretch(bgObj.GetComponent<RectTransform>());

        // 1. Header Bar
        GameObject headerObj = CreateUIElement("HeaderBar", bgObj.transform);
        Image headerImg = headerObj.AddComponent<Image>();
        headerImg.color = new Color(0.07f, 0.11f, 0.16f);
        RectTransform hrt = headerObj.GetComponent<RectTransform>();
        hrt.anchorMin = new Vector2(0f, 0.935f);
        hrt.anchorMax = Vector2.one;
        hrt.offsetMin = Vector2.zero; hrt.offsetMax = Vector2.zero;

        GameObject titleObj = CreateUIElement("TitleText", headerObj.transform);
        var titleTmp = AddCyrillicText(titleObj, "ЭНЕРГОБЛОК №1 ВВЭР-1200 | ГЛАВНЫЙ НАСТЕННЫЙ МНЕМОЩИТ БЩУ | ТЕЛЕМЕТРИЯ: ОНЛАЙН", 24f, FontStyles.Bold, TextAlignmentOptions.Center);
        titleTmp.color = new Color(0f, 0.95f, 1f);
        SetStretch(titleObj.GetComponent<RectTransform>());
        display.headerText = titleTmp;

        // 2. Top Row: 5 Analog SCADA Gauges
        GameObject gaugesRow = CreateUIElement("TopGaugesRow", bgObj.transform);
        RectTransform grt = gaugesRow.GetComponent<RectTransform>();
        grt.anchorMin = new Vector2(0.02f, 0.72f);
        grt.anchorMax = new Vector2(0.98f, 0.93f);
        grt.offsetMin = Vector2.zero; grt.offsetMax = Vector2.zero;

        float gaugeWidth = 1f / 5f;
        display.powerDial = CreateAnalogDial("Dial_Power", gaugesRow.transform, new Vector2(gaugeWidth * 0 + 0.01f, 0f), new Vector2(gaugeWidth * 1 - 0.01f, 1f),
            "ТЕПЛОВАЯ МОЩНОСТЬ", 0f, 4000f, "МВт", new Color(0f, 1f, 0.45f));
        display.pressureDial = CreateAnalogDial("Dial_Pressure", gaugesRow.transform, new Vector2(gaugeWidth * 1 + 0.01f, 0f), new Vector2(gaugeWidth * 2 - 0.01f, 1f),
            "ДАВЛЕНИЕ 1-ГО КОНТУРА", 0f, 20f, "МПа", new Color(0.2f, 0.8f, 1f));
        display.tempDial = CreateAnalogDial("Dial_Temp", gaugesRow.transform, new Vector2(gaugeWidth * 2 + 0.01f, 0f), new Vector2(gaugeWidth * 3 - 0.01f, 1f),
            "ТЕМПЕРАТУРА ВЫХОДА", 200f, 360f, "°C", new Color(1f, 0.75f, 0.2f));
        display.turbineDial = CreateAnalogDial("Dial_Turbine", gaugesRow.transform, new Vector2(gaugeWidth * 3 + 0.01f, 0f), new Vector2(gaugeWidth * 4 - 0.01f, 1f),
            "ОБОРОТЫ ТУРБИНЫ", 0f, 3600f, "об/мин", new Color(0.4f, 0.9f, 1f));
        display.electricDial = CreateAnalogDial("Dial_Electric", gaugesRow.transform, new Vector2(gaugeWidth * 4 + 0.01f, 0f), new Vector2(gaugeWidth * 5 - 0.01f, 1f),
            "ЭЛЕКТРИЧЕСКАЯ МОЩНОСТЬ", 0f, 1400f, "МВт(э)", new Color(0.2f, 1f, 0.6f));

        // 3. Center Section: Mimic Diagram
        GameObject mimicObj = CreateUIElement("CenterMimicDiagram", bgObj.transform);
        RectTransform mrt = mimicObj.GetComponent<RectTransform>();
        mrt.anchorMin = new Vector2(0.02f, 0.17f);
        mrt.anchorMax = new Vector2(0.98f, 0.70f);
        mrt.offsetMin = Vector2.zero; mrt.offsetMax = Vector2.zero;

        Image mimicBg = mimicObj.AddComponent<Image>();
        mimicBg.color = new Color(0.055f, 0.08f, 0.11f, 0.95f);

        GameObject rxVessel = CreateUIElement("RxVessel", mimicObj.transform);
        Image rxImg = rxVessel.AddComponent<Image>();
        rxImg.color = new Color(0.12f, 0.18f, 0.24f);
        RectTransform rxrt = rxVessel.GetComponent<RectTransform>();
        rxrt.anchorMin = new Vector2(0.42f, 0.15f);
        rxrt.anchorMax = new Vector2(0.58f, 0.85f);
        rxrt.offsetMin = Vector2.zero; rxrt.offsetMax = Vector2.zero;

        GameObject rxTitle = CreateUIElement("RxTitle", rxVessel.transform);
        var rxTmp = AddCyrillicText(rxTitle, "РЕАКТОР ВВЭР-1200\n(АКТИВНАЯ ЗОНА)", 20f, FontStyles.Bold, TextAlignmentOptions.Center);
        rxTmp.color = new Color(0f, 0.9f, 1f);
        SetStretchMargins(rxTitle.GetComponent<RectTransform>(), 10, 10, 10, 10);

        GameObject coreGlow = CreateUIElement("CoreGlow", rxVessel.transform);
        Image cgImg = coreGlow.AddComponent<Image>();
        cgImg.color = new Color(0f, 0.6f, 1f, 0.75f);
        RectTransform cgrt = coreGlow.GetComponent<RectTransform>();
        cgrt.anchorMin = new Vector2(0.2f, 0.2f);
        cgrt.anchorMax = new Vector2(0.8f, 0.65f);
        cgrt.offsetMin = Vector2.zero; cgrt.offsetMax = Vector2.zero;

        GameObject pzrCard = CreateCard("PressurizerCard", mimicObj.transform, new Vector2(0.26f, 0.45f), new Vector2(0.40f, 0.92f));
        display.pzrLevelBar = CreateSegmentedBar("PzrLevel", pzrCard.transform, new Vector2(0.05f, 0.05f), new Vector2(0.95f, 0.95f),
            "УРОВЕНЬ В КД (м)", 10, false);

        GameObject rodsCard = CreateCard("RodsCard", mimicObj.transform, new Vector2(0.60f, 0.45f), new Vector2(0.74f, 0.92f));
        display.rodsBar = CreateSegmentedBar("RodsPos", rodsCard.transform, new Vector2(0.05f, 0.05f), new Vector2(0.95f, 0.95f),
            "ПОЛОЖЕНИЕ ОРГАНОВ СУЗ (%)", 10, false);

        display.pumpRotors = new RectTransform[4];
        display.pumpLamps = new Image[4];
        display.pumpLabels = new TextMeshProUGUI[4];

        Vector2[] pumpPositionsMin = new Vector2[]
        {
            new Vector2(0.05f, 0.20f),
            new Vector2(0.22f, 0.08f),
            new Vector2(0.64f, 0.08f),
            new Vector2(0.81f, 0.20f)
        };
        Vector2[] pumpPositionsMax = new Vector2[]
        {
            new Vector2(0.19f, 0.55f),
            new Vector2(0.36f, 0.43f),
            new Vector2(0.78f, 0.43f),
            new Vector2(0.95f, 0.55f)
        };

        for (int p = 0; p < 4; p++)
        {
            GameObject pumpCard = CreateCard($"Pump_{p + 1}", mimicObj.transform, pumpPositionsMin[p], pumpPositionsMax[p]);

            GameObject pTitle = CreateUIElement("Title", pumpCard.transform);
            var pTmp = AddCyrillicText(pTitle, $"ГЦН-{p + 1}\n1000 ОБ/МИН", 16f, FontStyles.Bold, TextAlignmentOptions.Center);
            pTmp.color = Color.white;
            RectTransform pTitRt = pTitle.GetComponent<RectTransform>();
            pTitRt.anchorMin = new Vector2(0f, 0.65f); pTitRt.anchorMax = Vector2.one;
            pTitRt.offsetMin = Vector2.zero; pTitRt.offsetMax = Vector2.zero;
            display.pumpLabels[p] = pTmp;

            GameObject rotorGo = CreateUIElement("RotorIcon", pumpCard.transform);
            Image rotorImg = rotorGo.AddComponent<Image>();
            rotorImg.color = new Color(0f, 0.95f, 0.5f);
            RectTransform rotorRt = rotorGo.GetComponent<RectTransform>();
            rotorRt.anchorMin = new Vector2(0.3f, 0.18f);
            rotorRt.anchorMax = new Vector2(0.7f, 0.62f);
            rotorRt.offsetMin = Vector2.zero; rotorRt.offsetMax = Vector2.zero;
            display.pumpRotors[p] = rotorRt;

            GameObject lampGo = CreateUIElement("Lamp", pumpCard.transform);
            Image lampImg = lampGo.AddComponent<Image>();
            lampImg.color = Color.green;
            RectTransform lampRt = lampGo.GetComponent<RectTransform>();
            lampRt.anchorMin = new Vector2(0.1f, 0.04f);
            lampRt.anchorMax = new Vector2(0.9f, 0.16f);
            lampRt.offsetMin = Vector2.zero; lampRt.offsetMax = Vector2.zero;
            display.pumpLamps[p] = lampImg;
        }

        // 4. Bottom Row: 12-Tile Illuminated Annunciator Alarm Matrix
        GameObject annRow = CreateUIElement("AnnunciatorMatrix", bgObj.transform);
        RectTransform anrt = annRow.GetComponent<RectTransform>();
        anrt.anchorMin = new Vector2(0.02f, 0.02f);
        anrt.anchorMax = new Vector2(0.98f, 0.155f);
        anrt.offsetMin = Vector2.zero; anrt.offsetMax = Vector2.zero;

        display.annunciatorTiles = new Image[12];
        display.annunciatorTexts = new TextMeshProUGUI[12];

        float tileW = 1f / 6f;
        for (int i = 0; i < 12; i++)
        {
            int col = i % 6;
            int row = i / 6;
            Vector2 tMin = new Vector2(col * tileW + 0.005f, row == 0 ? 0.52f : 0.04f);
            Vector2 tMax = new Vector2((col + 1) * tileW - 0.005f, row == 0 ? 0.96f : 0.48f);

            GameObject tileGo = CreateUIElement($"Tile_{i}", annRow.transform);
            Image tImg = tileGo.AddComponent<Image>();
            tImg.color = new Color(0.1f, 0.15f, 0.2f);
            RectTransform trt = tileGo.GetComponent<RectTransform>();
            trt.anchorMin = tMin; trt.anchorMax = tMax;
            trt.offsetMin = Vector2.zero; trt.offsetMax = Vector2.zero;

            GameObject tTxtGo = CreateUIElement("Text", tileGo.transform);
            var tTmp = AddCyrillicText(tTxtGo, "ТАБЛО", 15f, FontStyles.Bold, TextAlignmentOptions.Center);
            tTmp.color = Color.white;
            SetStretch(tTxtGo.GetComponent<RectTransform>());

            display.annunciatorTiles[i] = tImg;
            display.annunciatorTexts[i] = tTmp;
        }

        // 5. Alarm Banner
        GameObject alarmObj = CreateUIElement("AlarmBanner", bgObj.transform);
        Image alarmImg = alarmObj.AddComponent<Image>();
        alarmImg.color = new Color(0.9f, 0.1f, 0.1f, 0.98f);
        RectTransform art = alarmObj.GetComponent<RectTransform>();
        art.anchorMin = new Vector2(0.15f, 0.60f);
        art.anchorMax = new Vector2(0.85f, 0.72f);
        art.offsetMin = Vector2.zero; art.offsetMax = Vector2.zero;

        GameObject alTxtGo = CreateUIElement("AlarmText", alarmObj.transform);
        var alTmp = AddCyrillicText(alTxtGo, "⚠️ СРАБОТАЛА АВАРИЙНАЯ ЗАЩИТА АЗ-1 (СБРОС СТЕРЖНЕЙ СУЗ) ⚠️", 26f, FontStyles.Bold, TextAlignmentOptions.Center);
        alTmp.color = Color.white;
        SetStretch(alTxtGo.GetComponent<RectTransform>());

        display.alarmBanner = alarmObj;
        display.alarmBannerText = alTmp;
        alarmObj.SetActive(false);
    }

    private static void SetupInteractiveMonitors()
    {
        GameObject room1 = GameObject.Find("room1");
        if (room1 == null) return;

        Transform monitor3 = room1.transform.Find("Monitor (3)"); // Far Left
        Transform monitor1 = room1.transform.Find("Monitor (1)"); // Mid Left
        Transform monitorMid = room1.transform.Find("Monitor");   // Center
        Transform monitor4 = room1.transform.Find("Monitor (4)"); // Mid Right
        Transform monitor2 = room1.transform.Find("Monitor (2)"); // Far Right

        if (monitor4 == null && monitor1 != null)
        {
            GameObject dup = UnityEngine.Object.Instantiate(monitor1.gameObject, room1.transform);
            dup.name = "Monitor (4)";
            dup.transform.localPosition = new Vector3(10.74f, monitor1.localPosition.y, 1.765f);
            dup.transform.localEulerAngles = new Vector3(270f, -7.255f, 0f);
            monitor4 = dup.transform;
            Undo.RegisterCreatedObjectUndo(dup, "Create Monitor (4)");
        }

        if (monitor3 != null)
        {
            BuildFittedMonitorCanvas(room1, monitor3.gameObject, 41.36f,
                InteractiveMonitorUI.MonitorType.CoreAndRods,
                "ПУЛЬТ СУЗ: СТЕРЖНИ И МОЩНОСТЬ", new Color(0.1f, 0.95f, 0.45f));
        }

        if (monitor1 != null)
        {
            BuildFittedMonitorCanvas(room1, monitor1.gameObject, 7.25f,
                InteractiveMonitorUI.MonitorType.PrimaryLoop,
                "ПЕРВЫЙ КОНТУР И НАСОСЫ (ГЦН)", new Color(0.2f, 0.85f, 1.0f));
        }

        if (monitorMid != null)
        {
            BuildFittedMonitorCanvas(room1, monitorMid.gameObject, 0.0f,
                InteractiveMonitorUI.MonitorType.CoreHeatmap,
                "АКТИВНАЯ ЗОНА: КАРТА ТЕМПЕРАТУР", new Color(0.0f, 1.0f, 0.85f));
        }

        if (monitor4 != null)
        {
            BuildFittedMonitorCanvas(room1, monitor4.gameObject, -7.25f,
                InteractiveMonitorUI.MonitorType.TurbineGenerator,
                "ТУРБОГЕНЕРАТОР ТГ-1 И СЕТЬ", new Color(1.0f, 0.9f, 0.2f));
        }

        if (monitor2 != null)
        {
            BuildFittedMonitorCanvas(room1, monitor2.gameObject, -37.40f,
                InteractiveMonitorUI.MonitorType.SafetyAndLogs,
                "СИСТЕМЫ БЕЗОПАСНОСТИ И CCTV", new Color(1.0f, 0.5f, 0.2f));
        }
    }

    private static void BuildFittedMonitorCanvas(GameObject room1, GameObject monitorObj, float yawAngle,
        InteractiveMonitorUI.MonitorType monType, string title, Color accentColor)
    {
        MeshRenderer mr = monitorObj.GetComponent<MeshRenderer>();
        Vector3 centerPos = mr != null ? mr.bounds.center : monitorObj.transform.position;

        // Position: precisely 7.8 cm along front normal, resting right on the front screen bezel
        Vector3 normalOut = Quaternion.Euler(0f, yawAngle, 0f) * Vector3.forward;
        Vector3 screenPos = centerPos + normalOut * 0.078f;
        Quaternion screenRot = Quaternion.Euler(0f, 180f + yawAngle, 0f);

        string canvasName = "MonitorInteractiveCanvas_" + monType;
        Transform old = room1.transform.Find(canvasName);
        if (old != null) UnityEngine.Object.DestroyImmediate(old.gameObject);

        GameObject canvasGo = new GameObject(canvasName);
        canvasGo.transform.SetParent(room1.transform);
        canvasGo.transform.position = screenPos;
        canvasGo.transform.rotation = screenRot;

        float worldW = 0.525f;
        float worldH = 0.315f;
        canvasGo.transform.localScale = new Vector3(worldW / 960f, worldH / 580f, 0.001f);

        Canvas canvas = canvasGo.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.WorldSpace;
        Camera mainCam = Camera.main;
        if (mainCam != null) canvas.worldCamera = mainCam;

        var cs = canvasGo.AddComponent<CanvasScaler>();
        cs.dynamicPixelsPerUnit = 10f;
        canvasGo.AddComponent<GraphicRaycaster>();

        RectTransform crt = canvasGo.GetComponent<RectTransform>();
        crt.sizeDelta = new Vector2(960f, 580f);

        var monUI = canvasGo.AddComponent<InteractiveMonitorUI>();
        monUI.monitorType = monType;
        monUI.stationTitle = title;

        // Rich LCD screen background with subtle inner blue bezel tint
        GameObject bgObj = CreateUIElement("Background", canvasGo.transform);
        Image bgImg = bgObj.AddComponent<Image>();
        bgImg.color = new Color(0.045f, 0.07f, 0.10f, 1f);
        SetStretch(bgObj.GetComponent<RectTransform>());

        // 1. Header bar
        GameObject headerObj = CreateUIElement("HeaderBar", bgObj.transform);
        Image headerImg = headerObj.AddComponent<Image>();
        headerImg.color = new Color(0.08f, 0.13f, 0.19f);
        RectTransform hrt = headerObj.GetComponent<RectTransform>();
        hrt.anchorMin = new Vector2(0f, 0.88f);
        hrt.anchorMax = Vector2.one;
        hrt.offsetMin = Vector2.zero; hrt.offsetMax = Vector2.zero;

        GameObject titleObj = CreateUIElement("TitleText", headerObj.transform);
        var titleTmp = AddCyrillicText(titleObj, title, 24f, FontStyles.Bold, TextAlignmentOptions.MidlineLeft);
        titleTmp.color = accentColor;
        RectTransform trt = titleObj.GetComponent<RectTransform>();
        trt.anchorMin = new Vector2(0.03f, 0f);
        trt.anchorMax = new Vector2(0.88f, 1f);
        trt.offsetMin = Vector2.zero; trt.offsetMax = Vector2.zero;
        monUI.titleText = titleTmp;

        GameObject ledObj = CreateUIElement("StatusLED", headerObj.transform);
        Image ledImg = ledObj.AddComponent<Image>();
        ledImg.color = Color.green;
        RectTransform ledrt = ledObj.GetComponent<RectTransform>();
        ledrt.anchorMin = new Vector2(0.92f, 0.22f);
        ledrt.anchorMax = new Vector2(0.97f, 0.78f);
        ledrt.offsetMin = Vector2.zero; ledrt.offsetMax = Vector2.zero;
        monUI.statusLight = ledImg;

        // 2. Center Content depending on monitor type
        if (monType == InteractiveMonitorUI.MonitorType.SafetyAndLogs)
        {
            // Full CCTV feed on Far Right Monitor
            GameObject cctvObj = CreateUIElement("CCTV_Stream", bgObj.transform);
            RawImage rawImg = cctvObj.AddComponent<RawImage>();
            rawImg.color = Color.white;
            rawImg.texture = GetOrCreateCCTVRenderTexture();

            RectTransform crtCctv = cctvObj.GetComponent<RectTransform>();
            crtCctv.anchorMin = new Vector2(0.02f, 0.20f);
            crtCctv.anchorMax = new Vector2(0.68f, 0.86f);
            crtCctv.offsetMin = Vector2.zero; crtCctv.offsetMax = Vector2.zero;
            monUI.cctvImage = rawImg;

            GameObject osdObj = CreateUIElement("CCTV_OSD", cctvObj.transform);
            var osdTmp = AddCyrillicText(osdObj, "● REC | CAM-01 [РЕАКТОРНЫЙ ЗАЛ]\nТЕЛЕМЕТРИЯ: ОНЛАЙН", 18f, FontStyles.Bold, TextAlignmentOptions.TopLeft);
            osdTmp.color = new Color(0f, 1f, 0.4f);
            SetStretchMargins(osdObj.GetComponent<RectTransform>(), 10, 10, 10, 10);
            monUI.cctvOsdText = osdTmp;

            // Radiation dial on right side
            monUI.dial1 = CreateAnalogDial("Dial_Rad", bgObj.transform, new Vector2(0.70f, 0.20f), new Vector2(0.98f, 0.86f),
                "РАДИАЦИЯ РЗ", 0f, 500f, "мкР/ч", new Color(1f, 0.8f, 0.1f));

            // Controls
            GameObject ctrlObj = CreateUIElement("ControlsRow", bgObj.transform);
            RectTransform crtRow = ctrlObj.GetComponent<RectTransform>();
            crtRow.anchorMin = new Vector2(0.03f, 0.02f);
            crtRow.anchorMax = new Vector2(0.97f, 0.18f);
            crtRow.offsetMin = Vector2.zero; crtRow.offsetMax = Vector2.zero;

            GameObject btn1 = CreateButton("BtnSwitchCam", ctrlObj.transform, "🎥 СМЕНИТЬ РАКУРС (CAM 1..3)", new Vector2(0f, 0f), new Vector2(0.55f, 1f), new Color(0.15f, 0.45f, 0.65f));
            monUI.actionButton1 = btn1.GetComponent<Button>();

            GameObject btn2 = CreateButton("BtnFull", ctrlObj.transform, "ПОЛНЫЙ ЭКРАН [E]", new Vector2(0.58f, 0f), new Vector2(1.0f, 1f), new Color(0.2f, 0.65f, 0.35f));
            monUI.actionButton2 = btn2.GetComponent<Button>();
            monUI.actionButton2.onClick.AddListener(() => {
                ControlRoomFullscreenUI.Instance?.OpenSection(4);
            });
        }
        else
        {
            // Gauges Row (Upper Half)
            GameObject gaugesContainer = CreateUIElement("GaugesRow", bgObj.transform);
            RectTransform grt = gaugesContainer.GetComponent<RectTransform>();
            grt.anchorMin = new Vector2(0.02f, 0.48f);
            grt.anchorMax = new Vector2(0.98f, 0.87f);
            grt.offsetMin = Vector2.zero; grt.offsetMax = Vector2.zero;

            // Telemetry & Parameters Box (Middle)
            GameObject telemCard = CreateCard("TelemetryCard", bgObj.transform, new Vector2(0.02f, 0.20f), new Vector2(0.98f, 0.46f));
            GameObject pValObj = CreateUIElement("PrimaryVal", telemCard.transform);
            var pValTmp = AddCyrillicText(pValObj, "ПАРАМЕТР: ЗАГРУЗКА...", 22f, FontStyles.Bold, TextAlignmentOptions.TopLeft);
            pValTmp.color = new Color(0f, 1f, 0.7f);
            RectTransform pValRt = pValObj.GetComponent<RectTransform>();
            pValRt.anchorMin = new Vector2(0.03f, 0.50f); pValRt.anchorMax = new Vector2(0.97f, 0.95f);
            pValRt.offsetMin = Vector2.zero; pValRt.offsetMax = Vector2.zero;
            monUI.primaryValueText = pValTmp;

            GameObject sValObj = CreateUIElement("SecondaryVal", telemCard.transform);
            var sValTmp = AddCyrillicText(sValObj, "Состояние контура: НОРМА | Сервер: ОНЛАЙН", 16f, FontStyles.Normal, TextAlignmentOptions.TopLeft);
            sValTmp.color = new Color(0.75f, 0.85f, 0.95f);
            RectTransform sValRt = sValObj.GetComponent<RectTransform>();
            sValRt.anchorMin = new Vector2(0.03f, 0.05f); sValRt.anchorMax = new Vector2(0.97f, 0.48f);
            sValRt.offsetMin = Vector2.zero; sValRt.offsetMax = Vector2.zero;
            monUI.secondaryTelemetryText = sValTmp;

            // Controls Row (Bottom)
            GameObject ctrlObj = CreateUIElement("ControlsRow", bgObj.transform);
            RectTransform crtRow = ctrlObj.GetComponent<RectTransform>();
            crtRow.anchorMin = new Vector2(0.02f, 0.02f);
            crtRow.anchorMax = new Vector2(0.98f, 0.18f);
            crtRow.offsetMin = Vector2.zero; crtRow.offsetMax = Vector2.zero;

            if (monType == InteractiveMonitorUI.MonitorType.CoreAndRods)
            {
                monUI.dial1 = CreateAnalogDial("Dial_Power", gaugesContainer.transform, new Vector2(0.02f, 0f), new Vector2(0.38f, 1f),
                    "МОЩНОСТЬ РУ", 0f, 4000f, "МВт", new Color(0f, 1f, 0.5f));
                monUI.dial2 = CreateAnalogDial("Dial_Temp", gaugesContainer.transform, new Vector2(0.40f, 0f), new Vector2(0.76f, 1f),
                    "ТЕМП. ТОПЛИВА", 200f, 1200f, "°C", new Color(1f, 0.6f, 0.1f));
                monUI.barGraph = CreateSegmentedBar("Bar_Rods", gaugesContainer.transform, new Vector2(0.78f, 0f), new Vector2(0.98f, 1f),
                    "СУЗ %", 10, false);

                pValTmp.text = "<color=#33FF77>ТЕПЛОВАЯ МОЩНОСТЬ: 3200 МВт (100%)</color>";
                sValTmp.text = "Стержни СУЗ: 30.0% погружено | Реактивность: +0.0 pcm | T = > 9999 сек";

                GameObject sliderGo = CreateSlider("RodsSlider", ctrlObj.transform, new Vector2(0f, 0f), new Vector2(0.45f, 1f));
                monUI.mainSlider = sliderGo.GetComponent<Slider>();
                monUI.mainSlider.minValue = 0f;
                monUI.mainSlider.maxValue = 100f;
                monUI.mainSlider.value = 30f;

                GameObject btn1 = CreateButton("BtnUp", ctrlObj.transform, "▲ ВВЕСТИ (+5%)", new Vector2(0.48f, 0f), new Vector2(0.68f, 1f), new Color(0.18f, 0.45f, 0.25f));
                monUI.actionButton1 = btn1.GetComponent<Button>();

                GameObject az5 = CreateButton("BtnAZ5", ctrlObj.transform, "⚠️ АЗ-5 СБРОС", new Vector2(0.71f, 0f), new Vector2(1.0f, 1f), new Color(0.85f, 0.12f, 0.12f));
                monUI.az5Button = az5.GetComponent<Button>();
            }
            else if (monType == InteractiveMonitorUI.MonitorType.PrimaryLoop)
            {
                monUI.dial1 = CreateAnalogDial("Dial_Pressure", gaugesContainer.transform, new Vector2(0.02f, 0f), new Vector2(0.38f, 1f),
                    "ДАВЛЕНИЕ 1-Й К.", 0f, 20f, "МПа", new Color(0.2f, 0.8f, 1f));
                monUI.dial2 = CreateAnalogDial("Dial_Flow", gaugesContainer.transform, new Vector2(0.40f, 0f), new Vector2(0.76f, 1f),
                    "РАСХОД 1-Й К.", 0f, 90000f, "кг/с", new Color(0.1f, 1f, 0.7f));
                monUI.barGraph = CreateSegmentedBar("Bar_Pzr", gaugesContainer.transform, new Vector2(0.78f, 0f), new Vector2(0.98f, 1f),
                    "УРОВЕНЬ КД", 10, false);

                pValTmp.text = "<color=#33CCFF>ДАВЛЕНИЕ В 1 КОНТУРЕ: 16.20 МПа (НОРМА)</color>";
                sValTmp.text = "Расход: 85600 кг/с | Уровень в КД: 7.20 м | Температура T_вх: 298.2 °C, T_вых: 328.9 °C";

                GameObject sliderGo = CreateSlider("PumpsSlider", ctrlObj.transform, new Vector2(0f, 0f), new Vector2(0.45f, 1f));
                monUI.mainSlider = sliderGo.GetComponent<Slider>();
                monUI.mainSlider.minValue = 20f;
                monUI.mainSlider.maxValue = 100f;
                monUI.mainSlider.value = 100f;

                GameObject btn1 = CreateButton("BtnP1", ctrlObj.transform, "ГЦН-1 ВКЛ/ВЫКЛ", new Vector2(0.48f, 0f), new Vector2(0.72f, 1f), new Color(0.15f, 0.4f, 0.6f));
                monUI.actionButton1 = btn1.GetComponent<Button>();

                GameObject btn2 = CreateButton("BtnP2", ctrlObj.transform, "ГЦН-2 ВКЛ/ВЫКЛ", new Vector2(0.75f, 0f), new Vector2(0.98f, 1f), new Color(0.15f, 0.4f, 0.6f));
                monUI.actionButton2 = btn2.GetComponent<Button>();
            }
            else if (monType == InteractiveMonitorUI.MonitorType.CoreHeatmap)
            {
                monUI.dial1 = CreateAnalogDial("Dial_DNBR", gaugesContainer.transform, new Vector2(0.02f, 0f), new Vector2(0.38f, 1f),
                    "КРИЗИС (DNBR)", 0.5f, 3.5f, "Крит.", new Color(0.1f, 1f, 0.5f));
                monUI.dial2 = CreateAnalogDial("Dial_TempOut", gaugesContainer.transform, new Vector2(0.40f, 0f), new Vector2(0.76f, 1f),
                    "ТЕМП. ВЫХОДА АЗ", 200f, 360f, "°C", new Color(1f, 0.8f, 0.2f));
                monUI.barGraph = CreateSegmentedBar("Bar_Kz", gaugesContainer.transform, new Vector2(0.78f, 0f), new Vector2(0.98f, 1f),
                    "Kz НЕРАВН.", 10, false);

                pValTmp.text = "<color=#00FFAA>КАРТОГРАММА АКТИВНОЙ ЗОНЫ: 163 ТВС В НОРМЕ</color>";
                sValTmp.text = "DNBR = 2.18 (запас > 1.30) | Kz = 1.18, Kq = 1.25 | Макс. темп. оболочки: 348 °C";

                GameObject btn1 = CreateButton("Btn100", ctrlObj.transform, "СБРОС В 100% (НОМИНАЛ)", new Vector2(0f, 0f), new Vector2(0.48f, 1f), new Color(0.12f, 0.5f, 0.3f));
                monUI.actionButton1 = btn1.GetComponent<Button>();

                GameObject btn2 = CreateButton("Btn50", ctrlObj.transform, "ИЗВЛЕЧЬ СТЕРЖНИ (-5%)", new Vector2(0.52f, 0f), new Vector2(1.0f, 1f), new Color(0.5f, 0.35f, 0.1f));
                monUI.actionButton2 = btn2.GetComponent<Button>();
            }
            else if (monType == InteractiveMonitorUI.MonitorType.TurbineGenerator)
            {
                monUI.dial1 = CreateAnalogDial("Dial_RPM", gaugesContainer.transform, new Vector2(0.02f, 0f), new Vector2(0.38f, 1f),
                    "СКОРОСТЬ ТУРБИНЫ", 0f, 3600f, "об/мин", new Color(0.2f, 0.85f, 1f));
                monUI.dial2 = CreateAnalogDial("Dial_Electric", gaugesContainer.transform, new Vector2(0.40f, 0f), new Vector2(0.76f, 1f),
                    "ВЫРАБОТКА ТГ-1", 0f, 1400f, "МВт(э)", new Color(0.2f, 1f, 0.6f));
                monUI.barGraph = CreateSegmentedBar("Bar_Freq", gaugesContainer.transform, new Vector2(0.78f, 0f), new Vector2(0.98f, 1f),
                    "СЕТЬ 50 Гц", 10, false);

                pValTmp.text = "<color=#FFEE33>ТУРБОГЕНЕРАТОР ТГ-1: 3000 ОБ/МИН | 1195 МВт(э)</color>";
                sValTmp.text = "Давление 2-го контура: 7.0 МПа | Расход пара: 1773 кг/с | Частота сети: 50.00 Гц";

                GameObject btn1 = CreateButton("BtnTurbine", ctrlObj.transform, "СТОПОРНЫЕ КЛАПАНЫ ТГ-1", new Vector2(0f, 0f), new Vector2(0.52f, 1f), new Color(0.55f, 0.45f, 0.12f));
                monUI.actionButton1 = btn1.GetComponent<Button>();

                GameObject btn2 = CreateButton("BtnGrid", ctrlObj.transform, "СЕТЬ 500 кВ ВКЛ/ВЫКЛ", new Vector2(0.55f, 0f), new Vector2(1.0f, 1f), new Color(0.2f, 0.4f, 0.65f));
                monUI.actionButton2 = btn2.GetComponent<Button>();
            }
        }
    }

    private static AnalogDialUI CreateAnalogDial(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax,
        string label, float minVal, float maxVal, string unit, Color needleCol)
    {
        GameObject dialObj = CreateUIElement(name, parent);
        RectTransform drt = dialObj.GetComponent<RectTransform>();
        drt.anchorMin = anchorMin; drt.anchorMax = anchorMax;
        drt.offsetMin = new Vector2(3, 3); drt.offsetMax = new Vector2(-3, -3);

        Image dialBg = dialObj.AddComponent<Image>();
        dialBg.color = new Color(0.08f, 0.12f, 0.16f, 0.98f);

        GameObject lblGo = CreateUIElement("Label", dialObj.transform);
        var lblTmp = AddCyrillicText(lblGo, label, 13f, FontStyles.Bold, TextAlignmentOptions.Center);
        lblTmp.color = new Color(0.75f, 0.88f, 0.98f);
        RectTransform lrt = lblGo.GetComponent<RectTransform>();
        lrt.anchorMin = new Vector2(0.02f, 0.74f); lrt.anchorMax = new Vector2(0.98f, 0.98f);
        lrt.offsetMin = Vector2.zero; lrt.offsetMax = Vector2.zero;

        GameObject ringGo = CreateUIElement("DialRing", dialObj.transform);
        Image ringImg = ringGo.AddComponent<Image>();
        ringImg.color = new Color(0.14f, 0.20f, 0.28f);
        RectTransform rrt = ringGo.GetComponent<RectTransform>();
        rrt.anchorMin = new Vector2(0.12f, 0.22f); rrt.anchorMax = new Vector2(0.88f, 0.74f);
        rrt.offsetMin = Vector2.zero; rrt.offsetMax = Vector2.zero;

        GameObject needleGo = CreateUIElement("Needle", ringGo.transform);
        Image needleImg = needleGo.AddComponent<Image>();
        needleImg.color = needleCol;
        RectTransform nrt = needleGo.GetComponent<RectTransform>();
        nrt.pivot = new Vector2(0.5f, 0.0f);
        nrt.anchorMin = new Vector2(0.5f, 0.5f);
        nrt.anchorMax = new Vector2(0.5f, 0.5f);
        nrt.sizeDelta = new Vector2(3.5f, 38f);
        nrt.localEulerAngles = new Vector3(0f, 0f, 45f);

        GameObject hubGo = CreateUIElement("Hub", ringGo.transform);
        Image hubImg = hubGo.AddComponent<Image>();
        hubImg.color = new Color(0.9f, 0.9f, 0.95f);
        RectTransform hrt = hubGo.GetComponent<RectTransform>();
        hrt.anchorMin = new Vector2(0.5f, 0.5f);
        hrt.anchorMax = new Vector2(0.5f, 0.5f);
        hrt.sizeDelta = new Vector2(10f, 10f);

        GameObject valGo = CreateUIElement("ValueText", dialObj.transform);
        var valTmp = AddCyrillicText(valGo, $"0 {unit}", 16f, FontStyles.Bold, TextAlignmentOptions.Center);
        valTmp.color = Color.white;
        RectTransform vrt = valGo.GetComponent<RectTransform>();
        vrt.anchorMin = new Vector2(0.05f, 0.02f); vrt.anchorMax = new Vector2(0.95f, 0.22f);
        vrt.offsetMin = Vector2.zero; vrt.offsetMax = Vector2.zero;

        return new AnalogDialUI
        {
            needleRect = nrt,
            valueText = valTmp,
            labelText = lblTmp,
            minValue = minVal,
            maxValue = maxVal,
            minAngle = 135f,
            maxAngle = -135f
        };
    }

    private static SegmentedBarUI CreateSegmentedBar(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax,
        string label, int segmentCount = 10, bool horizontal = false)
    {
        GameObject barGo = CreateUIElement(name, parent);
        RectTransform brt = barGo.GetComponent<RectTransform>();
        brt.anchorMin = anchorMin; brt.anchorMax = anchorMax;
        brt.offsetMin = new Vector2(2, 2); brt.offsetMax = new Vector2(-2, -2);

        Image barBg = barGo.AddComponent<Image>();
        barBg.color = new Color(0.07f, 0.11f, 0.15f, 0.95f);

        GameObject lblGo = CreateUIElement("Label", barGo.transform);
        var lblTmp = AddCyrillicText(lblGo, label, 11f, FontStyles.Bold, TextAlignmentOptions.Center);
        lblTmp.color = new Color(0.75f, 0.88f, 0.98f);
        RectTransform lrt = lblGo.GetComponent<RectTransform>();
        lrt.anchorMin = new Vector2(0.02f, 0.82f); lrt.anchorMax = new Vector2(0.98f, 0.98f);
        lrt.offsetMin = Vector2.zero; lrt.offsetMax = Vector2.zero;

        GameObject segsContainer = CreateUIElement("Segments", barGo.transform);
        RectTransform scrt = segsContainer.GetComponent<RectTransform>();
        scrt.anchorMin = new Vector2(0.12f, 0.18f); scrt.anchorMax = new Vector2(0.88f, 0.80f);
        scrt.offsetMin = Vector2.zero; scrt.offsetMax = Vector2.zero;

        Image[] segs = new Image[segmentCount];
        float step = 1f / segmentCount;
        for (int s = 0; s < segmentCount; s++)
        {
            GameObject segObj = CreateUIElement($"Seg_{s}", segsContainer.transform);
            Image sImg = segObj.AddComponent<Image>();
            sImg.color = s < (segmentCount * 0.7f) ? new Color(0f, 0.9f, 0.45f) : (s < (segmentCount * 0.9f) ? new Color(1f, 0.8f, 0.1f) : new Color(0.95f, 0.2f, 0.2f));
            RectTransform srt = segObj.GetComponent<RectTransform>();
            srt.anchorMin = new Vector2(0.05f, s * step + 0.015f);
            srt.anchorMax = new Vector2(0.95f, (s + 1) * step - 0.015f);
            srt.offsetMin = Vector2.zero; srt.offsetMax = Vector2.zero;
            segs[s] = sImg;
        }

        GameObject valGo = CreateUIElement("Value", barGo.transform);
        var valTmp = AddCyrillicText(valGo, "100%", 13f, FontStyles.Bold, TextAlignmentOptions.Center);
        valTmp.color = Color.white;
        RectTransform vrt = valGo.GetComponent<RectTransform>();
        vrt.anchorMin = new Vector2(0.02f, 0.02f); vrt.anchorMax = new Vector2(0.98f, 0.17f);
        vrt.offsetMin = Vector2.zero; vrt.offsetMax = Vector2.zero;

        return new SegmentedBarUI
        {
            segments = segs,
            valueText = valTmp,
            normalColor = new Color(0f, 0.95f, 0.45f),
            warningColor = new Color(1.0f, 0.8f, 0.1f),
            alarmColor = new Color(0.95f, 0.15f, 0.15f)
        };
    }

    private static GameObject CreateUIElement(string name, Transform parent)
    {
        GameObject go = new GameObject(name);
        go.transform.SetParent(parent, false);
        go.AddComponent<RectTransform>();
        return go;
    }

    private static GameObject CreateCard(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax)
    {
        GameObject card = CreateUIElement(name, parent);
        Image img = card.AddComponent<Image>();
        img.color = new Color(0.07f, 0.11f, 0.16f, 0.95f);
        RectTransform rt = card.GetComponent<RectTransform>();
        rt.anchorMin = anchorMin;
        rt.anchorMax = anchorMax;
        rt.offsetMin = new Vector2(3, 3);
        rt.offsetMax = new Vector2(-3, -3);
        return card;
    }

    private static GameObject CreateButton(string name, Transform parent, string label, Vector2 anchorMin, Vector2 anchorMax, Color normalColor)
    {
        GameObject btnObj = CreateUIElement(name, parent);
        Image img = btnObj.AddComponent<Image>();
        img.color = normalColor;
        Button btn = btnObj.AddComponent<Button>();

        ColorBlock cb = btn.colors;
        cb.normalColor = normalColor;
        cb.highlightedColor = normalColor * 1.25f;
        cb.pressedColor = normalColor * 0.75f;
        btn.colors = cb;

        RectTransform rt = btnObj.GetComponent<RectTransform>();
        rt.anchorMin = anchorMin;
        rt.anchorMax = anchorMax;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;

        GameObject txtObj = CreateUIElement("Text", btnObj.transform);
        var tmp = AddCyrillicText(txtObj, label, 15f, FontStyles.Bold, TextAlignmentOptions.Center);
        tmp.color = Color.white;

        SetStretch(txtObj.GetComponent<RectTransform>());
        return btnObj;
    }

    private static GameObject CreateSlider(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax)
    {
        GameObject sliderGo = CreateUIElement(name, parent);
        RectTransform srt = sliderGo.GetComponent<RectTransform>();
        srt.anchorMin = anchorMin;
        srt.anchorMax = anchorMax;
        srt.offsetMin = Vector2.zero;
        srt.offsetMax = Vector2.zero;

        Slider slider = sliderGo.AddComponent<Slider>();

        GameObject bgObj = CreateUIElement("Background", sliderGo.transform);
        Image bgImg = bgObj.AddComponent<Image>();
        bgImg.color = new Color(0.12f, 0.17f, 0.22f);
        RectTransform bgrt = bgObj.GetComponent<RectTransform>();
        bgrt.anchorMin = new Vector2(0f, 0.3f);
        bgrt.anchorMax = new Vector2(1f, 0.7f);
        bgrt.offsetMin = Vector2.zero;
        bgrt.offsetMax = Vector2.zero;

        GameObject fillArea = CreateUIElement("Fill Area", sliderGo.transform);
        RectTransform fart = fillArea.GetComponent<RectTransform>();
        fart.anchorMin = new Vector2(0f, 0.3f);
        fart.anchorMax = new Vector2(1f, 0.7f);
        fart.offsetMin = Vector2.zero;
        fart.offsetMax = Vector2.zero;

        GameObject fill = CreateUIElement("Fill", fillArea.transform);
        Image fillImg = fill.AddComponent<Image>();
        fillImg.color = new Color(0.15f, 0.75f, 0.45f);
        SetStretch(fill.GetComponent<RectTransform>());
        slider.fillRect = fill.GetComponent<RectTransform>();

        GameObject handleArea = CreateUIElement("Handle Slide Area", sliderGo.transform);
        SetStretch(handleArea.GetComponent<RectTransform>());

        GameObject handle = CreateUIElement("Handle", handleArea.transform);
        Image handleImg = handle.AddComponent<Image>();
        handleImg.color = Color.white;
        RectTransform hrt = handle.GetComponent<RectTransform>();
        hrt.sizeDelta = new Vector2(24f, 0f);
        hrt.anchorMin = new Vector2(0f, 0.1f);
        hrt.anchorMax = new Vector2(0f, 0.9f);

        slider.handleRect = hrt;
        slider.targetGraphic = handleImg;
        slider.direction = Slider.Direction.LeftToRight;

        return sliderGo;
    }

    private static void SetStretch(RectTransform rt)
    {
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }

    private static void SetStretchMargins(RectTransform rt, float left, float right, float top, float bottom)
    {
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = new Vector2(left, bottom);
        rt.offsetMax = new Vector2(-right, -top);
    }
}

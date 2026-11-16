using System;
using UnityEngine;

/// <summary>
/// Controls real-time physical and visual animations inside the reactor containment hall (reaktor2_0).
/// Responds to operator actions: Cherenkov radiation luminescence, pump motor rotation,
/// control rod drive displacement, and emergency containment strobe alarms.
/// </summary>
public class ReactorRoomVisualEffects : MonoBehaviour
{
    private ReactorSimulationSystem sim => ReactorSimulationSystem.Instance;

    [Header("Cherenkov Radiation Effect")]
    public Light cherenkovLight;
    public Color cherenkovColor = new Color(0.0f, 0.65f, 1.0f);
    public float maxCherenkovIntensity = 4.5f;

    [Header("4x Main Coolant Pumps (ГЦН)")]
    public Transform[] pumpRotors = new Transform[4];
    public Light[] pumpStatusLights = new Light[4];
    public float basePumpRpm = 600f; // degrees per second

    [Header("Emergency Alarm Beacons")]
    public Light[] emergencyBeacons;
    public float alarmFlashSpeed = 4f;

    [Header("Control Rod Assembly")]
    public Transform controlRodCluster;
    public Vector3 rodsExtractedPos = new Vector3(-20.77f, 3.2f, -2.99f);
    public Vector3 rodsInsertedPos = new Vector3(-20.77f, 1.8f, -2.99f);

    private float _beaconTimer = 0f;

    private void Start()
    {
        InitializeComponents();
    }

    public void InitializeComponents()
    {
        GameObject reaktor = GameObject.Find("reaktor2_0");
        if (reaktor == null) return;

        // 1. Cherenkov core light
        if (cherenkovLight == null)
        {
            Transform existing = reaktor.transform.Find("CherenkovLight");
            if (existing != null) cherenkovLight = existing.GetComponent<Light>();
            else
            {
                GameObject cl = new GameObject("CherenkovLight");
                cl.transform.SetParent(reaktor.transform);
                cl.transform.position = new Vector3(-20.77f, 1.94f, -2.99f);
                cherenkovLight = cl.AddComponent<Light>();
                cherenkovLight.type = LightType.Point;
                cherenkovLight.color = cherenkovColor;
                cherenkovLight.range = 16f;
                cherenkovLight.intensity = maxCherenkovIntensity;
            }
        }

        // 2. Find pump motor objects
        for (int i = 0; i < 4; i++)
        {
            if (pumpRotors[i] == null)
            {
                Transform m = reaktor.transform.Find($"Двигатель_ГЦН_{i + 1}");
                if (m == null) m = reaktor.transform.Find($"ГЦН_{i + 1}");
                pumpRotors[i] = m;
            }

            if (pumpStatusLights[i] == null && pumpRotors[i] != null)
            {
                Transform pl = pumpRotors[i].Find("PumpStatusLight");
                if (pl != null) pumpStatusLights[i] = pl.GetComponent<Light>();
                else
                {
                    GameObject pGo = new GameObject("PumpStatusLight");
                    pGo.transform.SetParent(pumpRotors[i]);
                    pGo.transform.localPosition = new Vector3(0f, 0.8f, 0f);
                    var l = pGo.AddComponent<Light>();
                    l.type = LightType.Point;
                    l.range = 3.5f;
                    l.intensity = 1.8f;
                    l.color = Color.green;
                    pumpStatusLights[i] = l;
                }
            }
        }

        // 3. Emergency Containment Beacon Lights
        if (emergencyBeacons == null || emergencyBeacons.Length == 0)
        {
            emergencyBeacons = new Light[2];
            for (int b = 0; b < 2; b++)
            {
                string bName = "EmergencyBeacon_" + b;
                Transform eb = reaktor.transform.Find(bName);
                if (eb != null) emergencyBeacons[b] = eb.GetComponent<Light>();
                else
                {
                    GameObject bGo = new GameObject(bName);
                    bGo.transform.SetParent(reaktor.transform);
                    bGo.transform.position = new Vector3(-20.77f + (b == 0 ? -5f : 5f), 5.5f, -2.99f);
                    var l = bGo.AddComponent<Light>();
                    l.type = LightType.Point;
                    l.color = Color.red;
                    l.range = 22f;
                    l.intensity = 0f;
                    emergencyBeacons[b] = l;
                }
            }
        }
    }

    private void Update()
    {
        if (sim == null) return;
        float dt = Time.deltaTime;

        // 1. Cherenkov Glow Dynamics (scales with thermal power + high frequency quantum shimmer)
        if (cherenkovLight != null)
        {
            float powerFraction = Mathf.Clamp01(sim.thermalPower / 3200f);
            float shimmer = 1f + 0.05f * Mathf.Sin(Time.time * 12f) + 0.03f * Mathf.Sin(Time.time * 23f);
            float targetIntensity = (sim.isScramActive ? 0.3f : maxCherenkovIntensity * powerFraction) * shimmer;
            cherenkovLight.intensity = Mathf.Lerp(cherenkovLight.intensity, targetIntensity, dt * 5f);
            cherenkovLight.color = sim.isScramActive ? new Color(0.1f, 0.2f, 0.6f) : cherenkovColor;
        }

        // 2. Main Coolant Pumps Rotation & Status Lights
        for (int i = 0; i < 4; i++)
        {
            bool active = (sim.pumpActive != null && i < sim.pumpActive.Length) ? sim.pumpActive[i] : true;

            if (pumpRotors[i] != null && active)
            {
                // Rotate motor shaft around Y axis
                pumpRotors[i].Rotate(Vector3.up, basePumpRpm * dt, Space.Self);
            }

            if (pumpStatusLights[i] != null)
            {
                pumpStatusLights[i].color = active ? Color.green : Color.red;
                pumpStatusLights[i].intensity = active ? 1.6f : 2.5f;
            }
        }

        // 3. Emergency Alarm Beacons
        _beaconTimer += dt;
        bool isAlarm = sim.isScramActive || sim.primaryPressure > 16.6f;
        if (emergencyBeacons != null)
        {
            foreach (var b in emergencyBeacons)
            {
                if (b != null)
                {
                    if (isAlarm)
                    {
                        float pulse = Mathf.PingPong(_beaconTimer * alarmFlashSpeed, 1f);
                        b.intensity = pulse > 0.4f ? 3.5f : 0.1f;
                    }
                    else
                    {
                        b.intensity = Mathf.MoveTowards(b.intensity, 0f, dt * 4f);
                    }
                }
            }
        }

        // 4. Control Rods Cluster Position
        if (controlRodCluster != null)
        {
            float t = Mathf.Clamp01(sim.controlRodsPosition / 100f);
            controlRodCluster.position = Vector3.Lerp(rodsExtractedPos, rodsInsertedPos, t);
        }
    }
}

using UnityEngine;
using UnityEngine.Networking;
using Newtonsoft.Json;
using System.Collections;

public class SimpleServerConnect : MonoBehaviour
{
    private string serverUrl = "http://localhost:3000/api/monitor";

    void Start()
    {
        StartCoroutine(GetData());
    }

    IEnumerator GetData()
    {
        UnityWebRequest request = UnityWebRequest.Get(serverUrl);
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            string json = request.downloadHandler.text;
            Debug.Log("Raw JSON: " + json);

            try
            {
                ReactorData data = JsonConvert.DeserializeObject<ReactorData>(json);

                if (data != null)
                {
                    Debug.Log("=== REACTOR DATA ===");
                    Debug.Log("Status: " + data.status);
                    Debug.Log("Version: " + data.version);
                    Debug.Log("Sim Time: " + data.simTime);
                    Debug.Log("Rod Position: " + data.inputs.rodPositionTarget);
                    Debug.Log("Turbine Valve: " + data.inputs.turbineValveTarget);
                    Debug.Log("Feedwater: " + data.inputs.feedwaterFlowTarget);
                    Debug.Log("Steady State: " + data.isSteadyState);
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError("JSON Parse Error: " + e.Message);
            }
        }
        else
        {
            Debug.LogError("Error: " + request.error);
        }
    }

    [System.Serializable]
    public class ReactorData
    {
        public string status;
        public string version;
        public string buildId;
        public string mode;
        public float simTime;
        public Inputs inputs;
        public bool isSteadyState;
    }

    [System.Serializable]
    public class Inputs
    {
        public float rodPositionTarget;
        public string rodControlMode;
        public float boronInjectionRate;
        public bool boronPumpActive;
        public bool pureWaterPumpActive;
        public float turbineValveTarget;
        public bool turbineStopValvesOpen;
        public string feedwaterControlMode;
        public float feedwaterFlowTarget;
        public string pzrControlMode;
        public float pzrSprayValveTarget;
        public float pzrHeaterPowerTarget;
        public bool[] rcpActive;
        public float rcpSpeedTarget;
        public float bruKTarget;
        public float bruATarget;
        public bool gridConnected;
        public bool manualScram;
    }
}
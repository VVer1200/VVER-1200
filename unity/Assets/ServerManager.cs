using UnityEngine;
using UnityEngine.Networking;
using TMPro;
using System.Collections;

public class ServerManager : MonoBehaviour
{
    [Header("Server Settings")]
    public string serverUrl = "http://localhost:3000";
    public string endpoint = "/api/status";
    public float updateInterval = 5f;

    [Header("UI Reference")]
    public TextMeshPro monitorText;

    void Start()
    {
        if (monitorText == null)
        {
            Debug.LogError("Monitor Text is not assigned!");
            return;
        }

        StartCoroutine(UpdateLoop());
    }

    IEnumerator UpdateLoop()
    {
        while (true)
        {
            yield return StartCoroutine(FetchData());
            yield return new WaitForSeconds(updateInterval);
        }
    }

    IEnumerator FetchData()
    {
        string fullUrl = serverUrl + endpoint;
        Debug.Log("Requesting: " + fullUrl);

        UnityWebRequest request = UnityWebRequest.Get(fullUrl);
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            string json = request.downloadHandler.text;
            Debug.Log("Server response: " + json);

            MonitorData data = JsonUtility.FromJson<MonitorData>(json);

            if (data != null)
            {
                monitorText.text = "STATUS: " + data.status + "\n" +
                                   "VALUE: " + data.value + "\n" +
                                   "TIME: " + data.time;
            }
        }
        else
        {
            Debug.LogError("Error: " + request.error);
            monitorText.text = "CONNECTION ERROR";
        }
    }

    [System.Serializable]
    public class MonitorData
    {
        public string status;
        public int value;
        public string time;
    }
}
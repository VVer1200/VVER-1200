using UnityEngine;
using UnityWebBrowser;

public class BrowserToTexture : MonoBehaviour
{
    public RenderTexture targetTexture;

    void Start()
    {
        WebBrowserUI browser = GetComponent<WebBrowserUI>();

        if (browser != null && targetTexture != null)
        {
            var property = browser.GetType().GetProperty("TargetTexture");
            if (property != null)
            {
                property.SetValue(browser, targetTexture);
                Debug.Log("Texture assigned via reflection!");
            }
            else
            {
                Debug.LogWarning("TargetTexture property not found. Trying field...");
                var field = browser.GetType().GetField("targetTexture", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                if (field != null)
                {
                    field.SetValue(browser, targetTexture);
                    Debug.Log("Texture assigned via field!");
                }
            }
        }
    }
}
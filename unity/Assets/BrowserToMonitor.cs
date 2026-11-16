
using UnityEngine;
using UnityEngine.UI;

public class BrowserToMonitor : MonoBehaviour
{
    [SerializeField] private RawImage browserImage;
    [SerializeField] private Renderer monitorRenderer;

    private Material monitorMaterial;

    private void Start()
    {
        monitorMaterial = monitorRenderer.material;
    }

    private void LateUpdate()
    {
        if (browserImage != null && browserImage.texture != null)
        {
            monitorMaterial.mainTexture = browserImage.texture;
            monitorMaterial.mainTextureScale = new Vector2(-1, -1);
            monitorMaterial.mainTextureOffset = new Vector2(1, 1);
        }
    }
}

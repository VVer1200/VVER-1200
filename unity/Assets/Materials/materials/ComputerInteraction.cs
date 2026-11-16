
using UnityEngine;
using TMPro;
using UnityEngine.UI;

#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

public class ComputerInteraction : MonoBehaviour
{
    [Header("Компьютер")]
    [SerializeField] private Canvas monitorCanvas;
    [SerializeField] private MonoBehaviour playerController;
    [SerializeField] private float interactionDistance = 3f;

    [Header("Подсказка")]
    [SerializeField] private TMP_Text interactionText;

    [Header("Настройки клавиш")]
    [SerializeField] private KeyCode interactKey = KeyCode.E;
    [SerializeField] private KeyCode exitKey = KeyCode.Escape;

    private bool isInteracting;

    private Transform playerTransform;
    private Transform originalParent;
    private RectTransform canvasRect;

    private RenderMode originalRenderMode;
    private Camera originalCamera;

    private Vector3 originalLocalPosition;
    private Quaternion originalLocalRotation;
    private Vector3 originalLocalScale;

    private Vector2 originalAnchorMin;
    private Vector2 originalAnchorMax;
    private Vector2 originalOffsetMin;
    private Vector2 originalOffsetMax;
    private Vector2 originalSizeDelta;
    private Vector2 originalPivot;

    private void Start()
    {
        if (playerController != null)
            playerTransform = playerController.transform;

        if (monitorCanvas != null)
        {
            canvasRect = monitorCanvas.GetComponent<RectTransform>();

            originalParent = monitorCanvas.transform.parent;
            originalRenderMode = monitorCanvas.renderMode;
            originalCamera = monitorCanvas.worldCamera;

            originalLocalPosition = monitorCanvas.transform.localPosition;
            originalLocalRotation = monitorCanvas.transform.localRotation;
            originalLocalScale = monitorCanvas.transform.localScale;

            originalAnchorMin = canvasRect.anchorMin;
            originalAnchorMax = canvasRect.anchorMax;
            originalOffsetMin = canvasRect.offsetMin;
            originalOffsetMax = canvasRect.offsetMax;
            originalSizeDelta = canvasRect.sizeDelta;
            originalPivot = canvasRect.pivot;
        }

        if (interactionText != null)
        {
            interactionText.text = "E — взаимодействовать";
            interactionText.gameObject.SetActive(true);

            interactionText.raycastTarget = false;
        }
    }

    private void Update()
    {
        if (!isInteracting && IsInteractPressed())
        {
            if (playerTransform != null && monitorCanvas != null)
            {
                float distance = Vector3.Distance(
                    playerTransform.position,
                    transform.position
                );

                if (distance <= interactionDistance)
                    StartInteraction();
            }
        }

        if (isInteracting && IsExitPressed())
        {
            StopInteraction();
        }
    }

    private void StartInteraction()
    {
        isInteracting = true;

        if (playerController != null)
            playerController.enabled = false;

        monitorCanvas.transform.SetParent(null, false);

        monitorCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
        monitorCanvas.worldCamera = null;

        canvasRect.anchorMin = Vector2.zero;
        canvasRect.anchorMax = Vector2.one;
        canvasRect.pivot = new Vector2(0.5f, 0.5f);

        canvasRect.offsetMin = new Vector2(30f, 30f);
        canvasRect.offsetMax = new Vector2(-30f, -30f);

        canvasRect.anchoredPosition = Vector2.zero;
        canvasRect.sizeDelta = Vector2.zero;

        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;

        if (interactionText != null)
            interactionText.text = "ESC — выйти";
    }

    private void StopInteraction()
    {
        isInteracting = false;

        monitorCanvas.transform.SetParent(originalParent, false);

        monitorCanvas.renderMode = originalRenderMode;
        monitorCanvas.worldCamera = originalCamera;

        monitorCanvas.transform.localPosition = originalLocalPosition;
        monitorCanvas.transform.localRotation = originalLocalRotation;
        monitorCanvas.transform.localScale = originalLocalScale;

        canvasRect.anchorMin = originalAnchorMin;
        canvasRect.anchorMax = originalAnchorMax;
        canvasRect.offsetMin = originalOffsetMin;
        canvasRect.offsetMax = originalOffsetMax;
        canvasRect.sizeDelta = originalSizeDelta;
        canvasRect.pivot = originalPivot;

        if (playerController != null)
            playerController.enabled = true;

        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;

        if (interactionText != null)
            interactionText.text = "E — взаимодействовать";
    }

    private bool IsInteractPressed()
    {
#if ENABLE_INPUT_SYSTEM
        return Keyboard.current != null &&
               Keyboard.current.eKey.wasPressedThisFrame;
#else
        return Input.GetKeyDown(interactKey);
#endif
    }

    private bool IsExitPressed()
    {
#if ENABLE_INPUT_SYSTEM
        return Keyboard.current != null &&
               Keyboard.current.escapeKey.wasPressedThisFrame;
#else
        return Input.GetKeyDown(exitKey);
#endif
    }
}

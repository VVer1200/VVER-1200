using UnityEngine;

/// <summary>
/// Allows the player to toggle cursor unlock (by pressing E or Tab) to interactively click and drag
/// UI sliders and buttons on the computer screens.
/// </summary>
public class PlayerInteractManager : MonoBehaviour
{
    public static PlayerInteractManager Instance { get; private set; }

    [Header("Input Keys")]
    public KeyCode toggleCursorKey = KeyCode.E;
    public KeyCode secondaryToggleKey = KeyCode.Tab;

    [Header("Crosshair & Hint")]
    public bool isInteractingWithUI = false;

    private FirstPersonController fpc;

    private void Awake()
    {
        Instance = this;
        fpc = FindFirstObjectByType<FirstPersonController>();
    }

    private void Update()
    {
        if (ControlRoomFullscreenUI.Instance != null)
        {
            // Fullscreen UI handles interaction directly
            return;
        }

        if (Input.GetKeyDown(toggleCursorKey) || Input.GetKeyDown(secondaryToggleKey))
        {
            ToggleInteraction();
        }
        else if (isInteractingWithUI && Input.GetKeyDown(KeyCode.Escape))
        {
            SetInteraction(false);
        }
    }

    public void ToggleInteraction()
    {
        SetInteraction(!isInteractingWithUI);
    }

    public void SetInteraction(bool state)
    {
        isInteractingWithUI = state;
        if (isInteractingWithUI)
        {
            // Unlock cursor so user can click on screens
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
            if (fpc != null) fpc.enabled = false;
        }
        else
        {
            // Lock cursor back for first-person walking
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
            if (fpc != null) fpc.enabled = true;
        }
    }

    private void OnGUI()
    {
        if (ControlRoomFullscreenUI.Instance != null) return;

        GUIStyle style = new GUIStyle(GUI.skin.box);
        style.fontSize = 15;
        style.fontStyle = FontStyle.Bold;
        style.normal.textColor = Color.white;
        style.alignment = TextAnchor.MiddleCenter;

        string hint = isInteractingWithUI
            ? "РЕЖИМ КУРСОРА: Кликайте по экранам мониторов для управления реактором\nНажмите [E], [Tab] или [Esc] для возврата к ходьбе"
            : "Нажмите [E] или [Tab], чтобы переключиться на мышь и управлять мониторами";

        GUI.backgroundColor = isInteractingWithUI ? new Color(0.08f, 0.45f, 0.2f, 0.9f) : new Color(0.08f, 0.12f, 0.16f, 0.85f);
        GUI.Box(new Rect((Screen.width - 660) / 2, 20, 660, 52), hint, style);
    }
}

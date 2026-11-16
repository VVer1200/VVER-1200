
using System;
using UnityEngine;

/// <summary>
/// Defines a contract for calculating player movement.
/// </summary>
/// <remarks>
/// Implementations calculate movement without moving the player directly.
/// The consumer is responsible for applying the returned vector.
/// </remarks>
public interface IPlayerMovement
{
    /// <summary>
    /// Calculates the player's movement vector in world space.
    /// </summary>
    Vector3 CalculateMove(
        Transform playerTransform,
        Vector2 input,
        float speed
    );
}

/// <summary>
/// Calculates movement relative to the player's orientation.
/// Diagonal movement is normalized to prevent increased speed.
/// </summary>
public class PlayerMovement : MonoBehaviour, IPlayerMovement
{
    /// <inheritdoc/>
    public Vector3 CalculateMove(
        Transform playerTransform,
        Vector2 input,
        float speed)
    {
        ValidateArguments(playerTransform, input, speed);

        // Ignore vertical tilt so the character does not move into the air
        // when the camera looks up or down.
        Vector3 forward = playerTransform.forward;
        Vector3 right = playerTransform.right;

        forward.y = 0f;
        right.y = 0f;

        forward.Normalize();
        right.Normalize();

        Vector3 move = right * input.x + forward * input.y;

        if (move.sqrMagnitude > 1f)
            move.Normalize();

        return move * speed;
    }

    /// <summary>
    /// Validates movement calculation arguments.
    /// </summary>
    internal static void ValidateArguments(
        Transform playerTransform,
        Vector2 input,
        float speed)
    {
        if (playerTransform == null)
            throw new ArgumentNullException(nameof(playerTransform));

        if (!IsFinite(input.x) || !IsFinite(input.y))
            throw new ArgumentOutOfRangeException(nameof(input));

        if (!IsFinite(speed) || speed < 0f)
            throw new ArgumentOutOfRangeException(nameof(speed));
    }

    /// <summary>
    /// Checks whether a value is finite.
    /// </summary>
    internal static bool IsFinite(float value)
    {
        return !float.IsNaN(value) && !float.IsInfinity(value);
    }
}

/// <summary>
/// Alternative movement implementation for substitution testing.
/// Moves in a configured world-space direction.
/// </summary>
public class FixedPlayerMovement : MonoBehaviour, IPlayerMovement
{
    /// <summary>
    /// Direction used for movement.
    /// </summary>
    public Vector3 fixedDirection = Vector3.forward;

    /// <inheritdoc/>
    public Vector3 CalculateMove(
        Transform playerTransform,
        Vector2 input,
        float speed)
    {
        PlayerMovement.ValidateArguments(playerTransform, input, speed);

        if (!PlayerMovement.IsFinite(fixedDirection.x) ||
            !PlayerMovement.IsFinite(fixedDirection.y) ||
            !PlayerMovement.IsFinite(fixedDirection.z))
        {
            throw new ArgumentOutOfRangeException(nameof(fixedDirection));
        }

        if (input.sqrMagnitude == 0f)
            return Vector3.zero;

        Vector3 direction = fixedDirection;

        if (direction.sqrMagnitude > 1f)
            direction.Normalize();

        return direction * speed;
    }
}

/// <summary>
/// Controls first-person camera rotation, movement, and gravity.
/// </summary>
public class FirstPersonController : MonoBehaviour
{
    [Header("Mouse Settings")]
    public float mouseSensitivity = 100f;

    [Header("Movement Settings")]
    public float walkSpeed = 5f;
    public float runSpeed = 10f;
    public float gravity = -9.81f;

    [Header("Ground Check")]
    public Transform groundCheck;
    public float groundDistance = 0.2f;
    public LayerMask groundMask;

    [Header("Movement Module")]
    [SerializeField]
    private MonoBehaviour movementImplementation;

    private CharacterController controller;
    private IPlayerMovement movementModule;
    private Camera playerCamera;

    private Vector3 velocity;
    private float xRotation;
    private bool isGrounded;

    /// <summary>
    /// Initializes components and selects a movement implementation.
    /// </summary>
    private void Awake()
    {
        controller = GetComponent<CharacterController>();

        // Find a camera belonging to this character first.
        playerCamera = GetComponentInChildren<Camera>();

        // Fall back to the main camera if necessary.
        if (playerCamera == null)
            playerCamera = Camera.main;

        if (controller == null)
        {
            Debug.LogError(
                "CharacterController is missing from the player.",
                this
            );

            enabled = false;
            return;
        }

        // Use the implementation assigned in the Inspector, if valid.
        movementModule = movementImplementation as IPlayerMovement;

        // Otherwise, use or create the default movement component.
        if (movementModule == null)
        {
            PlayerMovement defaultMovement =
                GetComponent<PlayerMovement>();

            if (defaultMovement == null)
            {
                defaultMovement = gameObject.AddComponent<PlayerMovement>();
            }

            movementImplementation = defaultMovement;
            movementModule = defaultMovement;

            Debug.Log(
                "Default PlayerMovement has been assigned.",
                this
            );
        }

        if (playerCamera == null)
        {
            Debug.LogError(
                "No player camera found. Mouse look will be unavailable.",
                this
            );
        }
    }

    /// <summary>
    /// Locks the cursor for first-person controls.
    /// </summary>
    private void Start()
    {
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    /// <summary>
    /// Updates mouse look, movement, and gravity.
    /// </summary>
    private void Update()
    {
        if (controller == null)
            return;

        // Mouse look does not depend on the movement module.
        if (playerCamera != null)
            HandleMouseLook();

        if (movementModule != null)
            HandleMovement();

        HandleGravity();
    }

    /// <summary>
    /// Rotates the player horizontally and the camera vertically.
    /// </summary>
    private void HandleMouseLook()
    {
        float mouseX = Input.GetAxis("Mouse X")
                       * mouseSensitivity
                       * Time.deltaTime;

        float mouseY = Input.GetAxis("Mouse Y")
                       * mouseSensitivity
                       * Time.deltaTime;

        transform.Rotate(Vector3.up * mouseX);

        xRotation -= mouseY;
        xRotation = Mathf.Clamp(xRotation, -90f, 90f);

        playerCamera.transform.localRotation =
            Quaternion.Euler(xRotation, 0f, 0f);
    }

    /// <summary>
    /// Reads input and applies horizontal movement.
    /// </summary>
    private void HandleMovement()
    {
        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");

        Vector2 input = new Vector2(horizontal, vertical);

        float currentSpeed = Input.GetKey(KeyCode.LeftShift)
            ? runSpeed
            : walkSpeed;

        Vector3 move = movementModule.CalculateMove(
            transform,
            input,
            currentSpeed
        );

        controller.Move(move * Time.deltaTime);
    }

    /// <summary>
    /// Checks ground contact and applies gravity.
    /// </summary>
    private void HandleGravity()
    {
        if (groundCheck != null)
        {
            isGrounded = Physics.CheckSphere(
                groundCheck.position,
                groundDistance,
                groundMask
            );
        }
        else
        {
            // Use CharacterController ground detection when no
            // separate ground-check object has been configured.
            isGrounded = controller.isGrounded;
        }

        if (isGrounded && velocity.y < 0f)
            velocity.y = -2f;

        velocity.y += gravity * Time.deltaTime;

        controller.Move(velocity * Time.deltaTime);
    }

    /// <summary>
    /// Unlocks the cursor when the component is disabled.
    /// </summary>
    private void OnDisable()
    {
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
    }
}

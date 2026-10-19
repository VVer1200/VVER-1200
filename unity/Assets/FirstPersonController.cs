using UnityEngine;

public class FirstPersonController : MonoBehaviour
{
    [Header("Настройки мыши")]
    public float mouseSensitivity = 100f;
    
    [Header("Настройки ходьбы")]
    public float walkSpeed = 5f;
    public float runSpeed = 10f;
    public float gravity = -9.81f;
    
    [Header("Проверка земли")]
    public Transform groundCheck;
    public float groundDistance = 0.2f;
    public LayerMask groundMask;
    
    private CharacterController controller;
    private Vector3 velocity;
    private float xRotation = 0f;
    private bool isGrounded;
    
    void Start()
    {
        controller = GetComponent<CharacterController>();
        Cursor.lockState = CursorLockMode.Locked;
    }
    
    void Update()
    {
        float mouseX = Input.GetAxis("Mouse X") * mouseSensitivity * Time.deltaTime;
        float mouseY = Input.GetAxis("Mouse Y") * mouseSensitivity * Time.deltaTime;
        
        transform.Rotate(Vector3.up * mouseX);
        
        xRotation -= mouseY;
        xRotation = Mathf.Clamp(xRotation, -90f, 90f);
        Camera.main.transform.localRotation = Quaternion.Euler(xRotation, 0f, 0f);
        
        float moveX = Input.GetAxis("Horizontal");
        float moveZ = Input.GetAxis("Vertical");
        
        Vector3 move = transform.right * moveX + transform.forward * moveZ;
        
        float currentSpeed = Input.GetKey(KeyCode.LeftShift) ? runSpeed : walkSpeed;
        
        controller.Move(move * currentSpeed * Time.deltaTime);
        
        isGrounded = Physics.CheckSphere(groundCheck.position, groundDistance, groundMask);
        
        if (isGrounded && velocity.y < 0)
        {
            velocity.y = -2f;
        }
        
        velocity.y += gravity * Time.deltaTime;
        controller.Move(velocity * Time.deltaTime);
    }
}
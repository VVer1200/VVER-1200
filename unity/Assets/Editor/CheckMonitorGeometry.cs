using UnityEngine;
using UnityEditor;

public static class CheckMonitorGeometry
{
    [MenuItem("Tools/Debug/Check Monitor Geometry")]
    public static void Check()
    {
        GameObject mon = GameObject.Find("Monitor");
        if (mon == null)
        {
            Debug.LogError("Monitor not found");
            return;
        }

        MeshRenderer mr = mon.GetComponent<MeshRenderer>();
        MeshFilter mf = mon.GetComponent<MeshFilter>();
        Debug.Log($"Monitor position: {mon.transform.position}, rotation: {mon.transform.eulerAngles}");
        Debug.Log($"Bounds center: {mr.bounds.center}, extents: {mr.bounds.extents}, min: {mr.bounds.min}, max: {mr.bounds.max}");

        for (int i = 0; i < mr.sharedMaterials.Length; i++)
        {
            Debug.Log($"Material {i}: {mr.sharedMaterials[i]?.name}");
        }

        // Find vertices for the screen face
        Mesh m = mf.sharedMesh;
        Debug.Log($"Mesh vertex count: {m.vertexCount}, subMeshCount: {m.subMeshCount}");

        // Check canvas position
        GameObject canvas = GameObject.Find("MonitorInteractiveCanvas_CoreHeatmap");
        if (canvas != null)
        {
            Debug.Log($"Canvas pos: {canvas.transform.position}, rot: {canvas.transform.eulerAngles}");
            Vector3 diff = canvas.transform.position - mr.bounds.center;
            Debug.Log($"Canvas diff from center: {diff}");
        }
    }
}

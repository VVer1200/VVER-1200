using System.IO;
using UnityEngine;
using UnityEditor;

[InitializeOnLoad]
public static class MeasureMonitorSurfaces
{
    static MeasureMonitorSurfaces()
    {
        EditorApplication.delayCall += Measure;
    }

    [MenuItem("Tools/Debug/Measure")]
    public static void Measure()
    {
        string[] names = new string[] { "Monitor (3)", "Monitor (1)", "Monitor", "Monitor (4)", "Monitor (2)" };
        GameObject room1 = GameObject.Find("room1");
        if (room1 == null) return;

        using (StreamWriter sw = new StreamWriter("scratch/measure_output.txt"))
        {
            foreach (var n in names)
            {
                Transform t = room1.transform.Find(n);
                if (t == null) continue;
                MeshRenderer mr = t.GetComponent<MeshRenderer>();
                MeshFilter mf = t.GetComponent<MeshFilter>();
                if (mf == null || mf.sharedMesh == null) continue;

                Bounds b = mr.bounds;
                sw.WriteLine($"{n}|center={b.center.x:F4},{b.center.y:F4},{b.center.z:F4}|size={b.size.x:F4},{b.size.y:F4},{b.size.z:F4}|min={b.min.x:F4},{b.min.y:F4},{b.min.z:F4}|max={b.max.x:F4},{b.max.y:F4},{b.max.z:F4}");

                Mesh m = mf.sharedMesh;
                Vector3[] verts = m.vertices;
                float maxZ = float.MinValue;
                float minZ = float.MaxValue;
                foreach (var v in verts)
                {
                    Vector3 wv = t.TransformPoint(v);
                    if (wv.z > maxZ) maxZ = wv.z;
                    if (wv.z < minZ) minZ = wv.z;
                }
                sw.WriteLine($"{n}_verts|worldMinZ={minZ:F4}|worldMaxZ={maxZ:F4}");
            }
        }
    }
}

using UnityEngine;
using UnityEditor;
using System.IO;

public static class CreateSCADASprites
{
    [MenuItem("Tools/SCADA/Generate Instrument Sprites")]
    public static void Generate()
    {
        string dir = "Assets/Resources/SCADA";
        if (!Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        SaveSprite(CreateDialFaceTexture(), Path.Combine(dir, "DialFace.png"));
        SaveSprite(CreateNeedleTexture(), Path.Combine(dir, "DialNeedle.png"));
        SaveSprite(CreateBezelTexture(), Path.Combine(dir, "DialBezel.png"));
        SaveSprite(CreateHazardStripeTexture(), Path.Combine(dir, "HazardStripe.png"));
        SaveSprite(CreateTileTexture(), Path.Combine(dir, "AnnunciatorTile.png"));

        AssetDatabase.Refresh();
        ConfigureImporter(Path.Combine(dir, "DialFace.png"), new Vector2(0.5f, 0.5f));
        ConfigureImporter(Path.Combine(dir, "DialNeedle.png"), new Vector2(0.5f, 0.15f)); // Pivot at base
        ConfigureImporter(Path.Combine(dir, "DialBezel.png"), new Vector2(0.5f, 0.5f));
        ConfigureImporter(Path.Combine(dir, "HazardStripe.png"), new Vector2(0.5f, 0.5f));
        ConfigureImporter(Path.Combine(dir, "AnnunciatorTile.png"), new Vector2(0.5f, 0.5f));
        AssetDatabase.SaveAssets();

        Debug.Log("<color=green>[SCADA] High-resolution instrument textures generated!</color>");
    }

    private static void SaveSprite(Texture2D tex, string path)
    {
        byte[] bytes = tex.EncodeToPNG();
        File.WriteAllBytes(path, bytes);
        UnityEngine.Object.DestroyImmediate(tex);
    }

    private static void ConfigureImporter(string path, Vector2 pivot)
    {
        TextureImporter importer = AssetImporter.GetAtPath(path) as TextureImporter;
        if (importer != null)
        {
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePivot = pivot;
            importer.filterMode = FilterMode.Bilinear;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.SaveAndReimport();
        }
    }

    private static Texture2D CreateDialFaceTexture()
    {
        int size = 512;
        Texture2D tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        Color[] cols = new Color[size * size];
        Vector2 center = new Vector2(size / 2f, size / 2f);
        float radius = size * 0.46f;
        float innerRadius = size * 0.40f;

        for (int y = 0; y < size; y++)
        {
            for (int x = 0; x < size; x++)
            {
                float dist = Vector2.Distance(new Vector2(x, y), center);
                if (dist <= radius)
                {
                    // Dark metallic dial face gradient
                    float normDist = dist / radius;
                    float shade = Mathf.Lerp(0.12f, 0.05f, normDist);
                    cols[y * size + x] = new Color(shade, shade + 0.02f, shade + 0.04f, 1f);

                    // Angle in degrees from top (clockwise)
                    float angle = Mathf.Atan2(x - center.x, y - center.y) * Mathf.Rad2Deg;
                    if (angle < 0) angle += 360f;

                    // Active dial arc: from 225 deg (bottom-left) clockwise to 135 deg (bottom-right)
                    // In 0..360 system: 225..360 and 0..135 (total span 270 deg)
                    bool inArc = (angle >= 225f || angle <= 135f);
                    if (inArc && dist >= innerRadius - 4f && dist <= radius - 8f)
                    {
                        // Map angle to progress 0..1
                        float progress = (angle >= 225f) ? (angle - 225f) / 270f : (angle + 135f) / 270f;
                        Color arcCol;
                        if (progress < 0.70f) arcCol = new Color(0.1f, 0.85f, 0.4f, 0.9f); // Green
                        else if (progress < 0.88f) arcCol = new Color(1.0f, 0.8f, 0.1f, 0.9f); // Yellow
                        else arcCol = new Color(0.95f, 0.2f, 0.15f, 0.9f); // Red

                        cols[y * size + x] = arcCol;
                    }

                    // Dial tick marks
                    if (inArc && dist >= innerRadius - 16f && dist <= innerRadius)
                    {
                        float progress = (angle >= 225f) ? (angle - 225f) / 270f : (angle + 135f) / 270f;
                        float tick = progress * 10f; // 10 major ticks
                        float diff = Mathf.Abs(tick - Mathf.Round(tick));
                        if (diff < 0.035f)
                        {
                            cols[y * size + x] = Color.white;
                        }
                    }
                }
                else
                {
                    cols[y * size + x] = Color.clear;
                }
            }
        }

        tex.SetPixels(cols);
        tex.Apply();
        return tex;
    }

    private static Texture2D CreateNeedleTexture()
    {
        int w = 64;
        int h = 256;
        Texture2D tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
        Color[] cols = new Color[w * h];

        float cx = w / 2f;
        float pivotY = h * 0.15f;
        float tipY = h * 0.95f;

        for (int y = 0; y < h; y++)
        {
            for (int x = 0; x < w; x++)
            {
                float dx = Mathf.Abs(x - cx);
                if (y >= pivotY && y <= tipY)
                {
                    // Tapered needle
                    float t = (y - pivotY) / (tipY - pivotY);
                    float halfWidth = Mathf.Lerp(7f, 1.5f, t);
                    if (dx <= halfWidth)
                    {
                        // Red SCADA needle with orange highlight
                        Color needleCol = (dx < 1.5f) ? new Color(1f, 0.45f, 0.2f, 1f) : new Color(0.9f, 0.15f, 0.1f, 1f);
                        cols[y * w + x] = needleCol;
                        continue;
                    }
                }

                // Needle center cap circle
                float distToPivot = Vector2.Distance(new Vector2(x, y), new Vector2(cx, pivotY));
                if (distToPivot <= 14f)
                {
                    float shade = Mathf.Lerp(0.85f, 0.35f, distToPivot / 14f);
                    cols[y * w + x] = new Color(shade, shade, shade, 1f);
                    continue;
                }

                cols[y * w + x] = Color.clear;
            }
        }

        tex.SetPixels(cols);
        tex.Apply();
        return tex;
    }

    private static Texture2D CreateBezelTexture()
    {
        int size = 512;
        Texture2D tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        Color[] cols = new Color[size * size];
        Vector2 center = new Vector2(size / 2f, size / 2f);
        float rOut = size * 0.49f;
        float rIn = size * 0.42f;

        for (int y = 0; y < size; y++)
        {
            for (int x = 0; x < size; x++)
            {
                float dist = Vector2.Distance(new Vector2(x, y), center);
                if (dist <= rOut && dist >= rIn)
                {
                    float t = (dist - rIn) / (rOut - rIn);
                    float rim = Mathf.Sin(t * Mathf.PI);
                    float val = Mathf.Lerp(0.35f, 0.75f, rim);
                    cols[y * size + x] = new Color(val, val + 0.03f, val + 0.06f, 1f);
                }
                else
                {
                    cols[y * size + x] = Color.clear;
                }
            }
        }

        tex.SetPixels(cols);
        tex.Apply();
        return tex;
    }

    private static Texture2D CreateHazardStripeTexture()
    {
        int w = 256;
        int h = 64;
        Texture2D tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
        Color yellow = new Color(1.0f, 0.85f, 0.0f);
        Color black = new Color(0.12f, 0.12f, 0.14f);

        for (int y = 0; y < h; y++)
        {
            for (int x = 0; x < w; x++)
            {
                int stripe = ((x + y) / 16) % 2;
                tex.SetPixel(x, y, stripe == 0 ? yellow : black);
            }
        }

        tex.Apply();
        return tex;
    }

    private static Texture2D CreateTileTexture()
    {
        int w = 128;
        int h = 64;
        Texture2D tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
        Color baseCol = new Color(0.08f, 0.12f, 0.16f);
        Color borderCol = new Color(0.25f, 0.35f, 0.45f);

        for (int y = 0; y < h; y++)
        {
            for (int x = 0; x < w; x++)
            {
                bool isBorder = (x < 2 || x >= w - 2 || y < 2 || y >= h - 2);
                tex.SetPixel(x, y, isBorder ? borderCol : baseCol);
            }
        }

        tex.Apply();
        return tex;
    }
}

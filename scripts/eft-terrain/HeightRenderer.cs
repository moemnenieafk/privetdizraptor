// Ортографический рендер КАРТЫ ВЫСОТ карты EFT из экспортированного Unity-проекта.
// Канон: docs/decisions/map-asset-pipeline-canon.md §1.3.
//
// Класть в Assets/Editor/ экспортированного проекта. Запуск (batch):
//   Unity.exe -batchmode -quit -projectPath <proj> -executeMethod HeightRenderer.RenderBatch \
//             -jobsFile <jobs.json> -logFile -
//
// jobs.json: { "scenes": ["Assets/.../custom_Terrain.unity", ...],
//              "xMin": -372, "xMax": 698, "zMin": -307, "zMax": 237,
//              "width": 4096, "height": 2082, "out": "D:/eft-export/customs-height.exr" }
//
// Как работает: вместо depth-буфера пишем МИРОВУЮ ВЫСОТУ (world.y) шейдером-заменителем —
// это устойчивее depth (нет зависимости от near/far и обратной Z) и сразу даёт метры.

using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

public static class HeightRenderer
{
    [Serializable]
    private class Job
    {
        public string[] scenes;
        public float xMin, xMax, zMin, zMax;
        public int width = 4096, height = 2082;
        public string @out;
    }

    private const string ShaderSrc = @"
Shader ""Hidden/WorldHeight"" {
  SubShader {
    Tags { ""RenderType""=""Opaque"" }
    Pass {
      CGPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      #include ""UnityCG.cginc""
      struct v2f { float4 pos : SV_POSITION; float h : TEXCOORD0; };
      v2f vert(appdata_base v) {
        v2f o;
        o.pos = UnityObjectToClipPos(v.vertex);
        o.h = mul(unity_ObjectToWorld, v.vertex).y;   // мировая высота в метрах
        return o;
      }
      float4 frag(v2f i) : SV_Target { return float4(i.h, 0, 0, 1); }
      ENDCG
    }
  }
}";

    public static void RenderBatch()
    {
        var jobsFile = GetArg("-jobsFile");
        if (string.IsNullOrEmpty(jobsFile)) { Debug.LogError("нет -jobsFile"); EditorApplication.Exit(2); return; }
        var job = JsonUtility.FromJson<Job>(File.ReadAllText(jobsFile));

        // сцены грузим аддитивно — карта собрана из нескольких
        for (int i = 0; i < job.scenes.Length; i++)
        {
            var mode = i == 0 ? OpenSceneMode.Single : OpenSceneMode.Additive;
            try { EditorSceneManager.OpenScene(job.scenes[i], mode); Debug.Log($"scene ok: {job.scenes[i]}"); }
            catch (Exception e) { Debug.LogWarning($"scene fail {job.scenes[i]}: {e.Message}"); }
        }

        // Диагностика + принудительное включение рендереров: в batch-режиме часть объектов
        // EFT приходит выключенной (стриминг), а occlusion culling режет всё из камеры сверху.
        int total = 0, enabled = 0, forced = 0;
        foreach (var r in UnityEngine.Object.FindObjectsOfType<MeshRenderer>(true))
        {
            total++;
            if (r.enabled && r.gameObject.activeInHierarchy) { enabled++; continue; }
            if (!r.enabled) r.enabled = true;
            if (!r.gameObject.activeSelf) r.gameObject.SetActive(true);
            forced++;
        }
        Debug.Log($"RENDERERS: всего={total} активных={enabled} включено_принудительно={forced}");

        // Реальные мировые границы всей видимой геометрии — сверить с рамкой камеры из манифеста.
        var b = new Bounds(); bool bInit = false; int bn = 0;
        foreach (var r in UnityEngine.Object.FindObjectsOfType<MeshRenderer>(false))
        {
            if (!r.enabled || !r.gameObject.activeInHierarchy) continue;
            if (!bInit) { b = r.bounds; bInit = true; } else b.Encapsulate(r.bounds);
            bn++;
        }
        if (bInit) Debug.Log($"GEOMETRY BOUNDS ({bn} рендереров): X[{b.min.x:F0},{b.max.x:F0}] Y[{b.min.y:F0},{b.max.y:F0}] Z[{b.min.z:F0},{b.max.z:F0}]");

        // Что реально стоит в игровой зоне: топ рендереров по площади следа
        var zone = new Bounds(new Vector3((job.xMin+job.xMax)*0.5f, 0, (job.zMin+job.zMax)*0.5f),
                              new Vector3(job.xMax-job.xMin, 100000f, job.zMax-job.zMin));
        var list = new List<KeyValuePair<float,string>>();
        foreach (var r in UnityEngine.Object.FindObjectsOfType<MeshRenderer>(false))
        {
            if (!r.enabled || !r.gameObject.activeInHierarchy) continue;
            if (!zone.Intersects(r.bounds)) continue;
            float area = r.bounds.size.x * r.bounds.size.z;
            list.Add(new KeyValuePair<float,string>(area, $"{r.gameObject.name} | scene={r.gameObject.scene.name} | {r.bounds.size.x:F0}x{r.bounds.size.z:F0}м y={r.bounds.center.y:F0}"));
        }
        list.Sort((x,y) => y.Key.CompareTo(x.Key));
        Debug.Log($"ZONE RENDERERS: {list.Count}");
        for (int i = 0; i < Mathf.Min(25, list.Count); i++) Debug.Log($"  ZTOP {i+1}: {list[i].Value}");

        var shader = ShaderUtil.CreateShaderAsset(ShaderSrc);
        var camGo = new GameObject("HeightCam");
        var cam = camGo.AddComponent<Camera>();
        cam.orthographic = true;
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(-10000f, 0, 0, 1);   // «нет геометрии»
        cam.cullingMask = ~0;
        cam.allowMSAA = false;
        cam.allowHDR = true;
        cam.useOcclusionCulling = false;                     // иначе камера вне баке-волюма режет всё
        cam.layerCullDistances = new float[32];              // без пер-слойных отсечек
        cam.layerCullSpherical = false;

        float cx = (job.xMin + job.xMax) * 0.5f, cz = (job.zMin + job.zMax) * 0.5f;
        float spanX = job.xMax - job.xMin, spanZ = job.zMax - job.zMin;
        cam.transform.position = new Vector3(cx, 1500f, cz);
        cam.transform.rotation = Quaternion.Euler(90f, 0f, 0f);   // строго вниз
        cam.orthographicSize = spanZ * 0.5f;                       // половина высоты кадра
        cam.aspect = spanX / spanZ;
        cam.nearClipPlane = 1f;
        cam.farClipPlane = 4000f;

        var rt = new RenderTexture(job.width, job.height, 24, RenderTextureFormat.RFloat)
        { antiAliasing = 1, useMipMap = false, filterMode = FilterMode.Point };
        cam.targetTexture = rt;
        cam.RenderWithShader(shader, "");

        var prev = RenderTexture.active;
        RenderTexture.active = rt;
        var tex = new Texture2D(job.width, job.height, TextureFormat.RFloat, false);
        tex.ReadPixels(new Rect(0, 0, job.width, job.height), 0, 0);
        tex.Apply();
        RenderTexture.active = prev;

        // статистика + сырой float-дамп (постобработку делаем в Python)
        var px = tex.GetRawTextureData<float>();
        float mn = float.MaxValue, mx = float.MinValue; int hit = 0;
        for (int i = 0; i < px.Length; i++)
        {
            float v = px[i];
            if (v < -9000f) continue;
            hit++; if (v < mn) mn = v; if (v > mx) mx = v;
        }
        Directory.CreateDirectory(Path.GetDirectoryName(job.@out));
        var raw = Path.ChangeExtension(job.@out, ".f32");
        using (var fs = new FileStream(raw, FileMode.Create))
        using (var bw = new BinaryWriter(fs))
        {
            bw.Write(job.width); bw.Write(job.height);
            for (int i = 0; i < px.Length; i++) bw.Write(px[i]);
        }
        Debug.Log($"HEIGHT ok: {job.width}x{job.height} покрытие={100f * hit / px.Length:F1}% высоты=[{mn:F1},{mx:F1}] м → {raw}");
        EditorApplication.Exit(0);
    }

    private static string GetArg(string name)
    {
        var a = Environment.GetCommandLineArgs();
        for (int i = 0; i < a.Length - 1; i++) if (a[i] == name) return a[i + 1];
        return null;
    }
}

// Пиксель-точный рендер иконок EFT в РОДНОМ движке Unity (2022.3.43 LTS — версия EFT).
// Кладётся в Unity-проект как Assets/Editor/IconRenderer.cs; запускается в batch-режиме:
//   Unity.exe -batchmode -quit -projectPath <proj> -executeMethod IconRenderer.RenderBatch -jobsFile <jobs.json>
// (БЕЗ -nographics — рендер требует графического девайса.)
//
// jobs.json: { "jobs": [ { prefabName, bundlePath, depPaths[], iconRotation[x,y,z,w],
//   perspective, boundsScale, orthographic, orthographicSize, outPath, res } ] }
// Параметры берутся из UnityPy-meta (extract_item.py). Конвертация координат НЕ нужна —
// движок тот же, Icon.rotation ставится как есть.
using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEditor;

public static class IconRenderer
{
    [Serializable] public class Job {
        public string prefabName;
        public string bundlePath;
        public string[] depPaths;
        public float[] iconRotation; // x,y,z,w
        public float[] pivotRotation; // x,y,z,w — поза предмета
        public int cameraMode; // 0=item:pivot,cam:icon (дефолт) … перебор моделей камеры
        public float perspective;
        public float boundsScale;
        public int orthographic;
        public float orthographicSize;
        public string outPath;
        public int res;
    }
    [Serializable] public class JobList { public Job[] jobs; }

    static string Arg(string name) {
        var a = Environment.GetCommandLineArgs();
        for (int i = 0; i < a.Length - 1; i++) if (a[i] == name) return a[i + 1];
        return null;
    }

    public static void RenderBatch() {
        string jobsFile = Arg("-jobsFile");
        if (string.IsNullOrEmpty(jobsFile) || !File.Exists(jobsFile)) {
            Debug.LogError("[IconRenderer] нет -jobsFile"); EditorApplication.Exit(2); return;
        }
        var list = JsonUtility.FromJson<JobList>(File.ReadAllText(jobsFile));
        int ok = 0, fail = 0;
        foreach (var job in list.jobs) {
            try { RenderOne(job); ok++; Debug.Log("[IconRenderer] OK " + job.outPath); }
            catch (Exception e) { fail++; Debug.LogError("[IconRenderer] FAIL " + job.prefabName + ": " + e); }
        }
        Debug.Log($"[IconRenderer] ГОТОВО ok={ok} fail={fail}");
        EditorApplication.Exit(fail > 0 ? 1 : 0);
    }

    static void RenderOne(Job job) {
        var bundles = new List<AssetBundle>();
        GameObject inst = null; Camera cam = null; RenderTexture rt = null; GameObject lightGo = null;
        try {
            // 1. зависимости (shaders/textures/cubemaps) ДО основного бандла
            foreach (var dp in job.depPaths)
                if (File.Exists(dp)) { var b = AssetBundle.LoadFromFile(dp); if (b != null) bundles.Add(b); }
            var main = AssetBundle.LoadFromFile(job.bundlePath);
            if (main == null) throw new Exception("бандл не загрузился: " + job.bundlePath);
            bundles.Add(main);

            // 2. префаб (по имени; иначе — GameObject с максимумом рендереров)
            GameObject prefab = null;
            var gos = main.LoadAllAssets<GameObject>();
            foreach (var g in gos) if (g.name == job.prefabName) { prefab = g; break; }
            if (prefab == null) {
                int best = -1;
                foreach (var g in gos) {
                    int n = g.GetComponentsInChildren<Renderer>(true).Length;
                    if (n > best) { best = n; prefab = g; }
                }
            }
            if (prefab == null) throw new Exception("префаб не найден в бандле");

            inst = UnityEngine.Object.Instantiate(prefab);
            inst.transform.position = Vector3.zero;
            // модели композиции pivotRotation/Icon.rotation (перебор для точного ракурса)
            var icon = new Quaternion(job.iconRotation[0], job.iconRotation[1], job.iconRotation[2], job.iconRotation[3]);
            var pivot = (job.pivotRotation != null && job.pivotRotation.Length == 4)
                ? new Quaternion(job.pivotRotation[0], job.pivotRotation[1], job.pivotRotation[2], job.pivotRotation[3])
                : Quaternion.identity;
            Quaternion itemRot, camRot;
            switch (job.cameraMode) {
                default: case 0: itemRot = pivot; camRot = icon; break;
                case 1: itemRot = Quaternion.identity; camRot = icon; break;
                case 2: itemRot = pivot; camRot = pivot * icon; break;
                case 3: itemRot = Quaternion.identity; camRot = pivot * icon; break;
                case 4: itemRot = pivot; camRot = icon * pivot; break;
                case 5: itemRot = Quaternion.identity; camRot = Quaternion.Inverse(icon); break;
            }
            inst.transform.rotation = itemRot;

            // 3. границы по видимым рендерерам
            var rends = inst.GetComponentsInChildren<Renderer>(true);
            Bounds b2 = new Bounds(Vector3.zero, Vector3.zero); bool first = true;
            foreach (var r in rends) {
                if (!(r is MeshRenderer || r is SkinnedMeshRenderer)) continue;
                if (first) { b2 = r.bounds; first = false; } else b2.Encapsulate(r.bounds);
            }
            if (first) throw new Exception("нет видимых рендереров");
            Vector3 center = b2.center; float radius = b2.extents.magnitude;

            // 4. камера по Icon (нативные координаты Unity)
            var camGo = new GameObject("IconCam");
            cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0, 0, 0, 0);
            cam.allowHDR = false; cam.allowMSAA = true;
            cam.transform.rotation = camRot;
            float bs = Mathf.Max(job.boundsScale, 0.05f);
            float dist;
            if (job.orthographic != 0) {
                cam.orthographic = true;
                cam.orthographicSize = radius / bs;
                dist = radius * 3f;
            } else {
                cam.orthographic = false;
                cam.fieldOfView = job.perspective;
                dist = (radius / bs) / Mathf.Tan(job.perspective * Mathf.Deg2Rad * 0.5f);
            }
            cam.nearClipPlane = Mathf.Max(0.001f, dist - radius * 4f);
            cam.farClipPlane = dist + radius * 4f;
            cam.transform.position = center - cam.transform.forward * dist;

            // 5. свет (ambient + key + fill); отражения металла идут из материала _Cube (бандл cubemaps загружен)
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.58f, 0.59f, 0.63f);
            lightGo = new GameObject("Lights");
            var keyGo = new GameObject("Key"); keyGo.transform.SetParent(lightGo.transform);
            var key = keyGo.AddComponent<Light>();
            key.type = LightType.Directional; key.intensity = 1.5f; key.color = Color.white;
            keyGo.transform.rotation = Quaternion.Euler(35f, 145f, 0f);
            var fillGo = new GameObject("Fill"); fillGo.transform.SetParent(lightGo.transform);
            var fill = fillGo.AddComponent<Light>();
            fill.type = LightType.Directional; fill.intensity = 0.65f; fill.color = new Color(0.9f, 0.93f, 1f);
            fillGo.transform.rotation = Quaternion.Euler(-15f, -35f, 0f);

            // 6. рендер -> прозрачный PNG
            int res = job.res > 0 ? job.res : 512;
            rt = new RenderTexture(res, res, 24, RenderTextureFormat.ARGB32);
            rt.antiAliasing = 4;
            cam.targetTexture = rt;
            cam.Render();
            var prev = RenderTexture.active; RenderTexture.active = rt;
            var tex = new Texture2D(res, res, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, res, res), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            Directory.CreateDirectory(Path.GetDirectoryName(job.outPath));
            File.WriteAllBytes(job.outPath, tex.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(tex);
        } finally {
            if (rt != null) { rt.Release(); UnityEngine.Object.DestroyImmediate(rt); }
            if (inst != null) UnityEngine.Object.DestroyImmediate(inst);
            if (cam != null) UnityEngine.Object.DestroyImmediate(cam.gameObject);
            if (lightGo != null) UnityEngine.Object.DestroyImmediate(lightGo);
            foreach (var b in bundles) if (b != null) b.Unload(true);
        }
    }
}

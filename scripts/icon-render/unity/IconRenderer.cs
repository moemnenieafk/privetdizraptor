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
        // освещение (0/null => дефолты): подбор угла/яркости
        public float[] keyEuler;     // x,y,z поворот ключевого света
        public float keyIntensity;
        public float fillIntensity;
        public float ambientLevel;
        public float[] bgColor;      // фон; null = прозрачный
        public float[] glassTint;    // хак для стекла: заменить материал на непрозрачный с этим тинтом (+нормаль-фростинг)
        public int weaponMode;       // 1 = оружейный контейнер: визуал в client_assets отдельными GO;
                                     //     собрать по ВСЕМ бандлам, отсечь fp-руки (Base Human*/joint*) и LOD1+
        public int dogtagMode;       // 1 = жетон: цепь раздувает верт. границы -> кадр по ПЛАСТИНЕ (широкие ряды),
                                     //     цепь уходит вверх за кадр (как на tarkov.dev)
        public AssemblyPart[] assembly; // сборка дефолт-пресета оружия ПО ДЕРЕВУ (родитель→ребёнок)
        public string rootPartId;    // partId, соответствующий главному префабу (inst) — корень дерева
    }
    [Serializable] public class AssemblyPart {
        public string partId;        // id этой части в дереве пресета
        public string parentId;      // id родителя (пусто/rootPartId → крепить к слоту КОРНЯ оружия)
        public string slot;          // имя слот-трансформа на РОДИТЕЛЕ (mod_barrel/mod_stock/…)
        public string bundlePath;    // бандл мода (с визуалом)
        public string[] depPaths;    // текстуры/шейдеры мода (иначе белый)
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
        GameObject inst = null; Camera cam = null; RenderTexture rt = null; GameObject lightGo = null; Cubemap cube = null;
        try {
            // 1. зависимости (shaders/textures/cubemaps) ДО основного бандла.
            //    Дедуп по нормализованному пути: у EFT client_assets часто дублируется
            //    (в depKeys И как weapon-сосед) → повторный LoadFromFile = null и рвёт линковку мешей.
            var seenPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var bpath = new Dictionary<AssetBundle, string>();
            foreach (var dp in job.depPaths) {
                if (string.IsNullOrEmpty(dp) || !File.Exists(dp)) continue;
                var full = Path.GetFullPath(dp).ToLowerInvariant();
                if (!seenPaths.Add(full)) continue;
                var b = AssetBundle.LoadFromFile(dp); if (b != null) { bundles.Add(b); bpath[b] = full; }
            }
            AssetBundle main = null;
            var mainFull = Path.GetFullPath(job.bundlePath).ToLowerInvariant();
            if (seenPaths.Add(mainFull)) main = AssetBundle.LoadFromFile(job.bundlePath);
            if (main == null) throw new Exception("бандл не загрузился: " + job.bundlePath);
            bundles.Add(main); bpath[main] = mainFull;

            // 2. префаб. Обычный предмет: по имени из main. Оружие (weaponMode): визуал —
            //    отдельные GO в client_assets (не дети контейнера) → ищем по ВСЕМ бандлам
            //    GameObject с максимумом статических мешей БЕЗ fp-рига (Base Human*/joint*) и LOD1+.
            GameObject prefab = null;
            if (job.weaponMode == 1) {
                // Визуал ищем ТОЛЬКО в бандлах из папки самого оружия (контейнер + его client_assets),
                // иначе цепляется чужой ассет из общих deps (foregrip и т.п. без материалов).
                string wdir = Path.GetDirectoryName(mainFull);
                int best = -1;
                bool wantSlots = job.assembly != null && job.assembly.Length > 0;
                foreach (var b in bundles) {
                    if (!bpath.TryGetValue(b, out var bp) || !bp.StartsWith(wdir)) continue;
                    foreach (var g in b.LoadAllAssets<GameObject>()) {
                        int n = 0;
                        foreach (var mf in g.GetComponentsInChildren<MeshFilter>(true)) {
                            if (mf.sharedMesh == null) continue;
                            var nm = mf.gameObject.name;
                            if (nm.StartsWith("Base Human") || nm.StartsWith("joint") ||
                                System.Text.RegularExpressions.Regex.IsMatch(nm, "_LOD[1-9]")) continue;
                            n++;
                        }
                        // При сборке предпочесть КОРЕНЬ СО СЛОТАМИ (mod_*): слоты, ресивер и моды окажутся в ОДНОМ фрейме.
                        // Без сборки — как раньше, по максимуму мешей.
                        int slots = 0;
                        if (wantSlots) foreach (var t in g.GetComponentsInChildren<Transform>(true)) if (t.gameObject.name.StartsWith("mod_")) slots++;
                        int score = wantSlots ? slots * 1000 + n : n;
                        if (score > best) { best = score; prefab = g; }
                    }
                }
            } else {
                var gos = main.LoadAllAssets<GameObject>();
                foreach (var g in gos) if (g.name == job.prefabName) { prefab = g; break; }
                if (prefab == null) {
                    int best = -1;
                    foreach (var g in gos) {
                        int n = g.GetComponentsInChildren<Renderer>(true).Length;
                        if (n > best) { best = n; prefab = g; }
                    }
                }
            }
            if (prefab == null) throw new Exception("префаб не найден в бандле");

            inst = UnityEngine.Object.Instantiate(prefab);
            inst.transform.position = Vector3.zero; // монтаж модов относителен слотам инстанса → корень можно в origin
            // Оружие: отсечь fp-руки (SkinnedMeshRenderer рига) и LOD1+ — оставить только визуал предмета.
            if (job.weaponMode == 1) {
                foreach (var r in inst.GetComponentsInChildren<Renderer>(true)) {
                    var nm = r.gameObject.name;
                    if (r is SkinnedMeshRenderer || nm.StartsWith("Base Human") || nm.StartsWith("joint") ||
                        System.Text.RegularExpressions.Regex.IsMatch(nm, "_LOD[1-9]"))
                        r.enabled = false;
                }
            }

            // Сборка дефолт-пресета ПО ДЕРЕВУ (калибровано на эталоне): каждый part цепляется к СЛОТУ своего РОДИТЕЛЯ
            // (корень мода → слот-трансформ родителя, zero-local = mount на слот), рекурсия по parentId через instMap.
            // Порядок assembly[] = родитель раньше ребёнка. rootPartId = partId главного префаба (inst).
            if (job.assembly != null && job.assembly.Length > 0) {
                var instMap = new Dictionary<string, GameObject>();
                if (!string.IsNullOrEmpty(job.rootPartId)) instMap[job.rootPartId] = inst;
                // --- ФАЗА 1: загрузка бандлов + выбор меш-префаба mp для каждой части (ОДИН раз) ---
                var loaded = new List<(AssemblyPart part, GameObject mp, bool done)>();
                foreach (var part in job.assembly) {
                    if (part == null || string.IsNullOrEmpty(part.bundlePath)) continue;
                    if (part.depPaths != null) foreach (var dp in part.depPaths) {
                        if (string.IsNullOrEmpty(dp) || !File.Exists(dp)) continue;
                        var f = Path.GetFullPath(dp).ToLowerInvariant();
                        if (!seenPaths.Add(f)) continue;
                        var db = AssetBundle.LoadFromFile(dp); if (db != null) { bundles.Add(db); bpath[db] = f; }
                    }
                    AssetBundle pb = null;
                    var pf = Path.GetFullPath(part.bundlePath).ToLowerInvariant();
                    if (seenPaths.Add(pf)) { pb = AssetBundle.LoadFromFile(part.bundlePath); if (pb != null) { bundles.Add(pb); bpath[pb] = pf; } }
                    if (pb == null) { Console.WriteLine($"[assembly] бандл не загрузился/дубль: {part.slot}"); continue; }
                    GameObject mp = null; int mbest = -1;
                    foreach (var g in pb.LoadAllAssets<GameObject>()) {
                        if (g.transform.parent != null) continue; // корень префаба мода = точка крепления (mount origin)
                        int n = 0;
                        foreach (var mf in g.GetComponentsInChildren<MeshFilter>(true)) {
                            if (mf.sharedMesh == null) continue;
                            var nm2 = mf.gameObject.name;
                            if (nm2.StartsWith("Base Human") || nm2.StartsWith("joint") || System.Text.RegularExpressions.Regex.IsMatch(nm2, "_LOD[1-9]")) continue;
                            n++;
                        }
                        if (n > mbest) { mbest = n; mp = g; }
                    }
                    if (mp == null) { Console.WriteLine($"[assembly] нет меша: {part.slot}"); continue; }
                    loaded.Add((part, mp, false));
                }
                // --- ФАЗА 2: МНОГОПРОХОДНЫЙ монтаж. Слот части может принадлежать под-моду, что цепляется
                //     ПОЗЖЕ (напр. mod_handguard живёт на mod_mount_001 «стойка цевья», а не на root). Крутим
                //     проходы, пока цепляется хоть что-то — порядок дерева тогда не критичен. ---
                bool progress = true;
                while (progress) {
                    progress = false;
                    for (int i = 0; i < loaded.Count; i++) {
                        if (loaded[i].done) continue;
                        var part = loaded[i].part;
                        GameObject parentInst = inst;
                        if (!string.IsNullOrEmpty(part.parentId) && instMap.TryGetValue(part.parentId, out var pi)) parentInst = pi;
                        Transform slotT = null;
                        foreach (var t in parentInst.GetComponentsInChildren<Transform>(true)) if (t.gameObject.name == part.slot) { slotT = t; break; }
                        // ФОЛБЭК: слот на другой уже прицепленной части (не у названного родителя)
                        if (slotT == null) {
                            foreach (var kv in instMap) { foreach (var t in kv.Value.GetComponentsInChildren<Transform>(true)) if (t.gameObject.name == part.slot) { slotT = t; break; } if (slotT != null) break; }
                            if (slotT == null) foreach (var t in inst.GetComponentsInChildren<Transform>(true)) if (t.gameObject.name == part.slot) { slotT = t; break; }
                        }
                        if (slotT == null) continue; // носитель слота ещё не прицеплен — ждём следующего прохода
                        var mi = UnityEngine.Object.Instantiate(loaded[i].mp);
                        foreach (var r in mi.GetComponentsInChildren<Renderer>(true)) {
                            var nm3 = r.gameObject.name;
                            if (r is SkinnedMeshRenderer || nm3.StartsWith("Base Human") || nm3.StartsWith("joint") || System.Text.RegularExpressions.Regex.IsMatch(nm3, "_LOD[1-9]")) r.enabled = false;
                        }
                        // МОНТАЖ: корень мода → мировая позиция слота, авторский поворот сохраняем (keep-world)
                        var slotWorld = slotT.position;
                        mi.transform.SetParent(inst.transform, true);
                        mi.transform.position = slotWorld;
                        if (!string.IsNullOrEmpty(part.partId)) instMap[part.partId] = mi;
                        loaded[i] = (part, loaded[i].mp, true);
                        progress = true;
                        Console.WriteLine($"[assembly] {part.slot} → ({slotWorld.x:F3},{slotWorld.y:F3},{slotWorld.z:F3})");
                    }
                }
                foreach (var L in loaded) if (!L.done) Console.WriteLine($"[assembly] слот {L.part.slot} не найден нигде — пропуск");
            }
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

            // ХАК для стекла: заменить кастомный glass-шейдер на непрозрачный Standard с тинтом + нормаль (фростинг)
            if (job.glassTint != null && job.glassTint.Length == 3) {
                var tint = new Color(job.glassTint[0], job.glassTint[1], job.glassTint[2]);
                foreach (var r in inst.GetComponentsInChildren<Renderer>(true)) {
                    if (!(r is MeshRenderer)) continue;
                    var src = r.sharedMaterial;
                    var std = new Material(Shader.Find("Standard"));
                    std.color = tint;
                    var n = src != null ? src.GetTexture("_BumpMap") : null;
                    if (n != null) { std.SetTexture("_BumpMap", n); std.EnableKeyword("_NORMALMAP"); std.SetFloat("_BumpScale", 1.2f); }
                    std.SetFloat("_Glossiness", 0.42f);
                    std.SetFloat("_Metallic", 0f);
                    r.material = std;
                }
            }

            // 3. границы по видимым рендерерам
            var rends = inst.GetComponentsInChildren<Renderer>(true);
            Bounds b2 = new Bounds(Vector3.zero, Vector3.zero); bool first = true;
            foreach (var r in rends) {
                if (!r.enabled) continue; // отключённые (fp-руки/LOD1+ в weaponMode) в границы не берём
                Bounds rb;
                if (r is SkinnedMeshRenderer smr) {
                    // SkinnedMeshRenderer.bounds РАЗДУТ (bind-pose/анимация) и зависит от костей -> носимые
                    // (броня/риги/маски) рендерились мелко. BakeMesh даёт РЕАЛЬНУЮ позу -> тугие границы по вершинам.
                    if (smr.sharedMesh == null) continue;
                    var baked = new Mesh();
                    smr.BakeMesh(baked);
                    var verts = baked.vertices;
                    if (verts.Length == 0) { UnityEngine.Object.DestroyImmediate(baked); continue; }
                    var mtx = smr.transform.localToWorldMatrix;
                    rb = new Bounds(mtx.MultiplyPoint3x4(verts[0]), Vector3.zero);
                    for (int vi = 1; vi < verts.Length; vi++) rb.Encapsulate(mtx.MultiplyPoint3x4(verts[vi]));
                    UnityEngine.Object.DestroyImmediate(baked);
                } else if (r is MeshRenderer) {
                    rb = r.bounds;
                } else continue;
                if (first) { b2 = rb; first = false; } else b2.Encapsulate(rb);
            }
            if (first) throw new Exception($"нет видимых рендереров (всего {rends.Length}, weaponMode={job.weaponMode})");
            Vector3 center = b2.center; float radius = b2.extents.magnitude;

            // 4. камера по Icon (нативные координаты Unity)
            var camGo = new GameObject("IconCam");
            cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = (job.bgColor != null && job.bgColor.Length == 4)
                ? new Color(job.bgColor[0], job.bgColor[1], job.bgColor[2], job.bgColor[3])
                : new Color(0, 0, 0, 0);
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
            dist *= 1.6f; // запас, чтобы предмет точно влез в кадр для измерения
            cam.nearClipPlane = Mathf.Max(0.001f, dist - radius * 10f);
            cam.farClipPlane = dist + radius * 10f;
            cam.transform.position = center - cam.transform.forward * dist;

            // КАМЕРА-АВТОФИТ: измеряем реальный экранный размер -> центрируем (truck) + зум ОБЪЕКТИВОМ (FOV).
            // Камеру НЕ двигаем ближе (нет клиппинга), предмет крупный на ПОЛНОМ разрешении -> резко.
            // Надёжно для skinned-носимых (броня/риги/маски), у которых bounds раздут -> были мелкие/мыло.
            if (job.orthographic == 0) {
                const int mres = 512; const float target = 0.92f;
                var mrt = new RenderTexture(mres, mres, 24, RenderTextureFormat.ARGB32);
                cam.targetTexture = mrt; cam.Render();
                var prevA = RenderTexture.active; RenderTexture.active = mrt;
                var mt = new Texture2D(mres, mres, TextureFormat.RGBA32, false);
                mt.ReadPixels(new Rect(0, 0, mres, mres), 0, 0); mt.Apply(); RenderTexture.active = prevA;
                var pxs = mt.GetPixels32();
                int minx = mres, miny = mres, maxx = -1, maxy = -1;
                int[] rMinX = new int[mres], rMaxX = new int[mres];
                for (int y = 0; y < mres; y++) { rMinX[y] = mres; rMaxX[y] = -1; }
                for (int y = 0; y < mres; y++) for (int x = 0; x < mres; x++)
                    if (pxs[y * mres + x].a > 20) {
                        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
                        if (x < rMinX[y]) rMinX[y] = x; if (x > rMaxX[y]) rMaxX[y] = x;
                    }
                UnityEngine.Object.DestroyImmediate(mt); mrt.Release(); UnityEngine.Object.DestroyImmediate(mrt);
                if (maxx >= minx) {
                    float halfTan = Mathf.Tan(cam.fieldOfView * Mathf.Deg2Rad * 0.5f);
                    float wpp = (2f * dist * halfTan) / mres; // мир на пиксель на глубине предмета
                    float cx = (minx + maxx) * 0.5f, cy = (miny + maxy) * 0.5f;
                    float extent = Mathf.Max(maxx - minx, maxy - miny) + 1f;
                    float tgt = target;
                    if (job.dogtagMode != 0) {
                        // жетон: цепь раздувает верт. границы -> кадрируем по ПЛАСТИНЕ = полоса самых широких рядов,
                        // цепь уходит вверх за кадр (как на tarkov.dev). Центр и зум — по этой полосе, не по всему альфа.
                        int maxRW = 0;
                        for (int y = 0; y < mres; y++) if (rMaxX[y] >= rMinX[y]) { int w = rMaxX[y] - rMinX[y]; if (w > maxRW) maxRW = w; }
                        int bminx = mres, bmaxx = -1, bminy = mres, bmaxy = -1;
                        for (int y = 0; y < mres; y++) if (rMaxX[y] >= rMinX[y] && (rMaxX[y] - rMinX[y]) >= 0.55f * maxRW) {
                            if (rMinX[y] < bminx) bminx = rMinX[y]; if (rMaxX[y] > bmaxx) bmaxx = rMaxX[y];
                            if (y < bminy) bminy = y; if (y > bmaxy) bmaxy = y;
                        }
                        if (bmaxx >= bminx) { cx = (bminx + bmaxx) * 0.5f; cy = (bminy + bmaxy) * 0.5f; extent = Mathf.Max(bmaxx - bminx, bmaxy - bminy) + 1f; tgt = 0.80f; }
                    }
                    cam.transform.position += cam.transform.right * ((cx - mres * 0.5f) * wpp) + cam.transform.up * ((cy - mres * 0.5f) * wpp);
                    float newFov = 2f * Mathf.Atan((extent / (mres * tgt)) * halfTan) * Mathf.Rad2Deg;
                    cam.fieldOfView = Mathf.Clamp(newFov, 0.3f, 60f);
                }
            }

            // 5. свет (ambient + key + fill); отражения металла/стекла из материала _Cube (бандл cubemaps загружен)
            float amb = job.ambientLevel > 0f ? job.ambientLevel : 0.58f;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(amb, amb * 1.02f, amb * 1.09f);
            lightGo = new GameObject("Lights");
            var keyGo = new GameObject("Key"); keyGo.transform.SetParent(lightGo.transform);
            var key = keyGo.AddComponent<Light>();
            key.type = LightType.Directional; key.color = Color.white;
            key.intensity = job.keyIntensity > 0f ? job.keyIntensity : 1.5f;
            keyGo.transform.rotation = (job.keyEuler != null && job.keyEuler.Length == 3)
                ? Quaternion.Euler(job.keyEuler[0], job.keyEuler[1], job.keyEuler[2])
                : Quaternion.Euler(35f, 145f, 0f);
            var fillGo = new GameObject("Fill"); fillGo.transform.SetParent(lightGo.transform);
            var fill = fillGo.AddComponent<Light>();
            fill.type = LightType.Directional; fill.color = new Color(0.9f, 0.93f, 1f);
            fill.intensity = job.fillIntensity > 0f ? job.fillIntensity : 0.65f;
            fillGo.transform.rotation = Quaternion.Euler(-15f, -35f, 0f);

            // студийное окружение отражений (даёт БЛИКИ на металле/стекле; раньше отражалась пустота)
            int cs = 64;
            cube = new Cubemap(cs, TextureFormat.RGBA32, false);
            Color cTop = new Color(1.15f, 1.15f, 1.2f), cMid = new Color(0.5f, 0.51f, 0.55f), cBot = new Color(0.08f, 0.08f, 0.1f);
            System.Func<float, Color> grad = (t) => t > 0.5f ? Color.Lerp(cMid, cTop, (t - 0.5f) * 2f) : Color.Lerp(cBot, cMid, t * 2f);
            foreach (CubemapFace face in new[] { CubemapFace.PositiveX, CubemapFace.NegativeX, CubemapFace.PositiveY, CubemapFace.NegativeY, CubemapFace.PositiveZ, CubemapFace.NegativeZ }) {
                var px = new Color[cs * cs];
                for (int yy = 0; yy < cs; yy++) for (int xx = 0; xx < cs; xx++) {
                    float u = (xx + 0.5f) / cs * 2f - 1f, v = (yy + 0.5f) / cs * 2f - 1f;
                    Vector3 dir;
                    switch (face) {
                        case CubemapFace.PositiveX: dir = new Vector3(1, -v, -u); break;
                        case CubemapFace.NegativeX: dir = new Vector3(-1, -v, u); break;
                        case CubemapFace.PositiveY: dir = new Vector3(u, 1, v); break;
                        case CubemapFace.NegativeY: dir = new Vector3(u, -1, -v); break;
                        case CubemapFace.PositiveZ: dir = new Vector3(u, -v, 1); break;
                        default: dir = new Vector3(-u, -v, -1); break;
                    }
                    dir.Normalize();
                    px[yy * cs + xx] = grad((dir.y + 1f) * 0.5f);
                }
                cube.SetPixels(px, face);
            }
            cube.Apply();
            RenderSettings.defaultReflectionMode = UnityEngine.Rendering.DefaultReflectionMode.Custom;
            RenderSettings.customReflectionTexture = cube;
            DynamicGI.UpdateEnvironment();

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
            if (cube != null) UnityEngine.Object.DestroyImmediate(cube);
            foreach (var b in bundles) if (b != null) b.Unload(true);
        }
    }
}

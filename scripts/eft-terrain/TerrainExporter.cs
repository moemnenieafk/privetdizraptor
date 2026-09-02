// ТОЧНЫЙ экспорт карты высот EFT: читаем Unity TerrainData напрямую (GetHeights), без рендера.
// Канон: docs/decisions/map-asset-pipeline-canon.md §1.3.
//
// Запуск:
//   Unity.exe -batchmode -quit -projectPath <proj> -executeMethod TerrainExporter.Run \
//             -scenes "Assets/.../custom_Terrain.unity" -out "D:/eft-export/customs-terrain.bin" -logFile -
//
// Формат выхода (little-endian): для каждого террейна —
//   int nameLen, byte[] name(UTF8),
//   float posX, posY, posZ, sizeX, sizeY, sizeZ, int res, float[res*res] heights01
// heights01 — нормализованные [0..1]; мировая высота = posY + h * sizeY.
// Мировые X/Z узла (i=строка Z, j=колонка X): X = posX + j/(res-1)*sizeX, Z = posZ + i/(res-1)*sizeZ.

using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class TerrainExporter
{
    public static void Run()
    {
        var scenesArg = GetArg("-scenes");
        var outPath = GetArg("-out");
        if (string.IsNullOrEmpty(scenesArg) || string.IsNullOrEmpty(outPath))
        {
            Debug.LogError("нужны -scenes и -out"); EditorApplication.Exit(2); return;
        }

        var scenes = scenesArg.Split(';');
        for (int i = 0; i < scenes.Length; i++)
        {
            var mode = i == 0 ? OpenSceneMode.Single : OpenSceneMode.Additive;
            try { EditorSceneManager.OpenScene(scenes[i], mode); Debug.Log($"scene ok: {scenes[i]}"); }
            catch (Exception e) { Debug.LogWarning($"scene fail {scenes[i]}: {e.Message}"); }
        }

        var terrains = UnityEngine.Object.FindObjectsOfType<Terrain>(true);
        Debug.Log($"TERRAINS: {terrains.Length}");

        Directory.CreateDirectory(Path.GetDirectoryName(outPath));
        using (var fs = new FileStream(outPath, FileMode.Create))
        using (var bw = new BinaryWriter(fs))
        {
            int written = 0;
            foreach (var t in terrains)
            {
                var td = t.terrainData;
                if (td == null) { Debug.LogWarning($"  {t.name}: нет terrainData"); continue; }
                int res = td.heightmapResolution;
                var pos = t.transform.position;
                var size = td.size;
                var h = td.GetHeights(0, 0, res, res);   // [z, x] в диапазоне 0..1

                float mn = 1f, mx = 0f;
                for (int z = 0; z < res; z++)
                    for (int x = 0; x < res; x++) { float v = h[z, x]; if (v < mn) mn = v; if (v > mx) mx = v; }

                var nameBytes = Encoding.UTF8.GetBytes(t.name);
                bw.Write(nameBytes.Length); bw.Write(nameBytes);
                bw.Write(pos.x); bw.Write(pos.y); bw.Write(pos.z);
                bw.Write(size.x); bw.Write(size.y); bw.Write(size.z);
                bw.Write(res);
                for (int z = 0; z < res; z++)
                    for (int x = 0; x < res; x++) bw.Write(h[z, x]);

                // Splatmap: веса слоёв поверхности + имена текстур — это и есть карта материала
                try
                {
                    int aw = td.alphamapWidth, ah = td.alphamapHeight, al = td.alphamapLayers;
                    var names = new List<string>();
                    foreach (var lay in td.terrainLayers)
                        names.Add(lay == null ? "?" : (lay.diffuseTexture == null ? lay.name : lay.diffuseTexture.name));
                    Debug.Log($"  SPLAT {t.name}: {aw}x{ah} слоёв={al} [{string.Join(", ", names)}]");
                    var alpha = td.GetAlphamaps(0, 0, aw, ah);
                    var sp = Path.Combine(Path.GetDirectoryName(outPath), $"splat_{t.name}.bin");
                    using (var sfs = new FileStream(sp, FileMode.Create))
                    using (var sbw = new BinaryWriter(sfs))
                    {
                        sbw.Write(aw); sbw.Write(ah); sbw.Write(al);
                        foreach (var n in names) { var nb = Encoding.UTF8.GetBytes(n); sbw.Write(nb.Length); sbw.Write(nb); }
                        for (int z = 0; z < ah; z++)
                            for (int x = 0; x < aw; x++)
                                for (int l = 0; l < al; l++) sbw.Write(alpha[z, x, l]);
                    }
                    Debug.Log($"  SPLAT saved: {sp}");
                }
                catch (Exception e) { Debug.LogWarning($"  splat fail {t.name}: {e.Message}"); }

                written++;
                Debug.Log($"  TERRAIN {t.name}: res={res} pos=({pos.x:F1},{pos.y:F1},{pos.z:F1}) " +
                          $"size=({size.x:F0},{size.y:F0},{size.z:F0}) высоты=[{pos.y + mn * size.y:F1},{pos.y + mx * size.y:F1}] м " +
                          $"шаг={size.x / (res - 1):F2} м");
            }
            Debug.Log($"TERRAIN EXPORT ok: {written} террейнов → {outPath}");
        }
        EditorApplication.Exit(0);
    }

    private static string GetArg(string name)
    {
        var a = Environment.GetCommandLineArgs();
        for (int i = 0; i < a.Length - 1; i++) if (a[i] == name) return a[i + 1];
        return null;
    }
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

const filesToMove = [
  {
    source: path.join(rootDir, "gemini-deep-research", "tarkov-items.ts"),
    dest: path.join(rootDir, "src", "types", "tarkov-items.ts"),
  },
  {
    source: path.join(rootDir, "gemini-deep-research", "ItemTile.tsx"),
    dest: path.join(rootDir, "src", "components", "features", "items", "ItemTile.tsx"),
  },
];

for (const { source, dest } of filesToMove) {
  if (fs.existsSync(source)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(source, dest);
    console.log(`✅ Перемещен: ${path.relative(rootDir, source)} -> ${path.relative(rootDir, dest)}`);
  } else {
    console.warn(`⚠️ Файл не найден: ${path.relative(rootDir, source)}`);
  }
}
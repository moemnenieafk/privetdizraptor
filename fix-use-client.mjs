import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, 'src', 'app');

async function getFiles(dir) {
  let results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await getFiles(fullPath)));
      } else if (entry.name.endsWith('.tsx')) {
        results.push(fullPath);
      }
    }
  } catch (e) {}
  return results;
}

async function fixFile(fullPath) {
  try {
    let content = await fs.readFile(fullPath, 'utf-8');
    let modified = false;

    // 1. Если скрипт ранее добавил импорт PageHeader, но компонент не используется — удаляем его
    if (content.includes("import { PageHeader }") && !content.includes("<PageHeader")) {
        content = content.replace(/import \{ PageHeader \} from '@\/components\/ui\/PageHeader';[\r\n]*/, '');
        modified = true;
    }

    // 2. Ищем директиву "use client" (в любых кавычках) и переносим её на самую первую строку
    let lines = content.split('\n');
    let useClientIndex = lines.findIndex(l => l.trim() === '"use client";' || l.trim() === "'use client';");
    
    // Если "use client" есть, и она не на первой строке (индекс > 0)
    if (useClientIndex > 0) {
       const useClientLine = lines.splice(useClientIndex, 1)[0];
       lines.unshift(useClientLine);
       content = lines.join('\n');
       modified = true;
    }

    if (modified) {
      await fs.writeFile(fullPath, content, 'utf-8');
      console.log(`✅ Исправлено: ${path.relative(__dirname, fullPath).replace(/\\/g, '/')}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Ошибка файла ${fullPath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Исправление директивы "use client" и лишних импортов...');
  const files = await getFiles(SRC_DIR);
  let count = 0;
  for (const file of files) {
    if (await fixFile(file)) count++;
  }
  console.log(`\n🎉 Готово! Исправлено файлов: ${count}.`);
}

main();

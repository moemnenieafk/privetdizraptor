import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICONS_DIR = path.join(__dirname, 'public', 'icons');
const SRC_DIR = path.join(__dirname, 'src');
const OUTPUT_FILE = path.join(__dirname, 'icon-list.txt');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getFiles(dir, extensions) {
  let results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await getFiles(fullPath, extensions)));
      } else if (extensions.some(ext => entry.name.toLowerCase().endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch (err) {}
  return results;
}

async function main() {
  console.log('🚀 Сканирование базы иконок и их использования в коде...');
  
  const iconFiles = await getFiles(ICONS_DIR, ['.svg', '.webp', '.png', '.jpg']);
  const codeFiles = await getFiles(SRC_DIR, ['.ts', '.tsx', '.css']);
  
  const sources = await Promise.all(codeFiles.map(async file => ({
    path: '/' + path.relative(__dirname, file).replace(/\\/g, '/'),
    content: await fs.readFile(file, 'utf-8')
  })));

  const iconsCss = sources.find(s => s.path.endsWith('icons.css'))?.content || '';
  const headerConfig = sources.find(s => s.path.endsWith('headerConfig.ts'))?.content || '';

  let report = `=== ПОЛНЫЙ ОТЧЕТ ПО ИКОНКАМ ПРОЕКТА ===\n`;
  report += `Всего физических иконок в базе (public/icons): ${iconFiles.length}\n\n`;

  for (const icon of iconFiles) {
    const relativePath = '/icons/' + path.relative(ICONS_DIR, icon).replace(/\\/g, '/');
    const filename = path.basename(icon);
    const escapedFilename = escapeRegExp(filename);
    
    let usages = sources.filter(src => src.content.includes(relativePath) || src.content.includes(filename));

    // Поиск класса в icons.css
    let cssClass = 'Не назначен';
    const classMatch = new RegExp(`\\.([a-zA-Z0-9_-]+)\\s*\\{[^}]*?${escapedFilename}`, 'i').exec(iconsCss);
    if (classMatch) {
      cssClass = `.${classMatch[1]}`;
    }

    // Поиск раздела в headerConfig.ts
    let menuSection = 'Не в меню';
    const menuMatch = new RegExp(`label\\s*:\\s*['"]([^'"]+)['"][^}]*?${escapedFilename}`, 'i').exec(headerConfig);
    if (menuMatch) {
      menuSection = menuMatch[1];
    }

    report += `----------------------------------------\n`;
    report += `ИКОНКА: ${filename}\n`;
    report += `ПУТЬ:   public${relativePath}\n`;
    report += `КЛАСС CSS: ${cssClass}\n`;
    report += `НАЗВАНИЕ РАЗДЕЛА МЕНЮ: ${menuSection}\n`;
    
    if (usages.length > 0) report += `ИСПОЛЬЗУЕТСЯ В:\n${usages.map(u => `  - ${u.path}`).join('\n')}\n`;
    else report += `⚠️ ВНИМАНИЕ: Ссылки на иконку не найдены в коде! (Или путь в коде отличается от реального)\n`;
  }

  await fs.writeFile(OUTPUT_FILE, report, 'utf-8');
  console.log(`✅ Отчет успешно сгенерирован: ${OUTPUT_FILE}`);
}

main();
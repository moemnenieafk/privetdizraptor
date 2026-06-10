import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, '..', 'src', 'app');

// Улучшенная регулярка: ищет <div> с text-center, внутри которого <h1> и <p> (даже если есть комментарии)
const HEADER_BLOCK_REGEX = /(?:\{\/\*\s*Заголовок страницы\s*\*\/\}\s*)?<div[^>]*text-center[^>]*>[\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>[\s\S]*?<p[^>]*>[\s\S]*?<\/p>[\s\S]*?<\/div>/;

async function getFiles(dir) {
  let results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await getFiles(fullPath)));
      } else if (entry.name === 'page.tsx') {
        results.push(fullPath);
      }
    }
  } catch (e) {}
  return results;
}

async function refactorFile(fullPath) {
  try {
    let content = await fs.readFile(fullPath, 'utf-8');
    let modified = false;

    // 1. Генерируем pageId из пути
    const relativePath = path.relative(path.join(__dirname, '..', 'src', 'app'), fullPath).replace(/\\/g, '/');
    const pageId = relativePath.replace('/page.tsx', '').replace(/\//g, '-');

    // 2. Меняем заголовок
    if (HEADER_BLOCK_REGEX.test(content)) {
      content = content.replace(HEADER_BLOCK_REGEX, `<PageHeader pageId="${pageId}" />`);
      modified = true;
    }

    // 3. Обновляем <main> отступы: pt-[28px] pb-[56px]
    const mainTagMatch = content.match(/<main\s+className="([^"]+)"/);
    if (mainTagMatch) {
      // Убираем старые pt- и pb-
      let classes = mainTagMatch[1].split(/\s+/).filter(c => !c.startsWith('pt-') && !c.startsWith('pb-') && !c.startsWith('py-'));
      classes.push('pt-[28px]', 'pb-[56px]');
      
      const newMainTag = `<main className="${classes.join(' ')}"`;
      const newContent = content.replace(mainTagMatch[0], newMainTag);
      
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    }

    // 4. Добавляем импорт
    if (modified && !content.includes("import { PageHeader }")) {
      const importStatement = `import { PageHeader } from '@/components/ui/PageHeader';\n`;
      content = content.replace(/('use client';\n|)/, `$1${importStatement}`);
    }

    if (modified) {
      await fs.writeFile(fullPath, content, 'utf-8');
      console.log(`✅ Рефакторинг: ${relativePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Ошибка файла ${fullPath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Запуск умного сканера страниц...');
  const files = await getFiles(SRC_DIR);
  let count = 0;
  for (const file of files) {
    if (await refactorFile(file)) count++;
  }
  console.log(`\n🎉 Завершено! Успешно обновлено файлов: ${count}.`);
}

main();
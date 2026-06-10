import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, '..', 'src', 'app');

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

async function ensureHeaderInFile(fullPath) {
  try {
    let content = await fs.readFile(fullPath, 'utf-8');
    const relativePath = path.relative(SRC_DIR, fullPath).replace(/\\/g, '/');

    // Пропускаем корневую страницу, системные файлы и динамические роуты с [id]
    if (
      relativePath === 'page.tsx' || 
      relativePath === 'not-found.tsx' || 
      relativePath === 'layout.tsx' || 
      relativePath.includes('[') || 
      relativePath.startsWith('api/')
    ) {
      return false;
    }

    // Генерируем pageId
    const pageId = relativePath.replace('/page.tsx', '').replace(/\//g, '-');

    // Если компонент PageHeader уже есть — пропускаем
    if (content.includes('<PageHeader')) {
      return false;
    }

    let modified = false;

    // Пытаемся аккуратно вставить PageHeader внутрь контейнера внутри main
    const maxWDivRegex = /(<main[^>]*>\s*<div[^>]*max-w-[^>]*>)/i;
    const mainRegex = /(<main[^>]*>)/i;

    if (maxWDivRegex.test(content)) {
      content = content.replace(maxWDivRegex, `$1\n        <PageHeader pageId="${pageId}" />`);
      modified = true;
    } else if (mainRegex.test(content)) {
      content = content.replace(mainRegex, `$1\n        <div className="w-full max-w-[1100px] px-4 xl:px-0 mx-auto">\n          <PageHeader pageId="${pageId}" />\n        </div>`);
      modified = true;
    } else {
      console.log(`⚠️ ПРЕДУПРЕЖДЕНИЕ: В ${relativePath} не найден тег <main>. Пропускаем.`);
      return false;
    }

    // Добавляем импорт наверх (учитывая use client)
    if (modified && !content.includes('import { PageHeader }')) {
      const importStatement = `import { PageHeader } from '@/components/ui/PageHeader';`;
      let lines = content.split('\n');
      let insertIndex = lines[0].includes('use client') ? 1 : 0;
      lines.splice(insertIndex, 0, importStatement);
      content = lines.join('\n');
    }

    if (modified) {
      await fs.writeFile(fullPath, content, 'utf-8');
      console.log(`✅ Добавлен <PageHeader pageId="${pageId}" /> в файл: ${relativePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Ошибка файла ${fullPath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Сканирование разделов на отсутствие PageHeader...');
  const files = await getFiles(SRC_DIR);
  let count = 0;
  for (const file of files) {
    if (await ensureHeaderInFile(file)) count++;
  }
  console.log(`\n🎉 Завершено! Успешно добавлено заголовков: ${count}.`);
  if (count > 0) {
    console.log('💡 Если на новых страницах вы видите красный текст об ошибке, добавьте эти ID в src/data/pageContent.ts!');
  }
}

main();

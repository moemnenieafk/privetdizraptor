import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, '..', 'src', 'app');

// Именно те файлы, которые выдали ПРЕДУПРЕЖДЕНИЕ
const TARGET_FILES = [
  'eft/crafts/page.tsx',
  'eft/maps/page.tsx',
  'eft/questmap/page.tsx'
];

async function fixFile(relativePath) {
  const fullPath = path.join(SRC_DIR, relativePath);
  try {
    let content = await fs.readFile(fullPath, 'utf-8');
    const pageId = relativePath.replace('/page.tsx', '').replace(/\//g, '-');

    if (content.includes('<PageHeader')) {
      console.log(`⚠️ PageHeader уже есть в ${relativePath}`);
      return false;
    }

    let modified = false;

    // 1. Если файл возвращает просто <div>
    const returnDivRegex = /return\s*\(\s*(<div[^>]*>)/i;
    // 2. Если файл возвращает просто компонент-заглушку <PlaceholderPage />
    const returnInlineRegex = /return\s+(<[A-Z][^;]+)\s*;/i;

    if (returnDivRegex.test(content)) {
      content = content.replace(returnDivRegex, `return (\n    <main className="flex w-full flex-col items-center justify-start pt-[28px] pb-[56px] animate-[fade-in_0.5s_ease-out_both] min-h-[70vh]">\n      <div className="w-full max-w-[1100px] px-4 xl:px-0 mx-auto">\n        <PageHeader pageId="${pageId}" />\n        $1`);
      content = content.replace(/(<\/div>\s*)\)\s*;/i, `$1      </div>\n    </main>\n  );`);
      modified = true;
    } else if (returnInlineRegex.test(content)) {
      content = content.replace(returnInlineRegex, `return (\n    <main className="flex w-full flex-col items-center justify-start pt-[28px] pb-[56px] animate-[fade-in_0.5s_ease-out_both] min-h-[70vh]">\n      <div className="w-full max-w-[1100px] px-4 xl:px-0 mx-auto">\n        <PageHeader pageId="${pageId}" />\n        $1\n      </div>\n    </main>\n  );`);
      modified = true;
    } else {
      // Если файл совсем пустой или сломан, приводим его к стандартному виду заглушки
      const isClient = content.includes('use client');
      content = `${isClient ? "'use client';\n\n" : ""}import { PageHeader } from '@/components/ui/PageHeader';
import { PlaceholderPage } from '@/components/PlaceholderPage';

export default function Page() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[28px] pb-[56px] animate-[fade-in_0.5s_ease-out_both] min-h-[70vh]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0 mx-auto">
        <PageHeader pageId="${pageId}" />
        <PlaceholderPage />
      </div>
    </main>
  );
}
`;
      modified = true;
    }

    if (modified) {
      if (!content.includes('import { PageHeader }')) {
        const importStatement = `import { PageHeader } from '@/components/ui/PageHeader';\n`;
        content = content.replace(/('use client';\n|)/, `$1${importStatement}`);
      }
      await fs.writeFile(fullPath, content, 'utf-8');
      console.log(`✅ Обернут в <main> и добавлен заголовок: ${relativePath}`);
      return true;
    }
  } catch (error) {
    // Если файла еще не существует, игнорируем
    return false;
  }
}

async function main() {
  console.log('🚀 Приведение оставшихся страниц к единому виду...');
  let count = 0;
  for (const file of TARGET_FILES) {
    if (await fixFile(file)) count++;
  }
  console.log(`\n🎉 Завершено! Успешно исправлено файлов: ${count}.`);
}

main();

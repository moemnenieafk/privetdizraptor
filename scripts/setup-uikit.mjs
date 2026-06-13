import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const uiKitDir = path.join(rootDir, 'src', 'components', 'ui', 'kit');

// 1. Создаем папку, если ее нет
if (!fs.existsSync(uiKitDir)) {
  fs.mkdirSync(uiKitDir, { recursive: true });
  console.log(`✅ Создана директория: src/components/ui/kit`);
}

// 2. Список файлов для переноса
const filesToMove = [
  'Badge.tsx',
  'MetricCard.tsx',
  'ProgressBar.tsx',
  'SectionPanel.tsx',
  'index.ts'
];

filesToMove.forEach(file => {
  const sourcePath = path.join(rootDir, file);
  const destPath = path.join(uiKitDir, file);

  if (fs.existsSync(sourcePath)) {
    fs.renameSync(sourcePath, destPath);
    console.log(`✅ Перемещен ${file} -> src/components/ui/kit/`);
  }
});

console.log('🚀 UI Kit успешно собран на своем месте!');
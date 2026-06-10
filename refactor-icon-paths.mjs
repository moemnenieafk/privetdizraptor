import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICONS_DIR = path.join(__dirname, 'public', 'icons');
const EFT_ICONS_DIR = path.join(ICONS_DIR, 'eft');
const SRC_DIR = path.join(__dirname, 'src');

// Директории, которые должны быть внутри /public/icons/eft/
const DIRS_TO_MOVE = [
  '01-maps',
  '02-quests',
  '03-items',
  '04-progression',
  '05-gamesetting',
  '06-videos',
];

// --- Вспомогательные функции ---
async function moveDirectory(oldPath, newPath) {
  try {
    await fs.rename(oldPath, newPath);
    console.log(`✅ Перемещена директория: ${path.basename(oldPath)} -> eft/${path.basename(oldPath)}`);
  } catch (err) {
    if (err.code === 'EEXIST') {
      console.log(`ℹ️ Директория ${path.basename(newPath)} уже существует. Пропускаем перемещение.`);
    } else if (err.code !== 'ENOENT') { // Игнорируем, если папки нет
      throw err;
    }
  }
}

async function getFiles(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

// --- Основная логика ---
async function main() {
  console.log('🚀 Запуск скрипта исправления путей иконок...');

  console.log('\n--- Шаг 1: Проверка и перемещение директорий с иконками ---');
  await fs.mkdir(EFT_ICONS_DIR, { recursive: true });
  for (const dirName of DIRS_TO_MOVE) {
    await moveDirectory(path.join(ICONS_DIR, dirName), path.join(EFT_ICONS_DIR, dirName));
  }
  console.log('✅ Структура директорий иконок исправлена.');

  console.log('\n--- Шаг 2: Обновление путей в файлах проекта ---');
  const allFiles = await getFiles(SRC_DIR);
  const targetFiles = allFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.css'));
  let updatedCount = 0;

  const pathRegex = /(["'\(])(\/icons\/)(?!eft\/)([0-9][^"'\)]+)/g;

  for (const file of targetFiles) {
    const content = await fs.readFile(file, 'utf-8');
    const newContent = content.replace(pathRegex, '$1$2eft/$3');
    if (content !== newContent) {
      await fs.writeFile(file, newContent, 'utf-8');
      console.log(`📝 Исправлены пути в файле: ${path.relative(__dirname, file)}`);
      updatedCount++;
    }
  }

  console.log(`\n🎉 Рефакторинг путей завершен! Обновлено файлов: ${updatedCount}.`);
}

main().catch(err => console.error('❌ Непредвиденная ошибка:', err));

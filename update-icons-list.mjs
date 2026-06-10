import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICONS_DIR = path.join(__dirname, 'public', 'icons');
const OUTPUT_FILE = path.join(__dirname, 'icons-list.txt');

// Рекурсивная функция для обхода всех папок
async function getAllFiles(dirPath, arrayOfFiles = []) {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      if (file.isDirectory()) {
        arrayOfFiles = await getAllFiles(fullPath, arrayOfFiles);
      } else if (/\.(svg|png|jpg|webp)$/.test(file)) {
        arrayOfFiles.push(fullPath);
      }
    }
  } catch (err) {
    // Игнорируем, если папка не найдена
  }
  return arrayOfFiles;
}

// Функция для генерации имени из имени файла
function generateNameFromFilename(filename) {
  return path.basename(filename, path.extname(filename))
    .replace(/[-_]/g, ' ')
    .replace(/%20/g, ' ')
    .trim()
    .toUpperCase();
}

async function main() {
  console.log('🚀 Запуск скрипта обновления списка иконок...');
  try {
    const files = (await getAllFiles(ICONS_DIR)).sort();
    let output = "=== СПИСОК ИКОНОК ПРОЕКТА ===\n\n";

    files.forEach(file => {
      // Безопасное получение относительного пути от папки public
      const relativePath = '/' + path.relative(path.join(__dirname, 'public'), file).replace(/\\/g, '/');
      const generatedName = generateNameFromFilename(relativePath);
      output += `- [${generatedName}] (${relativePath})\n`;
    });

    await fs.writeFile(OUTPUT_FILE, output, 'utf-8');
    console.log(`✅ Готово! Найдено иконок: ${files.length}. Список сохранен в файл ${path.basename(OUTPUT_FILE)}`);
  } catch (err) {
    console.error("❌ Ошибка сканирования:", err.message);
  }
}

main();

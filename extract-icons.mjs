import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию (аналог __dirname для ES-модулей)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Указываем путь к папке с иконками
const directoryPath = path.join(__dirname, 'public', 'icons', 'eft');

// Рекурсивная функция для обхода всех папок
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      // Берем только картинки
      if (file.endsWith('.svg') || file.endsWith('.png') || file.endsWith('.jpg')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

try {
  const files = getAllFiles(directoryPath);
  let output = "=== ТВОЙ ШАБЛОН ИКОНОК ===\n\n";

  files.forEach(file => {
    // Отрезаем локальный путь компьютера, оставляя только нужный для Next.js (начиная с /icons/...)
    const relativePath = file.split('public')[1].replace(/\\/g, '/');
    
    // Формируем строчку под шаблон
    output += `- [НАПИШИ_СЮДА_НАЗВАНИЕ] (${relativePath})\n`;
  });

  // Записываем результат в текстовый файл
  fs.writeFileSync('icons-list.txt', output);
  console.log(`✅ Готово! Найдено иконок: ${files.length}. Шаблон сохранен в файл icons-list.txt`);
} catch (err) {
  console.error("❌ Ошибка сканирования (проверь путь к папке):", err.message);
}
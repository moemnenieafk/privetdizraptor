import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSTCSS_CONFIG_PATH = path.join(__dirname, 'postcss.config.mjs');
const GLOBALS_CSS_PATH = path.join(__dirname, 'src', 'app', 'globals.css');

const POSTCSS_CONTENT = `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`;

const ICONS_IMPORT_LINE = '@import "../styles/icons.css";';
const TAILWIND_IMPORT_LINE = '@import "tailwindcss";';

async function main() {
  console.log('🚀 Запуск верификации и исправления конфигурации стилей...');
  let changesMade = false;

  // 1. Проверка и создание postcss.config.mjs
  try {
    await fs.access(POSTCSS_CONFIG_PATH);
    console.log('✅ Файл postcss.config.mjs уже существует.');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('⚠️ Файл postcss.config.mjs не найден. Создаю...');
      await fs.writeFile(POSTCSS_CONFIG_PATH, POSTCSS_CONTENT, 'utf-8');
      console.log('✅ Файл postcss.config.mjs успешно создан.');
      changesMade = true;
    } else {
      throw error;
    }
  }

  // 2. Проверка и исправление globals.css
  try {
    let globalsContent = await fs.readFile(GLOBALS_CSS_PATH, 'utf-8');
    if (!globalsContent.includes(ICONS_IMPORT_LINE)) {
      console.log('⚠️ В globals.css отсутствует импорт icons.css. Добавляю...');
      globalsContent = globalsContent.replace(
        TAILWIND_IMPORT_LINE,
        `${TAILWIND_IMPORT_LINE}\n${ICONS_IMPORT_LINE}`
      );
      await fs.writeFile(GLOBALS_CSS_PATH, globalsContent, 'utf-8');
      console.log('✅ Файл globals.css успешно исправлен.');
      changesMade = true;
    } else {
      console.log('✅ Импорт icons.css в globals.css уже присутствует.');
    }
  } catch (error) {
    console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: Файл ${GLOBALS_CSS_PATH} не найден!`, error);
  }

  console.log('\n🎉 Проверка завершена!');
  if (changesMade) {
    console.log('Были внесены исправления. Пожалуйста, перезапустите сервер разработки (Ctrl+C, затем npm run dev).');
  } else {
    console.log('Конфигурация стилей в порядке.');
  }
}

main().catch(err => {
  console.error('❌ Непредвиденная ошибка при выполнении скрипта:', err);
});
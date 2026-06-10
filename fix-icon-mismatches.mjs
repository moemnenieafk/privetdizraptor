import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICONS_CSS_PATH = path.join(__dirname, 'src', 'styles', 'icons.css');

async function main() {
  console.log('🚀 Запуск скрипта исправления несоответствий в стилях иконок...');

  try {
    let cssContent = await fs.readFile(ICONS_CSS_PATH, 'utf-8');
    let modified = false;

    // 1. Исправляем рассинхрон BTN_remove-pmc-profile.svg
    if (cssContent.includes('BTN_add-remove-profile.svg')) {
      cssContent = cssContent.replace(/BTN_add-remove-profile\.svg/g, 'BTN_remove-pmc-profile.svg');
      console.log('✅ Исправлен путь (-webkit-mask-image) для .icon-eft-profile-btn-remove');
      modified = true;
    }

    // 2. Исправляем имя файла profile-settings-icon.svg
    if (cssContent.includes('profile-pannel-settings.svg')) {
      cssContent = cssContent.replace(/profile-pannel-settings\.svg/g, 'profile-settings-icon.svg');
      console.log('✅ Исправлен путь для .icon-eft-profile-settings');
      modified = true;
    }

    if (modified) {
      await fs.writeFile(ICONS_CSS_PATH, cssContent, 'utf-8');
      console.log(`🎉 Файл ${path.relative(__dirname, ICONS_CSS_PATH)} успешно обновлен! Перезапустите сервер.`);
    } else {
      console.log('ℹ️ Несоответствия не найдены, файл уже в порядке.');
    }

  } catch (err) {
    console.error('❌ Ошибка при выполнении скрипта:', err);
  }
}

main();

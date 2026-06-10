import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OLD_DIR = path.join(__dirname, 'public', 'icons', 'eft', 'profile_pannel');
const NEW_DIR = path.join(__dirname, 'public', 'icons', 'eft', 'profile-pannel');

async function main() {
  try {
    await fs.access(OLD_DIR);
    await fs.rename(OLD_DIR, NEW_DIR);
    console.log('✅ Папка успешно переименована из "profile_pannel" в "profile-pannel"');
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('ℹ️ Папка "profile_pannel" не найдена. Скорее всего, она уже была переименована ранее.');
    } else {
      console.error('❌ Произошла ошибка при переименовании папки:', e);
    }
  }
}

main();

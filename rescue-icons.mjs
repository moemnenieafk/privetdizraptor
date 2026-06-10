import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

// Точная карта: Имя файла -> Куда он должен быть перемещен (относительно public)
const TARGETS = {
  // Корневые иконки хаба
  'maps-icon.svg': 'icons/eft/maps-icon.svg',
  'progress-icon.svg': 'icons/eft/progress-icon.svg',
  'quests-icon.svg': 'icons/eft/quests-icon.svg',
  'videos-icon.svg': 'icons/eft/videos-icon.svg',
  'codex-icon.svg': 'icons/eft/codex-icon.svg',
  '_not-found-logo.svg': 'icons/eft/_not-found-logo.svg',
  'BEAR-faction-icon.svg': 'icons/eft/BEAR-faction-icon.svg',
  'USEC-faction-icon.svg': 'icons/eft/USEC-faction-icon.svg',

  // Панель профиля
  'USEC-logo-sign.svg': 'icons/eft/profile-pannel/USEC-logo-sign.svg',
  'BEAR-logo-sign.svg': 'icons/eft/profile-pannel/BEAR-logo-sign.svg',
  'profile-pannel-settings.svg': 'icons/eft/profile-pannel/profile-pannel-settings.svg',
  'USEC_label_icon.svg': 'icons/eft/profile-pannel/USEC_label_icon.svg',
  'BEAR_label_icon.svg': 'icons/eft/profile-pannel/BEAR_label_icon.svg',
  'BTN_account-centre.svg': 'icons/eft/profile-pannel/BTN_account-centre.svg',
  'BTN_add-pmc-profile.svg': 'icons/eft/profile-pannel/BTN_add-pmc-profile.svg',
  'BTN_close-window.svg': 'icons/eft/profile-pannel/BTN_close-window.svg',
  'login-icon.svg': 'icons/eft/profile-pannel/login-icon.svg',
  'logout-icon.svg': 'icons/eft/profile-pannel/logout-icon.svg',
  'profile-reset-icon.svg': 'icons/eft/profile-pannel/profile-reset-icon.svg',
  'warning-attention-icon.svg': 'icons/eft/profile-pannel/warning-attention-icon.svg',
  'EOD_icon.svg': 'icons/eft/profile-pannel/EOD_icon.svg',
  'I-lvl-rep.svg': 'icons/eft/profile-pannel/I-lvl-rep.svg',
  'II-lvl-rep.svg': 'icons/eft/profile-pannel/II-lvl-rep.svg',
  'III-lvl-rep.svg': 'icons/eft/profile-pannel/III-lvl-rep.svg',
  'IV-Crown.svg': 'icons/eft/profile-pannel/IV-Crown.svg',
  'kappa_icon.svg': 'icons/eft/profile-pannel/kappa_icon.svg',
  'LB_icon.svg': 'icons/eft/profile-pannel/LB_icon.svg',
  'lightkeeper_icon.svg': 'icons/eft/profile-pannel/lightkeeper_icon.svg',
  'loot-mark-unheard.svg': 'icons/eft/profile-pannel/loot-mark-unheard.svg',
  'PFE_icon.svg': 'icons/eft/profile-pannel/PFE_icon.svg',
  'PVE_icon.svg': 'icons/eft/profile-pannel/PVE_icon.svg',
  'PVP_icon.svg': 'icons/eft/profile-pannel/PVP_icon.svg',
  'S_icon.svg': 'icons/eft/profile-pannel/S_icon.svg',
  'TUE_icon.svg': 'icons/eft/profile-pannel/TUE_icon.svg'
};

async function getAllFiles(dirPath, arrayOfFiles = []) {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      if (file.isDirectory()) arrayOfFiles = await getAllFiles(fullPath, arrayOfFiles);
      else arrayOfFiles.push(fullPath);
    }
  } catch (err) {}
  return arrayOfFiles;
}

async function main() {
  console.log('🚀 Запуск умного сканера для восстановления иконок...');
  const allFiles = await getAllFiles(PUBLIC_DIR);
  let movedCount = 0;
  for (const filePath of allFiles) {
    const fileName = path.basename(filePath);
    const targetKey = Object.keys(TARGETS).find(k => k.toLowerCase() === fileName.toLowerCase());
    if (targetKey) {
      const targetPath = path.join(PUBLIC_DIR, TARGETS[targetKey]);
      if (filePath.toLowerCase() === targetPath.toLowerCase()) continue;
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.rename(filePath, targetPath);
      console.log(`✅ Иконка восстановлена: ${TARGETS[targetKey]}`);
      movedCount++;
    }
  }
  console.log(`\n🎉 Операция завершена. Восстановлено иконок: ${movedCount}.`);
}
main();
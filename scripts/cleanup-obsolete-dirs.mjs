import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Список устаревших путей, которые были заменены динамическим роутингом или удалены (согласно CHANGELOG)
 */
const OBSOLETE_PATHS = [
    'src/app/abi',
    'src/app/gzw',
    'src/app/frago',
    'src/app/actmat',
    'src/app/arcraiders',
    'src/app/marathon',
    'src/app/wardogs',
    'src/app/eft/progression/itemtracker',
    'src/app/eft/items/equipment',
    'src/app/eft/items/guns',
    'src/app/eft/items/keys',
    'src/app/eft/items/meds',
    'src/app/eft/items/provisions',
    'src/app/eft/items/mods'
];

function removeObsoletePaths() {
    console.log('🧹 Запуск очистки устаревших директорий и файлов...');
    let removedCount = 0;

    OBSOLETE_PATHS.forEach(relativePath => {
        const fullPath = path.join(rootDir, relativePath);
        if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log(`✅ Удалено: ${relativePath}`);
            removedCount++;
        }
    });

    if (removedCount === 0) {
        console.log('✨ Проект уже чист, устаревшие папки не найдены.');
    } else {
        console.log(`Очистка завершена. Удалено объектов: ${removedCount}.`);
    }
}

removeObsoletePaths();
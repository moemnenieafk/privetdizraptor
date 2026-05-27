import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️ Файл не найден (пропущен): ${filePath}`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    for (const [oldStr, newStr] of Object.entries(replacements)) {
        if (content.includes(oldStr)) {
            content = content.replaceAll(oldStr, newStr);
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Исправлен файл: ${filePath}`);
    } else {
        console.log(`➖ Изменений не требуется (уже исправлено): ${filePath}`);
    }
}

const basePath = path.join(process.cwd(), 'src');

// 1. Исправляем ItemSearch (путь к экшену)
replaceInFile(path.join(basePath, 'components', 'features', 'ItemSearch.tsx'), {
    "'@/lib/search-actions'": "'@/actions/search-actions'"
});

// 2. Исправляем страницу трекера предметов (путь к ItemSearch)
replaceInFile(path.join(basePath, 'app', 'eft', 'progression', 'itemtracker', 'page.tsx'), {
    "'@/components/ItemSearch'": "'@/components/features/ItemSearch'"
});

// 3. Исправляем главную страницу (ошибка с footer)
replaceInFile(path.join(basePath, 'app', 'page.tsx'), {
    '"@/components/footer"': '"@/components/layout/Footer"'
});

console.log('🚀 Обновление путей завершено!');
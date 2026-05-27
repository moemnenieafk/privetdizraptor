import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return;
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
    }
}

const basePath = path.join(process.cwd(), 'src');

// Исправляем ItemSearch.tsx
replaceInFile(path.join(basePath, 'components', 'features', 'ItemSearch.tsx'), {
    "'@/lib/search-actions'": "'@/actions/search-actions'"
});

// Исправляем главную страницу (ошибка с Footer)
replaceInFile(path.join(basePath, 'app', 'page.tsx'), {
    '"@/components/footer"': '"@/components/layout/Footer"'
});

console.log('🚀 Проверка импортов завершена! Ошибки должны исчезнуть.');
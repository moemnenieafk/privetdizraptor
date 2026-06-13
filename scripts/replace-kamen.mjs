import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

const REPLACEMENTS = {
  'text-kamen-heading': 'text-text-primary',
  'text-kamen-stone': 'text-text-secondary',
  'text-kamen-slate': 'text-text-muted',
  'text-kamen-icon': 'text-text-muted',
  'text-kamen-action': 'text-[var(--primary)]',
  'bg-kamen-action': 'bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]',
  'border-kamen-action': 'border-[var(--primary)]',
  'bg-kamen-dark': 'bg-[var(--color-base)]',
  'text-kamen-danger': 'text-[#CF6679]',
  'border-kamen-dark': 'border-lines-hover'
};

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    fs.statSync(dirPath).isDirectory() ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

let modifiedCount = 0;

walkDir(SRC_DIR, (filePath) => {
  if (!/\.(tsx|ts|jsx|js|css)$/.test(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  for (const [legacy, current] of Object.entries(REPLACEMENTS)) {
    if (content.includes(legacy)) {
      content = content.replaceAll(legacy, current);
      hasChanges = true;
    }
  }
  if (hasChanges) { fs.writeFileSync(filePath, content, 'utf8'); modifiedCount++; console.log(`Обновлен: ${path.relative(process.cwd(), filePath)}`); }
});
console.log(`\n✅ Готово. Обновлено файлов: ${modifiedCount}`);
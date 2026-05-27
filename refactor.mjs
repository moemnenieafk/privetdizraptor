// refactor.mjs
import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'src');

// 1. Создаем необходимые директории (слои архитектуры)
const dirsToCreate = [
  'components/layout',
  'components/ui',
  'components/features',
  'components/providers',
  'actions'
];

dirsToCreate.forEach(dir => {
  fs.mkdirSync(path.join(srcDir, dir), { recursive: true });
  console.log(`[+] Создана директория: ${dir}`);
});

// 2. Маппинг файлов для перемещения
const filesToMove = [
  // Layout (Глобальный каркас)
  { from: 'components/Header', to: 'components/layout/Header' },
  { from: 'components/footer.tsx', to: 'components/layout/Footer.tsx' }, // Сразу переименовываем с заглавной буквы
  
  // UI (Переиспользуемые dumb-компоненты)
  { from: 'components/NavLink.tsx', to: 'components/ui/NavLink.tsx' },
  { from: 'components/HubCard.tsx', to: 'components/ui/HubCard.tsx' },
  { from: 'components/GameCard.tsx', to: 'components/ui/GameCard.tsx' },
  { from: 'components/Breadcrumbs.tsx', to: 'components/ui/Breadcrumbs.tsx' },
  { from: 'components/Carousel.tsx', to: 'components/ui/Carousel.tsx' },
  
  // Features (Сложные умные виджеты)
  { from: 'components/TacticalSearch.tsx', to: 'components/features/TacticalSearch.tsx' },
  { from: 'components/ItemSearch.tsx', to: 'components/features/ItemSearch.tsx' },
  { from: 'components/PlayerTelemetry.tsx', to: 'components/features/PlayerTelemetry.tsx' },
  { from: 'components/StreamStatus.tsx', to: 'components/features/StreamStatus.tsx' },
  
  // Providers
  { from: 'components/ThemeProvider.tsx', to: 'components/providers/ThemeProvider.tsx' },
  
  // Server Actions
  { from: 'lib/search-actions.ts', to: 'actions/search-actions.ts' }
];

filesToMove.forEach(({ from, to }) => {
  const fromPath = path.join(srcDir, from);
  const toPath = path.join(srcDir, to);
  
  if (fs.existsSync(fromPath)) {
    fs.renameSync(fromPath, toPath);
    console.log(`[->] Перемещено: ${from} -> ${to}`);
  } else {
    console.log(`[!] Пропущено (не найдено): ${from}`);
  }
});

console.log('\n✅ Рефакторинг структуры успешно завершен! Не забудьте обновить импорты в IDE.');

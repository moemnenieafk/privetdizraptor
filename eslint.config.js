const nextConfig = require('eslint-config-next');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    // Чужой и генерируемый код. Без этого `eslint .` линтит скачанные
    // минифицированные бандлы карт из !non-related и накидывает +38 ошибок
    // из ниоткуда — по цифрам становится не видно, что происходит в src/.
    // tests/ сюда НЕ входит: там живой responsive-snapshots.spec.ts.
    ignores: [
      // Префикс '**/' обязателен и не декоративен: в flat-config паттерн,
      // начинающийся с '!', ESLint читает как ОТРИЦАНИЕ и возвращает папку
      // в проверку. Папки здесь буквально названы с восклицательного знака.
      '**/!non-related/**',
      '**/!for-deep-research/**',
      '**/!future-requests/**',
      '.backup_static_routes/**',
      '.claude/**',
      'ds-bundle/**',
      'graphify-out/**',
      'map-exports/**',
      'test-results/**',
      'docs/**',
    ],
  },
  ...nextConfig,
  {
    rules: {
      // React Compiler emits these as errors for valid patterns like route-reset
      // or mount-detection (useEffect -> setState). Compiler just skips memoizing.
      'react-hooks/set-state-in-effect': 'warn',

      // TanStack Virtual's useVirtualizer is intentionally used without memoization.
      'react-hooks/incompatible-library': 'off',

      // Game assets use <img> with custom error fallback chains incompatible
      // with next/image's loader. Suppressed project-wide.
      '@next/next/no-img-element': 'off',
    },
  },
];

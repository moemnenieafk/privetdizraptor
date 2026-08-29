const nextConfig = require('eslint-config-next');

// ─── Локальное правило cta/no-layout-px ───────────────────────────────────────
// Ловит СЫРОЙ px в РАЗМЕРНЫХ/grid/gap/text-классах Tailwind. Под моделью
// пропорционального зума (root ×2 к 4K, globals.css) такой px не растёт за root →
// карточки мелкие + auto-fill меняет число колонок = «вёрстка едет» на 2K/4K.
// Решение: держать раскладку в rem/Tailwind-шкале. Хайрлайны/бордеры/радиусы/тени/
// blur/translate/позиционирование — можно px (в список НЕ входят). См.
// docs/decisions/responsive-2k-4k-scaling.md.
const LAYOUT_PX =
  /(?<![\w-])(?:min-w|max-w|min-h|max-h|gap-x|gap-y|grid-cols|grid-rows|grid-auto-rows|grid-auto-columns|basis|size|text|gap|w|h)-\[[^\]]*?[0-9]px[^\]]*?\]/g;

const noLayoutPxRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Сырой px в размерных/grid/gap/text-классах не масштабируется под 2K/4K (пропорциональный зум). Держи раскладку в rem/Tailwind-шкале.',
    },
    messages: {
      px: 'Сырой px в раскладке: «{{token}}». Под зум-моделью 2K/4K не растёт за root (карточки мелкие / auto-fill плодит колонки → «едет»). Переведи в rem ([{{rem}}]) или Tailwind-класс. Бордеры/радиусы/тени/blur/позиционирование — можно px.',
    },
    schema: [],
  },
  create(context) {
    function scan(node, text) {
      if (!text || !text.includes('px]')) return;
      const seen = new Set();
      let m;
      LAYOUT_PX.lastIndex = 0;
      while ((m = LAYOUT_PX.exec(text))) {
        const token = m[0];
        if (seen.has(token)) continue;
        seen.add(token);
        // Хайрлайны/тонкие линии (< 4px) — норма, не флагаем. Флагаем, если
        // ХОТЬ ОДНО px-значение в токене ≥ 4px (реальный размер/трек).
        const vals = (token.match(/([0-9]+(?:\.[0-9]+)?)px/g) || []).map((v) => parseFloat(v));
        const maxPx = Math.max(0, ...vals);
        if (maxPx < 4) continue;
        const rem = `${+(maxPx / 16).toFixed(4)}rem`;
        context.report({ node, messageId: 'px', data: { token, rem } });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') scan(node, node.value);
      },
      TemplateElement(node) {
        scan(node, node.value && node.value.raw);
      },
    };
  },
};

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
    // Локальный плагин cta с правилом no-layout-px (см. определение выше).
    plugins: { cta: { rules: { 'no-layout-px': noLayoutPxRule } } },
    rules: {
      // warn, не error: подсветка в редакторе/CI без блокировки билда. Бэклог
      // сырого px чистится постепенно; item-сетки под спрайты — осознанно px
      // (inline ${cell}px в style, правило их не трогает — только className).
      'cta/no-layout-px': 'warn',
    },
  },
  {
    rules: {
      // React Compiler emits these as errors for valid patterns like route-reset
      // or mount-detection (useEffect -> setState). Compiler just skips memoizing.
      'react-hooks/set-state-in-effect': 'warn',

      // Строгий eslint-config-next 16.3 промоутнул ещё три компиляторных правила
      // в ошибки на давно рабочем коде (чтение ref.current при измерении layout,
      // порядок объявлений, пропуск мемоизации). Билд webpack проходит — компилятор
      // просто не мемоизирует такие места. Держим политику как у set-state-in-effect.
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',

      // TanStack Virtual's useVirtualizer is intentionally used without memoization.
      'react-hooks/incompatible-library': 'off',

      // Game assets use <img> with custom error fallback chains incompatible
      // with next/image's loader. Suppressed project-wide.
      '@next/next/no-img-element': 'off',
    },
  },
];

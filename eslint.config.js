const nextConfig = require('eslint-config-next');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
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

import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';


const frontendFiles = [
  'client/src/**/*.{js,jsx}',
];

const nodeFiles = [
  'server/src/**/*.js',
  'server/tests/**/*.js',
  'server/scripts/**/*.js',
  'scripts/**/*.mjs',
  'client/vite.config.js',
  'eslint.config.mjs',
];


const unusedVariablesRule = [
  'error',
  {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
  },
];


export default [
  {
    ignores: [
      '**/node_modules/**',
      'client/dist/**',
      'dist/**',
      'public_html/**',

      'server/uploads/**',
      'server/data/**',
      'server/tmp/**',
      'server/logs/**',

      'server/src/data/instructions/**',
      'server/src/data/publicGenerationOrders/**',
      'server/src/data/analytics/**',
      'server/src/data/instruction-history/**',
      'server/src/data/deleted-instructions/**',
    ],
  },

  {
    files: frontendFiles,

    ...js.configs.recommended,

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },

      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
  },

  {
    files: frontendFiles,

    plugins: {
      ...eslintReact.configs.recommended.plugins,
      'react-hooks': reactHooks,
    },

    rules: {
      ...eslintReact.configs.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,

      '@eslint-react/exhaustive-deps': 'off',
      '@eslint-react/set-state-in-effect': 'off',
      'react-hooks/set-state-in-effect': 'off',

      eqeqeq: [
        'error',
        'always',
      ],

      'no-unused-vars':
        unusedVariablesRule,
    },
  },

  {
    files: nodeFiles,

    ...js.configs.recommended,

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',

      globals: {
        ...globals.nodeBuiltin,
        ...globals.es2021,

        fetch: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },

    rules: {
      eqeqeq: [
        'error',
        'always',
      ],

      'no-unused-vars':
        unusedVariablesRule,
    },
  },

  eslintConfigPrettier,
];

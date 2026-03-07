import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Enforce core isolation: no Phaser/browser imports in src/core/
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['phaser', 'phaser/*'],
              message: 'Core must not import Phaser (Constitution Principle I)',
            },
          ],
          paths: [
            {
              name: 'phaser',
              message: 'Core must not import Phaser (Constitution Principle I)',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'document',
          message: 'Core must not use browser APIs (Constitution Principle I)',
        },
        {
          name: 'window',
          message: 'Core must not use browser APIs (Constitution Principle I)',
        },
        {
          name: 'navigator',
          message: 'Core must not use browser APIs (Constitution Principle I)',
        },
        {
          name: 'localStorage',
          message: 'Core must not use browser APIs (Constitution Principle I)',
        },
      ],
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'build/', 'capacitor/', 'public/'],
  },
);

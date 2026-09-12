// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // TypeScript estricto — `any` sólo con justificación explícita (ver ~/.claude/CLAUDE.md)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // No silenciar errores con catch vacíos
      'no-empty': ['error', { allowEmptyCatch: false }],
      // Prohibir PHI/secrets accidentales en consola de producción (ver §17, §33)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);

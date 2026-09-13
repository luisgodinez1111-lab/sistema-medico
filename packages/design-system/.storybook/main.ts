import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook del design-system (NIVEL 1 — infra de componentes). Documenta y
 * aísla los componentes/patrones que consume la app, con los tokens y CSS reales
 * cargados en `preview.ts` para ver el look final (§2.3, accesibilidad).
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
};

export default config;

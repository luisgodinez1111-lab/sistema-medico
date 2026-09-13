import type { Preview } from '@storybook/react-vite';
import '../src/styles/tokens.css';
import '../src/styles/global.css';
import '../src/styles/components.css';

/** Carga los tokens y CSS reales para que las stories reflejen el look final. */
const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    layout: 'padded',
    a11y: { test: 'error' },
  },
};

export default preview;

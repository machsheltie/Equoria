import type { Preview } from '@storybook/react-vite';
import '../src/styles/tokens.css';
import '../src/styles/fonts.css';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'equoria',
      values: [{ name: 'equoria', value: '#0a0e1a' }],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
};

export default preview;

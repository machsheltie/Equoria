/**
 * Babel Configuration for Equoria Monorepo
 *
 * Configures Babel to handle both backend (Node.js/ES modules) and frontend (React/TypeScript) code
 * with appropriate presets and plugins for testing and development.
 *
 * NOTE: Removed @babel/plugin-transform-modules-commonjs plugin to fix backend test failures.
 * The project uses ES Modules ("type": "module" in package.json), so we don't need to transform
 * to CommonJS. The plugin was causing "require is not defined" errors in jest.setup.mjs.
 */

export default {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      },
      modules: false  // Changed from 'auto' to false to preserve ES Modules
    }],
    '@babel/preset-flow',
    ['@babel/preset-react', {
      runtime: 'automatic'
    }],
    ['@babel/preset-typescript', {
      allExtensions: true,
      isTSX: true,
    }]
  ],
  env: {
    test: {
      presets: [
        '@react-native/babel-preset',
        ['@babel/preset-typescript', {
          allExtensions: true,
          isTSX: true,
        }]
      ]
    }
  }
};

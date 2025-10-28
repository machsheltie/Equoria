/**
 * Babel Configuration for Equoria Monorepo
 * 
 * Configures Babel to handle both backend (Node.js/ES modules) and frontend (React/TypeScript) code
 * with appropriate presets and plugins for testing and development.
 */

export default {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      },
      modules: 'auto'
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
  plugins: [
    '@babel/plugin-transform-modules-commonjs'
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

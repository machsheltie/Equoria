export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.m?js$': 'babel-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.mjs'],
}; 
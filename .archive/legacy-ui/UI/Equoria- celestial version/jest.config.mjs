export default {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/UI/**/*.test.js', '<rootDir>/frontend/**/*.test.js'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^../../utils/(.*)$': '<rootDir>/utils/$1',
  },
};

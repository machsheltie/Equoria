module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@navigation': './src/navigation',
            '@state': './src/state',
            '@api': './src/api',
            '@utils': './src/utils',
            '@types': './src/types',
            '@constants': './src/constants',
            '@hooks': './src/hooks',
            '@theme': './src/theme',
            '@config': './src/config'
          }
        }
      ]
      // IMPORTANT: react-native-reanimated/plugin must be listed LAST when enabled
      // Temporarily disabled until animations are implemented in Week 2+
      // 'react-native-reanimated/plugin'
    ]
  };
};

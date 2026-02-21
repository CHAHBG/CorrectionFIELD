module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['src/data/**', 'src/domain/**', 'src/presentation/**', 'src/app/**'],
  rules: {
    'react-native/no-inline-styles': 'off',
    'react/no-unstable-nested-components': 'off',
  },
};

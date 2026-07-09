module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '\\.integration\\.spec\\.ts$',
  setupFiles: ['reflect-metadata'],
};

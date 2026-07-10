module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '\\.e2e-spec\\.ts$',
  setupFiles: ['reflect-metadata'],
};

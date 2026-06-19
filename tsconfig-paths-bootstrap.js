const tsConfigPaths = require('tsconfig-paths');
const tsConfig = require('./tsconfig.json');

// Override baseUrl to point to dist/ at runtime
tsConfigPaths.register({
  baseUrl: './dist',
  paths: tsConfig.compilerOptions.paths || {},
});
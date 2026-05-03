// apps/demo-cli/eslint.config.mjs
//
// Per-package override: this is a CLI app, so console.log is its primary
// output mechanism. Disable the no-console rule for this package only.

import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];

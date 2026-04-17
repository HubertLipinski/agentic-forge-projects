/**
 * @file tests/fixtures/esm-cycle/a.js
 * @description Test fixture for an ES Module circular dependency.
 * This file imports from `b.js`, which in turn imports from `a.js`, creating a cycle.
 * a.js -> b.js -> a.js
 */

import { functionFromB } from './b.js';

export const functionFromA = () => {
  console.log('Executing functionFromA');
  // This call might fail or return `undefined` if the circular dependency
  // is not handled correctly by the module loader, which is the exact
  // scenario this tool helps to detect.
  functionFromB();
};

export const valueFromA = 'This is a value from a.js';

// A default export to test that syntax as well.
export default function aDefault() {
  return 'Default export from a.js';
}
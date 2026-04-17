import { a } from './a.js';

export const b = 'This is module B';

export function getA() {
  // This function call demonstrates the circular dependency.
  // When `a.js` is evaluated, `a` will be an uninitialized binding here.
  // After `a.js` finishes its top-level code, the binding will be live.
  return a;
}
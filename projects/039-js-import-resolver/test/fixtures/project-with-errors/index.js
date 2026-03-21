/**
 * @file test/fixtures/project-with-errors/index.js
 * @description A sample file containing various types of broken ES module imports
 * and exports. This file is used as a test fixture for the js-import-resolver tool
 * to verify its detection and suggestion capabilities.
 */

// --- Correct imports (should be ignored by the analyzer) ---
import path from 'node:path';
import { someFunction } from './utils/helpers.js';

// --- Broken imports for the analyzer to find ---

// 1. Typo in the filename
import { typoHelper } from './utils/helprs.js';

// 2. Missing file extension (.js)
import { missingExt } from './utils/helpers';

// 3. Incorrect relative path (should be './utils/helpers.js')
import { wrongPath } from './helpers.js';

// 4. Non-existent module (no suggestions expected)
import { nonExistent } from './non/existent/module.js';

// 5. Bare specifier with a typo (should suggest 'picocolors')
import pc from 'picocollors';

// 6. Dynamic import with a typo
async function loadDynamic() {
  const helpers = await import('./utils/hhelpers.js');
  return helpers;
}

// 7. Dynamic import with a missing extension
async function loadDynamicNoExt() {
  const helpers = await import('./utils/helpers');
  return helpers;
}

// --- Broken exports for the analyzer to find ---

// 8. Re-exporting from a module with a typo
export { anotherHelper } from './utils/hhelpers.js';

// 9. Re-exporting from a module with a missing extension
export * from './utils/helpers';

// --- Some code to make the file look realistic ---

function main() {
  console.log('This is the main function of the project with errors.');
  console.log('It uses a correct import:', path.sep);
  console.log('And another correct one:', someFunction());

  // These lines would cause runtime errors if executed.
  // console.log(typoHelper());
  // console.log(missingExt());
  // console.log(wrongPath());
  // console.log(nonExistent());
  // console.log(pc.red('This will fail'));
}

export default main;
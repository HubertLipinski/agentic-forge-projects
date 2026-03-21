/**
 * @file test/suggestion-engine.test.js
 * @description Unit tests for the suggestion engine module.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSuggestions } from '../src/core/suggestion-engine.js';
import { clearResolutionCache } from '../src/core/path-resolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, 'fixtures', 'project-for-suggestions');

// A mock list of all source files in the test project.
// These paths must be absolute for the suggestion engine to work correctly.
const allSourceFiles = [
  path.join(projectRoot, 'index.js'),
  path.join(projectRoot, 'src', 'app.js'),
  path.join(projectRoot, 'src', 'components', 'button.js'),
  path.join(projectRoot, 'src', 'components', 'modal.mjs'),
  path.join(projectRoot, 'src', 'utils', 'helpers.js'),
  path.join(projectRoot, 'src', 'utils', 'formatter.cjs'),
  path.join(projectRoot, 'src', 'services', 'api.js'),
];

describe('Suggestion Engine', () => {
  before(() => {
    // Ensure caches are clear before tests start
    clearResolutionCache();
  });

  after(() => {
    // Clean up caches after tests
    clearResolutionCache();
  });

  describe('generateSuggestions()', () => {
    it('should throw an error if required arguments are missing', async () => {
      await assert.rejects(
        () => generateSuggestions({}),
        {
          name: 'Error',
          message: 'Missing required arguments for suggestion generation.',
        },
        'Should fail when all arguments are missing'
      );

      await assert.rejects(
        () => generateSuggestions({ specifier: './foo', importer: '/bar.js', projectRoot }),
        {
          name: 'Error',
          message: 'Missing required arguments for suggestion generation.',
        },
        'Should fail when allSourceFiles is missing'
      );
    });

    it('should suggest missing file extensions for relative paths', async () => {
      const suggestions = await generateSuggestions({
        specifier: './helpers',
        importer: path.join(projectRoot, 'src', 'utils', 'some-file.js'),
        projectRoot,
        allSourceFiles,
      });

      assert.ok(suggestions.includes('./helpers.js'), 'Should suggest .js extension');
      assert.ok(suggestions.includes('./helpers.mjs'), 'Should suggest .mjs extension');
      assert.ok(suggestions.includes('./helpers.cjs'), 'Should suggest .cjs extension');
    });

    it('should NOT suggest extensions for bare specifiers or paths with existing extensions', async () => {
      const suggestionsBare = await generateSuggestions({
        specifier: 'lodash',
        importer: path.join(projectRoot, 'src', 'app.js'),
        projectRoot,
        allSourceFiles,
      });
      assert.strictEqual(suggestionsBare.length, 0, 'Should not suggest extensions for bare specifiers');

      const suggestionsWithExt = await generateSuggestions({
        specifier: './utils/helpers.js',
        importer: path.join(projectRoot, 'src', 'app.js'),
        projectRoot,
        allSourceFiles,
      });
      assert.strictEqual(suggestionsWithExt.length, 0, 'Should not suggest extensions for paths that already have one');
    });

    it('should suggest typo fixes for filenames', async () => {
      const suggestions = await generateSuggestions({
        specifier: './hlpers', // Typo for 'helpers'
        importer: path.join(projectRoot, 'src', 'utils', 'some-file.js'),
        projectRoot,
        allSourceFiles,
      });

      // The suggestion engine should find `helpers.js` and create a relative path.
      assert.ok(suggestions.includes('./helpers.js'), "Should suggest './helpers.js' for typo './hlpers'");
    });

    it('should suggest typo fixes for filenames in a different directory', async () => {
      const suggestions = await generateSuggestions({
        specifier: './componants/buton.js', // Typo for 'components/button.js'
        importer: path.join(projectRoot, 'src', 'app.js'),
        projectRoot,
        allSourceFiles,
      });

      // It finds 'button.js' and constructs the relative path from 'src/app.js'
      assert.ok(suggestions.includes('./components/button.js'), "Should suggest correct path for typo in different directory");
    });

    it('should suggest adding `../` for potentially incorrect relative paths', async () => {
      // Scenario: a file in `src/utils` tries to import from `src/components` using `./components/button`
      // The correct path should be `../components/button`.
      const suggestions = await generateSuggestions({
        specifier: './components/button',
        importer: path.join(projectRoot, 'src', 'utils', 'some-file.js'),
        projectRoot,
        allSourceFiles,
      });

      assert.ok(suggestions.includes('../components/button'), 'Should suggest adding ../ to traverse up');
    });

    it('should combine multiple suggestion strategies', async () => {
      // Scenario: A file in `src/utils` has a typo and is missing an extension for a file in `src/components`.
      // Specifier: './modl' -> should be '../components/modal.mjs'
      const suggestions = await generateSuggestions({
        specifier: './modl',
        importer: path.join(projectRoot, 'src', 'utils', 'some-file.js'),
        projectRoot,
        allSourceFiles,
      });

      // Strategy 1: Extension suggestions
      assert.ok(suggestions.includes('./modl.js'), 'Should suggest extension');

      // Strategy 2: Relative path fix
      assert.ok(suggestions.includes('../modl'), 'Should suggest path fix');

      // Strategy 3: Typo fix (finds 'modal.mjs' and constructs the correct relative path)
      assert.ok(suggestions.includes('../components/modal.mjs'), 'Should suggest typo fix with correct relative path');
    });

    it('should not suggest typos for bare specifiers', async () => {
      const suggestions = await generateSuggestions({
        specifier: 'expres', // Typo for 'express'
        importer: path.join(projectRoot, 'index.js'),
        projectRoot,
        allSourceFiles,
      });

      assert.strictEqual(suggestions.length, 0, 'Should not generate typo suggestions for bare specifiers');
    });

    it('should handle specifiers with multiple path segments correctly', async () => {
      const suggestions = await generateSuggestions({
        specifier: './utils/hlper.js', // Typo is in the filename part
        importer: path.join(projectRoot, 'src', 'app.js'),
        projectRoot,
        allSourceFiles,
      });

      assert.ok(suggestions.includes('./utils/helpers.js'), 'Should correct typo in a multi-segment path');
    });

    it('should return an empty array when no suggestions are found', async () => {
      const suggestions = await generateSuggestions({
        specifier: './non/existent/file.js',
        importer: path.join(projectRoot, 'index.js'),
        projectRoot,
        allSourceFiles,
      });

      // It might suggest `../non/existent/file.js`, but no typo or extension fixes should match.
      const expectedSuggestions = ['../non/existent/file.js'];
      assert.deepStrictEqual(suggestions.sort(), expectedSuggestions.sort(), 'Should only suggest path fixes if no other matches');
    });

    it('should generate unique suggestions', async () => {
      // A scenario that could generate duplicate suggestions without a Set
      const suggestions = await generateSuggestions({
        specifier: './helpers',
        importer: path.join(projectRoot, 'src', 'utils', 'some-file.js'),
        projectRoot,
        allSourceFiles, // `helpers.js` is in this list
      });

      // './helpers.js' could be suggested by both `suggestMissingExtensions` and `suggestTypos`.
      // The final array should only contain it once.
      const count = suggestions.filter(s => s === './helpers.js').length;
      assert.strictEqual(count, 1, 'Suggestions should be unique');
    });

    it('should correctly calculate relative path for suggestions from project root', async () => {
      const suggestions = await generateSuggestions({
        specifier: './src/util/helpers.js', // Typo for 'utils'
        importer: path.join(projectRoot, 'index.js'),
        projectRoot,
        allSourceFiles,
      });

      // The typo is in the directory name, which the current `suggestTypos` doesn't handle.
      // It will compare `helpers.js` to `helpers.js` (distance 0) and suggest the correct path.
      assert.ok(suggestions.includes('./src/utils/helpers.js'), 'Should suggest correct path from root');
    });
  });
});
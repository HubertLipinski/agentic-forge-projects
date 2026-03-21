import { test, describe, before, after, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { getPathFromURL } from '../src/utils/file-system.js';
import { analyzeProject } from '../src/core/analyzer.js';
import { clearResolutionCache } from '../src/core/path-resolver.js';

const __dirname = getPathFromURL(import.meta.url);
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures', 'project-with-errors');

describe('Core Analyzer', () => {
  let projectFiles = [];

  before(async () => {
    // Setup a mock project structure in memory or on disk for tests
    // For this test, we'll use a pre-defined fixture directory.
    const indexJsPath = path.join(FIXTURES_DIR, 'index.js');
    const helpersJsPath = path.join(FIXTURES_DIR, 'utils', 'helpers.js');
    const emptyJsPath = path.join(FIXTURES_DIR, 'empty.js');
    const noImportsPath = path.join(FIXTURES_DIR, 'no-imports.js');
    const badFilePath = path.join(FIXTURES_DIR, 'non-existent-file.js'); // This file won't exist

    projectFiles = [indexJsPath, helpersJsPath, emptyJsPath, noImportsPath];

    // Ensure fixture files exist
    await fs.mkdir(path.join(FIXTURES_DIR, 'utils'), { recursive: true });
    await fs.writeFile(
      indexJsPath,
      `
import path from 'node:path'; // Built-in, should be ignored
import { helper } from './utils/helpers.js'; // Correct import
import { nonExistent } from './utils/nonExistent'; // Missing extension
import { typofunc } from './utils/helprs.js'; // Typo in path
import { another } from '../another/file.js'; // Incorrect relative path
import * as dynamic from './utils/helpers'; // Missing extension (dynamic import style)
export { something } from './non-existent-export'; // Broken export
`
    );
    await fs.writeFile(helpersJsPath, 'export function helper() { return "I am a helper"; }');
    await fs.writeFile(emptyJsPath, '');
    await fs.writeFile(noImportsPath, 'const x = 1; \nexport { x };');
  });

  after(async () => {
    // Clean up the mock project files
    try {
      await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors during cleanup, as they are not critical to test results
      console.error('Failed to clean up fixtures:', error);
    }
    clearResolutionCache();
  });

  // Clear cache before each test to ensure isolation
  before(clearResolutionCache);
  after(clearResolutionCache);

  it('should throw an error if filePaths is not an array', async () => {
    await assert.rejects(
      () => analyzeProject('not-an-array'),
      {
        name: 'Error',
        message: 'Invalid input: "filePaths" must be an array of strings.',
      },
      'Should reject non-array input'
    );
  });

  it('should return an empty array if no files are provided', async () => {
    const results = await analyzeProject([]);
    assert.deepStrictEqual(results, [], 'Should return an empty array for no input files');
  });

  it('should correctly identify broken imports in a file', async () => {
    const results = await analyzeProject(projectFiles);

    assert.strictEqual(results.length, 1, 'Should find issues in exactly one file');

    const problematicFile = results[0];
    assert.ok(problematicFile.filePath.endsWith('index.js'), 'The problematic file should be index.js');
    assert.strictEqual(problematicFile.brokenImports.length, 4, 'Should identify 4 broken imports');

    const brokenSpecifiers = problematicFile.brokenImports.map(b => b.specifier);
    assert.ok(brokenSpecifiers.includes('./utils/nonExistent'), 'Should detect missing .js extension');
    assert.ok(brokenSpecifiers.includes('./utils/helprs.js'), 'Should detect typo in path');
    assert.ok(brokenSpecifiers.includes('../another/file.js'), 'Should detect incorrect relative path');
    assert.ok(brokenSpecifiers.includes('./non-existent-export'), 'Should detect broken export source');
  });

  it('should ignore built-in Node.js modules starting with "node:"', async () => {
    const results = await analyzeProject(projectFiles);
    const problematicFile = results.find(r => r.filePath.endsWith('index.js'));
    const brokenSpecifiers = problematicFile.brokenImports.map(b => b.specifier);

    assert.strictEqual(
      brokenSpecifiers.includes('node:path'),
      false,
      'Should not report "node:path" as a broken import'
    );
  });

  it('should not report files with no imports or only valid imports', async () => {
    const results = await analyzeProject(projectFiles);
    const filePathsWithIssues = results.map(r => r.filePath);

    assert.strictEqual(
      filePathsWithIssues.some(p => p.endsWith('helpers.js')),
      false,
      'helpers.js has no imports and should not be reported'
    );
    assert.strictEqual(
      filePathsWithIssues.some(p => p.endsWith('no-imports.js')),
      false,
      'no-imports.js has no imports and should not be reported'
    );
  });

  it('should handle files that are empty or unparsable', async () => {
    const unparsableFilePath = path.join(FIXTURES_DIR, 'unparsable.js');
    await fs.writeFile(unparsableFilePath, 'import { a from ; // invalid syntax');

    const testFiles = [unparsableFilePath, path.join(FIXTURES_DIR, 'empty.js')];
    const results = await analyzeProject(testFiles);

    const unparsableResult = results.find(r => r.filePath.endsWith('unparsable.js'));
    assert.ok(unparsableResult, 'Should have a result for the unparsable file');
    assert.ok(unparsableResult.error, 'Unparsable file result should have an error property');
    assert.strictEqual(unparsableResult.brokenImports.length, 0, 'Unparsable file should have no broken imports listed');

    const emptyResult = results.find(r => r.filePath.endsWith('empty.js'));
    assert.strictEqual(emptyResult, undefined, 'Empty file should not produce a problematic result');
  });

  it('should produce a file-level error if a file cannot be read', async () => {
    const nonExistentFile = path.join(FIXTURES_DIR, 'this-file-does-not-exist.js');
    const results = await analyzeProject([nonExistentFile]);

    assert.strictEqual(results.length, 1, 'Should return one result for the non-existent file');
    const errorResult = results[0];
    assert.strictEqual(errorResult.filePath, nonExistentFile);
    assert.ok(errorResult.error, 'Result for non-existent file should contain an error message');
    assert.match(errorResult.error, /File not found at path/, 'Error message should indicate file not found');
  });
});
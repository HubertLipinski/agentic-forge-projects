import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Module Mocks ---
// Mock dependencies for the parsers.
// The primary dependency is the file-system utility, which we need to control.
const mockFileSystem = {
  readJsonFile: mock.fn(),
  readFileContent: mock.fn(),
  pathExists: mock.fn(),
};
mock.module('../src/utils/file-system.js', () => mockFileSystem);

// Mock 'jsdoc-to-markdown' as it's an external dependency that we don't want to run.
const mockJsdocToMarkdown = {
  render: mock.fn(),
};
mock.module('jsdoc-to-markdown', () => ({ default: mockJsdocToMarkdown }));

// Mock 'glob' to control file discovery.
const mockGlob = {
  glob: mock.fn(),
};
mock.module('glob', () => mockGlob);


// --- Test Setup ---
// Dynamically import the modules under test *after* setting up the mocks.
const { parsePackageFile } = await import('../src/parsers/package-parser.js');
const { parseJsdoc } = await import('../src/parsers/jsdoc-parser.js');
const { parseLicenseFile } = await import('../src/parsers/license-parser.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_PROJECT_ROOT = path.resolve(__dirname, 'mock-project');

// --- Test Suite ---
describe('Parsers', () => {

  // Reset all mocks before each test to ensure isolation.
  before(async (t) => {
    t.beforeEach(() => {
      mock.reset();
      // Suppress console.warn during tests
      mock.method(console, 'warn', () => {});
    });
  });

  after(() => {
    mock.reset();
  });

  // --- package-parser.js Tests ---
  describe('package-parser', () => {
    it('should parse a complete package.json and detect npm', async () => {
      const mockPackageJson = {
        name: 'test-project',
        description: 'A test project.',
        version: '1.0.0',
        license: 'MIT',
        author: 'Test Author <test@example.com> (https://example.com)',
        repository: { type: 'git', url: 'https://github.com/test/test-project.git' },
        bugs: { url: 'https://github.com/test/test-project/issues' },
        homepage: 'https://github.com/test/test-project#readme',
        scripts: { start: 'node index.js' },
      };
      mockFileSystem.pathExists.mock.mockImplementation(async (p) => {
        return p.endsWith('package.json'); // Only package.json exists
      });
      mockFileSystem.readJsonFile.mock.mockResolvedValueOnce(mockPackageJson);

      const result = await parsePackageFile(MOCK_PROJECT_ROOT);

      assert.deepStrictEqual(result.project, {
        name: 'test-project',
        description: 'A test project.',
        version: '1.0.0',
        license: 'MIT',
        author: { name: 'Test Author', email: 'test@example.com', url: 'https://example.com' },
        repository: { type: 'git', url: 'https://github.com/test/test-project.git' },
        bugs: { url: 'https://github.com/test/test-project/issues' },
        homepage: 'https://github.com/test/test-project#readme',
        scripts: { start: 'node index.js' },
      });
      assert.strictEqual(result.packageManager, 'npm');
      assert.strictEqual(mockFileSystem.readJsonFile.mock.calls[0].arguments[0], path.join(MOCK_PROJECT_ROOT, 'package.json'));
    });

    it('should handle a minimal package.json and detect yarn', async () => {
      const mockPackageJson = { name: 'minimal-project' };
      mockFileSystem.pathExists.mock.mockImplementation(async (p) => {
        return p.endsWith('package.json') || p.endsWith('yarn.lock');
      });
      mockFileSystem.readJsonFile.mock.mockResolvedValueOnce(mockPackageJson);

      const result = await parsePackageFile(MOCK_PROJECT_ROOT);

      assert.deepStrictEqual(result.project, {
        name: 'minimal-project',
        description: undefined,
        version: undefined,
        license: undefined,
        author: null,
        repository: undefined,
        bugs: undefined,
        homepage: undefined,
        scripts: undefined,
      });
      assert.strictEqual(result.packageManager, 'yarn');
    });

    it('should detect pnpm with pnpm-lock.yaml', async () => {
        const mockPackageJson = { name: 'pnpm-project' };
        mockFileSystem.pathExists.mock.mockImplementation(async (p) => {
            return p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml');
        });
        mockFileSystem.readJsonFile.mock.mockResolvedValueOnce(mockPackageJson);

        const { packageManager } = await parsePackageFile(MOCK_PROJECT_ROOT);
        assert.strictEqual(packageManager, 'pnpm');
    });

    it('should throw an error if package.json is not found', async () => {
      mockFileSystem.pathExists.mock.mockResolvedValue(false);
      await assert.rejects(
        () => parsePackageFile(MOCK_PROJECT_ROOT),
        new Error(`'package.json' not found in the project root: ${MOCK_PROJECT_ROOT}`)
      );
    });

    it('should throw an error if package.json is missing the "name" field', async () => {
      mockFileSystem.pathExists.mock.mockResolvedValue(true);
      mockFileSystem.readJsonFile.mock.mockResolvedValueOnce({ description: 'No name here' });
      await assert.rejects(
        () => parsePackageFile(MOCK_PROJECT_ROOT),
        new Error(`'name' field is missing in ${path.join(MOCK_PROJECT_ROOT, 'package.json')}. This is a required field.`)
      );
    });

    it('should correctly parse an author object', async () => {
        const mockPackageJson = { name: 'author-test', author: { name: 'Object Author', email: 'obj@example.com' } };
        mockFileSystem.pathExists.mock.mockResolvedValue(true);
        mockFileSystem.readJsonFile.mock.mockResolvedValueOnce(mockPackageJson);

        const { project } = await parsePackageFile(MOCK_PROJECT_ROOT);
        assert.deepStrictEqual(project.author, { name: 'Object Author', email: 'obj@example.com', url: undefined });
    });
  });

  // --- jsdoc-parser.js Tests ---
  describe('jsdoc-parser', () => {
    it('should return null if no entry files are provided', async () => {
      const result = await parseJsdoc([]);
      assert.strictEqual(result, null);
      assert.strictEqual(mockGlob.glob.mock.callCount(), 0);
    });

    it('should return null if glob finds no files', async () => {
      mockGlob.glob.mock.mockResolvedValueOnce([]);
      const result = await parseJsdoc(['src/nonexistent/*.js']);
      assert.strictEqual(result, null);
    });

    it('should call jsdoc-to-markdown with files found by glob', async () => {
      const files = ['src/index.js', 'src/utils.js'];
      const expectedMarkdown = '## API Docs';
      mockGlob.glob.mock.mockResolvedValueOnce(files);
      // Mock pathExists to confirm files exist
      mockFileSystem.pathExists.mock.mockResolvedValue(true);
      mockJsdocToMarkdown.render.mock.mockResolvedValueOnce(expectedMarkdown);

      const result = await parseJsdoc(['src/**/*.js']);

      assert.strictEqual(result, expectedMarkdown);
      assert.strictEqual(mockJsdocToMarkdown.render.mock.callCount(), 1);
      assert.deepStrictEqual(mockJsdocToMarkdown.render.mock.calls[0].arguments[0].files, files);
    });

    it('should return null if jsdoc-to-markdown renders empty string', async () => {
        mockGlob.glob.mock.mockResolvedValueOnce(['src/index.js']);
        mockFileSystem.pathExists.mock.mockResolvedValue(true);
        mockJsdocToMarkdown.render.mock.mockResolvedValueOnce('   \n   '); // Empty or whitespace only

        const result = await parseJsdoc(['src/index.js']);
        assert.strictEqual(result, null);
    });

    it('should throw a JSDocParserError if jsdoc.render fails', async () => {
        const renderError = new Error('JSDoc syntax error');
        mockGlob.glob.mock.mockResolvedValueOnce(['src/index.js']);
        mockFileSystem.pathExists.mock.mockResolvedValue(true);
        mockJsdocToMarkdown.render.mock.mockRejectedValueOnce(renderError);

        await assert.rejects(
            () => parseJsdoc(['src/index.js']),
            (err) => {
                assert.strictEqual(err.name, 'JSDocParserError');
                assert.strictEqual(err.message, 'Failed to generate API documentation from JSDoc comments.');
                assert.strictEqual(err.cause, renderError);
                return true;
            }
        );
    });
  });

  // --- license-parser.js Tests ---
  describe('license-parser', () => {
    it('should find and read a LICENSE file', async () => {
      const licenseContent = 'MIT License...';
      const licensePath = path.join(MOCK_PROJECT_ROOT, 'LICENSE');
      mockFileSystem.pathExists.mock.mockResolvedValueOnce(true);
      mockFileSystem.readFileContent.mock.mockResolvedValueOnce(licenseContent);

      const result = await parseLicenseFile(MOCK_PROJECT_ROOT);

      assert.deepStrictEqual(result, {
        content: licenseContent,
        path: 'LICENSE',
      });
      assert.strictEqual(mockFileSystem.pathExists.mock.calls[0].arguments[0], licensePath);
      assert.strictEqual(mockFileSystem.readFileContent.mock.calls[0].arguments[0], licensePath);
    });

    it('should find and read a LICENSE.md file if LICENSE is not present', async () => {
      const licenseContent = 'Apache License 2.0...';
      const licenseMdPath = path.join(MOCK_PROJECT_ROOT, 'LICENSE.md');
      mockFileSystem.pathExists.mock.mockImplementation(async (p) => p.endsWith('LICENSE.md'));
      mockFileSystem.readFileContent.mock.mockResolvedValueOnce(licenseContent);

      const result = await parseLicenseFile(MOCK_PROJECT_ROOT);

      assert.deepStrictEqual(result, {
        content: licenseContent,
        path: 'LICENSE.md',
      });
      // It should have checked for 'LICENSE' first
      assert.strictEqual(mockFileSystem.pathExists.mock.calls[0].arguments[0], path.join(MOCK_PROJECT_ROOT, 'LICENSE'));
      assert.strictEqual(mockFileSystem.pathExists.mock.calls[1].arguments[0], licenseMdPath);
    });

    it('should return null if no license file is found', async () => {
      mockFileSystem.pathExists.mock.mockResolvedValue(false);
      const result = await parseLicenseFile(MOCK_PROJECT_ROOT);
      assert.strictEqual(result, null);
      // Should check all potential filenames
      assert.strictEqual(mockFileSystem.pathExists.mock.callCount(), 7);
    });

    it('should re-throw a FileSystemError if reading the file fails', async () => {
      const readError = new Error('Permission denied');
      readError.name = 'FileSystemError';

      mockFileSystem.pathExists.mock.mockResolvedValueOnce(true);
      mockFileSystem.readFileContent.mock.mockRejectedValueOnce(readError);

      await assert.rejects(
        () => parseLicenseFile(MOCK_PROJECT_ROOT),
        (err) => {
          assert.strictEqual(err.name, 'FileSystemError');
          assert.strictEqual(err, readError);
          return true;
        }
      );
    });
  });
});
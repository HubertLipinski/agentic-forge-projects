import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Module Mocks ---
// We need to mock all modules that interact with the file system or external processes.
// This ensures our tests are fast, deterministic, and isolated from the actual file system.

// Mock the file-system utility module
const mockFileSystem = {
  readFileContent: mock.fn(),
  writeFileContent: mock.fn(),
  resolveTemplatePath: mock.fn(),
  pathExists: mock.fn(),
};
mock.module('../src/utils/file-system.js', () => mockFileSystem);

// Mock the package parser module
const mockPackageParser = {
  parsePackageFile: mock.fn(),
};
mock.module('../src/parsers/package-parser.js', () => mockPackageParser);

// Mock the JSDoc parser module
const mockJsdocParser = {
  parseJsdoc: mock.fn(),
};
mock.module('../src/parsers/jsdoc-parser.js', () => mockJsdocParser);

// Mock the license parser module
const mockLicenseParser = {
  parseLicenseFile: mock.fn(),
};
mock.module('../src/parsers/license-parser.js', () => mockLicenseParser);

// --- Test Setup ---
// Dynamically import the module under test *after* setting up the mocks.
const { generateReadme } = await import('../src/engine.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_PROJECT_ROOT = path.resolve(__dirname, 'mock-project');

// --- Test Suite ---
describe('Engine: generateReadme', () => {
  before(() => {
    // Suppress console.log during tests to keep output clean
    mock.method(console, 'log', () => {});
  });

  after(() => {
    // Restore mocks and console.log after all tests have run
    mock.reset();
  });

  // Reset mocks before each test to ensure test isolation
  before(async (t) => {
    t.beforeEach(() => {
      mockFileSystem.readFileContent.mock.resetCalls();
      mockFileSystem.writeFileContent.mock.resetCalls();
      mockFileSystem.resolveTemplatePath.mock.resetCalls();
      mockFileSystem.pathExists.mock.resetCalls();
      mockPackageParser.parsePackageFile.mock.resetCalls();
      mockJsdocParser.parseJsdoc.mock.resetCalls();
      mockLicenseParser.parseLicenseFile.mock.resetCalls();
    });
  });


  it('should generate a full README with all data sources present', async () => {
    // --- Arrange ---
    const options = {
      projectRoot: MOCK_PROJECT_ROOT,
      entry: ['src/**/*.js'],
      template: 'default',
      output: 'README.md',
    };

    // Mock file system and parser responses for a "perfect" scenario
    mockFileSystem.resolveTemplatePath.mock.mockResolvedValueOnce('/path/to/templates/default.md');
    mockFileSystem.readFileContent.mock.mockResolvedValueOnce(
      '# {{project.name}}\n{{{api}}}\nLicense: {{project.license}}\nScripts: {{#project.scripts}}{{key}},{{/project.scripts}}\n{{#contributing}}Contributing section exists{{/contributing}}'
    );
    mockPackageParser.parsePackageFile.mock.mockResolvedValueOnce({
      project: { name: 'my-cool-project', license: 'MIT', scripts: { start: 'node index.js', test: 'node --test' } },
      packageManager: 'npm',
    });
    mockJsdocParser.parseJsdoc.mock.mockResolvedValueOnce('## API Docs\nThis is the API.');
    mockLicenseParser.parseLicenseFile.mock.mockResolvedValueOnce({ content: 'MIT License...', path: 'LICENSE' });
    mockFileSystem.pathExists.mock.mockResolvedValueOnce(true); // For CONTRIBUTING.md

    // --- Act ---
    await generateReadme(options);

    // --- Assert ---
    // 1. Verify that writeFileContent was called exactly once
    assert.strictEqual(mockFileSystem.writeFileContent.mock.callCount(), 1, 'writeFileContent should be called once.');

    // 2. Get the arguments passed to writeFileContent
    const [outputPath, outputContent] = mockFileSystem.writeFileContent.mock.calls[0].arguments;

    // 3. Assert the output path is correct
    assert.strictEqual(outputPath, path.resolve(MOCK_PROJECT_ROOT, 'README.md'), 'Output path should be correct.');

    // 4. Assert the rendered content is correct
    const expectedContent = '# my-cool-project\n## API Docs\nThis is the API.\nLicense: MIT\nScripts: start,test,\nContributing section exists';
    assert.strictEqual(outputContent, expectedContent, 'Rendered content should match expected output.');

    // 5. Verify parsers were called with correct arguments
    assert.strictEqual(mockPackageParser.parsePackageFile.mock.calls[0].arguments[0], MOCK_PROJECT_ROOT);
    assert.deepStrictEqual(mockJsdocParser.parseJsdoc.mock.calls[0].arguments[0], options.entry);
    assert.strictEqual(mockLicenseParser.parseLicenseFile.mock.calls[0].arguments[0], MOCK_PROJECT_ROOT);
  });

  it('should handle missing optional data gracefully (no JSDoc, no license, no contributing)', async () => {
    // --- Arrange ---
    const options = {
      projectRoot: MOCK_PROJECT_ROOT,
      entry: [], // No entry files
      template: 'default',
      output: 'README.md',
    };

    mockFileSystem.resolveTemplatePath.mock.mockResolvedValueOnce('/path/to/templates/default.md');
    mockFileSystem.readFileContent.mock.mockResolvedValueOnce(
      'Name: {{project.name}}\nAPI: {{#api}}API_EXISTS{{/api}}\nLicense: {{#license}}LICENSE_EXISTS{{/license}}\nContributing: {{#contributing}}CONTRIB_EXISTS{{/contributing}}'
    );
    mockPackageParser.parsePackageFile.mock.mockResolvedValueOnce({
      project: { name: 'minimal-project', scripts: null },
      packageManager: 'pnpm',
    });
    // Simulate parsers returning null for missing data
    mockJsdocParser.parseJsdoc.mock.mockResolvedValueOnce(null);
    mockLicenseParser.parseLicenseFile.mock.mockResolvedValueOnce(null);
    mockFileSystem.pathExists.mock.mockResolvedValueOnce(false); // No CONTRIBUTING.md

    // --- Act ---
    await generateReadme(options);

    // --- Assert ---
    assert.strictEqual(mockFileSystem.writeFileContent.mock.callCount(), 1);
    const [, outputContent] = mockFileSystem.writeFileContent.mock.calls[0].arguments;

    const expectedContent = 'Name: minimal-project\nAPI: \nLicense: \nContributing: ';
    assert.strictEqual(outputContent, expectedContent, 'Rendered content should not include optional sections.');

    assert.strictEqual(mockJsdocParser.parseJsdoc.mock.calls[0].arguments[0].length, 0, 'jsdoc-parser should be called with an empty array.');
  });

  it('should throw an EngineError if a parser fails', async () => {
    // --- Arrange ---
    const parserError = new Error('Failed to parse package.json');
    mockPackageParser.parsePackageFile.mock.mockRejectedValueOnce(parserError); // Simulate failure

    mockFileSystem.resolveTemplatePath.mock.mockResolvedValueOnce('/path/to/template.md');
    mockFileSystem.readFileContent.mock.mockResolvedValueOnce('Template content');

    // --- Act & Assert ---
    await assert.rejects(
      async () => {
        await generateReadme({ projectRoot: MOCK_PROJECT_ROOT });
      },
      (err) => {
        assert.strictEqual(err.name, 'EngineError', 'The error should be an EngineError.');
        assert.strictEqual(err.message, 'Failed to gather project data.', 'The error message should be specific to data gathering.');
        assert.strictEqual(err.cause, parserError, 'The original parser error should be the cause.');
        return true;
      }
    );
  });

  it('should throw an error if template reading fails', async () => {
    // --- Arrange ---
    const fileError = new Error('File not found');
    mockFileSystem.resolveTemplatePath.mock.mockResolvedValueOnce('/path/to/nonexistent-template.md');
    mockFileSystem.readFileContent.mock.mockRejectedValueOnce(fileError); // Simulate failure

    // --- Act & Assert ---
    await assert.rejects(
      async () => {
        await generateReadme({ projectRoot: MOCK_PROJECT_ROOT });
      },
      fileError, // The engine should propagate the original file system error.
      'Should reject with the error from readFileContent'
    );
  });

  it('should use default options when none are provided', async () => {
    // --- Arrange ---
    // Setup mocks for a minimal successful run
    mockFileSystem.resolveTemplatePath.mock.mockResolvedValueOnce('/path/to/default.md');
    mockFileSystem.readFileContent.mock.mockResolvedValueOnce('{{project.name}}');
    mockPackageParser.parsePackageFile.mock.mockResolvedValueOnce({ project: { name: 'default-project' } });
    mockJsdocParser.parseJsdoc.mock.mockResolvedValueOnce(null);
    mockLicenseParser.parseLicenseFile.mock.mockResolvedValueOnce(null);
    mockFileSystem.pathExists.mock.mockResolvedValueOnce(false);

    // --- Act ---
    await generateReadme(); // Call with no options

    // --- Assert ---
    // Verify that default values were used
    const resolveTemplatePathArgs = mockFileSystem.resolveTemplatePath.mock.calls[0].arguments;
    assert.strictEqual(resolveTemplatePathArgs[0], 'default', 'Should use "default" template by default.');

    const parseJsdocArgs = mockJsdocParser.parseJsdoc.mock.calls[0].arguments;
    assert.deepStrictEqual(parseJsdocArgs[0], [], 'Should use empty array for entry by default.');

    const writeFileContentArgs = mockFileSystem.writeFileContent.mock.calls[0].arguments;
    const expectedOutputPath = path.resolve(process.cwd(), 'README.md');
    assert.strictEqual(writeFileContentArgs[0], expectedOutputPath, 'Should use "README.md" in cwd by default.');

    const parsePackageFileArgs = mockPackageParser.parsePackageFile.mock.calls[0].arguments;
    assert.strictEqual(parsePackageFileArgs[0], process.cwd(), 'Should use cwd for projectRoot by default.');
  });

  it('should correctly transform the scripts object into an array of key-value pairs', async () => {
    // --- Arrange ---
    mockFileSystem.resolveTemplatePath.mock.mockResolvedValueOnce('/path/to/template.md');
    mockFileSystem.readFileContent.mock.mockResolvedValueOnce(
      '{{#project.scripts}}[{{key}}:{{value}}]{{/project.scripts}}'
    );
    mockPackageParser.parsePackageFile.mock.mockResolvedValueOnce({
      project: {
        name: 'script-test',
        scripts: {
          start: 'node server.js',
          test: 'jest',
          build: 'tsc'
        }
      },
      packageManager: 'yarn'
    });
    mockJsdocParser.parseJsdoc.mock.mockResolvedValueOnce(null);
    mockLicenseParser.parseLicenseFile.mock.mockResolvedValueOnce(null);
    mockFileSystem.pathExists.mock.mockResolvedValueOnce(false);

    // --- Act ---
    await generateReadme({ projectRoot: MOCK_PROJECT_ROOT });

    // --- Assert ---
    const [, outputContent] = mockFileSystem.writeFileContent.mock.calls[0].arguments;
    const expected = '[start:node server.js][test:jest][build:tsc]';
    assert.strictEqual(outputContent, expected, 'Scripts should be correctly formatted for Mustache iteration.');
  });
});
/**
 * @file test/markdown-parser.test.js
 * @description Unit tests for the markdown-parser module.
 * This file uses Node.js's built-in test runner.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { extractLinks } from '../src/parser/markdown-parser.js';

describe('Markdown Parser - extractLinks()', () => {
  const MOCK_FILE_PATH = '/path/to/mock/file.md';

  it('should return an empty array for content with no links', () => {
    const content = 'This is some text without any links.';
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.deepStrictEqual(links, [], 'Should be an empty array for no links');
  });

  it('should extract a single standard Markdown link', () => {
    const content = 'Check out [Google](https://www.google.com).';
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 1, 'Should find exactly one link');
    assert.deepStrictEqual(links[0], {
      url: 'https://www.google.com',
      text: 'Google',
      file: MOCK_FILE_PATH,
      line: 1,
    });
  });

  it('should extract multiple standard links, including on the same line', () => {
    const content = `
      First link is [here](https://example.com/page1).
      Here are [two](https://www.google.com) links on the [same line](https://www.bing.com).
    `;
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 3, 'Should find three links');
    assert.deepStrictEqual(links, [
      { url: 'https://example.com/page1', text: 'here', file: MOCK_FILE_PATH, line: 2 },
      { url: 'https://www.google.com', text: 'two', file: MOCK_FILE_PATH, line: 3 },
      { url: 'https://www.bing.com', text: 'same line', file: MOCK_FILE_PATH, line: 3 },
    ]);
  });

  it('should extract relative local links', () => {
    const content = `
      [Link to another file](./another-file.md)
      [Link to a file in a subdirectory](./assets/image.png)
      [Link to a file in the parent directory](../docs/guide.md)
      [Link without leading dot-slash](another-file.md)
    `;
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 4, 'Should find four local links');
    assert.deepStrictEqual(links.map(link => link.url), [
      './another-file.md',
      './assets/image.png',
      '../docs/guide.md',
      'another-file.md',
    ]);
  });

  it('should extract reference-style links', () => {
    const content = `
      This is a reference-style link to [Node.js][node-ref].
      And another one for [a local file][local-ref].

      [node-ref]: https://nodejs.org/api/
      [local-ref]: ./another-file.md
    `;
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 2, 'Should find two reference-style links');
    assert.deepStrictEqual(links, [
      { url: 'https://nodejs.org/api/', text: 'Node.js', file: MOCK_FILE_PATH, line: 2 },
      { url: './another-file.md', text: 'a local file', file: MOCK_FILE_PATH, line: 3 },
    ]);
  });

  it('should correctly handle links with titles and trim them from the URL', () => {
    const content = '[A link with a title](https://www.mozilla.org "Mozilla Homepage")';
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 1, 'Should find one link');
    assert.deepStrictEqual(links[0], {
      url: 'https://www.mozilla.org',
      text: 'A link with a title',
      file: MOCK_FILE_PATH,
      line: 1,
    });
  });

  it('should handle links with extra whitespace and trim it', () => {
    const content = '[A link with extra spaces](  https://www.google.com  )';
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 1, 'Should find one link');
    assert.deepStrictEqual(links[0], {
      url: 'https://www.google.com',
      text: 'A link with extra spaces',
      file: MOCK_FILE_PATH,
      line: 1,
    });
  });

  it('should ignore anchor/fragment links (links starting with #)', () => {
    const content = 'This is an [internal anchor link](#section-1).';
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 0, 'Should ignore anchor links');
  });

  it('should ignore mailto and tel links', () => {
    const content = `
      Contact us at [email](mailto:test@example.com).
      Call us at [phone](tel:+1-555-555-5555).
    `;
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 0, 'Should ignore mailto and tel links');
  });

  it('should ignore links inside inline code blocks', () => {
    const content = 'This is not a link: `[fake link](https://example.com)`.';
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 0, 'Should ignore links in inline code');
  });

  it('should ignore links inside fenced code blocks', () => {
    const content = `
      \`\`\`markdown
      [This is also not a real link](https://example.com/inside-code-block)
      \`\`\`
    `;
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 0, 'Should ignore links in fenced code blocks');
  });

  it('should correctly calculate line numbers for multiple links', () => {
    const content = `
      # Title

      First link on line 3: [Link 1](url1)

      Second link on line 5: [Link 2](url2)
      Third link on line 6: [Link 3](url3)
    `;
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 3, 'Should find three links');
    assert.strictEqual(links[0].line, 4, 'First link should be on line 4');
    assert.strictEqual(links[1].line, 6, 'Second link should be on line 6');
    assert.strictEqual(links[2].line, 7, 'Third link should be on line 7');
  });

  it('should handle links with special characters in the URL', () => {
    const url = 'https://example.com/path(with)parentheses?q=a,b,c';
    const content = `[Special chars link](${url})`;
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 1, 'Should find one link');
    assert.strictEqual(links[0].url, url, 'URL with special characters should be preserved');
  });

  it('should not parse malformed links like []()', () => {
    const content = 'A malformed link []() here.';
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 0, 'Should not extract link from []()');
  });

  it('should not parse malformed links like [text]()', () => {
    const content = 'A malformed link [with text]() here.';
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 0, 'Should not extract link from [text]()');
  });

  it('should handle a complex mix of valid and invalid link formats', () => {
    const content = `
      This is a [valid link](https://example.com).
      This is a [valid relative link](./file.md).
      This is a [reference][ref].
      Ignore this: \`[code link](no.com)\`.
      Ignore this anchor: [anchor](#header).
      This is a [link with a title](https://example.com/page "Page Title").

      [ref]: https://reference.com/path
    `;
    const links = extractLinks(content, MOCK_FILE_PATH);
    assert.strictEqual(links.length, 4, 'Should find exactly four valid links');
    assert.deepStrictEqual(links.map(link => link.url), [
      'https://example.com',
      './file.md',
      'https://example.com/page',
      'https://reference.com/path',
    ]);
  });
});
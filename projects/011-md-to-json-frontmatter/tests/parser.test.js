/**
 * @file tests/parser.test.js
 * @description Unit tests for the Markdown parser module.
 *
 * This test suite uses the built-in Node.js test runner to verify the functionality
 * of the `parseMarkdown` function from `src/parser.js`. It covers various scenarios,
 * including valid front-matter, missing front-matter, different content structures,
 * and error conditions like malformed YAML.
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { parseMarkdown } from '../src/parser.js';

describe('parseMarkdown()', () => {
  it('should correctly parse a markdown string with valid YAML front-matter', () => {
    const content = `---
title: "Hello, World!"
author: "John Doe"
date: 2023-10-27
tags:
  - tech
  - blog
---

# My First Post

This is the body of the markdown file.
It contains multiple lines.`;

    const result = parseMarkdown(content);

    assert.deepStrictEqual(result.attributes, {
      title: 'Hello, World!',
      author: 'John Doe',
      date: new Date('2023-10-27T00:00:00.000Z'), // YAML spec auto-parses dates
      tags: ['tech', 'blog'],
    });

    assert.strictEqual(result.body, '# My First Post\n\nThis is the body of the markdown file.\nIt contains multiple lines.');
  });

  it('should handle files with no front-matter, returning empty attributes and full content as body', () => {
    const content = `# Just a Markdown File

This file has no front-matter block.
All of this should be considered the body.`;

    const result = parseMarkdown(content);

    assert.deepStrictEqual(result.attributes, {});
    assert.strictEqual(result.body, content);
  });

  it('should handle files with empty front-matter, returning empty attributes', () => {
    const content = `---
---

# Content Starts Here

The front-matter block was empty.`;

    const result = parseMarkdown(content);

    assert.deepStrictEqual(result.attributes, {});
    assert.strictEqual(result.body, '# Content Starts Here\n\nThe front-matter block was empty.');
  });

  it('should handle files with only front-matter and no body', () => {
    const content = `---
title: "A Title"
description: "A file with no body content."
---`;

    const result = parseMarkdown(content);

    assert.deepStrictEqual(result.attributes, {
      title: 'A Title',
      description: 'A file with no body content.',
    });
    assert.strictEqual(result.body, '');
  });

  it('should handle files with no content at all (empty string)', () => {
    const content = '';
    const result = parseMarkdown(content);

    assert.deepStrictEqual(result.attributes, {});
    assert.strictEqual(result.body, '');
  });

  it('should throw a YAMLParseError for malformed front-matter', () => {
    const content = `---
title: "My Post"
author: John Doe: Unquoted string with colon
---

# Content`;

    assert.throws(
      () => parseMarkdown(content),
      (err) => {
        assert.strictEqual(err.name, 'YAMLParseError');
        assert.ok(err.message.includes('Failed to parse YAML front-matter'));
        assert.ok(err.cause.name, 'YAMLException');
        return true;
      },
      'Expected function to throw a YAMLParseError for invalid YAML syntax.'
    );
  });

  it('should not parse a --- block that is not at the beginning of the file', () => {
    const content = `Some text before the block.

---
title: "Not Front-Matter"
---

This should all be treated as body content.`;

    const result = parseMarkdown(content);

    assert.deepStrictEqual(result.attributes, {});
    assert.strictEqual(result.body, content);
  });

  it('should correctly handle different newline characters (CRLF)', () => {
    const content = '---\r\ntitle: CRLF Test\r\n---\r\n\r\n# Body with CRLF';
    const result = parseMarkdown(content);

    assert.deepStrictEqual(result.attributes, { title: 'CRLF Test' });
    assert.strictEqual(result.body, '# Body with CRLF');
  });

  it('should handle front-matter with complex nested objects and arrays', () => {
    const content = `---
title: Complex Data
author:
  name: Jane Smith
  email: jane@example.com
metadata:
  - key: version
    value: 1.2
  - key: status
    value: draft
---

Body content.`;

    const result = parseMarkdown(content);

    assert.deepStrictEqual(result.attributes, {
      title: 'Complex Data',
      author: {
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
      metadata: [
        { key: 'version', value: 1.2 },
        { key: 'status', value: 'draft' },
      ],
    });
    assert.strictEqual(result.body, 'Body content.');
  });

  it('should return a default empty state for non-string input like null or undefined', () => {
    const nullResult = parseMarkdown(null);
    assert.deepStrictEqual(nullResult, { attributes: {}, body: '' });

    const undefinedResult = parseMarkdown(undefined);
    assert.deepStrictEqual(undefinedResult, { attributes: {}, body: '' });
  });

  it('should return a default empty state for non-string input like a number or object', () => {
    const numberResult = parseMarkdown(123);
    assert.deepStrictEqual(numberResult, { attributes: {}, body: '' });

    const objectResult = parseMarkdown({ data: 'test' });
    assert.deepStrictEqual(objectResult, { attributes: {}, body: '' });
  });

  it('should correctly trim leading whitespace from the body content', () => {
    const content = `---
title: Whitespace Test
---


  # The body starts here

Note the newlines and spaces before the heading.`;

    const result = parseMarkdown(content);

    assert.deepStrictEqual(result.attributes, { title: 'Whitespace Test' });
    assert.strictEqual(result.body, '# The body starts here\n\nNote the newlines and spaces before the heading.');
  });
});
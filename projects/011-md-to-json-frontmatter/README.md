# md-front-matter-json

[![NPM Version](https://img.shields.io/npm/v/md-front-matter-json.svg)](https://www.npmjs.com/package/md-front-matter-json)
[![License](https://img.shields.io/npm/l/md-front-matter-json.svg)](https://github.com/your-username/md-front-matter-json/blob/main/LICENSE)
[![Node.js CI](https://img.shields.io/github/actions/workflow/status/your-username/md-front-matter-json/node.js.yml?branch=main)](https://github.com/your-username/md-front-matter-json/actions)

A lightweight, zero-dependency CLI tool and library for converting Markdown files with YAML front-matter into structured JSON. It's designed for developers building static site generators, content management systems, or any script that needs to process Markdown content programmatically.

## Features

-   **YAML Front-Matter Parsing**: Automatically detects and parses YAML front-matter blocks.
-   **Structured JSON Output**: Creates a clean JSON object with `attributes` (from front-matter) and `body` (from Markdown content).
-   **Flexible CLI**: Convert a single file, an entire directory, or use glob patterns for complex selections.
-   **Programmable API**: Simple and powerful API for use as a library in any Node.js project.
-   **Graceful Handling**: Works correctly with files that have no front-matter.
-   **Zero Dependencies**: A lean and fast core with no external dependencies for the parsing logic.

## Installation

You can use this package as a command-line tool or as a library in your project.

**For global CLI usage:**

```bash
npm install -g md-front-matter-json
```

**For local project usage (CLI or library):**

```bash
npm install md-front-matter-json
```

## Usage

### Command-Line Interface (CLI)

The CLI is the quickest way to convert your Markdown files. The basic command structure is `md-to-json <input> [options]`.

**1. Convert a single file and print to console:**

```bash
md-to-json content/posts/my-first-post.md
```

**2. Convert a single file and save to an output file:**

```bash
md-to-json content/posts/my-first-post.md -o dist/my-first-post.json
```

**3. Convert an entire directory recursively:**

This will find all `.md` and `.markdown` files inside the `content/` directory and output a JSON array.

```bash
md-to-json content/ -o dist/all-content.json
```

**4. Use a glob pattern for advanced selection:**

```bash
md-to-json "content/posts/**/*.md" -o dist/posts.json
```

**5. Pretty-print the JSON output:**

Use the `--pretty` or `-p` flag for readable, indented JSON.

```bash
md-to-json content/posts/my-first-post.md --pretty
```

### Programmatic API (Library)

You can also use this package as a module in your Node.js applications.

```javascript
import { convertFile, convertDirectory } from 'md-front-matter-json';
// Or: const { convertFile, convertDirectory } = require('md-front-matter-json');

// Convert a single file
async function getPost(filePath) {
  try {
    const data = await convertFile(filePath);
    console.log(data);
    return data;
  } catch (error) {
    console.error('Error converting file:', error);
  }
}

// Convert all markdown files in a directory
async function getAllPosts(dirPath) {
  try {
    const posts = await convertDirectory(dirPath);
    console.log(`Found ${posts.length} posts.`);
    return posts;
  } catch (error) {
    console.error('Error converting directory:', error);
  }
}

getPost('path/to/post.md');
getAllPosts('path/to/posts/directory');
```

## Examples

### Example 1: Basic File Conversion

Given a file `post.md`:

```markdown
---
title: "Hello World"
author: "Jane Doe"
date: 2023-10-27
tags:
  - welcome
  - first-post
---

# My First Blog Post

This is the beginning of a beautiful blog.
```

**Command:**

```bash
md-to-json post.md --pretty
```

**Output:**

```json
{
  "filePath": "post.md",
  "fileName": "post.md",
  "attributes": {
    "title": "Hello World",
    "author": "Jane Doe",
    "date": "2023-10-27T00:00:00.000Z",
    "tags": [
      "welcome",
      "first-post"
    ]
  },
  "body": "# My First Blog Post\n\nThis is the beginning of a beautiful blog."
}
```

### Example 2: Directory Conversion

Given a directory `articles/` containing `post-1.md` and `post-2.md`.

**Command:**

```bash
md-to-json articles/ -o build/data.json
```

The output file `build/data.json` will contain a JSON array:

```json
[
  {
    "filePath": "articles/post-1.md",
    "fileName": "post-1.md",
    "attributes": { "title": "First Post" },
    "body": "Content of the first post."
  },
  {
    "filePath": "articles/post-2.md",
    "fileName": "post-2.md",
    "attributes": { "title": "Second Post" },
    "body": "Content of the second post."
  }
]
```

### Example 3: File with No Front-Matter

Given a file `about.md`:

```markdown
# About This Project

This is a simple page with no front-matter.
```

**Command:**

```bash
md-to-json about.md --pretty
```

**Output:**

The `attributes` object will be empty.

```json
{
  "filePath": "about.md",
  "fileName": "about.md",
  "attributes": {},
  "body": "# About This Project\n\nThis is a simple page with no front-matter."
}
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
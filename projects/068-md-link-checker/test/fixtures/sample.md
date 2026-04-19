# Markdown Link Checker Test Fixture

This file contains a variety of links to test the functionality of the `markdown-link-checker` tool.

## Section 1: Valid Links

### Valid Remote Links (HTTP/HTTPS)
- [A valid link to Google](https://www.google.com)
- [A link to the Node.js website](https://nodejs.org)
- [A link with a specific path](https://github.com/nodejs/node)
- [A link with query parameters](https://www.google.com/search?q=markdown)
- [A link with a hash/fragment](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD#description)

### Valid Local/Relative Links
This test assumes a file structure like:
- `test/`
  - `fixtures/`
    - `sample.md` (this file)
    - `another-file.md`
    - `assets/`
      - `image.png`
  - `markdown-parser.test.js`

- [Link to another file in the same directory](./another-file.md)
- [Link to a file in a subdirectory](./assets/image.png)
- [Link to a file in the parent directory](../markdown-parser.test.js)
- [Another valid local file without the leading dot-slash](another-file.md)

## Section 2: Intentionally Broken Links

### Broken Remote Links
- [A non-existent domain](https://thissitedoesnotexist.invalid)
- [A page that returns a 404 error](https://github.com/your-username/this-repo-does-not-exist/blob/main/README.md)
- [A link to a server that should not be running](http://localhost:9999/non-existent-page)
- [A link that will time out (hypothetical)](https://httpstat.us/200?sleep=20000)

### Broken Local/Relative Links
- [A link to a file that does not exist](./non-existent-file.md)
- [A link to a file in a non-existent directory](./non-existent-dir/some-file.md)
- [A link pointing way too far up the directory tree](../../../../../../etc/passwd)

## Section 3: Edge Cases and Special Formats

### Links to be Ignored
These links should be skipped if the correct ignore patterns are configured.
- [A link to a local server that should be ignored](http://localhost:3000/dashboard)
- [A link to an issue creation page, often ignored in project docs](https://github.com/your-username/markdown-link-checker/issues/new)

### Malformed or Unusual Links
- [A link with extra spaces](  https://www.google.com  )
- [A link with a title attribute](https://www.mozilla.org "Mozilla Homepage")
- This is a reference-style link to [Node.js][node-ref].
- This is another reference link to [a local file][local-ref].

[node-ref]: https://nodejs.org/api/
[local-ref]: ./another-file.md

### Links that should NOT be parsed
- [A link to a section on the same page](#section-1-valid-links) should be ignored.
- An email link like mailto:test@example.com should not be checked.
- A telephone link like tel:+1-555-555-5555 should not be checked.
- A link inside a code block should be ignored: `[this is not a link](https://example.com)`

```markdown
[This is also not a real link](https://example.com/inside-code-block)
```

### Multiple links on one line
Here are [two](https://www.google.com) links on the [same line](https://www.bing.com).
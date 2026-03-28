# Static Archive Scraper

A command-line tool that scrapes a static website and saves all of its content (HTML, CSS, JS, images, fonts) locally, rewriting links for offline viewing. It's designed for archiving personal blogs, documentation, or simple websites.

## Description

This tool recursively crawls a target website starting from a given URL, downloads all static assets, and saves them to a local directory while preserving the original site structure. It intelligently rewrites links (`href`, `src`) in HTML and CSS files to point to the downloaded local copies, creating a fully self-contained archive that can be browsed offline.

It focuses purely on static assets and avoids complex JavaScript-rendered content, making it fast and reliable for its intended purpose.

## Features

-   **Recursive Crawling**: Traverses a website up to a configurable depth.
-   **Asset Downloading**: Saves HTML, CSS, JS, images (jpeg, png, gif, svg), and web fonts (woff, woff2).
-   **Link Rewriting**: Updates `href` and `src` attributes in files for seamless offline browsing.
-   **Directory Structure**: Mirrors the original website's directory structure locally.
-   **CLI Interface**: Easy-to-use command line for specifying target, output, and depth.
-   **Programmatic API**: Can be used as a Node.js library in other projects.
-   **Configurable User-Agent**: Allows setting a custom User-Agent string for requests.

## Installation

You can use this tool by cloning the repository and installing its dependencies.

```bash
# 1. Clone the repository
git clone https://github.com/your-username/static-archive-scraper.git

# 2. Navigate into the project directory
cd static-archive-scraper

# 3. Install dependencies
npm install

# 4. (Optional) Link the CLI for global access
npm link
```

After linking, you can use the `static-archive` command from any directory.

## Usage

### Command-Line Interface (CLI)

The primary way to use the tool is via the `static-archive` command.

**Syntax:**

```bash
static-archive <url> [options]
```

**Arguments:**

-   `<url>` (required): The starting URL of the website to archive (e.g., `https://example.com`).

**Options:**

| Option                 | Alias | Description                               | Default                                                                                |
| ---------------------- | ----- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `--output <directory>` | `-o`  | Directory to save the archived website.   | `./archive`                                                                            |
| `--depth <number>`     | `-d`  | Maximum crawl depth for links.            | `3`                                                                                    |
| `--user-agent <string>`| `-U`  | User-Agent string for HTTP requests.      | `StaticArchiveScraper/1.0`                                                             |
| `--help`               | `-h`  | Show the help message.                    |                                                                                        |
| `--version`            | `-v`  | Show the version number.                  |                                                                                        |

### Programmatic API

You can also integrate the scraper into your own Node.js projects by importing the `crawlWebsite` function.

```javascript
import { crawlWebsite } from 'static-archive-scraper';

async function archiveMyBlog() {
  try {
    await crawlWebsite({
      startUrl: 'https://my-awesome-blog.com',
      outputDir: './my-blog-archive',
      maxDepth: 5,
      userAgent: 'MyCustomArchiver/1.0'
    });
    console.log('Blog archived successfully!');
  } catch (error) {
    console.error('Failed to archive blog:', error);
  }
}

archiveMyBlog();
```

## Examples

Here are a few examples of how to use the CLI.

### Example 1: Basic Archive

Archive a blog, crawling up to 2 levels deep from the homepage.

**Command:**

```bash
static-archive https://my-static-blog.dev --depth 2
```

**Output:**

The tool will create an `archive` directory in your current location. Inside, you will find the website's files organized in their original structure.

```
archive/
├── index.html
├── about/
│   └── index.html
└── assets/
    ├── style.css
    └── logo.png
```

### Example 2: Archive to a Specific Directory

Archive a documentation site and save it to a custom directory named `my-docs`.

**Command:**

```bash
static-archive https://docs.example.com -o ./my-docs
```

**Output:**

A `my-docs` directory will be created with the complete archived site. You can open `my-docs/index.html` in your browser to view the offline copy.

### Example 3: Shallow Scrape with Custom User-Agent

Scrape only the homepage and its direct assets (depth 0) using a custom User-Agent.

**Command:**

```bash
static-archive https://www.some-project.org --depth 0 -U "MyArchivalBot/1.1"
```

**Output:**

The `archive` directory will contain only `index.html` and the assets (CSS, JS, images) linked directly from that page. No other pages will be crawled.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
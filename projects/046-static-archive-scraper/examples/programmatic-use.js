/**
 * @file examples/programmatic-use.js
 * @description Demonstrates how to use the static-archive-scraper as a library.
 *
 * This script shows a practical example of importing and using the `crawlWebsite`
 * function to archive a website programmatically within a Node.js application.
 * It includes setting custom options and handling success and error states.
 */

// In a real project, you would install the package and import it like this:
// import { crawlWebsite } from 'static-archive-scraper';
// For this example, we import directly from the source file.
import { crawlWebsite } from '../src/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Helper to get the directory name in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * A simple mock server to simulate a target website for the scraper.
 * This allows the example to be self-contained and run without needing a live internet target.
 * It serves a few HTML pages, a CSS file, and an image.
 */
import http from 'node:http';

const MOCK_SITE_CONTENT = {
  '/': {
    contentType: 'text/html',
    body: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Home Page</title>
        <link rel="stylesheet" href="/assets/style.css">
      </head>
      <body>
        <h1>Welcome!</h1>
        <p>This is the home page.</p>
        <a href="/about.html">Go to About Page</a>
        <img src="/assets/image.png" alt="A test image">
      </body>
      </html>
    `,
  },
  '/about.html': {
    contentType: 'text/html',
    body: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>About Page</title>
        <link rel="stylesheet" href="/assets/style.css">
      </head>
      <body>
        <h1>About Us</h1>
        <p>This is the about page.</p>
        <a href="/">Back to Home</a>
        <a href="https://example.com">External Link (should be ignored)</a>
      </body>
      </html>
    `,
  },
  '/assets/style.css': {
    contentType: 'text/css',
    body: `
      body { font-family: sans-serif; background-color: #f0f0f0; }
      h1 { color: #333; }
    `,
  },
  '/assets/image.png': {
    contentType: 'image/png',
    // A simple 1x1 transparent PNG pixel as a Buffer
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
  },
};

const server = http.createServer((req, res) => {
  const url = req.url === '/about' ? '/about.html' : req.url; // Handle clean URL
  const resource = MOCK_SITE_CONTENT[url];

  if (resource) {
    res.writeHead(200, { 'Content-Type': resource.contentType });
    res.end(resource.body);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

/**
 * Main function to run the programmatic scraping example.
 */
async function runExample() {
  const PORT = 8989; // Use a non-standard port to avoid conflicts
  const MOCK_SERVER_URL = `http://localhost:${PORT}`;

  // Start the mock server
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`[Example] Mock server running at ${MOCK_SERVER_URL}`);

  // Define the options for the scraper.
  const archiveOptions = {
    startUrl: MOCK_SERVER_URL,
    // Save the archive in a directory relative to this script.
    outputDir: path.resolve(__dirname, 'programmatic-archive-output'),
    maxDepth: 2, // Scrape the homepage and links one level deep.
    userAgent: 'MyCustomArchiver/1.0 (Programmatic-Example)',
  };

  console.log('\n--- Starting Programmatic Archive ---');
  console.log(`> Target: ${archiveOptions.startUrl}`);
  console.log(`> Output: ${archiveOptions.outputDir}`);
  console.log('-------------------------------------\n');

  try {
    // Call the main library function with the specified options.
    await crawlWebsite(archiveOptions);

    console.log('\n✅ Programmatic archive completed successfully!');
    console.log(`Check the output in: ${archiveOptions.outputDir}`);
  } catch (error) {
    // Handle any errors that occur during the scraping process.
    console.error('\n❌ An error occurred during the programmatic archive:');
    console.error(error.message);
  } finally {
    // Ensure the mock server is closed, whether the scrape succeeded or failed.
    server.close(() => {
      console.log('[Example] Mock server shut down.');
    });
  }
}

// Execute the example function.
runExample();
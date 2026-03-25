'use strict';

/**
 * @fileoverview An advanced example demonstrating how to scrape a paginated
 * forum thread using the resilient-session-scraper.
 *
 * This script showcases several key features:
 * 1.  Creating a session with per-request User-Agent rotation.
 * 2.  Navigating to a starting page of a forum thread.
 * 3.  Scraping data (posts) from the current page.
 * 4.  Identifying and following the "Next Page" link to handle pagination.
 * 5.  Looping through pages until the last page is reached.
 * 6.  Aggregating the scraped data from all pages.
 *
 * A mock server is used to simulate a real forum, making the example
 * self-contained and runnable without external dependencies.
 */

import { createServer } from 'node:http';
import { createSession } from '../index.js';

// --- Mock Server Setup ---
// This server simulates a simple, paginated forum thread.
const MOCK_SERVER_PORT = 3001;
const MOCK_SERVER_URL = `http://localhost:${MOCK_SERVER_PORT}`;
const TOTAL_PAGES = 3;

/**
 * Generates the HTML for a single forum post.
 * @param {number} postNumber - The number of the post.
 * @returns {string} HTML string for a post.
 */
function createPostHtml(postNumber) {
  const authors = ['ScraperFan', 'NodeNinja', 'DataWizard', 'WebSleuth'];
  const author = authors[postNumber % authors.length];
  return `
    <div class="post" id="post-${postNumber}">
      <div class="post-author"><strong>${author}</strong></div>
      <div class="post-content">
        This is the content for post #${postNumber}. It's a fascinating discussion!
      </div>
    </div>
  `;
}

/**
 * Generates the HTML for a specific page of the forum thread.
 * @param {number} pageNum - The current page number (1-based).
 * @returns {string} The full HTML for the page.
 */
function generateForumPage(pageNum) {
  const postsPerPage = 5;
  const startPost = (pageNum - 1) * postsPerPage + 1;
  const endPost = startPost + postsPerPage - 1;

  let postsHtml = '';
  for (let i = startPost; i <= endPost; i++) {
    postsHtml += createPostHtml(i);
  }

  const nextPageLink = (pageNum < TOTAL_PAGES)
    ? `<a href="/thread?page=${pageNum + 1}" class="pagination-next">Next Page &raquo;</a>`
    : '<span class="pagination-disabled">Next Page &raquo;</span>';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>An Interesting Thread - Page ${pageNum}</title>
      <style>
        body { font-family: sans-serif; }
        .post { border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px; }
        .post-author { font-size: 1.1em; color: #0056b3; }
        .pagination { margin-top: 20px; }
        .pagination-next { text-decoration: none; font-weight: bold; }
        .pagination-disabled { color: #999; }
      </style>
    </head>
    <body>
      <h1>An Interesting Thread</h1>
      <div id="posts-container">
        ${postsHtml}
      </div>
      <div class="pagination">
        <span>Page ${pageNum} of ${TOTAL_PAGES}</span>
        ${nextPageLink}
      </div>
    </body>
    </html>
  `;
}

/**
 * Creates and starts a mock HTTP server for the forum.
 * @returns {Promise<import('node:http').Server>} A promise that resolves with the server instance.
 */
function startMockServer() {
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url, MOCK_SERVER_URL);

      if (url.pathname === '/thread') {
        const pageParam = url.searchParams.get('page') ?? '1';
        const pageNum = parseInt(pageParam, 10);

        if (isNaN(pageNum) || pageNum < 1 || pageNum > TOTAL_PAGES) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Page not found.');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(generateForumPage(pageNum));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(MOCK_SERVER_PORT, () => {
      console.log(`Mock forum server running at ${MOCK_SERVER_URL}`);
      resolve(server);
    });
  });
}

/**
 * Scrapes a single page of the forum thread, extracting post data.
 * @param {import('../lib/session.js').SessionResponse} response - The session response object.
 * @returns {{posts: {author: string, content: string}[], nextUrl: string | null}} Scraped data and the URL for the next page.
 */
function scrapePage(response) {
  const posts = [];
  // Use the Cheerio instance from the response to parse the HTML
  const $ = response.$;

  $('.post').each((index, element) => {
    const author = $(element).find('.post-author strong').text().trim();
    const content = $(element).find('.post-content').text().trim();
    posts.push({ author, content });
  });

  // Find the link to the next page. If it's a link (<a>), get its href.
  const nextUrl = $('.pagination-next').attr('href') ?? null;

  return { posts, nextUrl };
}

/**
 * Main function to run the forum scraping demonstration.
 */
async function main() {
  let server;
  try {
    server = await startMockServer();
    console.log('\n--- Starting Forum Scraping Demo ---');

    // 1. Create a session with per-request User-Agent rotation.
    // This is good practice for larger scrapes to avoid looking robotic.
    const session = createSession({
      userAgentRotation: 'per-request',
    });
    console.log('✅ Session created with per-request User-Agent rotation.');

    const allPosts = [];
    let currentUrl = `${MOCK_SERVER_URL}/thread?page=1`;
    let pageCount = 0;

    // 2. Loop through the paginated thread until there are no more "Next" links.
    while (currentUrl) {
      pageCount++;
      console.log(`\n[Page ${pageCount}] Scraping ${currentUrl}...`);
      console.log(`   - Using User-Agent: ${session.getUserAgent()}`);

      // Make the GET request. The session handles cookies and referers automatically.
      const response = await session.get(currentUrl);

      if (response.statusCode !== 200) {
        throw new Error(`Failed to fetch page. Status: ${response.statusCode}`);
      }

      // 3. Scrape the current page for posts and the next page link.
      const { posts, nextUrl } = scrapePage(response);
      allPosts.push(...posts);
      console.log(`   - Scraped ${posts.length} posts from this page.`);

      if (nextUrl) {
        // Construct the full URL for the next request.
        currentUrl = new URL(nextUrl, MOCK_SERVER_URL).href;
        console.log(`   - Found next page link: ${currentUrl}`);
      } else {
        // No more "Next" link, we've reached the end.
        currentUrl = null;
        console.log('   - Reached the last page of the thread.');
      }
    }

    // 4. Display the aggregated results.
    console.log('\n--- Scraping Complete ---');
    console.log(`✅ Successfully scraped ${pageCount} pages and collected ${allPosts.length} posts in total.`);
    console.log('\nFirst 3 posts scraped:');
    console.log(JSON.stringify(allPosts.slice(0, 3), null, 2));

  } catch (error) {
    console.error('\n--- An error occurred during the forum scraping demo ---');
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close(() => console.log('\nMock server stopped.'));
    }
  }
}

main();
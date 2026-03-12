import { promises as fs } from 'node:fs';
import path from 'node:path';
import DirectedGraph from 'graphology';
import { findMarkdownFiles } from '../utils/file-scanner.js';
import { parseFrontmatter } from '../parser/frontmatter-parser.js';
import { extractLinks } from '../parser/markdown-parser.js';
import { normalizeLink, getCanonicalPath } from '../utils/link-normalizer.js';

/**
 * @fileoverview
 * This is the core module for building the content graph. It orchestrates the entire
 * process: scanning for files, reading and parsing each file for front-matter and
 * links, normalizing the links, and finally constructing a directed graph using
 * the 'graphology' library. The resulting graph represents the structure of the
 * Markdown content, with files as nodes and links as edges.
 */

/**
 * @typedef {import('../utils/file-scanner.js').FileScannerOptions} FileScannerOptions
 */

/**
 * @typedef {object} GraphBuilderOptions
 * @property {string} projectRoot - The absolute path to the root of the project directory.
 * @property {FileScannerOptions} [scannerOptions] - Options to pass to the file scanner.
 */

/**
 * @typedef {object} ProcessedFile
 * @property {string} absolutePath - The absolute path of the file.
 * @property {string} id - The canonical path ID for the graph node.
 * @property {object} metadata - Parsed front-matter data.
 * @property {string[]} rawLinks - The raw hrefs extracted from the file.
 */

/**
 * Processes a single Markdown file to extract its metadata and links.
 *
 * This function reads the file content, parses its front-matter, and then
 * extracts all links from the main content body.
 *
 * @param {string} absolutePath - The absolute path to the file.
 * @param {string} projectRoot - The project's root directory path.
 * @returns {Promise<ProcessedFile>} A promise that resolves to an object
 *   containing the file's processed data.
 * @private
 */
async function processFile(absolutePath, projectRoot) {
  try {
    const fileContent = await fs.readFile(absolutePath, 'utf-8');
    const { metadata, content } = await parseFrontmatter(fileContent);
    const rawLinks = await extractLinks(content);
    const id = getCanonicalPath(absolutePath, projectRoot);

    return {
      absolutePath,
      id,
      metadata,
      rawLinks,
    };
  } catch (error) {
    console.error(`Error processing file "${absolutePath}": ${error.message}`);
    // Re-throw to be caught by the main builder function, which can
    // decide whether to skip the file or halt the process.
    throw error;
  }
}

/**
 * Orchestrates the entire process of building the content graph.
 *
 * It performs the following steps:
 * 1. Scans the specified directory for all Markdown files.
 * 2. Processes each file in parallel to parse front-matter and extract links.
 * 3. Initializes a `graphology` directed graph.
 * 4. Adds a node to the graph for each discovered Markdown file, attaching its
 *    metadata and file path as attributes.
 * 5. For each file, normalizes its extracted links and adds directed edges
 *    to the graph representing the connections between files.
 *
 * @param {GraphBuilderOptions} options - The configuration options for building the graph.
 * @returns {Promise<DirectedGraph>} A promise that resolves to a `graphology`
 *   directed graph instance representing the content structure.
 * @throws {Error} If the `projectRoot` is not provided or if a critical error
 *   occurs during file processing.
 */
export async function buildGraph({ projectRoot, scannerOptions = {} }) {
  if (!projectRoot) {
    throw new Error('A "projectRoot" option is required to build the graph.');
  }

  // 1. Find all markdown files
  const filePaths = await findMarkdownFiles(projectRoot, scannerOptions);

  // 2. Process all files in parallel to extract data
  const processingPromises = filePaths.map(filePath =>
    processFile(filePath, projectRoot).catch(err => {
      // Log the error but return null so Promise.all doesn't fail fast.
      // This allows the graph build to continue even if some files are un-parseable.
      console.warn(`Skipping file due to error: ${path.relative(projectRoot, filePath)}`);
      return null;
    })
  );
  const processedFiles = (await Promise.all(processingPromises)).filter(Boolean);

  // 3. Initialize the graph
  const graph = new DirectedGraph();

  // 4. Add a node for each file
  for (const file of processedFiles) {
    // Check for duplicate node IDs, which can happen with case-insensitive
    // file systems if files like 'Doc.md' and 'doc.md' exist.
    if (graph.hasNode(file.id)) {
      console.warn(`Duplicate node ID "${file.id}" detected. This may be caused by files with similar names on a case-insensitive file system. The later file will overwrite the former's attributes.`);
    }
    graph.addNode(file.id, {
      label: file.metadata.title ?? path.basename(file.absolutePath),
      absolutePath: file.absolutePath,
      ...file.metadata,
    });
  }

  // 5. Add edges for all links
  for (const sourceFile of processedFiles) {
    for (const rawLink of sourceFile.rawLinks) {
      const targetId = normalizeLink(rawLink, sourceFile.absolutePath, projectRoot);

      // Only add an edge if the link is internal and resolves to a valid canonical path
      if (targetId) {
        // The target node might not exist in the graph (a broken link),
        // but graphology allows adding edges to non-existent nodes.
        // These will be identified later during analysis.
        // We use `addDirectedEdge` which won't throw if the edge already exists.
        graph.addDirectedEdge(sourceFile.id, targetId, {
          // Store the original raw link for context in reports
          rawLink,
        });
      }
    }
  }

  return graph;
}
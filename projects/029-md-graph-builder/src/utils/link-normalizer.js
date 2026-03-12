import path from 'node:path';
import { SUPPORTED_EXTENSIONS } from '../constants.js';

/**
 * @fileoverview
 * Provides pure utility functions for resolving and normalizing Markdown link paths.
 * The primary goal is to convert various link formats into a canonical,
 * project-root-relative path that can be used as a unique identifier for a node
 * in the content graph.
 *
 * Canonical Path Format:
 * - Relative to the project root directory.
 * - Uses forward slashes ('/') as path separators.
 * - Does NOT include the file extension (e.g., '.md').
 * - Does NOT include URL fragments/anchors (e.g., '#section').
 * - Example: 'docs/guide/getting-started'
 */

/**
 * Normalizes a link target found within a source file into a canonical path.
 * This is the main entry point function for link normalization. It orchestrates
 * the resolution of relative and absolute links, removes extensions and fragments,
 * and ensures a consistent, project-root-relative format.
 *
 * @param {string} linkTarget - The raw link target (href) from the Markdown file.
 *   e.g., '../other.md#section', '/docs/index.md', './page.md'
 * @param {string} sourceFilePath - The absolute path of the file containing the link.
 *   e.g., '/Users/user/project/src/content/page.md'
 * @param {string} projectRoot - The absolute path of the project's root directory.
 *   e.g., '/Users/user/project'
 * @returns {string | null} The canonical, project-root-relative path, or null if the link
 *   is external (e.g., http), an anchor-only link, or invalid.
 *   e.g., 'src/other', 'docs/index', 'src/content/page'
 */
export function normalizeLink(linkTarget, sourceFilePath, projectRoot) {
  if (!linkTarget || typeof linkTarget !== 'string') {
    return null;
  }

  // Ignore external URLs, mailto links, and other protocols
  if (/^(?:[a-z]+:)?\/\//i.test(linkTarget) || /^[a-z]+:/.test(linkTarget)) {
    return null;
  }

  // Ignore links that are just anchors on the same page
  if (linkTarget.startsWith('#')) {
    return null;
  }

  // 1. Remove any URL fragment/anchor from the link
  const linkWithoutFragment = removeFragment(linkTarget);

  // 2. Resolve the link to an absolute file system path
  const absolutePath = resolvePath(linkWithoutFragment, sourceFilePath, projectRoot);

  // 3. Make the path relative to the project root
  const rootRelativePath = path.relative(projectRoot, absolutePath);

  // 4. Remove the file extension and normalize separators
  const canonicalPath = removeExtension(rootRelativePath);

  return canonicalPath;
}

/**
 * Resolves a link path to an absolute file system path.
 * It handles both relative paths (starting with '.') and "absolute from root" paths
 * (starting with '/').
 *
 * @param {string} linkPath - The link path, without any fragment.
 *   e.g., '../other.md', '/docs/index.md'
 * @param {string} sourceFilePath - The absolute path of the file containing the link.
 * @param {string} projectRoot - The absolute path of the project root.
 * @returns {string} The resolved absolute file system path.
 */
export function resolvePath(linkPath, sourceFilePath, projectRoot) {
  if (linkPath.startsWith('/')) {
    // Absolute from project root: join with project root directory
    return path.join(projectRoot, linkPath);
  } else {
    // Relative to the source file: join with the source file's directory
    const sourceDir = path.dirname(sourceFilePath);
    return path.join(sourceDir, linkPath);
  }
}

/**
 * Removes the URL fragment (hash) from a link.
 *
 * @param {string} link - The original link. e.g., 'path/to/file.md#section-heading'
 * @returns {string} The link without the fragment. e.g., 'path/to/file.md'
 */
export function removeFragment(link) {
  const hashIndex = link.indexOf('#');
  return hashIndex === -1 ? link : link.substring(0, hashIndex);
}

/**
 * Removes a supported Markdown file extension from a path and normalizes separators.
 * It also ensures the path uses forward slashes for consistency across platforms.
 *
 * @param {string} filePath - The path to process. e.g., 'docs\\guide\\setup.md'
 * @returns {string} The path without the extension, using forward slashes. e.g., 'docs/guide/setup'
 */
export function removeExtension(filePath) {
  const parsedPath = path.parse(filePath);
  const extension = parsedPath.ext.toLowerCase();

  // Check if the extension is one of the supported Markdown types
  if (SUPPORTED_EXTENSIONS.some(ext => `.${ext}` === extension)) {
    // Reconstruct the path without the extension
    const pathWithoutExt = path.join(parsedPath.dir, parsedPath.name);
    // Normalize to forward slashes for canonical representation
    return pathWithoutExt.split(path.sep).join('/');
  }

  // If no supported extension, return the original path, normalized
  return filePath.split(path.sep).join('/');
}

/**
 * Converts an absolute file path into a canonical node ID.
 * This is used to create the unique identifier for each file in the graph.
 *
 * @param {string} absoluteFilePath - The full, absolute path to a Markdown file.
 *   e.g., '/Users/user/project/docs/guide.md'
 * @param {string} projectRoot - The absolute path of the project root.
 *   e.g., '/Users/user/project'
 * @returns {string} The canonical node ID. e.g., 'docs/guide'
 */
export function getCanonicalPath(absoluteFilePath, projectRoot) {
  if (!absoluteFilePath.startsWith(projectRoot)) {
    throw new Error(`File path "${absoluteFilePath}" is not within the project root "${projectRoot}".`);
  }
  const rootRelativePath = path.relative(projectRoot, absoluteFilePath);
  return removeExtension(rootRelativePath);
}
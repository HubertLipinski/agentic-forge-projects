/**
 * @file src/cli/parser.js
 * @description Utility for parsing Matrix Market (.mtx) file format into a supported sparse matrix representation.
 *
 * The Matrix Market format is a standard text file format for storing sparse matrices.
 * This parser handles the "coordinate" format for real-valued matrices.
 *
 * A typical Matrix Market file looks like this:
 *
 *   %%MatrixMarket matrix coordinate real general
 *   % Comments can be included like this.
 *   <rows> <cols> <non-zero-entries>
 *   <row_idx> <col_idx> <value>
 *   <row_idx> <col_idx> <value>
 *   ...
 *
 * This parser reads the file, extracts the header information, and then parses
 * the non-zero entries to construct a `CoordinateListMatrix`. It also supports
 * reading a dense vector `b` from a separate file, which is common for `Ax=b` problems.
 *
 * The parser is designed to be robust, providing clear error messages for malformed files.
 */

import { readFile } from 'fs/promises';
import { CoordinateListMatrix } from '../formats/coordinate-list.js';

/**
 * Parses the content of a Matrix Market (.mtx) file.
 *
 * @param {string} filePath - The path to the .mtx file.
 * @returns {Promise<CoordinateListMatrix>} A promise that resolves to a `CoordinateListMatrix` instance.
 * @throws {Error} If the file cannot be read, is malformed, or is not a supported Matrix Market format.
 */
export async function parseMtxFile(filePath) {
  let fileContent;
  try {
    fileContent = await readFile(filePath, { encoding: 'utf-8' });
  } catch (error) {
    throw new Error(`Failed to read matrix file at '${filePath}': ${error.message}`);
  }

  const lines = fileContent.split('\n').map(line => line.trim());

  // 1. Find and validate the header line
  const headerIndex = lines.findIndex(line => !line.startsWith('%'));
  if (headerIndex === -1) {
    throw new Error(`Invalid Matrix Market file '${filePath}': No header line found.`);
  }

  const header = lines[headerIndex];
  const headerParts = header.toLowerCase().split(/\s+/);
  // Example: %%MatrixMarket matrix coordinate real general
  if (
    headerParts.length < 5 ||
    headerParts[0] !== '%%matrixmarket' ||
    headerParts[1] !== 'matrix' ||
    headerParts[2] !== 'coordinate' ||
    headerParts[3] !== 'real'
  ) {
    throw new Error(`Unsupported Matrix Market format in '${filePath}'. Only 'matrix coordinate real' is supported.`);
  }

  // The 'general' or 'symmetric' part determines how to read entries.
  const isSymmetric = headerParts[4] === 'symmetric';

  // 2. Find and parse the dimensions line
  const dimensionsIndex = lines.findIndex((line, index) => index > headerIndex && !line.startsWith('%') && line.length > 0);
  if (dimensionsIndex === -1) {
    throw new Error(`Invalid Matrix Market file '${filePath}': No dimensions line found after the header.`);
  }

  const dimensions = lines[dimensionsIndex].split(/\s+/).map(Number);
  if (dimensions.length < 3 || dimensions.some(isNaN)) {
    throw new Error(`Malformed dimensions line in '${filePath}': '${lines[dimensionsIndex]}'. Expected 'rows cols nonzeros'.`);
  }
  const [rows, cols, expectedNNZ] = dimensions;

  // 3. Parse the matrix entries
  const entries = [];
  const dataLines = lines.slice(dimensionsIndex + 1);

  for (const line of dataLines) {
    if (!line || line.startsWith('%')) {
      continue; // Skip empty lines and comments
    }

    const parts = line.split(/\s+/).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some(isNaN)) {
      throw new Error(`Malformed data line in '${filePath}': '${line}'. Expected 'row col value'.`);
    }

    // Matrix Market is 1-based, our library is 0-based.
    const row = parts[0] - 1;
    const col = parts[1] - 1;
    const value = parts[2];

    entries.push({ row, col, value });

    // If the matrix is symmetric, for every off-diagonal element (i, j),
    // we must also add the corresponding (j, i) element.
    if (isSymmetric && row !== col) {
      entries.push({ row: col, col: row, value });
    }
  }

  if (!isSymmetric && entries.length !== expectedNNZ) {
    console.warn(`Warning: The number of data lines (${entries.length}) in '${filePath}' does not match the expected non-zero count (${expectedNNZ}) in the header.`);
  }

  try {
    return new CoordinateListMatrix(rows, cols, entries);
  } catch (error) {
    // Add context to errors thrown by the matrix constructor
    throw new Error(`Error creating matrix from '${filePath}': ${error.message}`);
  }
}

/**
 * Parses a file containing a dense vector `b`.
 * The file is expected to contain one floating-point number per line.
 *
 * @param {string} filePath - The path to the vector file.
 * @returns {Promise<Float64Array>} A promise that resolves to a `Float64Array` representing the vector.
 * @throws {Error} If the file cannot be read or contains non-numeric data.
 */
export async function parseVectorFile(filePath) {
  let fileContent;
  try {
    fileContent = await readFile(filePath, { encoding: 'utf-8' });
  } catch (error) {
    throw new Error(`Failed to read vector file at '${filePath}': ${error.message}`);
  }

  const lines = fileContent.split('\n').filter(line => line.trim().length > 0);
  const vector = new Float64Array(lines.length);

  for (let i = 0; i < lines.length; i++) {
    const value = parseFloat(lines[i]);
    if (isNaN(value)) {
      throw new Error(`Invalid vector file '${filePath}': Found non-numeric value '${lines[i]}' at line ${i + 1}.`);
    }
    vector[i] = value;
  }

  return vector;
}
/**
 * @file src/formats/coordinate-list.js
 * @description Defines a sparse matrix class using the Coordinate List (COO) format.
 *
 * The Coordinate List (COO) format is one of the simplest ways to store a sparse matrix.
 * It uses three arrays of the same length:
 *  - `rows`: An array of row indices for each non-zero element.
 *  - `cols`: An array of column indices for each non-zero element.
 *  - `values`: An array of the non-zero element values themselves.
 *
 * For an element `A[i][j] = v`, we would store `i` in `rows`, `j` in `cols`, and `v` in `values`
 * at the same position in their respective arrays.
 *
 * This format is easy to construct but can be less efficient for matrix-vector multiplication
 * compared to formats like Compressed Sparse Row (CSR).
 */

import { fill } from '../utils/vector-ops.js';

/**
 * Represents a sparse matrix in Coordinate List (COO) format.
 */
export class CoordinateListMatrix {
  /**
   * The number of rows in the matrix.
   * @type {number}
   */
  rows;

  /**
   * The number of columns in the matrix.
   * @type {number}
   */
  cols;

  /**
   * An array of row indices for each non-zero element.
   * @type {number[]}
   */
  rowIndices;

  /**
   * An array of column indices for each non-zero element.
   * @type {number[]}
   */
  colIndices;

  /**
   * An array of values for each non-zero element.
   * @type {number[]}
   */
  values;

  /**
   * Constructs a CoordinateListMatrix instance.
   *
   * @param {number} rows - The total number of rows in the matrix.
   * @param {number} cols - The total number of columns in the matrix.
   * @param {Array<{row: number, col: number, value: number}>} entries - An array of objects,
   *   each representing a non-zero entry with its row, column, and value.
   *   Indices are expected to be 0-based.
   */
  constructor(rows, cols, entries) {
    if (rows <= 0 || cols <= 0 || !Number.isInteger(rows) || !Number.isInteger(cols)) {
      throw new Error(`Invalid matrix dimensions: (${rows}, ${cols}). Dimensions must be positive integers.`);
    }
    if (!Array.isArray(entries)) {
      throw new Error('Matrix entries must be provided as an array.');
    }

    this.rows = rows;
    this.cols = cols;

    const nnz = entries.length;
    this.rowIndices = new Array(nnz);
    this.colIndices = new Array(nnz);
    this.values = new Float64Array(nnz);

    for (let i = 0; i < nnz; i++) {
      const entry = entries[i];
      if (entry.row < 0 || entry.row >= rows || entry.col < 0 || entry.col >= cols) {
        throw new Error(`Matrix entry at index ${i} is out of bounds: row ${entry.row}, col ${entry.col} for a ${rows}x${cols} matrix.`);
      }
      this.rowIndices[i] = entry.row;
      this.colIndices[i] = entry.col;
      this.values[i] = entry.value;
    }
  }

  /**
   * Returns the shape of the matrix.
   * @returns {[number, number]} An array containing the number of rows and columns.
   */
  get shape() {
    return [this.rows, this.cols];
  }

  /**
   * Returns the number of non-zero elements in the matrix.
   * @returns {number} The count of non-zero elements.
   */
  get nnz() {
    return this.values.length;
  }

  /**
   * Performs matrix-vector multiplication (y = A * x).
   *
   * @param {number[] | Float64Array} x - The vector to multiply with. Its length must match the number of columns of the matrix.
   * @returns {Float64Array} The resulting vector `y`.
   * @throws {Error} If the vector length does not match the number of matrix columns.
   */
  multiply(x) {
    if (x.length !== this.cols) {
      throw new Error(`Dimension mismatch for matrix-vector multiplication: Matrix has ${this.cols} columns, but vector has length ${x.length}.`);
    }

    const y = fill(this.rows); // Initialize result vector with zeros

    for (let i = 0; i < this.nnz; i++) {
      const row = this.rowIndices[i];
      const col = this.colIndices[i];
      const value = this.values[i];
      y[row] += value * x[col];
    }

    return y;
  }

  /**
   * Creates a deep copy of the matrix.
   *
   * @returns {CoordinateListMatrix} A new CoordinateListMatrix instance with the same data.
   */
  clone() {
    const entries = [];
    for (let i = 0; i < this.nnz; i++) {
      entries.push({
        row: this.rowIndices[i],
        col: this.colIndices[i],
        value: this.values[i]
      });
    }
    return new CoordinateListMatrix(this.rows, this.cols, entries);
  }
}
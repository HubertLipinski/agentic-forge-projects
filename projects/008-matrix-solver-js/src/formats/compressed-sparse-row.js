/**
 * @file src/formats/compressed-sparse-row.js
 * @description Defines a sparse matrix class using the Compressed Sparse Row (CSR) format, optimized for fast matrix-vector products.
 *
 * The Compressed Sparse Row (CSR) format is a highly efficient way to store and perform
 * operations on sparse matrices, especially matrix-vector multiplication. It uses three arrays:
 *  - `values`: A Float64Array containing all non-zero values of the matrix, ordered row by row.
 *  - `colIndices`: An array of column indices corresponding to each value in the `values` array.
 *  - `rowPtr`: An array of pointers indicating the start of each row in the `values` and `colIndices` arrays.
 *    `rowPtr` has a length of `rows + 1`. The non-zero elements of row `i` are stored in `values`
 *    from index `rowPtr[i]` to `rowPtr[i+1] - 1`.
 *
 * This format is generally faster for multiplication than the Coordinate List (COO) format because
 * it allows for direct, sequential access to the elements of each row.
 */

import { fill } from '../utils/vector-ops.js';
import { CoordinateListMatrix } from './coordinate-list.js';

/**
 * Represents a sparse matrix in Compressed Sparse Row (CSR) format.
 */
export class CompressedSparseRowMatrix {
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
   * A Float64Array containing the non-zero values of the matrix, ordered by row.
   * @type {Float64Array}
   */
  values;

  /**
   * An Int32Array containing the column indices for each corresponding value in `this.values`.
   * @type {Int32Array}
   */
  colIndices;

  /**
   * An Int32Array of pointers to the start of each row in `values` and `colIndices`.
   * The length is `rows + 1`. `rowPtr[i]` is the index of the first non-zero element of row `i`.
   * @type {Int32Array}
   */
  rowPtr;

  /**
   * Constructs a CompressedSparseRowMatrix instance.
   * It is recommended to use the `fromCoordinateList` static method for easier construction.
   *
   * @param {number} rows - The total number of rows in the matrix.
   * @param {number} cols - The total number of columns in the matrix.
   * @param {Float64Array} values - The non-zero values.
   * @param {Int32Array} colIndices - The column indices for each value.
   * @param {Int32Array} rowPtr - The row pointers.
   */
  constructor(rows, cols, values, colIndices, rowPtr) {
    if (rows <= 0 || cols <= 0 || !Number.isInteger(rows) || !Number.isInteger(cols)) {
      throw new Error(`Invalid matrix dimensions: (${rows}, ${cols}). Dimensions must be positive integers.`);
    }
    if (!(values instanceof Float64Array) || !(colIndices instanceof Int32Array) || !(rowPtr instanceof Int32Array)) {
      throw new Error('`values`, `colIndices`, and `rowPtr` must be of the correct TypedArray types (Float64Array, Int32Array, Int32Array).');
    }
    if (values.length !== colIndices.length) {
      throw new Error(`Dimension mismatch: 'values' array (length ${values.length}) and 'colIndices' array (length ${colIndices.length}) must have the same length.`);
    }
    if (rowPtr.length !== rows + 1) {
      throw new Error(`Invalid 'rowPtr' length: expected ${rows + 1}, but got ${rowPtr.length}.`);
    }

    this.rows = rows;
    this.cols = cols;
    this.values = values;
    this.colIndices = colIndices;
    this.rowPtr = rowPtr;
  }

  /**
   * Creates a CompressedSparseRowMatrix from a CoordinateListMatrix.
   * This is the preferred method for creating CSR matrices.
   *
   * @param {CoordinateListMatrix} cooMatrix - The matrix in COO format to convert.
   * @returns {CompressedSparseRowMatrix} A new CSR matrix instance.
   */
  static fromCoordinateList(cooMatrix) {
    if (!(cooMatrix instanceof CoordinateListMatrix)) {
      throw new Error('Input must be an instance of CoordinateListMatrix.');
    }

    const { rows, cols, nnz } = cooMatrix;
    const entries = [];
    for (let i = 0; i < nnz; i++) {
      entries.push({
        row: cooMatrix.rowIndices[i],
        col: cooMatrix.colIndices[i],
        value: cooMatrix.values[i],
      });
    }

    // Sort entries by row, then by column. This is crucial for CSR construction.
    entries.sort((a, b) => {
      if (a.row !== b.row) {
        return a.row - b.row;
      }
      return a.col - b.col;
    });

    const values = new Float64Array(nnz);
    const colIndices = new Int32Array(nnz);
    const rowPtr = new Int32Array(rows + 1);
    rowPtr.fill(0); // Initialize with zeros

    if (nnz === 0) {
        return new CompressedSparseRowMatrix(rows, cols, values, colIndices, rowPtr);
    }

    let currentRow = 0;
    for (let i = 0; i < nnz; i++) {
      const entry = entries[i];
      values[i] = entry.value;
      colIndices[i] = entry.col;

      // Fill rowPtr gaps for any empty rows
      while (currentRow < entry.row) {
        currentRow++;
        rowPtr[currentRow] = i;
      }
    }

    // Fill in the remaining row pointers for any trailing empty rows
    for (let i = currentRow + 1; i <= rows; i++) {
        rowPtr[i] = nnz;
    }

    return new CompressedSparseRowMatrix(rows, cols, values, colIndices, rowPtr);
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
   * This operation is highly optimized for the CSR format.
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

    for (let i = 0; i < this.rows; i++) {
      const rowStart = this.rowPtr[i];
      const rowEnd = this.rowPtr[i + 1];
      let sum = 0.0;

      for (let j = rowStart; j < rowEnd; j++) {
        const col = this.colIndices[j];
        const value = this.values[j];
        sum += value * x[col];
      }
      y[i] = sum;
    }

    return y;
  }

  /**
   * Creates a deep copy of the matrix.
   *
   * @returns {CompressedSparseRowMatrix} A new CompressedSparseRowMatrix instance with the same data.
   */
  clone() {
    // TypedArrays have a `slice()` method that creates a shallow copy, which is
    // a deep copy for primitive types like numbers.
    return new CompressedSparseRowMatrix(
      this.rows,
      this.cols,
      this.values.slice(),
      this.colIndices.slice(),
      this.rowPtr.slice()
    );
  }
}
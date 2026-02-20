/**
 * @file src/preconditioners/jacobi.js
 * @description Implements the Jacobi (or Diagonal) preconditioner.
 *
 * The Jacobi preconditioner is one of the simplest preconditioning strategies.
 * It is defined as a diagonal matrix `P` where the diagonal entries are the
 * reciprocals of the diagonal entries of the original matrix `A`.
 *
 *   P_ii = 1 / A_ii
 *   P_ij = 0   for i != j
 *
 * Applying this preconditioner involves solving the system `Pz = r`, which simplifies
 * to a component-wise division: `z_i = r_i / A_ii`.
 *
 * This preconditioner is computationally cheap to construct and apply. It is most
 * effective for matrices that are strictly or strongly diagonally dominant.
 * For matrices with zero or near-zero diagonal entries, it can be unstable or
 * ineffective, and a small tolerance (`epsilon`) is used to prevent division by zero.
 */

import { fill } from '../utils/vector-ops.js';
import { CoordinateListMatrix } from '../formats/coordinate-list.js';
import { CompressedSparseRowMatrix } from '../formats/compressed-sparse-row.js';

/**
 * Implements the Jacobi (Diagonal) preconditioner.
 *
 * This class pre-computes the inverse of the diagonal of a given sparse matrix `A`
 * and provides a method to apply the preconditioning step, which solves `Pz = r`.
 */
export class JacobiPreconditioner {
  /**
   * The inverse of the diagonal of matrix A.
   * @type {Float64Array}
   * @private
   */
  #invDiag;

  /**
   * The number of rows/columns of the matrix.
   * @type {number}
   * @private
   */
  #size;

  /**
   * Constructs the Jacobi preconditioner for a given matrix `A`.
   *
   * @param {CoordinateListMatrix | CompressedSparseRowMatrix} A - The sparse matrix. Must be square.
   * @param {object} [options={}] - Configuration options.
   * @param {number} [options.epsilon=1e-12] - A small value to prevent division by zero when a diagonal element is close to zero.
   * @throws {Error} If the matrix is not square or not a supported sparse format.
   */
  constructor(A, { epsilon = 1e-12 } = {}) {
    if (!(A instanceof CoordinateListMatrix || A instanceof CompressedSparseRowMatrix)) {
      throw new Error('Matrix must be an instance of CoordinateListMatrix or CompressedSparseRowMatrix.');
    }

    const [rows, cols] = A.shape;
    if (rows !== cols) {
      throw new Error(`Matrix must be square to construct a Jacobi preconditioner. Dimensions found: ${rows}x${cols}.`);
    }

    this.#size = rows;
    this.#invDiag = this.#extractInverseDiagonal(A, epsilon);
  }

  /**
   * Extracts the inverse of the diagonal from the matrix `A`.
   *
   * @param {CoordinateListMatrix | CompressedSparseRowMatrix} A - The sparse matrix.
   * @param {number} epsilon - Small tolerance for division.
   * @returns {Float64Array} A vector containing the reciprocal of the diagonal elements of `A`.
   * @private
   */
  #extractInverseDiagonal(A, epsilon) {
    const invDiag = fill(this.#size, 0.0);

    if (A instanceof CompressedSparseRowMatrix) {
      // Optimized path for CSR format
      for (let i = 0; i < this.#size; i++) {
        const rowStart = A.rowPtr[i];
        const rowEnd = A.rowPtr[i + 1];
        for (let j = rowStart; j < rowEnd; j++) {
          if (A.colIndices[j] === i) {
            const diagValue = A.values[j];
            invDiag[i] = Math.abs(diagValue) < epsilon ? 0.0 : 1.0 / diagValue;
            break; // Found diagonal element for this row
          }
        }
      }
    } else { // CoordinateListMatrix
      for (let i = 0; i < A.nnz; i++) {
        if (A.rowIndices[i] === A.colIndices[i]) {
          const diagIndex = A.rowIndices[i];
          const diagValue = A.values[i];
          // In COO, duplicates might exist; we take the last one found.
          // For a valid matrix, duplicates for the same (i,i) should be summed up
          // during conversion to CSR, but we handle this robustly.
          invDiag[diagIndex] = Math.abs(diagValue) < epsilon ? 0.0 : 1.0 / diagValue;
        }
      }
    }

    return invDiag;
  }

  /**
   * Applies the preconditioner by solving the system `Pz = r`.
   * For the Jacobi preconditioner, this is an element-wise operation: `z = M_inv * r`,
   * where `M_inv` is the pre-computed inverse diagonal.
   *
   * @param {number[] | Float64Array} r - The residual vector.
   * @returns {Float64Array} The solution vector `z`.
   * @throws {Error} If the residual vector `r` has an incorrect length.
   */
  apply(r) {
    if (r.length !== this.#size) {
      throw new Error(`Dimension mismatch: Preconditioner is size ${this.#size}, but residual vector has length ${r.length}.`);
    }

    const z = new Float64Array(this.#size);
    for (let i = 0; i < this.#size; i++) {
      z[i] = this.#invDiag[i] * r[i];
    }
    return z;
  }

  /**
   * Solves the system `Pz = r` in-place.
   * Modifies the input vector `z` to store the result.
   *
   * @param {Float64Array} z - The vector to apply the preconditioner to. On input, this is the residual `r`. On output, it is the solution `z`.
   * @throws {Error} If the vector `z` has an incorrect length.
   */
  solve(z) {
    if (z.length !== this.#size) {
        throw new Error(`Dimension mismatch: Preconditioner is size ${this.#size}, but vector has length ${z.length}.`);
    }

    for (let i = 0; i < this.#size; i++) {
        z[i] *= this.#invDiag[i];
    }
  }
}
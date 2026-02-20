/**
 * @file src/solvers/gmres.js
 * @description Core implementation of the Generalized Minimal Residual (GMRES) iterative solver, including the Arnoldi iteration process.
 *
 * The Generalized Minimal Residual (GMRES) method is an iterative algorithm for solving
 * systems of linear equations `Ax = b`, particularly effective for large, sparse, and
 * non-symmetric matrices. Unlike the Conjugate Gradient method, GMRES does not require
 * the matrix `A` to be symmetric or positive-definite.
 *
 * The core idea of GMRES is to find an approximate solution `x_m` from a Krylov subspace
 * `K_m(A, r_0)` that minimizes the Euclidean norm of the residual `||b - Ax_m||`.
 * This is achieved by constructing an orthonormal basis for the Krylov subspace using
 * the Arnoldi iteration process.
 *
 * The memory and computational cost of GMRES grows with each iteration. To manage this,
 * a "restarted" version (GMRES(m)) is commonly used, where the algorithm is restarted
 * every `m` iterations. This implementation uses the restarted approach.
 *
 * Key components:
 * - **Arnoldi Iteration:** Builds an orthonormal basis `Q` for the Krylov subspace and a
 *   Hessenberg matrix `H` such that `AQ = QH`.
 * - **Givens Rotations:** Used to solve the least-squares problem `||H_m * y - beta * e_1||`
 *   efficiently by transforming `H_m` into an upper triangular matrix.
 * - **Restarting:** Limits the size of the Krylov subspace to control memory usage.
 */

import {
  dot,
  norm,
  sub,
  add,
  scale,
  clone,
  fill
} from '../utils/vector-ops.js';
import {
  CoordinateListMatrix
} from '../formats/coordinate-list.js';
import {
  CompressedSparseRowMatrix
} from '../formats/compressed-sparse-row.js';
import {
  JacobiPreconditioner
} from '../preconditioners/jacobi.js';

/**
 * Validates the inputs for the GMRES solver.
 * @param {CoordinateListMatrix | CompressedSparseRowMatrix} A - The matrix.
 * @param {Float64Array | number[]} b - The right-hand side vector.
 * @throws {Error} If inputs are invalid.
 * @private
 */
const validateInputs = (A, b) => {
  if (!(A instanceof CoordinateListMatrix || A instanceof CompressedSparseRowMatrix)) {
    throw new Error('Matrix `A` must be an instance of CoordinateListMatrix or CompressedSparseRowMatrix.');
  }

  const [rows, cols] = A.shape;
  if (rows !== cols) {
    throw new Error(`Matrix \`A\` must be square. Dimensions found: ${rows}x${cols}.`);
  }
  if (rows !== b.length) {
    throw new Error(`Dimension mismatch: Matrix has ${rows} rows, but vector 'b' has length ${b.length}.`);
  }
};

/**
 * Applies a sequence of Givens rotations to a column of the Hessenberg matrix.
 * This is used to maintain the upper triangular structure of the R matrix in the QR factorization of H.
 * @param {Float64Array} h_col - The j-th column of the Hessenberg matrix H.
 * @param {Array<{c: number, s: number}>} givens - Array of Givens rotation parameters (cosine and sine).
 * @param {number} j - The current column index.
 * @private
 */
const applyGivensRotation = (h_col, givens, j) => {
  for (let i = 0; i < j; i++) {
    const {
      c,
      s
    } = givens[i];
    const h_i = h_col[i];
    const h_ip1 = h_col[i + 1];
    h_col[i] = c * h_i + s * h_ip1;
    h_col[i + 1] = -s * h_i + c * h_ip1;
  }
};

/**
 * Solves the system of linear equations Ax = b using the restarted Generalized Minimal Residual (GMRES) method.
 *
 * This method is suitable for non-symmetric and non-positive-definite square matrices.
 *
 * @param {CoordinateListMatrix | CompressedSparseRowMatrix} A - The n x n sparse matrix of the system.
 * @param {Float64Array | number[]} b - The n-dimensional right-hand side vector.
 * @param {object} [options={}] - Configuration options for the solver.
 * @param {Float64Array | number[]} [options.x0=null] - The initial guess for the solution vector `x`. If not provided, a zero vector is used.
 * @param {number} [options.tolerance=1e-6] - The convergence tolerance. The iteration stops when the relative residual norm `||b - Ax|| / ||b||` is less than this value.
 * @param {number} [options.maxIterations=1000] - The maximum number of outer iterations (restarts) to perform.
 * @param {number} [options.restart=30] - The number of inner iterations before restarting (the size of the Krylov subspace).
 * @param {JacobiPreconditioner} [options.preconditioner=null] - An optional preconditioner to accelerate convergence.
 * @returns {Promise<{ solution: Float64Array, iterations: number, residualNorm: number }>} A promise that resolves to an object containing the solution vector `x`, the total number of inner iterations performed, and the final residual norm.
 */
export async function gmres(A, b, options = {}) {
  validateInputs(A, b);

  const {
    x0 = null,
      tolerance = 1e-6,
      maxIterations = 1000,
      restart = 30,
      preconditioner = null,
  } = options;

  const n = A.shape[0];
  const m = Math.min(restart, n);

  // Initialize solution vector x
  const x = x0 ? clone(x0) : fill(n);
  if (x.length !== n) {
    throw new Error(`Initial guess 'x0' has incorrect length ${x.length}; expected ${n}.`);
  }

  const bNorm = norm(b);
  if (bNorm === 0) {
    // If b is a zero vector, the solution is a zero vector.
    return {
      solution: fill(n),
      iterations: 0,
      residualNorm: 0
    };
  }
  const convergenceThreshold = tolerance * bNorm;

  let totalIterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    // r = b - A*x (initial residual for this restart cycle)
    const r = sub(b, A.multiply(x));

    // Apply preconditioner if available: r_precond = M⁻¹r
    const r_precond = preconditioner ? preconditioner.apply(r) : r;

    const rNorm = norm(r_precond);

    // Check for convergence at the beginning of the restart cycle
    if (rNorm < convergenceThreshold) {
      return {
        solution: x,
        iterations: totalIterations,
        residualNorm: norm(r)
      };
    }

    // Initialize Arnoldi iteration
    const Q = new Array(m + 1); // Orthonormal basis for Krylov subspace
    const H = new Array(m + 1).fill(0).map(() => new Float64Array(m)); // Hessenberg matrix
    const givens = new Array(m); // Store Givens rotation parameters
    const g = fill(m + 1); // Right-hand side of the least-squares problem

    // q_0 = r / ||r||
    Q[0] = scale(r_precond, 1.0 / rNorm);
    g[0] = rNorm;

    // Arnoldi process to build orthonormal basis Q and Hessenberg matrix H
    for (let j = 0; j < m; j++) {
      totalIterations++;

      // w = A * q_j
      const w_unprecond = A.multiply(Q[j]);
      // w = M⁻¹ * A * q_j
      const w = preconditioner ? preconditioner.apply(w_unprecond) : w_unprecond;

      const h_col = H[j];

      // Modified Gram-Schmidt to orthogonalize w against previous q_i
      for (let i = 0; i <= j; i++) {
        h_col[i] = dot(w, Q[i]);
        for (let k = 0; k < n; k++) {
          w[k] -= h_col[i] * Q[i][k];
        }
      }

      const h_jp1_j = norm(w);
      H[j + 1][j] = h_jp1_j;

      // Apply previous Givens rotations to the new column of H
      applyGivensRotation(h_col, givens, j);

      // Calculate new Givens rotation for the current column
      const h_j_j = h_col[j];
      const denom = Math.sqrt(h_j_j * h_j_j + h_jp1_j * h_jp1_j);

      if (denom < 1e-14) {
        // Lucky breakdown: the subspace is invariant. We can solve exactly.
        // This is rare in practice. We'll proceed to solve with the current basis.
        m = j + 1; // Truncate the process
        break;
      }

      const c = h_j_j / denom;
      const s = h_jp1_j / denom;
      givens[j] = {
        c,
        s
      };

      // Apply new rotation to H and g
      h_col[j] = c * h_j_j + s * h_jp1_j; // This becomes `denom`
      H[j + 1][j] = 0.0;

      g[j + 1] = -s * g[j];
      g[j] = c * g[j];

      // Check for convergence using the updated residual norm from g
      const currentResidualNorm = Math.abs(g[j + 1]);
      if (currentResidualNorm < convergenceThreshold) {
        m = j + 1; // Truncate and solve
        break;
      }

      // q_{j+1} = w / ||w||
      if (h_jp1_j > 1e-14) {
        Q[j + 1] = scale(w, 1.0 / h_jp1_j);
      } else {
        // Breakdown, subspace is invariant.
        m = j + 1;
        break;
      }
    }

    // Solve the upper triangular system Hy = g for the least-squares solution y
    const y = fill(m);
    for (let i = m - 1; i >= 0; i--) {
      let sum = 0.0;
      for (let j = i + 1; j < m; j++) {
        sum += H[j][i] * y[j];
      }
      y[i] = (g[i] - sum) / H[i][i];
    }

    // Update the solution: x = x + Q_m * y
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) {
        x[i] += Q[j][i] * y[j];
      }
    }

    // Final check after the full restart cycle
    const finalResidual = sub(b, A.multiply(x));
    const finalResidualNorm = norm(finalResidual);
    if (finalResidualNorm < convergenceThreshold) {
      return {
        solution: x,
        iterations: totalIterations,
        residualNorm: finalResidualNorm
      };
    }
  }

  const finalResidual = sub(b, A.multiply(x));
  const finalResidualNorm = norm(finalResidual);
  console.warn(`GMRES did not converge within ${maxIterations} restarts. Final residual norm: ${finalResidualNorm}`);

  return {
    solution: x,
    iterations: totalIterations,
    residualNorm: finalResidualNorm,
  };
}
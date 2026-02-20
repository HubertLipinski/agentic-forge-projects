/**
 * @file src/solvers/conjugate-gradient.js
 * @description Core implementation of the Conjugate Gradient iterative solver algorithm.
 *
 * The Conjugate Gradient (CG) method is an efficient iterative algorithm for solving
 * systems of linear equations `Ax = b` where the matrix `A` is symmetric and
 * positive-definite. It is one of the most popular iterative methods due to its
 * excellent convergence properties for this class of problems.
 *
 * The algorithm iteratively generates a sequence of approximate solutions `x_k` that
 * converge to the true solution. It minimizes the A-norm of the error by searching
 * along A-orthogonal (conjugate) directions.
 *
 * Algorithm Steps:
 * 1. Initialize:
 *    x_0 = initial guess (often a zero vector)
 *    r_0 = b - A * x_0  (initial residual)
 *    p_0 = r_0          (initial search direction)
 * 2. Iterate for k = 0, 1, 2, ...
 *    alpha_k = (r_k^T * r_k) / (p_k^T * A * p_k)
 *    x_{k+1} = x_k + alpha_k * p_k
 *    r_{k+1} = r_k - alpha_k * A * p_k
 *    Check for convergence: if ||r_{k+1}|| is small enough, stop.
 *    beta_k = (r_{k+1}^T * r_{k+1}) / (r_k^T * r_k)
 *    p_{k+1} = r_{k+1} + beta_k * p_k
 *
 * This implementation supports preconditioning to accelerate convergence. When a
 * preconditioner `M` is used, the algorithm solves the equivalent system `M⁻¹Ax = M⁻¹b`.
 * The preconditioned algorithm replaces `r_k` with `z_k = M⁻¹r_k` in key steps.
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
 * Validates the inputs for the conjugateGradient solver.
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
    throw new Error(`Matrix `A` must be square. Dimensions found: ${rows}x${cols}.`);
  }
  if (rows !== b.length) {
    throw new Error(`Dimension mismatch: Matrix has ${rows} rows, but vector 'b' has length ${b.length}.`);
  }
};

/**
 * Solves the system of linear equations Ax = b using the Conjugate Gradient method.
 *
 * This method is suitable for symmetric, positive-definite matrices. For non-symmetric
 * matrices, consider using the GMRES solver.
 *
 * @param {CoordinateListMatrix | CompressedSparseRowMatrix} A - The n x n sparse matrix of the system. Must be symmetric and positive-definite.
 * @param {Float64Array | number[]} b - The n-dimensional right-hand side vector.
 * @param {object} [options={}] - Configuration options for the solver.
 * @param {Float64Array | number[]} [options.x0=null] - The initial guess for the solution vector `x`. If not provided, a zero vector is used.
 * @param {number} [options.tolerance=1e-6] - The convergence tolerance. The iteration stops when the L2 norm of the residual is less than this value.
 * @param {number} [options.maxIterations=1000] - The maximum number of iterations to perform.
 * @param {JacobiPreconditioner} [options.preconditioner=null] - An optional preconditioner to accelerate convergence.
 * @returns {Promise<{ solution: Float64Array, iterations: number, residualNorm: number }>} A promise that resolves to an object containing the solution vector `x`, the number of iterations performed, and the final residual norm.
 */
export async function conjugateGradient(A, b, options = {}) {
  validateInputs(A, b);

  const {
    x0 = null,
      tolerance = 1e-6,
      maxIterations = 1000,
      preconditioner = null,
  } = options;

  const n = A.shape[0];

  // Initialize solution vector x
  const x = x0 ? clone(x0) : fill(n);
  if (x.length !== n) {
    throw new Error(`Initial guess 'x0' has incorrect length ${x.length}; expected ${n}.`);
  }

  // r = b - A*x (initial residual)
  const Ax = A.multiply(x);
  const r = sub(b, Ax);

  // p = z (initial search direction)
  // where z = M⁻¹r if preconditioned, otherwise z = r
  let p;
  let z = null;
  if (preconditioner) {
    z = preconditioner.apply(r);
    p = z;
  } else {
    p = clone(r);
  }

  // rho = rᵀ * z (or rᵀ * r if not preconditioned)
  let rho = preconditioner ? dot(r, z) : dot(r, r);

  const bNorm = norm(b);
  const convergenceThreshold = tolerance * bNorm;

  for (let k = 0; k < maxIterations; k++) {
    const rNorm = norm(r);
    if (rNorm < convergenceThreshold) {
      return {
        solution: x,
        iterations: k,
        residualNorm: rNorm
      };
    }

    // Ap = A * p
    const Ap = A.multiply(p);

    // alpha = rho / (pᵀ * Ap)
    const pAp = dot(p, Ap);
    if (Math.abs(pAp) < 1e-14) {
      // This can happen if the matrix is not positive-definite or due to numerical instability.
      // The search direction is (nearly) A-orthogonal to itself.
      console.warn(`CG breakdown: pᵀ*A*p is close to zero at iteration ${k}. The matrix may not be positive-definite.`);
      return {
        solution: x,
        iterations: k,
        residualNorm: rNorm
      };
    }
    const alpha = rho / pAp;

    // x = x + alpha * p
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
    }

    // r = r - alpha * Ap
    for (let i = 0; i < n; i++) {
      r[i] -= alpha * Ap[i];
    }

    // rho_new = r_newᵀ * z_new
    let rhoNew;
    if (preconditioner) {
      preconditioner.solve(r); // r becomes z_new = M⁻¹r_new
      z = r; // z now holds the result
      rhoNew = dot(r, z);
    } else {
      rhoNew = dot(r, r);
    }

    // beta = rho_new / rho
    const beta = rhoNew / rho;

    // p = z + beta * p
    if (preconditioner) {
      // p = z + beta * p
      for (let i = 0; i < n; i++) {
        p[i] = z[i] + beta * p[i];
      }
    } else {
      // p = r + beta * p
      for (let i = 0; i < n; i++) {
        p[i] = r[i] + beta * p[i];
      }
    }

    rho = rhoNew;
  }

  const finalResidualNorm = norm(r);
  console.warn(`Conjugate Gradient did not converge within ${maxIterations} iterations. Final residual norm: ${finalResidualNorm}`);

  return {
    solution: x,
    iterations: maxIterations,
    residualNorm: finalResidualNorm,
  };
}
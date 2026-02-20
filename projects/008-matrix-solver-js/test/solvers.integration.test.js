/**
 * @file test/solvers.integration.test.js
 * @description Integration tests for the iterative solvers (Conjugate Gradient and GMRES).
 *
 * These tests solve known, small-scale linear systems (Ax=b) and verify that the
 * computed solution `x` is close to the exact, known solution. This validates the
 * end-to-end correctness of the solver implementations, including their interaction
 * with matrix formats and vector operations.
 *
 * The tests cover:
 * - Conjugate Gradient (CG) for a symmetric positive-definite matrix.
 * - CG with a Jacobi preconditioner.
 * - Generalized Minimal Residual (GMRES) for a non-symmetric matrix.
 * - GMRES with a Jacobi preconditioner.
 * - Edge cases like zero vectors and matrices.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { conjugateGradient } from '../src/solvers/conjugate-gradient.js';
import { gmres } from '../src/solvers/gmres.js';
import { CompressedSparseRowMatrix } from '../src/formats/compressed-sparse-row.js';
import { CoordinateListMatrix } from '../src/formats/coordinate-list.js';
import { JacobiPreconditioner } from '../src/preconditioners/jacobi.js';
import { norm, sub } from '../src/utils/vector-ops.js';

/**
 * A small, symmetric positive-definite matrix for testing Conjugate Gradient.
 * A = [[ 4,  1],
 *      [ 1,  3]]
 */
const spdMatrix = new CompressedSparseRowMatrix(
  2, 2,
  new Float64Array([4, 1, 1, 3]),
  new Int32Array([0, 1, 0, 1]),
  new Int32Array([0, 2, 4])
);

/**
 * A small, non-symmetric matrix for testing GMRES.
 * A = [[ 1,  4,  0],
 *      [-1, -3,  1],
 *      [ 0,  2,  5]]
 */
const nonSymmetricMatrix = new CompressedSparseRowMatrix(
  3, 3,
  new Float64Array([1, 4, -1, -3, 1, 2, 5]),
  new Int32Array([0, 1, 0, 1, 2, 1, 2]),
  new Int32Array([0, 2, 5, 7])
);


/**
 * Asserts that two vectors are approximately equal element-wise.
 * @param {Float64Array | number[]} actual - The computed vector.
 * @param {Float64Array | number[]} expected - The expected vector.
 * @param {number} tolerance - The maximum allowed difference for each element.
 * @param {string} message - A message to display on failure.
 */
function assertVectorsAlmostEqual(actual, expected, tolerance, message) {
  assert.strictEqual(actual.length, expected.length, `${message}: Vector lengths do not match.`);
  const error = norm(sub(actual, expected));
  assert(error < tolerance, `${message}: Vectors are not close enough. Error norm: ${error}, tolerance: ${tolerance}`);
}

describe('Solver Integration Tests', () => {

  describe('Conjugate Gradient (CG)', () => {
    // For A = [[4, 1], [1, 3]], let the exact solution be x = [1, 2].
    // Then b = A*x = [[4*1 + 1*2], [1*1 + 3*2]] = [6, 7].
    const b_spd = new Float64Array([6, 7]);
    const expected_x_spd = new Float64Array([1, 2]);

    test('should solve a simple 2x2 SPD system without a preconditioner', async () => {
      const { solution } = await conjugateGradient(spdMatrix, b_spd, {
        tolerance: 1e-9,
        maxIterations: 10,
      });

      assertVectorsAlmostEqual(solution, expected_x_spd, 1e-8, 'CG solution without preconditioner');
    });

    test('should solve a simple 2x2 SPD system using a COO matrix', async () => {
        const cooMatrix = new CoordinateListMatrix(2, 2, [
            { row: 0, col: 0, value: 4 },
            { row: 0, col: 1, value: 1 },
            { row: 1, col: 0, value: 1 },
            { row: 1, col: 1, value: 3 },
        ]);
        const { solution } = await conjugateGradient(cooMatrix, b_spd, {
            tolerance: 1e-9,
            maxIterations: 10,
        });

        assertVectorsAlmostEqual(solution, expected_x_spd, 1e-8, 'CG solution with COO matrix');
    });

    test('should solve a simple 2x2 SPD system with a Jacobi preconditioner', async () => {
      const preconditioner = new JacobiPreconditioner(spdMatrix);
      const { solution, iterations } = await conjugateGradient(spdMatrix, b_spd, {
        tolerance: 1e-9,
        maxIterations: 10,
        preconditioner,
      });

      assertVectorsAlmostEqual(solution, expected_x_spd, 1e-8, 'CG solution with Jacobi preconditioner');
      // Preconditioning should ideally converge in fewer or same iterations for this simple case.
      assert(iterations <= 5, `Expected fast convergence with preconditioner, but took ${iterations} iterations.`);
    });

    test('should handle a zero b vector, returning a zero solution', async () => {
        const b_zero = new Float64Array([0, 0]);
        const expected_x_zero = new Float64Array([0, 0]);
        const { solution, iterations } = await conjugateGradient(spdMatrix, b_zero);

        assertVectorsAlmostEqual(solution, expected_x_zero, 1e-12, 'CG with zero b vector');
        assert.strictEqual(iterations, 0, 'CG with zero b vector should converge in 0 iterations');
    });
  });

  describe('Generalized Minimal Residual (GMRES)', () => {
    // For A = [[1, 4, 0], [-1, -3, 1], [0, 2, 5]], let the exact solution be x = [1, 2, 3].
    // Then b = A*x = [[1*1 + 4*2 + 0*3], [-1*1 - 3*2 + 1*3], [0*1 + 2*2 + 5*3]] = [9, -4, 19].
    const b_nonsym = new Float64Array([9, -4, 19]);
    const expected_x_nonsym = new Float64Array([1, 2, 3]);

    test('should solve a simple 3x3 non-symmetric system without a preconditioner', async () => {
      const { solution } = await gmres(nonSymmetricMatrix, b_nonsym, {
        tolerance: 1e-9,
        maxIterations: 10,
        restart: 5,
      });

      assertVectorsAlmostEqual(solution, expected_x_nonsym, 1e-8, 'GMRES solution without preconditioner');
    });

    test('should solve a simple 3x3 non-symmetric system with a Jacobi preconditioner', async () => {
      const preconditioner = new JacobiPreconditioner(nonSymmetricMatrix);
      const { solution, iterations } = await gmres(nonSymmetricMatrix, b_nonsym, {
        tolerance: 1e-9,
        maxIterations: 10,
        restart: 5,
        preconditioner,
      });

      assertVectorsAlmostEqual(solution, expected_x_nonsym, 1e-8, 'GMRES solution with Jacobi preconditioner');
      assert(iterations <= 5, `Expected fast convergence with preconditioner, but took ${iterations} iterations.`);
    });

    test('should handle a zero b vector, returning a zero solution', async () => {
        const b_zero = new Float64Array([0, 0, 0]);
        const expected_x_zero = new Float64Array([0, 0, 0]);
        const { solution, iterations } = await gmres(nonSymmetricMatrix, b_zero);

        assertVectorsAlmostEqual(solution, expected_x_zero, 1e-12, 'GMRES with zero b vector');
        assert.strictEqual(iterations, 0, 'GMRES with zero b vector should converge in 0 iterations');
    });

    test('should converge for a system where x0 is the exact solution', async () => {
        const { solution, iterations, residualNorm } = await gmres(nonSymmetricMatrix, b_nonsym, {
            x0: expected_x_nonsym,
            tolerance: 1e-9,
        });

        assertVectorsAlmostEqual(solution, expected_x_nonsym, 1e-12, 'GMRES with exact initial guess');
        // It should converge in the first check, before the first iteration.
        assert.strictEqual(iterations, 0, 'GMRES with exact x0 should take 0 iterations');
        assert(residualNorm < 1e-9, 'Residual norm should be near zero for exact solution');
    });
  });

  describe('Solver Input Validation', () => {
    test('should throw an error if matrix and vector dimensions mismatch', async () => {
      const b_wrong_size = new Float64Array([1, 2, 3]);
      await assert.rejects(
        conjugateGradient(spdMatrix, b_wrong_size),
        /Dimension mismatch: Matrix has 2 rows, but vector 'b' has length 3/
      );
      await assert.rejects(
        gmres(spdMatrix, b_wrong_size),
        /Dimension mismatch: Matrix has 2 rows, but vector 'b' has length 3/
      );
    });

    test('should throw an error if the matrix is not square', async () => {
      const nonSquareMatrix = new CompressedSparseRowMatrix(
        2, 3,
        new Float64Array([1, 2, 3]),
        new Int32Array([0, 1, 2]),
        new Int32Array([0, 1, 3])
      );
      const b = new Float64Array([1, 2]);

      await assert.rejects(
        conjugateGradient(nonSquareMatrix, b),
        /Matrix `A` must be square. Dimensions found: 2x3/
      );
      await assert.rejects(
        gmres(nonSquareMatrix, b),
        /Matrix `A` must be square. Dimensions found: 2x3/
      );
    });

    test('should throw an error for invalid initial guess x0 length', async () => {
        const b = new Float64Array([1, 2]);
        const x0_wrong_size = new Float64Array([1, 2, 3]);
        await assert.rejects(
            conjugateGradient(spdMatrix, b, { x0: x0_wrong_size }),
            /Initial guess 'x0' has incorrect length 3; expected 2/
        );
        await assert.rejects(
            gmres(spdMatrix, b, { x0: x0_wrong_size }),
            /Initial guess 'x0' has incorrect length 3; expected 2/
        );
    });
  });
});
/**
 * @file examples/programmatic-usage.js
 * @description Demonstrates how to use the matrix-solver-js library programmatically.
 *
 * This example script showcases the core functionality of the library:
 * 1. Defining a sparse matrix and a vector `b`.
 * 2. Creating a matrix in Coordinate List (COO) format.
 * 3. Converting the matrix to the more efficient Compressed Sparse Row (CSR) format.
 * 4. Setting up a Jacobi preconditioner to accelerate convergence.
 * 5. Solving the system `Ax=b` using both the Conjugate Gradient (CG) and GMRES solvers.
 * 6. Displaying the results, including the solution, iterations, and performance metrics.
 */

// Import necessary classes and functions from the library.
// In a real project, you would use `import { ... } from 'matrix-solver-js';`
import {
  CoordinateListMatrix,
  CompressedSparseRowMatrix,
  JacobiPreconditioner,
  conjugateGradient,
  gmres,
} from '../src/index.js';
import { performance } from 'perf_hooks';

/**
 * A helper function to pretty-print a vector to the console.
 * @param {string} label - A descriptive label for the vector.
 * @param {Float64Array | number[]} vector - The vector to print.
 * @param {number} [limit=10] - The maximum number of elements to display.
 */
function printVector(label, vector, limit = 10) {
  const elements = Array.from(vector.slice(0, limit))
    .map(v => v.toFixed(4))
    .join(', ');
  const ellipsis = vector.length > limit ? '...' : '';
  console.log(`  ${label.padEnd(12)} [${elements}${ellipsis}]`);
}

/**
 * A helper function to display solver results in a structured format.
 * @param {string} solverName - The name of the solver.
 * @param {object} result - The result object from the solver.
 * @param {number} duration - The time taken by the solver in milliseconds.
 */
function printResults(solverName, result, duration) {
  console.log(`\n--- ${solverName} Results ---`);
  console.log(`  Converged:      ${result.residualNorm < 1e-6 ? 'Yes' : 'No'}`);
  console.log(`  Iterations:     ${result.iterations}`);
  console.log(`  Final Residual: ${result.residualNorm.toExponential(4)}`);
  console.log(`  Solver Time:    ${(duration / 1000).toFixed(4)}s`);
  printVector('Solution x:', result.solution);
  console.log('--------------------' + '-'.repeat(solverName.length));
}

/**
 * Main function to demonstrate the library's usage.
 */
async function main() {
  console.log('Matrix Solver JS - Programmatic Usage Example');
  console.log('=============================================\n');

  // --- 1. Define the Linear System (Ax = b) ---
  // We will solve a simple 5x5 system.
  //
  //      [10, -1,  2,  0,  0] [x1]   [ 6]
  //      [-1, 11, -1,  3,  0] [x2]   [25]
  // A =  [ 2, -1, 10, -1,  0] [x3] = [-11]
  //      [ 0,  3, -1,  8, -1] [x4]   [15]
  //      [ 0,  0,  0, -1,  5] [x5]   [-27]
  //
  // The exact solution is x = [1, 2, -1, 1, -5]ᵀ.
  // The matrix A is symmetric and positive-definite, making it suitable for Conjugate Gradient.

  const matrixSize = 5;
  const matrixEntries = [
    { row: 0, col: 0, value: 10 }, { row: 0, col: 1, value: -1 }, { row: 0, col: 2, value: 2 },
    { row: 1, col: 0, value: -1 }, { row: 1, col: 1, value: 11 }, { row: 1, col: 2, value: -1 }, { row: 1, col: 3, value: 3 },
    { row: 2, col: 0, value: 2 },  { row: 2, col: 1, value: -1 }, { row: 2, col: 2, value: 10 }, { row: 2, col: 3, value: -1 },
    { row: 3, col: 1, value: 3 },  { row: 3, col: 2, value: -1 }, { row: 3, col: 3, value: 8 },  { row: 3, col: 4, value: -1 },
    { row: 4, col: 3, value: -1 }, { row: 4, col: 4, value: 5 },
  ];

  const b = new Float64Array([6, 25, -11, 15, -27]);

  console.log('System defined: 5x5 matrix A and vector b.');
  printVector('Vector b:', b);

  try {
    // --- 2. Create a Sparse Matrix ---
    // Start with the easy-to-construct Coordinate List (COO) format.
    const cooMatrix = new CoordinateListMatrix(matrixSize, matrixSize, matrixEntries);
    console.log(`\nMatrix created in COO format with ${cooMatrix.nnz} non-zero elements.`);

    // For performance, convert to Compressed Sparse Row (CSR) format.
    // This is highly recommended before passing the matrix to a solver.
    const A = CompressedSparseRowMatrix.fromCoordinateList(cooMatrix);
    console.log('Matrix converted to CSR format for efficient multiplication.');

    // --- 3. Set up a Preconditioner (Optional) ---
    // A preconditioner can significantly speed up convergence. The Jacobi (or Diagonal)
    // preconditioner is simple and effective for diagonally dominant matrices like this one.
    const preconditioner = new JacobiPreconditioner(A);
    console.log('Jacobi preconditioner created.');

    // --- 4. Solve using Conjugate Gradient (for symmetric positive-definite matrices) ---
    const cgOptions = {
      tolerance: 1e-9,
      maxIterations: 100,
      preconditioner: preconditioner, // Using the preconditioner
    };

    let startTime = performance.now();
    const cgResult = await conjugateGradient(A, b, cgOptions);
    let duration = performance.now() - startTime;
    printResults('Conjugate Gradient', cgResult, duration);

    // --- 5. Solve using GMRES (for general square matrices) ---
    // GMRES is more general and also works for this system.
    const gmresOptions = {
      tolerance: 1e-9,
      maxIterations: 10, // Max outer restarts
      restart: 5,        // Krylov subspace size
      preconditioner: preconditioner,
    };

    startTime = performance.now();
    const gmresResult = await gmres(A, b, gmresOptions);
    duration = performance.now() - startTime;
    printResults('GMRES', gmresResult, duration);

  } catch (error) {
    console.error('\n[ERROR] An unexpected error occurred during the demonstration:');
    console.error(error);
    process.exit(1);
  }
}

// Run the main demonstration function.
main();
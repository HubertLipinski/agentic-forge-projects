/**
 * @file src/index.js
 * @description Main library entry point for the Matrix Solver JS project.
 *
 * This file serves as the public API for the library, exporting the core
 * functionalities required for programmatic use. It allows users to construct
 * sparse matrices, configure preconditioners, and solve linear systems
 * using the provided iterative solvers (Conjugate Gradient and GMRES).
 *
 * By re-exporting from the internal module structure, this file provides a
 * clean and consolidated interface for developers integrating `matrix-solver-js`
 * into their own applications.
 *
 * @module matrix-solver-js
 *
 * @example
 * import {
 *   CompressedSparseRowMatrix,
 *   CoordinateListMatrix,
 *   JacobiPreconditioner,
 *   conjugateGradient,
 *   gmres
 * } from 'matrix-solver-js';
 *
 * // For more detailed examples, see `examples/programmatic-usage.js`
 */

// --- Sparse Matrix Formats ---
// Export the primary sparse matrix format classes.
// CoordinateListMatrix is useful for building matrices, while
// CompressedSparseRowMatrix is optimized for performance.
export { CoordinateListMatrix } from './formats/coordinate-list.js';
export { CompressedSparseRowMatrix } from './formats/compressed-sparse-row.js';

// --- Preconditioners ---
// Export available preconditioning strategies.
// Preconditioners are crucial for accelerating the convergence of iterative solvers.
export { JacobiPreconditioner } from './preconditioners/jacobi.js';

// --- Iterative Solvers ---
// Export the core solver functions.
// `conjugateGradient` is for symmetric positive-definite systems.
// `gmres` is a general-purpose solver for non-symmetric systems.
export { conjugateGradient } from './solvers/conjugate-gradient.js';
export { gmres } from './solvers/gmres.js';

// --- Utility Functions ---
// Export vector operations for advanced users who may need to perform
// custom vector manipulations or analysis. These are the building blocks
// for the solvers.
export {
  dot,
  norm,
  add,
  sub,
  scale,
  clone,
  fill
} from './utils/vector-ops.js';

// --- CLI-related Parsers ---
// Exporting parsers can be useful for users who want to work with
// Matrix Market files programmatically without using the CLI.
export { parseMtxFile, parseVectorFile } from './cli/parser.js';
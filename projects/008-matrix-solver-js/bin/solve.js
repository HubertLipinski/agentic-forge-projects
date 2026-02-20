#!/usr/bin/env node

/**
 * @file bin/solve.js
 * @description The executable CLI script for the Matrix Solver JS project.
 *
 * This script uses `yargs` to parse command-line arguments, reads a sparse matrix
 * and a vector from files, selects an iterative solver, and runs it to find the
 * solution to the linear system Ax=b. It reports the results, including convergence
 * status, iterations, final residual norm, and total execution time.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { performance } from 'perf_hooks';
import { writeFile } from 'fs/promises';

import { parseMtxFile, parseVectorFile } from '../src/cli/parser.js';
import { CompressedSparseRowMatrix } from '../src/formats/compressed-sparse-row.js';
import { JacobiPreconditioner } from '../src/preconditioners/jacobi.js';
import { conjugateGradient } from '../src/solvers/conjugate-gradient.js';
import { gmres } from '../src/solvers/gmres.js';

/**
 * Configures and retrieves command-line arguments using yargs.
 * @returns {object} The parsed command-line arguments.
 */
function getArguments() {
  return yargs(hideBin(process.argv))
    .usage('Usage: $0 -m <matrix_file> -b <vector_file> [options]')
    .scriptName('matrix-solve')
    .command('$0', 'Solve a sparse linear system Ax=b from Matrix Market files.')
    .option('matrix', {
      alias: 'm',
      describe: 'Path to the matrix A file in Matrix Market (.mtx) format',
      type: 'string',
      demandOption: true,
      normalize: true,
    })
    .option('vector', {
      alias: 'b',
      describe: 'Path to the right-hand side vector b file (one value per line)',
      type: 'string',
      demandOption: true,
      normalize: true,
    })
    .option('solver', {
      alias: 's',
      describe: 'The iterative solver to use',
      choices: ['cg', 'gmres'],
      default: 'gmres',
    })
    .option('preconditioner', {
      alias: 'p',
      describe: 'The preconditioner to use',
      choices: ['jacobi', 'none'],
      default: 'none',
    })
    .option('tolerance', {
      alias: 't',
      describe: 'Convergence tolerance for the residual norm',
      type: 'number',
      default: 1e-6,
    })
    .option('max-iterations', {
      alias: 'i',
      describe: 'Maximum number of iterations',
      type: 'number',
      default: 1000,
    })
    .option('gmres-restart', {
      alias: 'r',
      describe: 'Restart parameter for GMRES solver',
      type: 'number',
      default: 30,
    })
    .option('output', {
      alias: 'o',
      describe: 'Path to save the solution vector x. If not provided, prints to console.',
      type: 'string',
      normalize: true,
    })
    .option('quiet', {
      alias: 'q',
      describe: 'Suppress progress and result logging; only output errors or the solution file',
      type: 'boolean',
      default: false,
    })
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'v')
    .strict()
    .epilogue('For more information, visit the project repository.').argv;
}

/**
 * Selects and configures the appropriate solver function based on arguments.
 * @param {string} solverName - The name of the solver ('cg' or 'gmres').
 * @param {object} args - The parsed command-line arguments.
 * @returns {{ solve: Function, options: object }} An object containing the solver function and its options.
 */
function selectSolver(solverName, args) {
  const commonOptions = {
    tolerance: args.tolerance,
    preconditioner: args.preconditionerInstance,
  };

  if (solverName === 'cg') {
    return {
      solve: conjugateGradient,
      options: {
        ...commonOptions,
        maxIterations: args['max-iterations'],
      },
    };
  }

  if (solverName === 'gmres') {
    return {
      solve: gmres,
      options: {
        ...commonOptions,
        maxIterations: args['max-iterations'],
        restart: args['gmres-restart'],
      },
    };
  }

  // This case should be prevented by yargs' `choices` constraint.
  throw new Error(`Internal error: Unknown solver '${solverName}'.`);
}

/**
 * Saves the solution vector to a file.
 * @param {string} filePath - The path to the output file.
 * @param {Float64Array} solution - The solution vector.
 * @returns {Promise<void>}
 */
async function saveSolution(filePath, solution) {
  const content = Array.from(solution).join('\n');
  try {
    await writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write solution to '${filePath}': ${error.message}`);
  }
}

/**
 * The main execution function for the CLI.
 */
export async function main() {
  const startTime = performance.now();
  let args;

  try {
    args = getArguments();
  } catch (err) {
    // Yargs handles its own error logging for invalid arguments.
    // We exit gracefully.
    process.exit(1);
  }

  const log = args.quiet ? () => {} : console.log;

  try {
    log('Matrix Solver JS - CLI');
    log('------------------------');

    // 1. Load data
    log(`Loading matrix from: ${args.matrix}`);
    const cooMatrix = await parseMtxFile(args.matrix);
    log(` -> Matrix loaded: ${cooMatrix.rows}x${cooMatrix.cols}, ${cooMatrix.nnz} non-zero elements.`);

    log(`Loading vector from: ${args.vector}`);
    const b = await parseVectorFile(args.vector);
    log(` -> Vector loaded: ${b.length} elements.`);

    // 2. Prepare for solving
    log('Converting matrix to CSR format for performance...');
    const A = CompressedSparseRowMatrix.fromCoordinateList(cooMatrix);
    log(' -> Conversion complete.');

    // 3. Setup preconditioner
    if (args.preconditioner === 'jacobi') {
      log('Constructing Jacobi preconditioner...');
      args.preconditionerInstance = new JacobiPreconditioner(A);
      log(' -> Preconditioner ready.');
    } else {
      args.preconditionerInstance = null;
    }

    // 4. Select and run solver
    const { solve, options } = selectSolver(args.solver, args);
    const solverName = args.solver.toUpperCase();

    log(`\nSolving Ax=b with ${solverName}...`);
    log('Solver options:', options);

    const solverStartTime = performance.now();
    const result = await solve(A, b, options);
    const solverEndTime = performance.now();

    // 5. Report results
    log('\n--- Solver Results ---');
    const bNorm = b.length > 0 ? Math.sqrt(b.reduce((acc, val) => acc + val * val, 0)) : 1;
    const relativeResidual = bNorm > 0 ? result.residualNorm / bNorm : result.residualNorm;

    const converged = relativeResidual <= args.tolerance;
    log(`Convergence Status: ${converged ? 'Converged' : 'NOT Converged'}`);
    log(`Iterations:         ${result.iterations}`);
    log(`Final Residual Norm:  ${result.residualNorm.toExponential(4)}`);
    log(`Relative Residual:    ${relativeResidual.toExponential(4)} (tolerance: ${args.tolerance.toExponential(4)})`);
    log(`Solver Time:        ${((solverEndTime - solverStartTime) / 1000).toFixed(3)}s`);

    // 6. Handle output
    if (args.output) {
      log(`\nSaving solution to: ${args.output}`);
      await saveSolution(args.output, result.solution);
      log(' -> Solution saved successfully.');
    } else if (!args.quiet) {
      log('\nSolution vector x (first 10 elements):');
      log(result.solution.slice(0, 10));
    }

    const endTime = performance.now();
    log(`\nTotal execution time: ${((endTime - startTime) / 1000).toFixed(3)}s`);

  } catch (error) {
    console.error(`\n[ERROR] ${error.message}`);
    process.exit(1);
  }
}

// Execute the main function if the script is run directly.
// This check prevents the main function from running when this file is imported elsewhere.
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
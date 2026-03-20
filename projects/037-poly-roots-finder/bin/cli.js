#!/usr/bin/env node
'use strict';

/**
 * @fileoverview Command-line interface for the Polynomial Roots Finder library.
 *
 * This script allows users to find the roots of a polynomial by providing its
 * coefficients as command-line arguments. It uses `yargs` for robust argument
 * parsing and `findRoots` from the main library to perform the calculation.
 *
 * Usage:
 *   poly-roots <c_n> <c_n-1> ... <c_1> <c_0>
 *
 * Example:
 *   Find roots for x^2 - 3x + 2 (coeffs: 1, -3, 2)
 *   $ poly-roots 1 -3 2
 *
 *   Find roots for x^3 - 1 (coeffs: 1, 0, 0, -1)
 *   $ poly-roots 1 0 0 -1
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { findRoots } from '../lib/index.js';
import { Polynomial } from '../lib/polynomial.js';
import { Complex } from '../lib/complex.js';

/**
 * Formats a complex number for clean CLI output.
 * It rounds small real or imaginary parts to zero to improve readability
 * for roots that are purely real or purely imaginary.
 *
 * @param {Complex} root - The complex root to format.
 * @param {number} [tolerance=1e-12] - The threshold below which a part is considered zero.
 * @returns {string} The formatted string representation of the root.
 */
function formatRoot(root, tolerance = 1e-12) {
  let { re, im } = root;

  // Clean up floating point inaccuracies for display
  if (Math.abs(re) < tolerance) re = 0;
  if (Math.abs(im) < tolerance) im = 0;

  // Use the Complex class's robust toString method after cleanup
  return new Complex(re, im).toString();
}

/**
 * The main asynchronous function that orchestrates the CLI logic.
 * It parses arguments, validates them, calls the root-finding function,
 * and prints the results or errors to the console.
 */
async function main() {
  try {
    const argv = await yargs(hideBin(process.argv))
      .usage('Usage: $0 <c_n> <c_n-1> ... <c_0>')
      .command('$0 <coeffs...>', 'Finds the roots of a polynomial given its coefficients.', (yargs) => {
        yargs.positional('coeffs', {
          describe: 'Coefficients of the polynomial, from highest degree to constant term.',
          type: 'number',
        });
      })
      .demandCommand(1, 'You must provide at least one coefficient.')
      .help('h')
      .alias('h', 'help')
      .alias('v', 'version')
      .epilogue('For more information, visit the project repository.')
      .strict()
      .parseAsync();

    const coeffs = argv.coeffs;

    // Validate that all provided coefficients are numbers.
    // Yargs' `type: 'number'` helps, but this is an extra safeguard.
    if (coeffs.some(c => isNaN(c))) {
      console.error('Error: All coefficients must be valid numbers.');
      process.exit(1);
    }

    // Create a Polynomial instance to display it in a readable format.
    const polynomial = new Polynomial(coeffs);

    console.log(`Finding roots for polynomial: P(x) = ${polynomial.toString()}`);
    console.log(`Degree: ${polynomial.degree()}`);
    console.log('---');

    const roots = findRoots(coeffs);

    if (roots.length === 0) {
      console.log('The polynomial has no roots (it might be a non-zero constant) or it is the zero polynomial.');
    } else {
      console.log(`Found ${roots.length} root(s):`);
      roots.forEach((root, index) => {
        console.log(`  Root ${index + 1}: ${formatRoot(root)}`);
      });
    }

  } catch (error) {
    // Handle errors gracefully, whether from yargs parsing or the solver.
    console.error(`\nError: ${error.message}`);
    if (error.name === 'YError') {
      // Yargs-specific error, often indicates bad arguments.
      console.error('Please check your input and try again. Use --help for usage information.');
    }
    process.exit(1);
  }
}

// Execute the main function.
main();
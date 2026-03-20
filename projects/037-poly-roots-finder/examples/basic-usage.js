'use strict';

/**
 * @fileoverview This script provides basic usage examples for the
 * polynomial-roots-finder library. It demonstrates how to find the roots
 * for linear, quadratic, and higher-degree polynomials.
 *
 * To run this example from the project root, use the command:
 * `node examples/basic-usage.js`
 */

// Import the main `findRoots` function from the library.
import { findRoots } from '../lib/index.js';
import { Complex } from '../lib/complex.js';
import { Polynomial } from '../lib/polynomial.js';

/**
 * A helper function to format and print the results of a root-finding operation.
 * @param {string} description - A description of the polynomial being solved.
 * @param {number[]} coeffs - The coefficients of the polynomial.
 */
function solveAndPrint(description, coeffs) {
  console.log(`\n--- ${description} ---`);

  try {
    // Create a Polynomial instance to display its readable string form.
    const poly = new Polynomial(coeffs);
    console.log(`Polynomial: P(x) = ${poly.toString()}`);
    console.log(`Coefficients: [${coeffs.join(', ')}]`);

    // Call the main library function to find the roots.
    const roots = findRoots(coeffs);

    if (roots.length === 0) {
      console.log('Result: The polynomial has no roots (it may be a non-zero constant).');
    } else {
      console.log(`Found ${roots.length} root(s):`);
      // We can use a small tolerance to clean up floating point inaccuracies for display.
      const tolerance = 1e-12;
      roots.forEach((root, index) => {
        // Clean up tiny real/imaginary parts before printing.
        const cleanRe = Math.abs(root.re) < tolerance ? 0 : root.re;
        const cleanIm = Math.abs(root.im) < tolerance ? 0 : root.im;
        const cleanRoot = new Complex(cleanRe, cleanIm);
        console.log(`  Root ${index + 1}: ${cleanRoot.toString()}`);
      });
    }
  } catch (error) {
    console.error(`An error occurred while solving: ${error.message}`);
  }
}

/**
 * The main function to run the examples.
 */
function main() {
  console.log('--- Polynomial Roots Finder: Basic Usage Examples ---');

  // Example 1: A simple quadratic polynomial with two real roots.
  // P(x) = x^2 - 3x + 2 = (x - 1)(x - 2)
  // Roots are 1 and 2.
  solveAndPrint('Quadratic with Real Roots', [1, -3, 2]);

  // Example 2: A quadratic polynomial with complex conjugate roots.
  // P(x) = x^2 + 2x + 5
  // Roots are -1 + 2i and -1 - 2i.
  solveAndPrint('Quadratic with Complex Roots', [1, 2, 5]);

  // Example 3: A cubic polynomial with three distinct real roots.
  // P(x) = x^3 - 6x^2 + 11x - 6 = (x - 1)(x - 2)(x - 3)
  // Roots are 1, 2, and 3.
  solveAndPrint('Cubic with Real Roots', [1, -6, 11, -6]);

  // Example 4: A classic cubic polynomial with real and complex roots.
  // P(x) = x^3 - 1
  // Roots are the cube roots of unity: 1, -0.5 + 0.866i, -0.5 - 0.866i
  solveAndPrint('Cubic with Complex Roots (x^3 - 1)', [1, 0, 0, -1]);

  // Example 5: A quartic polynomial (degree 4) with a mix of roots.
  // P(x) = x^4 - 16 = (x^2 - 4)(x^2 + 4) = (x-2)(x+2)(x-2i)(x+2i)
  // Roots are 2, -2, 2i, -2i.
  solveAndPrint('Quartic with Real and Complex Roots', [1, 0, 0, 0, -16]);

  // Example 6: A polynomial with a non-unitary leading coefficient.
  // The library handles this automatically by creating a monic polynomial internally.
  // P(x) = 2x^2 - 8 = 2(x^2 - 4)
  // Roots are 2, -2.
  solveAndPrint('Polynomial with Non-Unitary Leading Coefficient', [2, 0, -8]);

  // Example 7: A linear polynomial.
  // P(x) = 4x + 12
  // Root is -3.
  solveAndPrint('Linear Polynomial', [4, 12]);
  
  // Example 8: Edge case - a constant polynomial.
  // P(x) = 42
  // Has no roots.
  solveAndPrint('Constant Polynomial', [42]);
}

// Run the demonstration.
main();
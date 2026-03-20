# Polynomial Roots Finder

A zero-dependency Node.js library for finding the real and complex roots of polynomials. It implements robust numerical methods like the Durand-Kerner method for simultaneous root-finding of higher-degree polynomials and provides a simple, chainable API for polynomial representation. Ideal for engineers, scientists, and students working on computational math problems in pure JavaScript environments.

[![NPM version](https://img.shields.io/npm/v/polynomial-roots-finder.svg)](https://www.npmjs.com/package/polynomial-roots-finder)
[![Build Status](https://img.shields.io/travis/your-username/polynomial-roots-finder.svg)](https://travis-ci.org/your-username/polynomial-roots-finder)
[![License](https://img.shields.io/npm/l/polynomial-roots-finder.svg)](https://github.com/your-username/polynomial-roots-finder/blob/main/LICENSE)

## Features

-   **Comprehensive Root-Finding**: Finds all real and complex roots of a polynomial of any degree.
-   **Robust Numerical Method**: Implements the Durand-Kerner (Weierstrass) method for stable, simultaneous root finding of polynomials degree 3 and higher.
-   **Optimized for Low Degrees**: Handles linear and quadratic polynomials with direct analytical formulas for maximum speed and precision.
-   **Simple API**: Provides a simple, elegant API for defining polynomials and finding roots.
-   **Command-Line Interface**: Includes a handy CLI for quick calculations directly from your terminal.
-   **Zero Dependencies**: Lightweight and secure, with no production dependencies.
-   **Modern & Immutable**: Built with modern JavaScript (ESM) and features immutable `Complex` and `Polynomial` classes for predictable, functional-style code.

## Installation

You can install the library via npm:

```bash
npm install polynomial-roots-finder
```

Alternatively, you can clone the repository and install dependencies for development:

```bash
git clone https://github.com/your-username/polynomial-roots-finder.git
cd polynomial-roots-finder
npm install
```

## Usage

### Command-Line Interface (CLI)

The package includes a `poly-roots` command for quick calculations. Pass the polynomial coefficients, from the highest degree term to the constant term, as arguments.

**Syntax:** `poly-roots <c_n> <c_n-1> ... <c_1> <c_0>`

**Example 1: Find roots of `x^2 - 3x + 2`**
The coefficients are `1`, `-3`, and `2`.

```bash
$ poly-roots 1 -3 2

Finding roots for polynomial: P(x) = x^2 - 3*x + 2
Degree: 2
---
Found 2 root(s):
  Root 1: 2
  Root 2: 1
```

**Example 2: Find roots of `x^3 - 1`**
The coefficients are `1`, `0`, `0`, and `-1` for `1x^3 + 0x^2 + 0x - 1`.

```bash
$ poly-roots 1 0 0 -1

Finding roots for polynomial: P(x) = x^3 - 1
Degree: 3
---
Found 3 root(s):
  Root 1: 1
  Root 2: -0.5 + 0.866025403784i
  Root 3: -0.5 - 0.866025403784i
```

### Library API

Import the `findRoots` function and pass an array of coefficients. The function returns an array of `Complex` number objects.

```javascript
import { findRoots } from 'polynomial-roots-finder';

// Find roots of P(x) = x^2 - 2x + 5
// Coefficients are [1, -2, 5]
const coeffs = [1, -2, 5];
const roots = findRoots(coeffs);

console.log('Roots found:');
roots.forEach((root, index) => {
  // The returned roots are instances of the Complex class
  console.log(`  Root ${index + 1}: ${root.toString()}`);
});
```

**Output:**

```
Roots found:
  Root 1: 1 + 2i
  Root 2: 1 - 2i
```

## Examples

### Example 1: Solving a Quadratic Equation

Find the roots of `P(x) = x^2 + 4`. This polynomial has two complex roots.

```javascript
import { findRoots } from 'polynomial-roots-finder';

const coeffs = [1, 0, 4]; // x^2 + 0x + 4
const roots = findRoots(coeffs);

console.log('Polynomial: x^2 + 4 = 0');
console.log('Roots:', roots.map(r => r.toString()));
// Expected output: Roots: [ '2i', '-2i' ]
```

### Example 2: Solving a Cubic Equation

Find the roots of `P(x) = x^3 - 6x^2 + 11x - 6`. This polynomial is factored as `(x-1)(x-2)(x-3)`.

```javascript
import { findRoots } from 'polynomial-roots-finder';

const coeffs = [1, -6, 11, -6];
const roots = findRoots(coeffs);

// The solver may not return roots in a sorted order.
// We can sort them for consistent output.
const sortedRoots = roots.map(r => r.re).sort();

console.log('Polynomial: x^3 - 6x^2 + 11x - 6 = 0');
console.log('Roots:', sortedRoots);
// Expected output: Roots: [ 1, 2, 3 ]
```

### Example 3: Customizing the Numerical Solver

For higher-degree polynomials, you can adjust the `maxIterations` and `tolerance` for the Durand-Kerner method. This is useful for difficult-to-solve polynomials or if you require higher precision.

```javascript
import { findRoots } from 'polynomial-roots-finder';

// Wilkinson's polynomial: (x-1)(x-2)...(x-20) is notoriously hard to solve.
// Let's try a simpler quintic version: (x-1)(x-2)(x-3)(x-4)(x-5)
// P(x) = x^5 - 15x^4 + 85x^3 - 225x^2 + 274x - 120
const coeffs = [1, -15, 85, -225, 274, -120];

const options = {
  maxIterations: 2000, // Increase iterations if needed
  tolerance: 1e-14,    // Demand higher precision
};

const roots = findRoots(coeffs, options);

console.log('Roots of the quintic polynomial:');
roots.forEach(root => console.log(`  ${root.toString()}`));
// Expected output (order may vary): 1, 2, 3, 4, 5
```

## Numerical Methods

-   **Degrees 1 & 2 (Linear & Quadratic):** For these low-degree polynomials, the library uses direct analytical formulas (`x = -b/a` and the quadratic formula). This is extremely fast and guarantees maximum precision without the need for iteration.
-   **Degree 3+ (Durand-Kerner Method):** For cubic and higher-degree polynomials, the library employs the Durand-Kerner method (also known as the Weierstrass method). This is a powerful, iterative numerical technique that finds all roots of a polynomial simultaneously. It is generally more stable than methods that find one root at a time (like Newton's method), as it avoids the process of polynomial deflation which can accumulate errors. The method starts with a set of initial guesses for the roots and refines them in each iteration until they converge to the true roots within a specified tolerance.

## Contributing

Contributions are welcome! If you have a feature request, bug report, or want to improve the code, please feel free to open an issue or submit a pull request.

### Development

1.  Clone the repository.
2.  Install dependencies with `npm install`.
3.  Run tests with `npm test`. You can also run tests in watch mode with `npm run test:watch`.
4.  Make your changes and ensure all tests pass before submitting a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
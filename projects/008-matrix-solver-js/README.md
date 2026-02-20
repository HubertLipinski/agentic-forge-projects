# Matrix Solver JS

A pure JavaScript linear algebra library for solving large and sparse systems of linear equations (Ax=b) using iterative methods. Optimized for performance and memory efficiency in Node.js environments without native code compilation. Ideal for scientific computing, data analysis, and simulation tasks where matrices are too large for direct inversion.

[![NPM version](https://img.shields.io/npm/v/matrix-solver-js.svg)](https://www.npmjs.com/package/matrix-solver-js)
[![License](https://img.shields.io/npm/l/matrix-solver-js.svg)](https://opensource.org/licenses/MIT)

## Features

-   Solves systems of linear equations (Ax=b) using iterative methods.
-   Implements the **Conjugate Gradient (CG)** method for symmetric positive-definite matrices.
-   Implements the **Generalized Minimal Residual (GMRES)** method for non-symmetric matrices.
-   Supports multiple sparse matrix storage formats:
    -   **Coordinate List (COO)**: Easy to construct.
    -   **Compressed Sparse Row (CSR)**: Optimized for fast matrix-vector products.
-   Includes preconditioning strategies (e.g., **Jacobi/Diagonal**) to accelerate convergence.
-   Command-line interface (CLI) for solving systems from **Matrix Market (.mtx)** format files.
-   Configurable convergence criteria (tolerance) and maximum iteration limits.
-   Pure JavaScript implementation for maximum portability across Node.js environments (Node.js >= 20).

## Installation

Install the package from npm:

```bash
npm install matrix-solver-js
```

Alternatively, you can clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/matrix-solver-js.git
cd matrix-solver-js
npm install
```

## Usage

`matrix-solver-js` can be used in two ways: programmatically within your Node.js application or as a standalone command-line tool.

### 1. Programmatic API Usage

Import the necessary classes and functions to define and solve your linear system. The library is designed to work with `Float64Array` for performance.

```javascript
import {
  CompressedSparseRowMatrix,
  CoordinateListMatrix,
} from 'matrix-solver-js';
import { conjugateGradient } from 'matrix-solver-js';
import { JacobiPreconditioner } from 'matrix-solver-js';

// 1. Define a symmetric positive-definite sparse matrix A
//    | 4 -1  0 |
// A =| -1 4 -1 |
//    | 0 -1  4 |
const cooMatrix = new CoordinateListMatrix(3, 3, [
  { row: 0, col: 0, value: 4 },
  { row: 0, col: 1, value: -1 },
  { row: 1, col: 0, value: -1 },
  { row: 1, col: 1, value: 4 },
  { row: 1, col: 2, value: -1 },
  { row: 2, col: 1, value: -1 },
  { row: 2, col: 2, value: 4 },
]);

// Convert to CSR for faster computations
const A = CompressedSparseRowMatrix.fromCoordinateList(cooMatrix);

// 2. Define the right-hand side vector b
const b = new Float64Array([1, 2, 3]);

// 3. (Optional) Create a preconditioner
const preconditioner = new JacobiPreconditioner(A);

// 4. Set solver options
const options = {
  tolerance: 1e-9,
  maxIterations: 100,
  preconditioner: preconditioner,
};

// 5. Solve the system Ax = b using Conjugate Gradient
conjugateGradient(A, b, options).then(({ solution, iterations, residualNorm }) => {
  console.log('Solver finished!');
  console.log(`Converged in ${iterations} iterations.`);
  console.log(`Final residual norm: ${residualNorm.toExponential(4)}`);
  console.log('Solution x:', solution);
});
```

### 2. Command-Line Interface (CLI)

The `matrix-solve` CLI tool allows you to solve systems directly from files. It requires a matrix in the [Matrix Market format](https://math.nist.gov/MatrixMarket/formats.html) (`.mtx`) and a vector file with one value per line.

**Basic Command:**

```bash
matrix-solve --matrix /path/to/A.mtx --vector /path/to/b.txt
```

**Full Options:**

```bash
matrix-solve --help

Usage: matrix-solve -m <matrix_file> -b <vector_file> [options]

Solve a sparse linear system Ax=b from Matrix Market files.

Options:
  --help, -h           Show help                                       [boolean]
  --version, -v        Show version number                             [boolean]
  --matrix, -m         Path to the matrix A file in Matrix Market (.mtx) format
                                                       [string] [required]
  --vector, -b         Path to the right-hand side vector b file (one value
                       per line)                         [string] [required]
  --solver, -s         The iterative solver to use
                                         [choices: "cg", "gmres"] [default: "gmres"]
  --preconditioner, -p The preconditioner to use
                                     [choices: "jacobi", "none"] [default: "none"]
  --tolerance, -t      Convergence tolerance for the residual norm
                                                      [number] [default: 1e-06]
  --max-iterations, -i Maximum number of iterations     [number] [default: 1000]
  --gmres-restart, -r  Restart parameter for GMRES solver
                                                         [number] [default: 30]
  --output, -o         Path to save the solution vector x. If not provided,
                       prints to console.                               [string]
  --quiet, -q          Suppress progress and result logging; only output errors
                       or the solution file           [boolean] [default: false]
```

## Examples

### Example 1: Solving a System with Conjugate Gradient (CLI)

Let's solve a simple symmetric system `Ax=b`.

**`matrix_A.mtx`:**
```
%%MatrixMarket matrix coordinate real symmetric
% A 3x3 symmetric matrix
3 3 4
1 1 4.0
2 1 -1.0
2 2 4.0
3 2 -1.0
```

**`vector_b.txt`:**
```
1
2
3
```

**Command:**

```bash
matrix-solve -m ./matrix_A.mtx -b ./vector_b.txt -s cg -p jacobi -t 1e-9
```

**Expected Output:**

```
Matrix Solver JS - CLI
------------------------
Loading matrix from: ./matrix_A.mtx
 -> Matrix loaded: 3x3, 6 non-zero elements.
Loading vector from: ./vector_b.txt
 -> Vector loaded: 3 elements.
Converting matrix to CSR format for performance...
 -> Conversion complete.
Constructing Jacobi preconditioner...
 -> Preconditioner ready.

Solving Ax=b with CG...
Solver options: { tolerance: 1e-9, preconditioner: [JacobiPreconditioner], maxIterations: 1000 }

--- Solver Results ---
Convergence Status: Converged
Iterations:         2
Final Residual Norm:  1.1102e-16
Relative Residual:    2.9659e-17 (tolerance: 1.0000e-09)
Solver Time:        0.002s

Solution vector x (first 10 elements):
Float64Array(3) [ 0.3928571428571428, 0.7857142857142857, 0.9464285714285714 ]

Total execution time: 0.015s
```

### Example 2: Solving and Saving the Solution (CLI)

This example uses the GMRES solver for a non-symmetric matrix and saves the resulting solution vector `x` to a file.

**Command:**

```bash
# Assume `ns_matrix.mtx` and `ns_vector.txt` exist
matrix-solve \
  --matrix ./ns_matrix.mtx \
  --vector ./ns_vector.txt \
  --solver gmres \
  --gmres-restart 50 \
  --output ./solution_x.txt
```

**Expected Output:**

```
Matrix Solver JS - CLI
------------------------
Loading matrix from: ./ns_matrix.mtx
...
Solving Ax=b with GMRES...
...
--- Solver Results ---
Convergence Status: Converged
Iterations:         85
Final Residual Norm:  8.5432e-07
Relative Residual:    9.1234e-07 (tolerance: 1.0000e-06)
Solver Time:        0.123s

Saving solution to: ./solution_x.txt
 -> Solution saved successfully.

Total execution time: 0.150s
```

The file `solution_x.txt` will now contain the elements of the solution vector, each on a new line.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
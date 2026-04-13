# Matrix Transform Engine

A pure JavaScript library for creating and composing 2D affine transformation matrices. Designed for developers working on graphics, animations, or geometry in a Node.js environment where a browser DOM is not available. Provides an immutable, chainable API for common transformations like translate, rotate, scale, and shear.

[![npm version](https://img.shields.io/npm/v/matrix-transform-engine.svg)](https://www.npmjs.com/package/matrix-transform-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Immutable API**: All transformation methods return a new `Matrix` instance, preventing side-effects and making state management predictable.
- **Chainable Interface**: Compose complex transformations with a fluent, readable API (e.g., `matrix.translate(10, 20).rotate(0.5)`).
- **Core Transformations**: Supports `translate`, `rotate`, `scale`, and `shear`.
- **Utility Methods**: Includes matrix `inversion`, `decomposition`, and `point transformation`.
- **Flexible Serialization**: Convert matrices to and from arrays, plain objects, and CSS `matrix()` strings.
- **Zero Dependencies**: A lightweight, pure ESM library with no external dependencies.
- **Node.js Focused**: Built for server-side graphics, physics engines, or any backend geometry task.

## Installation

Install the library using npm:

```bash
npm install matrix-transform-engine
```

Alternatively, you can clone the repository and install its development dependencies:

```bash
git clone https://github.com/your-username/matrix-transform-engine.git
cd matrix-transform-engine
npm install
```

## Usage

The library is an ES Module. You can import the `Matrix` class and start building transformations.

```javascript
import Matrix from 'matrix-transform-engine';

// Create a new identity matrix
const identity = new Matrix();

// Create a transformation matrix:
// 1. Scale by 2x uniformly
// 2. Rotate 90 degrees (PI/2 radians)
// 3. Translate 100px on the x-axis and 50px on the y-axis
const transform = new Matrix()
  .scale(2)
  .rotate(Math.PI / 2)
  .translate(100, 50);

// Define a point
const point = { x: 10, y: 5 };

// Apply the transformation to the point
const transformedPoint = transform.transformPoint(point);

console.log('Original Point:', point);
console.log('Transformed Point:', transformedPoint);

// You can also inspect the matrix components
console.log('Matrix as Array:', transform.toArray());
console.log('Matrix as CSS String:', transform.toString());
```

## API Reference

### `new Matrix([source])`

Creates a new `Matrix` instance.
- If `source` is omitted, an identity matrix is created.
- If `source` is another `Matrix`, a copy is created.
- If `source` is a 6-element array `[a, b, c, d, e, f]`, it initializes the matrix with those values.

### Transformation Methods (Chainable)

Each of these methods returns a **new** `Matrix` instance.

- `translate(tx, ty)`: Translates the matrix.
- `scale(sx, [sy])`: Scales the matrix. If `sy` is omitted, `sx` is used for uniform scaling.
- `rotate(radians)`: Rotates the matrix by an angle in radians.
- `rotateDeg(degrees)`: Rotates the matrix by an angle in degrees.
- `shear(kx, ky)`: Shears the matrix by factors in radians.
- `multiply(otherMatrix)`: Multiplies the current matrix by another `Matrix` instance.

### Utility Methods

- `invert()`: Returns a new `Matrix` that is the inverse of the current matrix. Throws an error if the matrix is not invertible.
- `transformPoint(point)`: Applies the matrix transformation to a point object `{x, y}` and returns a new point object.
- `decompose()`: Returns an object with the matrix's `translation`, `rotation`, `scale`, and `skew` components.
- `determinant()`: Calculates the determinant of the matrix.

### Serialization

- `toArray()`: Returns the matrix components as a 6-element array.
- `toObject()`: Returns the matrix components as a plain object `{a, b, c, d, e, f}`.
- `toString()`: Returns a CSS-compatible `matrix(a, b, c, d, e, f)` string.

### Static Factory Methods

- `Matrix.fromObject(obj)`: Creates a `Matrix` from a plain object.
- `Matrix.fromString(str)`: Creates a `Matrix` from a CSS `matrix()` string.

## Examples

### 1. Basic Transformation

Create a matrix that scales an object to 150% and moves it 50 pixels to the right. Then apply it to a point.

```javascript
import Matrix from 'matrix-transform-engine';

// Scale by 1.5, then translate by (50, 0)
const transform = new Matrix()
  .scale(1.5)
  .translate(50, 0);

const point = { x: 10, y: 10 };
const newPoint = transform.transformPoint(point);

console.log(transform.toString());
console.log(`The point (10, 10) is transformed to (${newPoint.x}, ${newPoint.y})`);
```

**Expected Output:**

```
matrix(1.5, 0, 0, 1.5, 50, 0)
The point (10, 10) is transformed to (65, 15)
```

### 2. Inverting a Matrix

Create a transformation and then find its inverse to transform a point back to its original position. This is useful for converting from screen coordinates back to world coordinates.

```javascript
import Matrix from 'matrix-transform-engine';

// A transform that rotates 45 degrees and translates
const toScreen = new Matrix()
  .rotateDeg(45)
  .translate(100, 50);

// The inverse transform converts back to the original coordinate system
const toWorld = toScreen.invert();

const screenPoint = { x: 170.71, y: 120.71 };
const worldPoint = toWorld.transformPoint(screenPoint);

console.log(`Screen Point: { x: ${screenPoint.x}, y: ${screenPoint.y} }`);
// Use toFixed to handle floating point inaccuracies in the example output
console.log(`World Point: { x: ${worldPoint.x.toFixed(0)}, y: ${worldPoint.y.toFixed(0)} }`);
```

**Expected Output:**

```
Screen Point: { x: 170.71, y: 120.71 }
World Point: { x: 100, y: 0 }
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
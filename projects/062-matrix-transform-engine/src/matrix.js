/**
 * @file src/matrix.js
 * @description The core Matrix class for creating and composing 2D affine transformations.
 *
 * This class provides an immutable, chainable API for building complex transformations
 * from simple primitives like translate, rotate, scale, and shear. Each transformation
 * method returns a new Matrix instance, preserving the original.
 */

import { IDENTITY_MATRIX, DEG_TO_RAD } from './utils/constants.js';
import { areClose, sin, cos } from './utils/math-helpers.js';
import { multiply } from './operations/multiplication.js';
import { invert, determinant } from './operations/inversion.js';
import { decompose } from './operations/decomposition.js';
import { transformPoint } from './operations/point-transform.js';

/**
 * Represents a 2D affine transformation matrix.
 *
 * The matrix is stored internally as a 6-element array `[a, b, c, d, e, f]`,
 * which corresponds to the 3x3 matrix:
 * | a c e |
 * | b d f |
 * | 0 0 1 |
 *
 * Instances are immutable. All transformation methods return a new `Matrix` instance.
 *
 * @class Matrix
 */
export class Matrix {
  /**
   * @private
   * @type {Readonly<[number, number, number, number, number, number]>}
   * The internal, immutable 6-element array representing the matrix.
   */
  #m;

  /**
   * Creates a new Matrix instance.
   *
   * If no arguments are provided, an identity matrix is created.
   * If a `Matrix` instance is provided, a copy is created.
   * If a 6-element array is provided, it is used to initialize the matrix.
   *
   * @param {Matrix | [number, number, number, number, number, number] | undefined} [source]
   *   The source to initialize the matrix from.
   * @throws {TypeError} If the source is not a valid type.
   */
  constructor(source) {
    if (source === undefined) {
      this.#m = IDENTITY_MATRIX;
    } else if (source instanceof Matrix) {
      this.#m = source.#m; // It's already a frozen array, safe to reuse
    } else if (Array.isArray(source) && source.length === 6) {
      if (!source.every(el => typeof el === 'number')) {
        throw new TypeError('Source array must contain only numbers.');
      }
      this.#m = Object.freeze([...source]);
    } else {
      throw new TypeError('Invalid source for Matrix constructor. Use a Matrix instance, a 6-element array, or no argument for an identity matrix.');
    }
  }

  /**
   * Applies a translation transformation.
   *
   * This is equivalent to multiplying by a translation matrix:
   * | 1 0 tx |
   * | 0 1 ty |
   * | 0 0 1  |
   *
   * @param {number} tx - The translation amount along the x-axis.
   * @param {number} ty - The translation amount along the y-axis.
   * @returns {Matrix} A new `Matrix` instance with the translation applied.
   */
  translate(tx, ty) {
    if (typeof tx !== 'number' || typeof ty !== 'number') {
      throw new TypeError('Translation values tx and ty must be numbers.');
    }
    const translationMatrix = [1, 0, 0, 1, tx, ty];
    const newMatrixArray = multiply(this.#m, translationMatrix);
    return new Matrix(newMatrixArray);
  }

  /**
   * Applies a rotation transformation around the origin (0,0).
   *
   * @param {number} radians - The angle of rotation in radians.
   * @returns {Matrix} A new `Matrix` instance with the rotation applied.
   */
  rotate(radians) {
    if (typeof radians !== 'number') {
      throw new TypeError('Rotation angle must be a number in radians.');
    }
    const c = cos(radians);
    const s = sin(radians);
    const rotationMatrix = [c, s, -s, c, 0, 0];
    const newMatrixArray = multiply(this.#m, rotationMatrix);
    return new Matrix(newMatrixArray);
  }

  /**
   * Applies a rotation transformation around the origin (0,0), with the angle in degrees.
   *
   * @param {number} degrees - The angle of rotation in degrees.
   * @returns {Matrix} A new `Matrix` instance with the rotation applied.
   */
  rotateDeg(degrees) {
    if (typeof degrees !== 'number') {
      throw new TypeError('Rotation angle must be a number in degrees.');
    }
    return this.rotate(degrees * DEG_TO_RAD);
  }

  /**
   * Applies a scaling transformation from the origin (0,0).
   *
   * @param {number} sx - The scaling factor along the x-axis.
   * @param {number} [sy=sx] - The scaling factor along the y-axis. Defaults to `sx` for uniform scaling.
   * @returns {Matrix} A new `Matrix` instance with the scaling applied.
   */
  scale(sx, sy = sx) {
    if (typeof sx !== 'number' || typeof sy !== 'number') {
      throw new TypeError('Scaling factors sx and sy must be numbers.');
    }
    const scaleMatrix = [sx, 0, 0, sy, 0, 0];
    const newMatrixArray = multiply(this.#m, scaleMatrix);
    return new Matrix(newMatrixArray);
  }

  /**
   * Applies a shear transformation from the origin (0,0).
   *
   * @param {number} kx - The shear factor along the x-axis in radians.
   * @param {number} ky - The shear factor along the y-axis in radians.
   * @returns {Matrix} A new `Matrix` instance with the shear applied.
   */
  shear(kx, ky) {
    if (typeof kx !== 'number' || typeof ky !== 'number') {
      throw new TypeError('Shear factors kx and ky must be numbers in radians.');
    }
    const shearMatrix = [1, Math.tan(ky), Math.tan(kx), 1, 0, 0];
    const newMatrixArray = multiply(this.#m, shearMatrix);
    return new Matrix(newMatrixArray);
  }

  /**
   * Multiplies this matrix by another matrix.
   *
   * This is the core composition operation. `matrixA.multiply(matrixB)` results in a
   * transformation that is equivalent to applying `matrixA` then `matrixB`.
   *
   * @param {Matrix} otherMatrix - The matrix to multiply by.
   * @returns {Matrix} A new `Matrix` instance representing the product.
   */
  multiply(otherMatrix) {
    if (!(otherMatrix instanceof Matrix)) {
      throw new TypeError('Argument must be a Matrix instance.');
    }
    const newMatrixArray = multiply(this.#m, otherMatrix.#m);
    return new Matrix(newMatrixArray);
  }

  /**
   * Computes the inverse of this matrix.
   *
   * The inverse matrix "undoes" the transformation of the original matrix.
   *
   * @returns {Matrix} A new `Matrix` instance that is the inverse of this one.
   * @throws {Error} If the matrix is not invertible (i.e., its determinant is zero).
   */
  invert() {
    const invertedMatrixArray = invert(this.#m);
    return new Matrix(invertedMatrixArray);
  }

  /**
   * Transforms a 2D point by this matrix.
   *
   * @param {{x: number, y: number}} point - The point to transform.
   * @returns {{x: number, y: number}} A new point object with the transformed coordinates.
   */
  transformPoint(point) {
    return transformPoint(this.#m, point);
  }

  /**
   * Decomposes the matrix into its constituent translation, rotation, scale, and skew components.
   *
   * @returns {{
   *   translation: {x: number, y: number},
   *   rotation: number,
   *   scale: {x: number, y: number},
   *   skew: {x: number, y: number}
   * }} An object containing the decomposed properties.
   */
  decompose() {
    return decompose(this.#m);
  }

  /**
   * Calculates the determinant of the matrix.
   *
   * A determinant of zero indicates a non-invertible (singular) matrix.
   *
   * @returns {number} The determinant.
   */
  determinant() {
    return determinant(this.#m);
  }

  /**
   * Checks if this matrix is equal to another matrix.
   *
   * @param {Matrix} otherMatrix - The matrix to compare against.
   * @returns {boolean} `true` if the matrices are approximately equal, `false` otherwise.
   */
  equals(otherMatrix) {
    if (!(otherMatrix instanceof Matrix)) {
      return false;
    }
    const otherM = otherMatrix.#m;
    for (let i = 0; i < 6; i++) {
      if (!areClose(this.#m[i], otherM[i])) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns a copy of the matrix's internal 6-element array.
   *
   * @returns {[number, number, number, number, number, number]} A new array with the matrix components.
   */
  toArray() {
    return [...this.#m];
  }

  /**
   * Returns a plain object representation of the matrix.
   *
   * @returns {{a: number, b: number, c: number, d: number, e: number, f: number}}
   *   An object with the matrix components.
   */
  toObject() {
    const [a, b, c, d, e, f] = this.#m;
    return { a, b, c, d, e, f };
  }

  /**
   * Returns a CSS-compatible `matrix()` string.
   *
   * @returns {string} The CSS `matrix(a, b, c, d, e, f)` string representation.
   */
  toString() {
    return `matrix(${this.#m.join(', ')})`;
  }

  /**
   * Creates a `Matrix` instance from a plain object.
   *
   * @param {{a: number, b: number, c: number, d: number, e: number, f: number}} obj
   *   An object with `a, b, c, d, e, f` properties.
   * @returns {Matrix} A new `Matrix` instance.
   */
  static fromObject(obj) {
    if (
      obj == null || typeof obj.a !== 'number' || typeof obj.b !== 'number' ||
      typeof obj.c !== 'number' || typeof obj.d !== 'number' ||
      typeof obj.e !== 'number' || typeof obj.f !== 'number'
    ) {
      throw new TypeError('Object must have numeric properties a, b, c, d, e, f.');
    }
    return new Matrix([obj.a, obj.b, obj.c, obj.d, obj.e, obj.f]);
  }

  /**
   * Creates a `Matrix` instance from a CSS `matrix()` or `matrix3d()` string.
   * Currently only supports the 2D `matrix()` format.
   *
   * @param {string} str - The CSS transform string.
   * @returns {Matrix} A new `Matrix` instance.
   * @throws {TypeError} If the string is not in a valid `matrix(...)` format.
   */
  static fromString(str) {
    if (typeof str !== 'string') {
      throw new TypeError('Input must be a string.');
    }
    const match = str.trim().match(/^matrix\(([^)]+)\)$/);
    if (!match) {
      throw new TypeError('Invalid matrix string format. Expected "matrix(a, b, c, d, e, f)".');
    }
    const values = match[1].split(',').map(v => parseFloat(v.trim()));
    if (values.length !== 6 || values.some(isNaN)) {
      throw new TypeError('Matrix string must contain 6 numeric values.');
    }
    return new Matrix(values);
  }

  /**
   * Accessor for the 'a' component of the matrix (scale x).
   * @returns {number}
   */
  get a() { return this.#m[0]; }

  /**
   * Accessor for the 'b' component of the matrix (skew y).
   * @returns {number}
   */
  get b() { return this.#m[1]; }

  /**
   * Accessor for the 'c' component of the matrix (skew x).
   * @returns {number}
   */
  get c() { return this.#m[2]; }

  /**
   * Accessor for the 'd' component of the matrix (scale y).
   * @returns {number}
   */
  get d() { return this.#m[3]; }

  /**
   * Accessor for the 'e' component of the matrix (translate x).
   * @returns {number}
   */
  get e() { return this.#m[4]; }

  /**
   * Accessor for the 'f' component of the matrix (translate y).
   * @returns {number}
   */
  get f() { return this.#m[5]; }
}
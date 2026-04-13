/**
 * @file src/operations/decomposition.js
 * @description Contains logic to decompose a matrix into its constituent translation, rotation, and scaling factors.
 *
 * This module provides a function to break down a 2D affine transformation matrix into
 * human-readable components: translation (x, y), rotation (in radians), scale (sx, sy),
 * and skew/shear (kx, ky). This is useful for inspecting the state of a transformation,
 * for UI controls that manipulate individual transform properties, or for animation systems.
 *
 * The decomposition algorithm is based on the QR decomposition method described in various
 * graphics programming resources, adapted for a 2D affine matrix.
 * See: https://www.w3.org/TR/css-transforms-1/#decomposing-a-2d-matrix
 */

import { areClose } from '../utils/math-helpers.js';

/**
 * Decomposes a 2D affine transformation matrix into its translation, rotation, scale, and skew components.
 *
 * The matrix `[a, b, c, d, e, f]` is decomposed as follows:
 * - Translation: `(e, f)` is the translation vector.
 * - The upper 2x2 matrix `[[a, c], [b, d]]` is decomposed into rotation, scale, and skew.
 *
 * The decomposition follows these steps:
 * 1. Extract translation `(tx, ty)` directly from `(e, f)`.
 * 2. Calculate scale `(sx, sy)` and rotation `(angle)` from `a, b, c, d`.
 *    - `sx = sqrt(a² + b²)`
 *    - `sy` is calculated considering the determinant to handle reflections (negative scale).
 *    - `angle = atan2(b, a)`
 * 3. Calculate skew factors `(kx, ky)`.
 *
 * Note: The decomposition of a matrix with shear is not unique. This implementation provides one
 * possible and widely-used interpretation. It prioritizes extracting rotation first, then scale,
 * then what remains is considered skew.
 *
 * @param {Readonly<[number, number, number, number, number, number]>} m - The matrix to decompose.
 * @returns {{
 *   translation: {x: number, y: number},
 *   rotation: number,
 *   scale: {x: number, y: number},
 *   skew: {x: number, y: number}
 * }} An object containing the decomposed transformation properties.
 *    - `translation`: The translation component as an {x, y} object.
 *    - `rotation`: The rotation component in radians.
 *    - `scale`: The scale component as an {x, y} object.
 *    - `skew`: The skew component as an {x, y} object (often zero for simple transforms).
 * @throws {TypeError} If the input is not a valid 6-element array of numbers.
 */
export function decompose(m) {
  if (!Array.isArray(m) || m.length !== 6) {
    throw new TypeError('Matrix decomposition requires a 6-element array.');
  }

  const [a, b, c, d, e, f] = m;

  if (
    typeof a !== 'number' || typeof b !== 'number' || typeof c !== 'number' ||
    typeof d !== 'number' || typeof e !== 'number' || typeof f !== 'number'
  ) {
    throw new TypeError('All matrix elements must be numbers for decomposition.');
  }

  // Step 1: Extract translation
  const translation = { x: e, y: f };

  // Handle the case of a near-zero matrix to avoid division by zero or NaN results.
  if (areClose(a, 0) && areClose(b, 0)) {
    // If the first column is zero, the matrix is degenerate.
    // We can't determine a unique rotation or x-scale.
    // A common convention is to assume no rotation and no x-scale.
    return {
      translation,
      rotation: 0,
      scale: { x: 0, y: Math.sqrt(c * c + d * d) },
      skew: { x: Math.atan2(c, d), y: 0 },
    };
  }

  // Step 2: Calculate scale and rotation from the first column (a, b)
  const scaleX = Math.sqrt(a * a + b * b);
  const rotation = Math.atan2(b, a);

  // Step 3: Remove rotation from the matrix to isolate scale and skew
  // We use the calculated rotation to "un-rotate" the 2x2 sub-matrix.
  // If the matrix was R(angle) * S(sx, sy) * K(kx, ky),
  // then R(-angle) * M should give us S * K.
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const unrotatedA = cos * a + sin * b; // This should be equal to scaleX
  const unrotatedB = -sin * a + cos * b; // This should be close to 0

  const unrotatedC = cos * c + sin * d;
  const unrotatedD = -sin * c + cos * d;

  // Step 4: Calculate skew and y-scale from the un-rotated second column
  // The un-rotated matrix is now approximately:
  // | scaleX   unrotatedC |
  // | 0        unrotatedD |
  // where unrotatedC is related to skew and unrotatedD is scaleY.
  const skewX = areClose(unrotatedA, 0) ? 0 : Math.atan2(unrotatedC, unrotatedA);
  const scaleY = unrotatedD; // After un-rotating, d' becomes the y-scale factor.

  // Alternative way to calculate skewX, sometimes seen in other libraries:
  // const skewX = Math.atan2(a * c + b * d, a * a + b * b);
  // The results are equivalent.

  // Check for reflection (negative scale)
  // The determinant (a*d - b*c) flips sign if one axis is scaled by a negative value.
  const determinant = a * d - b * c;
  if (determinant < 0) {
    // A negative determinant indicates a reflection.
    // A common convention is to assign this reflection to the X scale,
    // though it could be assigned to Y as well. This choice keeps rotation positive.
    if (areClose(scaleX, 0)) {
      // If scaleX is zero, we can't apply reflection there.
      // This is a degenerate case, but we handle it by flipping scaleY.
      return {
        translation,
        rotation,
        scale: { x: 0, y: -scaleY },
        skew: { x: skewX, y: 0 }, // SkewY is assumed to be 0 in this model
      };
    }
    return {
      translation,
      rotation,
      scale: { x: -scaleX, y: scaleY },
      skew: { x: -skewX, y: 0 },
    };
  }

  return {
    translation,
    rotation,
    scale: { x: scaleX, y: scaleY },
    // In this 2D model, we only extract one skew factor (skew-x).
    // The remaining component (unrotatedB) should be near zero if there's no skew-y.
    skew: { x: skewX, y: 0 },
  };
}
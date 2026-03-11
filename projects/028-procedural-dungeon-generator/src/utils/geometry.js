/**
 * @file src/utils/geometry.js
 * @description Defines geometric primitives and helper functions for 2D space.
 *
 * This file provides fundamental building blocks like Point and Rectangle, which are
 * essential for representing and manipulating spatial elements within the dungeon grid,
 * such as rooms, corridors, and tile positions.
 */

/**
 * Represents a 2D point with integer coordinates.
 * This is a simple, immutable value object.
 * @property {number} x - The x-coordinate.
 * @property {number} y - The y-coordinate.
 */
export class Point {
  /**
   * Creates an instance of a Point.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   */
  constructor(x = 0, y = 0) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error('Point coordinates must be integers.');
    }
    this.x = x;
    this.y = y;
    Object.freeze(this);
  }

  /**
   * Creates a string representation of the point.
   * @returns {string} A string in the format "Point(x, y)".
   */
  toString() {
    return `Point(${this.x}, ${this.y})`;
  }
}

/**
 * Represents an axis-aligned rectangle in a 2D grid.
 *
 * It is defined by its top-left corner (x, y) and its dimensions (width, height).
 * This class provides methods for collision detection, calculating centers,
 * and other geometric operations relevant to room and container placement.
 */
export class Rectangle {
  /**
   * Creates an instance of a Rectangle.
   * @param {number} x - The x-coordinate of the top-left corner.
   * @param {number} y - The y-coordinate of the top-left corner.
   * @param {number} width - The width of the rectangle.
   * @param {number} height - The height of the rectangle.
   */
  constructor(x, y, width, height) {
    if (![x, y, width, height].every(Number.isInteger)) {
      throw new Error('Rectangle parameters must be integers.');
    }
    if (width < 0 || height < 0) {
      throw new Error('Rectangle dimensions (width, height) cannot be negative.');
    }

    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    // Pre-calculate derived properties for performance
    this.left = x;
    this.right = x + width;
    this.top = y;
    this.bottom = y + height;
  }

  /**
   * Calculates the center point of the rectangle.
   * The coordinates are rounded down to the nearest integer.
   * @returns {Point} The center point of the rectangle.
   */
  getCenter() {
    const centerX = Math.floor(this.x + this.width / 2);
    const centerY = Math.floor(this.y + this.height / 2);
    return new Point(centerX, centerY);
  }

  /**
   * Checks if this rectangle overlaps with another rectangle.
   * Overlap includes edges and corners touching.
   * @param {Rectangle} other - The other rectangle to check against.
   * @returns {boolean} True if the rectangles overlap, false otherwise.
   */
  overlaps(other) {
    if (!(other instanceof Rectangle)) {
      throw new Error('Argument must be an instance of Rectangle.');
    }
    // Check for no overlap. If any of these are true, they do not overlap.
    const noOverlap =
      this.right <= other.left || // this is to the left of other
      this.left >= other.right || // this is to the right of other
      this.bottom <= other.top || // this is above other
      this.top >= other.bottom;   // this is below other

    return !noOverlap;
  }

  /**
   * Checks if a given point is inside this rectangle.
   * The check is inclusive of the rectangle's boundaries.
   * @param {Point} point - The point to check.
   * @returns {boolean} True if the point is inside the rectangle, false otherwise.
   */
  contains(point) {
    if (!(point instanceof Point)) {
      throw new Error('Argument must be an instance of Point.');
    }
    return (
      point.x >= this.left &&
      point.x < this.right &&
      point.y >= this.top &&
      point.y < this.bottom
    );
  }

  /**
   * Creates a new Rectangle that is a shrunken version of the current one.
   * This is useful for creating padding or margins inside a container.
   * @param {number} padding - The amount to shrink from all sides.
   * @returns {Rectangle} A new, smaller Rectangle.
   */
  shrink(padding) {
    if (!Number.isInteger(padding) || padding < 0) {
      throw new Error('Padding must be a non-negative integer.');
    }

    const newWidth = this.width - 2 * padding;
    const newHeight = this.height - 2 * padding;

    if (newWidth < 0 || newHeight < 0) {
      // This can happen if padding is too large. Return a zero-sized rectangle.
      return new Rectangle(this.x + padding, this.y + padding, 0, 0);
    }

    return new Rectangle(this.x + padding, this.y + padding, newWidth, newHeight);
  }

  /**
   * Creates a string representation of the rectangle.
   * @returns {string} A string in the format "Rectangle(x,y,w,h)".
   */
  toString() {
    return `Rectangle(${this.x},${this.y},${this.width},${this.height})`;
  }
}
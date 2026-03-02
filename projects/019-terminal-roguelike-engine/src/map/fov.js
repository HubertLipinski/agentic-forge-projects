/**
 * @file src/map/fov.js
 * @description Implements the Recursive Shadowcasting algorithm for calculating field of view.
 *
 * This algorithm determines which tiles on the map are visible from a specific
 * origin point (e.g., the player's position). It works by dividing the view
 * into eight octants and "casting shadows" from non-transparent tiles.
 *
 * For a detailed explanation of the algorithm, see:
 * http://www.adammil.net/blog/v125_roguelike_vision_algorithms.html#shadowcasting
 */

/**
 * A class that calculates the Field of View (FOV) on a game map.
 * It uses the Recursive Shadowcasting algorithm for efficient and
 * aesthetically pleasing results.
 */
export class FOV {
  /**
   * @private
   * @type {import('./tile.js').Tile[][]} The game map grid.
   */
  #map;

  /**
   * @private
   * @type {number} The width of the map.
   */
  #width;

  /**
   * @private
   * @type {number} The height of the map.
   */
  #height;

  /**
   * @private
   * @type {Set<string>} A set of visible tile coordinates in "x,y" format.
   */
  #visibleTiles;

  /**
   * Initializes the FOV calculator with a given map.
   * @param {import('./tile.js').Tile[][]} map - The 2D array of Tile objects representing the game map.
   */
  constructor(map) {
    if (!Array.isArray(map) || map.length === 0 || !Array.isArray(map[0])) {
      throw new Error('Invalid map provided to FOV constructor. Expected a 2D array of Tiles.');
    }
    this.#map = map;
    this.#height = map.length;
    this.#width = map[0].length;
    this.#visibleTiles = new Set();
  }

  /**
   * Computes the set of visible tiles from a given origin point within a specified radius.
   *
   * @param {object} origin - The starting point for the FOV calculation.
   * @param {number} origin.x - The x-coordinate of the origin.
   * @param {number} origin.y - The y-coordinate of the origin.
   * @param {number} radius - The maximum distance to which the FOV extends.
   * @returns {Set<string>} A set of strings, where each string is a "x,y" coordinate
   * of a visible tile.
   */
  compute(origin, radius) {
    this.#visibleTiles.clear();

    // The origin point is always visible.
    this.#setVisible(origin.x, origin.y);

    // The algorithm processes 8 octants around the origin.
    // Each call to #scanOctant handles one octant.
    // The parameters are: (origin, radius, octant, startSlope, endSlope)
    // Multipliers transform local octant coordinates to global map coordinates.
    // prettier-ignore
    this.#scanOctant(origin, radius, 1, { xx: 1, xy: 0, yx: 0, yy: 1 }, 1.0, 0.0); // E-SE
    // prettier-ignore
    this.#scanOctant(origin, radius, 1, { xx: 0, xy: 1, yx: 1, yy: 0 }, 1.0, 0.0); // SE-S
    // prettier-ignore
    this.#scanOctant(origin, radius, 1, { xx: 0, xy: -1, yx: 1, yy: 0 }, 1.0, 0.0); // SW-S
    // prettier-ignore
    this.#scanOctant(origin, radius, 1, { xx: -1, xy: 0, yx: 0, yy: 1 }, 1.0, 0.0); // W-SW
    // prettier-ignore
    this.#scanOctant(origin, radius, 1, { xx: -1, xy: 0, yx: 0, yy: -1 }, 1.0, 0.0); // W-NW
    // prettier-ignore
    this.#scanOctant(origin, radius, 1, { xx: 0, xy: -1, yx: -1, yy: 0 }, 1.0, 0.0); // NW-N
    // prettier-ignore
    this.#scanOctant(origin, radius, 1, { xx: 0, xy: 1, yx: -1, yy: 0 }, 1.0, 0.0); // NE-N
    // prettier-ignore
    this.#scanOctant(origin, radius, 1, { xx: 1, xy: 0, yx: 0, yy: -1 }, 1.0, 0.0); // E-NE

    return this.#visibleTiles;
  }

  /**
   * @private
   * Recursively scans a single octant.
   *
   * @param {object} origin - The global origin coordinates {x, y}.
   * @param {number} radius - The maximum view radius.
   * @param {number} depth - The current depth (row) in the octant, starting from 1.
   * @param {object} transform - The transformation matrix for the current octant.
   * @param {number} startSlope - The starting slope of the scan area.
   * @param {number} endSlope - The ending slope of the scan area.
   */
  #scanOctant(origin, radius, depth, transform, startSlope, endSlope) {
    if (depth > radius) return;

    let prevWasWall = null;
    const radiusSq = radius * radius;

    for (let i = 0; i <= depth; i++) {
      const localX = depth;
      const localY = i;

      // Check if the tile is within the circular radius.
      if (localX * localX + localY * localY > radiusSq) continue;

      // Transform local octant coordinates to global map coordinates.
      const mapX = origin.x + localX * transform.xx + localY * transform.xy;
      const mapY = origin.y + localX * transform.yx + localY * transform.yy;

      // Calculate the slopes for the current tile.
      const slopeStart = (localY - 0.5) / (localX + 0.5);
      const slopeEnd = (localY + 0.5) / (localX - 0.5);

      // If the tile is outside the view frustum, skip it.
      if (slopeStart > startSlope) continue;
      if (slopeEnd < endSlope) break;

      this.#setVisible(mapX, mapY);

      const isWall = !this.#isTransparent(mapX, mapY);

      // If we found a wall and the previous tile was a floor, this is the start
      // of a new shadow. We recurse to scan the area behind it.
      if (isWall && prevWasWall === false) {
        this.#scanOctant(origin, radius, depth + 1, transform, startSlope, slopeStart);
      }

      // If we found a floor and the previous tile was a wall, this is the end
      // of a shadow. We update the start slope for the next scan area.
      if (!isWall && prevWasWall === true) {
        startSlope = slopeEnd;
      }

      prevWasWall = isWall;
    }

    // If the last tile in the row was a floor, we need to continue scanning
    // from its end slope to the end of the original frustum.
    if (prevWasWall === false) {
      this.#scanOctant(origin, radius, depth + 1, transform, startSlope, endSlope);
    }
  }

  /**
   * @private
   * Checks if a tile at the given coordinates is transparent.
   * Handles out-of-bounds coordinates gracefully, treating them as non-transparent walls.
   *
   * @param {number} x - The x-coordinate of the tile.
   * @param {number} y - The y-coordinate of the tile.
   * @returns {boolean} `true` if the tile is transparent, `false` otherwise.
   */
  #isTransparent(x, y) {
    if (x < 0 || x >= this.#width || y < 0 || y >= this.#height) {
      return false; // Out of bounds is not transparent.
    }
    return this.#map[y][x]?.isTransparent ?? false;
  }

  /**
   * @private
   * Marks a tile as visible if it's within the map boundaries.
   *
   * @param {number} x - The x-coordinate of the tile.
   * @param {number} y - The y-coordinate of the tile.
   */
  #setVisible(x, y) {
    if (x >= 0 && x < this.#width && y >= 0 && y < this.#height) {
      this.#visibleTiles.add(`${x},${y}`);
    }
  }
}
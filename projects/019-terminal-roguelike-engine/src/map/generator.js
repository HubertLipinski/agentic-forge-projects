/**
 * @file src/map/generator.js
 * @description Procedural map generation using a Recursive Backtracking algorithm.
 *
 * This generator carves out a maze-like structure of floors from a solid
 * grid of walls. The result is a map with a single, continuous, winding path.
 * This method ensures all parts of the generated maze are reachable from any
 * other part, which is a desirable property for many roguelike games.
 */

import { RNG } from '../utils/rng.js';
import { Tile, TILE_WALL, TILE_FLOOR } from './tile.js';

/**
 * A class responsible for generating a game map using a Recursive Backtracking algorithm.
 */
export class MapGenerator {
  /**
   * @private
   * @type {number}
   */
  #width;

  /**
   * @private
   * @type {number}
   */
  #height;

  /**
   * @private
   * @type {RNG}
   */
  #rng;

  /**
   * @private
   * @type {Tile[][]}
   */
  #map;

  /**
   * Initializes a new MapGenerator.
   *
   * @param {object} options - Configuration for the generator.
   * @param {number} options.width - The width of the map to generate. Must be an odd integer >= 3.
   * @param {number} options.height - The height of the map to generate. Must be an odd integer >= 3.
   * @param {number} [options.seed] - An optional seed for the random number generator to ensure reproducibility.
   */
  constructor({ width, height, seed }) {
    if (!Number.isInteger(width) || width < 3 || width % 2 === 0) {
      throw new Error('Map width must be an odd integer of 3 or greater.');
    }
    if (!Number.isInteger(height) || height < 3 || height % 2 === 0) {
      throw new Error('Map height must be an odd integer of 3 or greater.');
    }

    this.#width = width;
    this.#height = height;
    this.#rng = new RNG(seed);
    this.#map = [];
  }

  /**
   * Generates and returns a new map.
   *
   * The process involves:
   * 1. Initializing a grid filled entirely with wall tiles.
   * 2. Performing a randomized depth-first search (Recursive Backtracking) to carve out floor tiles.
   *
   * @returns {{map: Tile[][], startPosition: {x: number, y: number}}} An object containing the generated 2D map array and a valid starting position for the player.
   */
  generate() {
    this.#initializeMap();

    // Choose a random starting point for the carving algorithm.
    // It must be an odd coordinate to align with the grid structure.
    const startX = this.#rng.nextInt(0, Math.floor(this.#width / 2)) * 2 + 1;
    const startY = this.#rng.nextInt(0, Math.floor(this.#height / 2)) * 2 + 1;

    this.#carvePassages(startX, startY);

    return {
      map: this.#map,
      startPosition: { x: startX, y: startY },
    };
  }

  /**
   * @private
   * Fills the map grid with solid wall tiles.
   * This creates the base state from which passages will be carved.
   */
  #initializeMap() {
    this.#map = Array.from({ length: this.#height }, () =>
      Array.from({ length: this.#width }, () => TILE_WALL.clone())
    );
  }

  /**
   * @private
   * The core recursive backtracking algorithm. It carves passages from a given
   * position (cx, cy) by moving in random directions.
   *
   * @param {number} cx - The current x-coordinate of the carver.
   * @param {number} cy - The current y-coordinate of the carver.
   */
  #carvePassages(cx, cy) {
    // Carve the current cell into a floor.
    this.#map[cy][cx] = TILE_FLOOR.clone();

    // Define the four cardinal directions (North, East, South, West).
    const directions = [
      { x: 0, y: -2 }, // North
      { x: 2, y: 0 },  // East
      { x: 0, y: 2 },  // South
      { x: -2, y: 0 }, // West
    ];

    // Randomize the order of directions to explore.
    this.#rng.shuffle(directions);

    for (const direction of directions) {
      const nx = cx + direction.x;
      const ny = cy + direction.y;

      // Check if the new position (nx, ny) is within the map bounds.
      if (ny > 0 && ny < this.#height - 1 && nx > 0 && nx < this.#width - 1) {
        // If the target cell is still a wall, it means we haven't visited it yet.
        if (!this.#map[ny][nx].isWalkable) {
          // Carve the wall between the current cell and the target cell.
          const wallX = cx + direction.x / 2;
          const wallY = cy + direction.y / 2;
          this.#map[wallY][wallX] = TILE_FLOOR.clone();

          // Recurse into the new cell.
          this.#carvePassages(nx, ny);
        }
      }
    }
  }
}
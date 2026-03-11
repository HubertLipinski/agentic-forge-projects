/**
 * @file test/generator.test.js
 * @description Unit tests for the main dungeon generator.
 *
 * These tests verify the core functionality and constraints of the `generateDungeon`
 * function, ensuring it produces valid, consistent, and correct maps according to
 * the provided configuration. We use Node.js's built-in test runner.
 */

import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeon } from '../src/generator.js';
import { TILE_TYPES } from '../src/core/constants.js';

describe('Dungeon Generator', () => {

  it('should generate a dungeon with default settings without errors', () => {
    assert.doesNotThrow(() => {
      const result = generateDungeon();
      assert.ok(result, 'Generator should return a result object');
      assert.ok(Array.isArray(result.grid), 'Result should contain a grid');
      assert.ok(Array.isArray(result.rooms), 'Result should contain a rooms array');
    }, 'generateDungeon() with default config should not throw');
  });

  describe('Configuration Validation', () => {
    it('should throw an error for invalid width', () => {
      assert.throws(
        () => generateDungeon({ width: -10 }),
        { message: /Config error: 'width' must be a positive integer/ },
        'Negative width should throw'
      );
      assert.throws(
        () => generateDungeon({ width: 0 }),
        { message: /Config error: 'width' must be a positive integer/ },
        'Zero width should throw'
      );
      assert.throws(
        () => generateDungeon({ width: 50.5 }),
        { message: /Config error: 'width' must be a positive integer/ },
        'Float width should throw'
      );
    });

    it('should throw an error for invalid bspSplitRatio', () => {
      assert.throws(
        () => generateDungeon({ bspSplitRatio: 1.1 }),
        { message: /Config error: 'bspSplitRatio' must be a number between 0 and 1/ },
        'bspSplitRatio > 1 should throw'
      );
      assert.throws(
        () => generateDungeon({ bspSplitRatio: 0 }),
        { message: /Config error: 'bspSplitRatio' must be a number between 0 and 1/ },
        'bspSplitRatio of 0 should throw'
      );
    });

    it('should throw an error if minRoom size is too small', () => {
      assert.throws(
        () => generateDungeon({ minRoomWidth: 2 }),
        { message: /Config error: `minRoomWidth` and `minRoomHeight` must be at least 3/ },
        'minRoomWidth < 3 should throw'
      );
    });

    it('should throw an error if minRoom size + padding exceeds dungeon dimensions', () => {
      assert.throws(
        () => generateDungeon({ width: 20, minRoomWidth: 15, roomPadding: 3 }),
        { message: /Config error: Minimum room size plus padding cannot exceed the total dungeon dimensions/ },
        'minRoomWidth + padding > width should throw'
      );
    });
  });

  describe('Grid Properties', () => {
    const config = { width: 60, height: 40, seed: 'grid-test' };
    const { grid } = generateDungeon(config);

    it('should produce a grid with the correct dimensions', () => {
      assert.strictEqual(grid.length, config.height, 'Grid height should match config');
      assert.ok(grid.every(row => row.length === config.width), 'All grid rows should match config width');
    });

    it('should only contain valid tile types', () => {
      const validTiles = new Set(Object.values(TILE_TYPES));
      const allTiles = grid.flat();
      assert.ok(allTiles.every(tile => validTiles.has(tile)), 'Grid should only contain defined tile types');
    });

    it('should have a border of wall tiles', () => {
      // Top and bottom rows
      assert.ok(grid[0].every(tile => tile === TILE_TYPES.WALL), 'Top border should be all walls');
      assert.ok(grid[config.height - 1].every(tile => tile === TILE_TYPES.WALL), 'Bottom border should be all walls');

      // Left and right columns
      for (let y = 0; y < config.height; y++) {
        assert.strictEqual(grid[y][0], TILE_TYPES.WALL, `Left border at y=${y} should be a wall`);
        assert.strictEqual(grid[y][config.width - 1], TILE_TYPES.WALL, `Right border at y=${y} should be a wall`);
      }
    });
  });

  describe('Room Properties', () => {
    const config = {
      width: 100,
      height: 80,
      minRoomWidth: 5,
      minRoomHeight: 5,
      bspDepth: 5,
      seed: 'room-test'
    };
    const { grid, rooms } = generateDungeon(config);

    it('should generate rooms that adhere to minimum size constraints', () => {
      assert.ok(rooms.length > 0, 'Should generate at least one room');
      assert.ok(
        rooms.every(room => room.width >= config.minRoomWidth && room.height >= config.minRoomHeight),
        'All rooms must be at least the minimum configured size'
      );
    });

    it('should place rooms entirely within the grid boundaries', () => {
      assert.ok(
        rooms.every(room => room.left >= 0 && room.right <= config.width && room.top >= 0 && room.bottom <= config.height),
        'All rooms must be within the grid boundaries'
      );
    });

    it('should carve rooms with floor tiles', () => {
      // Check the center of each room to be reasonably sure it's a floor.
      for (const room of rooms) {
        const center = room.getCenter();
        assert.strictEqual(grid[center.y][center.x], TILE_TYPES.FLOOR, `Center of room ${room} should be a floor tile`);
      }
    });
  });

  describe('Reproducibility', () => {
    const seed = 'deterministic-dungeon-42';
    const config = { width: 50, height: 30, seed };

    it('should produce the exact same grid given the same seed', () => {
      const result1 = generateDungeon(config);
      const result2 = generateDungeon(config);

      assert.deepStrictEqual(result1.grid, result2.grid, 'Grids generated with the same seed should be identical');
    });

    it('should produce the exact same room layout given the same seed', () => {
      const result1 = generateDungeon(config);
      const result2 = generateDungeon(config);

      // Convert room objects to a consistent string representation for comparison
      const rooms1Str = result1.rooms.map(r => r.toString()).sort();
      const rooms2Str = result2.rooms.map(r => r.toString()).sort();

      assert.deepStrictEqual(rooms1Str, rooms2Str, 'Room layouts generated with the same seed should be identical');
    });

    it('should produce different grids for different seeds', () => {
      const grid1 = generateDungeon({ seed: 'seed-a' }).grid;
      const grid2 = generateDungeon({ seed: 'seed-b' }).grid;

      assert.notDeepStrictEqual(grid1, grid2, 'Grids generated with different seeds should not be identical');
    });
  });

  describe('Connectivity', () => {
    /**
     * Helper function to perform a flood fill from a starting point.
     * @param {number[][]} grid - The dungeon grid.
     * @param {number} startX - The starting x-coordinate.
     * @param {number} startY - The starting y-coordinate.
     * @returns {Set<string>} A set of visited floor coordinates as "x,y" strings.
     */
    const floodFill = (grid, startX, startY) => {
      const visited = new Set();
      const queue = [[startX, startY]];
      const width = grid[0].length;
      const height = grid.length;

      if (grid[startY][startX] === TILE_TYPES.WALL) {
        return visited;
      }

      visited.add(`${startX},${startY}`);

      while (queue.length > 0) {
        const [x, y] = queue.shift();

        const neighbors = [
          [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
        ];

        for (const [nx, ny] of neighbors) {
          const key = `${nx},${ny}`;
          if (
            nx >= 0 && nx < width && ny >= 0 && ny < height &&
            grid[ny][nx] !== TILE_TYPES.WALL &&
            !visited.has(key)
          ) {
            visited.add(key);
            queue.push([nx, ny]);
          }
        }
      }
      return visited;
    };

    it('should ensure all floor tiles are connected', () => {
      const { grid, rooms } = generateDungeon({
        width: 80,
        height: 50,
        bspDepth: 4,
        seed: 'connectivity-check'
      });

      // Find all floor tiles in the grid
      const allFloorTiles = new Set();
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[0].length; x++) {
          if (grid[y][x] !== TILE_TYPES.WALL) {
            allFloorTiles.add(`${x},${y}`);
          }
        }
      }

      assert.ok(allFloorTiles.size > 0, 'The map should contain at least one floor tile.');

      // Get a starting point for the flood fill (e.g., center of the first room)
      assert.ok(rooms.length > 0, 'At least one room must exist for a valid connectivity test.');
      const startPoint = rooms[0].getCenter();

      // Perform flood fill from the start point
      const connectedFloors = floodFill(grid, startPoint.x, startPoint.y);

      // The set of all floor tiles should be identical to the set of flood-filled tiles
      assert.deepStrictEqual(
        connectedFloors,
        allFloorTiles,
        'All floor/door tiles in the dungeon should be part of a single connected component'
      );
    });
  });
});
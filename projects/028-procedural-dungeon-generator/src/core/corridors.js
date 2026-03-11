/**
 * @file src/core/corridors.js
 * @description Contains logic for carving corridors between rooms to ensure connectivity.
 *
 * This module takes the final grid with rooms carved into it and connects them
 * by creating winding paths. The primary goal is to ensure that every room is
 * reachable from every other room, making the dungeon fully explorable.
 */

import { TILE_TYPES } from './constants.js';
import { Point } from '../utils/geometry.js';

/**
 * Carves a horizontal corridor segment into the dungeon grid.
 *
 * This function draws a straight horizontal line of FLOOR tiles between two x-coordinates
 * at a specific y-coordinate. It handles drawing from left-to-right or right-to-left.
 *
 * @param {number[][]} grid - The 2D array representing the dungeon map.
 * @param {number} x1 - The starting x-coordinate.
 * @param {number} x2 - The ending x-coordinate.
 * @param {number} y - The y-coordinate for the corridor.
 */
function carveHorizontalCorridor(grid, x1, x2, y) {
  const startX = Math.min(x1, x2);
  const endX = Math.max(x1, x2);
  for (let x = startX; x <= endX; x++) {
    // Check bounds to prevent out-of-bounds errors, though unlikely with proper room placement.
    if (grid[y]?.[x] !== undefined) {
      grid[y][x] = TILE_TYPES.FLOOR;
    }
  }
}

/**
 * Carves a vertical corridor segment into the dungeon grid.
 *
 * This function draws a straight vertical line of FLOOR tiles between two y-coordinates
 * at a specific x-coordinate. It handles drawing from top-to-bottom or bottom-to-top.
 *
 * @param {number[][]} grid - The 2D array representing the dungeon map.
 * @param {number} y1 - The starting y-coordinate.
 * @param {number} y2 - The ending y-coordinate.
 * @param {number} x - The x-coordinate for the corridor.
 */
function carveVerticalCorridor(grid, y1, y2, x) {
  const startY = Math.min(y1, y2);
  const endY = Math.max(y1, y2);
  for (let y = startY; y <= endY; y++) {
    // Check bounds to prevent out-of-bounds errors.
    if (grid[y]?.[x] !== undefined) {
      grid[y][x] = TILE_TYPES.FLOOR;
    }
  }
}

/**
 * Creates a winding L-shaped corridor between two points.
 *
 * The function randomly decides whether to carve the horizontal segment first
 * or the vertical segment first. This creates more varied and less predictable
 * corridor layouts.
 *
 * @param {number[][]} grid - The 2D array representing the dungeon map.
 * @param {Point} start - The starting point of the corridor.
 * @param {Point} end - The ending point of the corridor.
 * @param {import('../utils/rng.js').RNG} rng - The seeded random number generator.
 */
function createLShapedCorridor(grid, start, end, rng) {
  if (!(start instanceof Point) || !(end instanceof Point)) {
    throw new Error('Corridor endpoints must be Point instances.');
  }

  const { x: x1, y: y1 } = start;
  const { x: x2, y: y2 } = end;

  // Randomly choose the order of carving to create varied "L" shapes.
  if (rng.nextFloat() < 0.5) {
    // Carve horizontal segment first, then vertical
    carveHorizontalCorridor(grid, x1, x2, y1);
    carveVerticalCorridor(grid, y1, y2, x2);
  } else {
    // Carve vertical segment first, then horizontal
    carveVerticalCorridor(grid, y1, y2, x1);
    carveHorizontalCorridor(grid, x1, x2, y2);
  }
}

/**
 * Connects all rooms in the dungeon with corridors.
 *
 * This function iterates through the list of rooms, connecting each room to the
 * next one in the list. The list of rooms is shuffled to ensure a non-linear
 * connection pattern, which contributes to a more organic and less predictable
 * dungeon layout.
 *
 * @param {number[][]} grid - The 2D array representing the dungeon map.
 * @param {import('./bsp.js').BspNode[]} leafNodes - An array of leaf nodes from the BSP tree, each containing a room.
 * @param {import('../utils/rng.js').RNG} rng - The seeded random number generator.
 */
export function connectRooms(grid, leafNodes, rng) {
  if (!Array.isArray(leafNodes) || leafNodes.length < 2) {
    // Not enough rooms to connect, so no corridors are needed.
    return;
  }

  // Filter out any leaf nodes that might not have a room (a defensive measure).
  const rooms = leafNodes.filter(node => node.room);

  if (rooms.length < 2) {
    return;
  }

  // Shuffle the rooms to create a more random connection graph.
  // This prevents a simple linear chain of connections (room 1 -> room 2 -> room 3...).
  rng.shuffle(rooms);

  for (let i = 0; i < rooms.length - 1; i++) {
    const roomA = rooms[i].room;
    const roomB = rooms[i + 1].room;

    const centerA = roomA.getCenter();
    const centerB = roomB.getCenter();

    createLShapedCorridor(grid, centerA, centerB, rng);
  }
}
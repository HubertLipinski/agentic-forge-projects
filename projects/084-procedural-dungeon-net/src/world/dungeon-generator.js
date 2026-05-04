/**
 * @file src/world/dungeon-generator.js
 * @description Implements a modified Binary Space Partitioning (BSP) algorithm to create
 * a dungeon layout with rooms and corridors. The process involves recursively splitting
 * a large area into smaller sub-areas, placing rooms within them, and then connecting
 * these rooms with corridors. This method produces natural-looking, non-overlapping
 * dungeon structures.
 */

import { generateId } from '../utils/uuid.js';

// --- Constants ---

/**
 * Represents a wall tile in the dungeon grid.
 * @constant {number}
 */
export const TILE_WALL = 1;

/**
 * Represents a floor tile in the dungeon grid.
 * @constant {number}
 */
export const TILE_FLOOR = 0;

const MIN_LEAF_SIZE = 10; // Minimum size (width or height) for a partition.
const MIN_ROOM_SIZE = 5; // Minimum size (width or height) for a room within a partition.
const ROOM_PADDING = 2; // Minimum space between a room and its partition boundary.

// --- Helper Classes ---

/**
 * Represents a rectangular area in the dungeon grid.
 * Used for partitions (leaves) and rooms.
 */
class Rectangle {
  /**
   * @param {number} x - The top-left x-coordinate.
   * @param {number} y - The top-left y-coordinate.
   * @param {number} width - The width of the rectangle.
   * @param {number} height - The height of the rectangle.
   */
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.right = x + width - 1;
    this.bottom = y + height - 1;
  }

  /**
   * Calculates and returns the center coordinates of the rectangle.
   * @returns {{x: number, y: number}} The center point.
   */
  getCenter() {
    const centerX = Math.floor(this.x + this.width / 2);
    const centerY = Math.floor(this.y + this.height / 2);
    return { x: centerX, y: centerY };
  }
}

/**
 * Represents a node in the BSP tree, also known as a "leaf".
 * Each leaf corresponds to a rectangular partition of the dungeon.
 */
class Leaf {
  /**
   * @param {Rectangle} rect - The rectangular area this leaf represents.
   * @param {function(): number} randomFn - The deterministic random function.
   */
  constructor(rect, randomFn) {
    this.rect = rect;
    this.randomFn = randomFn;
    this.leftChild = null;
    this.rightChild = null;
    this.room = null; // The room created within this leaf's area.
  }

  /**
   * Recursively splits the leaf into two smaller leaves, either horizontally or vertically.
   * The split is performed randomly but ensures sub-leaves are not too small.
   * @returns {boolean} - True if the split was successful, false otherwise.
   */
  split() {
    if (this.leftChild || this.rightChild) {
      return false; // Already split
    }

    const splitHorizontally = this.randomFn() > 0.5;
    const maxSplitSize = (splitHorizontally ? this.rect.height : this.rect.width) - MIN_LEAF_SIZE;

    if (maxSplitSize <= MIN_LEAF_SIZE) {
      return false; // Too small to split
    }

    const splitPoint = Math.floor(this.randomFn() * (maxSplitSize - MIN_LEAF_SIZE) + MIN_LEAF_SIZE);

    if (splitHorizontally) {
      // Horizontal split
      this.leftChild = new Leaf(new Rectangle(this.rect.x, this.rect.y, this.rect.width, splitPoint), this.randomFn);
      this.rightChild = new Leaf(new Rectangle(this.rect.x, this.rect.y + splitPoint, this.rect.width, this.rect.height - splitPoint), this.randomFn);
    } else {
      // Vertical split
      this.leftChild = new Leaf(new Rectangle(this.rect.x, this.rect.y, splitPoint, this.rect.height), this.randomFn);
      this.rightChild = new Leaf(new Rectangle(this.rect.x + splitPoint, this.rect.y, this.rect.width - splitPoint, this.rect.height), this.randomFn);
    }

    return true;
  }

  /**
   * Creates a room within the boundaries of this leaf.
   * The room's dimensions and position are randomized.
   */
  createRoom() {
    if (this.leftChild || this.rightChild) {
      return; // Only create rooms in terminal leaves
    }

    const maxRoomWidth = this.rect.width - ROOM_PADDING * 2;
    const maxRoomHeight = this.rect.height - ROOM_PADDING * 2;

    if (maxRoomWidth < MIN_ROOM_SIZE || maxRoomHeight < MIN_ROOM_SIZE) {
      return; // Partition is too small for a decent room
    }

    const roomWidth = Math.floor(this.randomFn() * (maxRoomWidth - MIN_ROOM_SIZE + 1)) + MIN_ROOM_SIZE;
    const roomHeight = Math.floor(this.randomFn() * (maxRoomHeight - MIN_ROOM_SIZE + 1)) + MIN_ROOM_SIZE;

    const roomX = this.rect.x + ROOM_PADDING + Math.floor(this.randomFn() * (maxRoomWidth - roomWidth + 1));
    const roomY = this.rect.y + ROOM_PADDING + Math.floor(this.randomFn() * (maxRoomHeight - roomHeight + 1));

    this.room = new Rectangle(roomX, roomY, roomWidth, roomHeight);
  }

  /**
   * Gets the room from this leaf or one of its children.
   * Used to find a room for connecting corridors.
   * @returns {Rectangle | null} - A room rectangle, or null if no room exists.
   */
  getRoom() {
    if (this.room) {
      return this.room;
    }

    const leftRoom = this.leftChild?.getRoom() ?? null;
    const rightRoom = this.rightChild?.getRoom() ?? null;

    // Prefer a room from a direct child, otherwise pick one randomly
    if (leftRoom && rightRoom) {
      return this.randomFn() > 0.5 ? leftRoom : rightRoom;
    }
    return leftRoom ?? rightRoom;
  }
}

// --- Dungeon Generation Logic ---

/**
 * Creates a deterministic pseudo-random number generator function from a seed.
 * This ensures that the same seed always produces the same sequence of numbers,
 * leading to identical dungeon layouts.
 * Uses the Mulberry32 algorithm.
 *
 * @param {number} seed - The integer seed for the random number generator.
 * @returns {function(): number} A function that returns a pseudo-random float between 0 and 1.
 */
function createSeededRandom(seed) {
  let a = seed;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Carves a horizontal corridor between two points.
 *
 * @param {number[][]} grid - The 2D array representing the dungeon map.
 * @param {number} x1 - The starting x-coordinate.
 * @param {number} x2 - The ending x-coordinate.
 * @param {number} y - The y-coordinate for the corridor.
 */
function createHorizontalCorridor(grid, x1, x2, y) {
  const startX = Math.min(x1, x2);
  const endX = Math.max(x1, x2);
  for (let x = startX; x <= endX; x++) {
    if (grid[y]?.[x] !== undefined) {
      grid[y][x] = TILE_FLOOR;
    }
  }
}

/**
 * Carves a vertical corridor between two points.
 *
 * @param {number[][]} grid - The 2D array representing the dungeon map.
 * @param {number} y1 - The starting y-coordinate.
 * @param {number} y2 - The ending y-coordinate.
 * @param {number} x - The x-coordinate for the corridor.
 */
function createVerticalCorridor(grid, y1, y2, x) {
  const startY = Math.min(y1, y2);
  const endY = Math.max(y1, y2);
  for (let y = startY; y <= endY; y++) {
    if (grid[y]?.[x] !== undefined) {
      grid[y][x] = TILE_FLOOR;
    }
  }
}

/**
 * Connects two rooms with L-shaped corridors.
 *
 * @param {number[][]} grid - The 2D array representing the dungeon map.
 * @param {Rectangle} roomA - The first room.
 * @param {Rectangle} roomB - The second room.
 * @param {function(): number} randomFn - The deterministic random function.
 */
function connectRooms(grid, roomA, roomB, randomFn) {
  const pointA = roomA.getCenter();
  const pointB = roomB.getCenter();

  if (randomFn() > 0.5) {
    // Horizontal first, then vertical
    createHorizontalCorridor(grid, pointA.x, pointB.x, pointA.y);
    createVerticalCorridor(grid, pointA.y, pointB.y, pointB.x);
  } else {
    // Vertical first, then horizontal
    createVerticalCorridor(grid, pointA.y, pointB.y, pointA.x);
    createHorizontalCorridor(grid, pointA.x, pointB.x, pointB.y);
  }
}

/**
 * The main class for generating a dungeon.
 */
export class DungeonGenerator {
  /**
   * @param {object} options - Configuration for the dungeon generator.
   * @param {number} options.width - The total width of the dungeon grid.
   * @param {number} options.height - The total height of the dungeon grid.
   * @param {number} options.seed - A seed for the random number generator to ensure deterministic output.
   * @param {number} [options.maxIterations=10] - The number of times to split the main partition. More iterations lead to more, smaller rooms.
   */
  constructor({ width, height, seed, maxIterations = 10 }) {
    if (!width || !height || width < MIN_LEAF_SIZE * 2 || height < MIN_LEAF_SIZE * 2) {
      throw new Error(`Dungeon dimensions must be at least ${MIN_LEAF_SIZE * 2}x${MIN_LEAF_SIZE * 2}.`);
    }
    if (seed === undefined || seed === null) {
      throw new Error('A numeric seed is required for dungeon generation.');
    }

    this.width = width;
    this.height = height;
    this.seed = seed;
    this.maxIterations = maxIterations;
    this.randomFn = createSeededRandom(this.seed);
  }

  /**
   * Generates the entire dungeon layout.
   *
   * @returns {{grid: number[][], rooms: object[], startPosition: {x: number, y: number}}} The generated dungeon data.
   */
  generate() {
    const grid = Array.from({ length: this.height }, () => Array(this.width).fill(TILE_WALL));
    const leaves = [];
    const rooms = [];

    const root = new Leaf(new Rectangle(0, 0, this.width, this.height), this.randomFn);
    leaves.push(root);

    // 1. Split partitions (BSP)
    let didSplit = true;
    for (let i = 0; i < this.maxIterations && didSplit; i++) {
      didSplit = false;
      const currentLeaves = [...leaves];
      for (const leaf of currentLeaves) {
        if (leaf.split()) {
          leaves.push(leaf.leftChild, leaf.rightChild);
          didSplit = true;
        }
      }
    }

    // 2. Create rooms in terminal leaves
    root.createRoom(); // Create rooms recursively
    const terminalLeaves = leaves.filter(l => !l.leftChild && !l.rightChild);
    terminalLeaves.forEach(leaf => {
      leaf.createRoom();
      if (leaf.room) {
        // Carve room into the grid
        for (let y = leaf.room.y; y < leaf.room.bottom; y++) {
          for (let x = leaf.room.x; x < leaf.room.right; x++) {
            grid[y][x] = TILE_FLOOR;
          }
        }
        rooms.push({
          id: `room-${generateId()}`,
          ...leaf.room
        });
      }
    });

    // 3. Connect rooms with corridors
    const connectLeaf = (leaf) => {
      if (!leaf.leftChild || !leaf.rightChild) {
        return;
      }
      connectLeaf(leaf.leftChild);
      connectLeaf(leaf.rightChild);

      const leftRoom = leaf.leftChild.getRoom();
      const rightRoom = leaf.rightChild.getRoom();

      if (leftRoom && rightRoom) {
        connectRooms(grid, leftRoom, rightRoom, this.randomFn);
      }
    };
    connectLeaf(root);

    if (rooms.length === 0) {
      throw new Error('Failed to generate any rooms. Try different dimensions or seed.');
    }

    // 4. Determine start position
    const startRoom = rooms[0];
    const startPosition = startRoom.getCenter();

    return {
      grid,
      rooms,
      startPosition,
    };
  }
}
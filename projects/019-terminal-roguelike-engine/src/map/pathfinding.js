/**
 * @file src/map/pathfinding.js
 * @description A* pathfinding implementation for navigating the game map.
 *
 * This file provides a function that uses the A* search algorithm to find the
 * shortest path between two points on a grid, taking into account obstacles
 * (non-walkable tiles). It's commonly used for NPC movement and AI behavior.
 *
 * The A* algorithm is efficient because it uses a heuristic to guide its search
 * towards the target, avoiding a brute-force exploration of the entire map.
 * The total cost of a node (`f`) is calculated as `f = g + h`, where:
 * - `g`: The actual cost of the path from the start node to the current node.
 * - `h`: The heuristic (estimated) cost from the current node to the end node.
 *
 * We use the Manhattan distance for our heuristic, as it's a good fit for
 * grid-based movement where only cardinal directions are allowed.
 */

/**
 * A simple Priority Queue implementation.
 * This is a crucial data structure for the A* algorithm, allowing efficient
 * retrieval of the node with the lowest 'f' score from the open set.
 * This implementation uses a simple array and sorts it on insertion, which is
 * sufficient for typical roguelike pathfinding needs. For very large-scale
 * searches, a more optimized structure like a binary heap could be used.
 * @private
 */
class PriorityQueue {
  /** @type {{node: string, priority: number}[]} */
  #elements;

  constructor() {
    this.#elements = [];
  }

  /**
   * Adds an element to the queue with a given priority.
   * @param {string} node - The node to add (e.g., "x,y" coordinate string).
   * @param {number} priority - The priority value (e.g., the 'f' score).
   */
  enqueue(node, priority) {
    this.#elements.push({ node, priority });
    // Sort by priority (lowest first).
    this.#elements.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Removes and returns the element with the highest priority (lowest priority value).
   * @returns {string | undefined} The node with the highest priority, or undefined if the queue is empty.
   */
  dequeue() {
    return this.#elements.shift()?.node;
  }

  /**
   * Checks if the queue is empty.
   * @returns {boolean} True if the queue has no elements.
   */
  isEmpty() {
    return this.#elements.length === 0;
  }
}

/**
 * Calculates the Manhattan distance between two points.
 * This serves as the heuristic (h-cost) for the A* algorithm. It's the sum
 * of the absolute differences of their Cartesian coordinates.
 * @private
 * @param {{x: number, y: number}} a - The first point.
 * @param {{x: number, y: number}} b - The second point.
 * @returns {number} The Manhattan distance.
 */
function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Reconstructs the path from the `cameFrom` map after the target has been found.
 * It backtracks from the target node to the start node.
 * @private
 * @param {Map<string, string>} cameFrom - A map where each key is a node and its value is the node it came from.
 * @param {string} current - The target node's key ("x,y").
 * @returns {{x: number, y: number}[]} The reconstructed path as an array of coordinate objects, from start to end.
 */
function reconstructPath(cameFrom, current) {
  const path = [{ x: parseInt(current.split(',')[0]), y: parseInt(current.split(',')[1]) }];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    path.unshift({ x: parseInt(current.split(',')[0]), y: parseInt(current.split(',')[1]) });
  }
  return path;
}

/**
 * Finds the shortest path between two points on a map using the A* algorithm.
 *
 * @param {object} start - The starting coordinates.
 * @param {number} start.x - The starting x-coordinate.
 * @param {number} start.y - The starting y-coordinate.
 * @param {object} end - The target coordinates.
 * @param {number} end.x - The target x-coordinate.
 * @param {number} end.y - The target y-coordinate.
 * @param {import('./tile.js').Tile[][]} map - The 2D array of Tile objects representing the game map.
 * @returns {{x: number, y: number}[] | null} An array of coordinate objects `{x, y}` representing the path
 * from start to end (inclusive of start, exclusive of end), or `null` if no path is found.
 */
export function findPath(start, end, map) {
  const height = map.length;
  const width = map[0].length;
  const startKey = `${start.x},${start.y}`;
  const endKey = `${end.x},${end.y}`;

  // Basic validation
  if (
    start.x < 0 || start.x >= width || start.y < 0 || start.y >= height ||
    end.x < 0 || end.x >= width || end.y < 0 || end.y >= height ||
    !map[start.y][start.x].isWalkable || !map[end.y][end.x].isWalkable
  ) {
    return null; // Start or end is out of bounds or not walkable.
  }

  const openSet = new PriorityQueue();
  openSet.enqueue(startKey, 0);

  // Map from a node to the node preceding it on the cheapest path.
  const cameFrom = new Map();

  // Cost from start to a specific node (g-score).
  const gScore = new Map();
  gScore.set(startKey, 0);

  // Total cost from start to goal through a specific node (f-score = g-score + h-score).
  const fScore = new Map();
  fScore.set(startKey, manhattanDistance(start, end));

  while (!openSet.isEmpty()) {
    const currentKey = openSet.dequeue();
    const [currentX, currentY] = currentKey.split(',').map(Number);

    if (currentKey === endKey) {
      const path = reconstructPath(cameFrom, currentKey);
      // Return path excluding the start node, as the entity is already there.
      return path.slice(1);
    }

    // Define neighbors (cardinal directions)
    const neighbors = [
      { x: currentX, y: currentY - 1 }, // North
      { x: currentX, y: currentY + 1 }, // South
      { x: currentX - 1, y: currentY }, // West
      { x: currentX + 1, y: currentY }, // East
    ];

    for (const neighbor of neighbors) {
      const { x, y } = neighbor;
      const neighborKey = `${x},${y}`;

      // Check if neighbor is valid and walkable
      if (x < 0 || x >= width || y < 0 || y >= height || !map[y][x].isWalkable) {
        continue;
      }

      // Tentative g-score is the score of the current node plus the distance to the neighbor (which is always 1).
      const tentativeGScore = (gScore.get(currentKey) ?? Infinity) + 1;

      if (tentativeGScore < (gScore.get(neighborKey) ?? Infinity)) {
        // This path to the neighbor is better than any previous one. Record it.
        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(neighborKey, tentativeGScore + manhattanDistance(neighbor, end));
        openSet.enqueue(neighborKey, fScore.get(neighborKey));
      }
    }
  }

  // No path was found.
  return null;
}
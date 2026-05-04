/**
 * @file src/world/pathfinding.js
 * @description A* pathfinding implementation for navigating the dungeon grid.
 * This module provides a function to find the shortest path between two points
 * on the game map, taking into account obstacles like walls. It uses the A*
 * search algorithm, which is highly efficient for this purpose. The implementation
 * relies on a min-priority queue to quickly select the most promising node to
 * explore next.
 */

import { PriorityQueue } from '../utils/priority-queue.js';
import { TILE_FLOOR } from './dungeon-generator.js';

/**
 * Represents a node in the A* search space.
 * Each node corresponds to a specific tile on the map.
 */
class PathNode {
  /**
   * @param {number} x The x-coordinate of the tile.
   * @param {number} y The y-coordinate of the tile.
   * @param {PathNode|null} parent The node from which we reached this node.
   * @param {number} gScore The cost of the path from the start node to this node.
   * @param {number} hScore The heuristic cost estimate from this node to the end node.
   */
  constructor(x, y, parent = null, gScore = 0, hScore = 0) {
    /** @type {number} */
    this.x = x;
    /** @type {number} */
    this.y = y;
    /** @type {PathNode|null} */
    this.parent = parent;
    /** @type {number} */
    this.gScore = gScore; // Cost from start
    /** @type {number} */
    this.hScore = hScore; // Heuristic cost to end (Manhattan distance)
  }

  /**
   * The total estimated cost of the path through this node (f = g + h).
   * @returns {number}
   */
  get fScore() {
    return this.gScore + this.hScore;
  }

  /**
   * Creates a unique key for this node, useful for tracking visited nodes.
   * @returns {string} A string representation, e.g., "12,34".
   */
  getKey() {
    return `${this.x},${this.y}`;
  }
}

/**
 * Calculates the Manhattan distance between two points.
 * This is used as the heuristic (hScore) in the A* algorithm. It's a good
 * choice for grids where movement is restricted to four directions, as it
 * never overestimates the actual cost.
 *
 * @param {{x: number, y: number}} a The first point.
 * @param {{x: number, y: number}} b The second point.
 * @returns {number} The Manhattan distance.
 */
function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Reconstructs the path from the end node back to the start node.
 *
 * @param {PathNode} endNode The final node in the path.
 * @returns {Array<{x: number, y: number}>} An array of coordinates representing the path, from start to end.
 */
function reconstructPath(endNode) {
  const path = [];
  let currentNode = endNode;
  while (currentNode) {
    path.push({ x: currentNode.x, y: currentNode.y });
    currentNode = currentNode.parent;
  }
  return path.reverse();
}

/**
 * Finds the shortest path between two points on the map using the A* algorithm.
 *
 * @param {{x: number, y: number}} start The starting coordinates.
 * @param {{x: number, y: number}} end The target coordinates.
 * @param {import('./map.js').DungeonMap} map The dungeon map instance, providing traversal info.
 * @returns {Array<{x: number, y: number}> | null} An array of coordinates representing the path from start to end,
 * or null if no path is found. The start point is not included in the returned path.
 */
export function findPath(start, end, map) {
  if (!map.isWalkable(start.x, start.y) || !map.isWalkable(end.x, end.y)) {
    // Start or end point is inside a wall or out of bounds.
    return null;
  }

  if (start.x === end.x && start.y === end.y) {
    return []; // Already at the destination.
  }

  const startNode = new PathNode(start.x, start.y, null, 0, manhattanDistance(start, end));
  const openSet = new PriorityQueue();
  openSet.enqueue(startNode, startNode.fScore);

  // Using a Map for O(1) average time complexity for get/set/has.
  // Stores the node with the lowest gScore found so far for a given coordinate.
  const openSetMap = new Map();
  openSetMap.set(startNode.getKey(), startNode);

  const closedSet = new Set();

  while (!openSet.isEmpty()) {
    const currentNode = openSet.dequeue();
    const currentKey = currentNode.getKey();

    // If we've found a better path to this node since it was enqueued, skip it.
    if (currentNode.gScore > (openSetMap.get(currentKey)?.gScore ?? Infinity)) {
      continue;
    }

    // Goal reached
    if (currentNode.x === end.x && currentNode.y === end.y) {
      const path = reconstructPath(currentNode);
      path.shift(); // Remove the starting point from the path
      return path;
    }

    closedSet.add(currentKey);
    openSetMap.delete(currentKey);

    // Explore neighbors (up, down, left, right)
    const neighbors = [
      { x: currentNode.x, y: currentNode.y - 1 }, // North
      { x: currentNode.x, y: currentNode.y + 1 }, // South
      { x: currentNode.x - 1, y: currentNode.y }, // West
      { x: currentNode.x + 1, y: currentNode.y }, // East
    ];

    for (const neighborPos of neighbors) {
      const neighborKey = `${neighborPos.x},${neighborPos.y}`;

      // Skip if already evaluated or is an obstacle
      if (closedSet.has(neighborKey) || !map.isWalkable(neighborPos.x, neighborPos.y)) {
        continue;
      }

      // The cost to move from the current node to a neighbor is always 1.
      const tentativeGScore = currentNode.gScore + 1;

      const existingNode = openSetMap.get(neighborKey);

      // If this is a new node or we've found a shorter path to it
      if (!existingNode || tentativeGScore < existingNode.gScore) {
        const hScore = manhattanDistance(neighborPos, end);
        const neighborNode = new PathNode(neighborPos.x, neighborPos.y, currentNode, tentativeGScore, hScore);

        openSetMap.set(neighborKey, neighborNode);
        openSet.enqueue(neighborNode, neighborNode.fScore);
      }
    }
  }

  // No path found
  return null;
}
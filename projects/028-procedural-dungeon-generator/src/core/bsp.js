/**
 * @file src/core/bsp.js
 * @description Implements the Binary Space Partitioning (BSP) algorithm.
 *
 * This module contains the logic for recursively splitting a rectangular container
 * into smaller sub-containers. This is the first major step in the dungeon generation
 * process, creating the foundational layout where rooms will be placed. The result
 * is a tree of containers, where the leaf nodes represent the final partitions.
 */

import { Rectangle } from '../utils/geometry.js';

/**
 * Represents a node in the BSP tree. Each node is a container that can be
 * split into two children or remain a leaf node.
 *
 * @property {Rectangle} container - The rectangular area this node represents.
 * @property {BspNode | null} leftChild - The first child node after a split.
 * @property {BspNode | null} rightChild - The second child node after a split.
 * @property {Rectangle | null} room - The room placed within this container (only for leaf nodes).
 */
class BspNode {
  /**
   * Creates an instance of a BspNode.
   * @param {Rectangle} container - The rectangular area for this node.
   */
  constructor(container) {
    if (!(container instanceof Rectangle)) {
      throw new Error('BspNode requires a Rectangle instance for its container.');
    }
    this.container = container;
    this.leftChild = null;
    this.rightChild = null;
    this.room = null; // A room will be added later if this is a leaf node
  }

  /**
   * A getter to determine if this node is a leaf node (i.e., has no children).
   * @returns {boolean} True if the node has no children, false otherwise.
   */
  get isLeaf() {
    return this.leftChild === null && this.rightChild === null;
  }
}

/**
 * Recursively splits a BSP node into two children until the desired depth is reached.
 * The split direction (horizontal or vertical) is chosen based on the container's
 * aspect ratio to encourage more square-like partitions.
 *
 * @param {BspNode} node - The current node to split.
 * @param {number} currentDepth - The current depth in the recursion.
 * @param {object} config - The dungeon generation configuration.
 * @param {import('../utils/rng.js').RNG} rng - The seeded random number generator.
 */
function recursiveSplit(node, currentDepth, config, rng) {
  if (currentDepth >= config.bspDepth) {
    return; // Stop splitting when max depth is reached
  }

  const { bspSplitRatio, minRoomWidth, minRoomHeight, roomPadding } = config;
  const container = node.container;

  // Determine split direction: horizontal or vertical
  let splitHorizontally = rng.nextFloat() < 0.5; // Default to random choice
  if (container.width > container.height && container.width / container.height >= 1.25) {
    splitHorizontally = false; // Container is wide, split vertically
  } else if (container.height > container.width && container.height / container.width >= 1.25) {
    splitHorizontally = true; // Container is tall, split horizontally
  }

  // Calculate minimum size for a container to hold a valid room
  const minContainerSize = Math.max(minRoomWidth, minRoomHeight) + 2 * roomPadding;

  // Check if the container is large enough to be split in the chosen direction
  const canSplitHorizontally = container.height >= minContainerSize * 2;
  const canSplitVertically = container.width >= minContainerSize * 2;

  if (splitHorizontally && !canSplitHorizontally) {
    if (canSplitVertically) {
      splitHorizontally = false; // Cannot split horizontally, try vertically
    } else {
      return; // Cannot split in either direction, stop here
    }
  } else if (!splitHorizontally && !canSplitVertically) {
    if (canSplitHorizontally) {
      splitHorizontally = true; // Cannot split vertically, try horizontally
    } else {
      return; // Cannot split in either direction, stop here
    }
  }

  if (splitHorizontally) {
    // Horizontal split (creates top and bottom children)
    const splitMin = Math.floor(container.height * bspSplitRatio);
    const splitMax = container.height - splitMin;
    const splitY = rng.nextInt(splitMin, splitMax);

    const child1Height = splitY;
    const child2Height = container.height - splitY;

    // Ensure children are large enough
    if (child1Height < minContainerSize || child2Height < minContainerSize) {
      return; // Split would create invalid children, so stop
    }

    const child1 = new BspNode(new Rectangle(container.x, container.y, container.width, child1Height));
    const child2 = new BspNode(new Rectangle(container.x, container.y + splitY, container.width, child2Height));
    node.leftChild = child1;
    node.rightChild = child2;
  } else {
    // Vertical split (creates left and right children)
    const splitMin = Math.floor(container.width * bspSplitRatio);
    const splitMax = container.width - splitMin;
    const splitX = rng.nextInt(splitMin, splitMax);

    const child1Width = splitX;
    const child2Width = container.width - splitX;

    // Ensure children are large enough
    if (child1Width < minContainerSize || child2Width < minContainerSize) {
      return; // Split would create invalid children, so stop
    }

    const child1 = new BspNode(new Rectangle(container.x, container.y, child1Width, container.height));
    const child2 = new BspNode(new Rectangle(container.x + splitX, container.y, child2Width, container.height));
    node.leftChild = child1;
    node.rightChild = child2;
  }

  // Recurse into the newly created children
  recursiveSplit(node.leftChild, currentDepth + 1, config, rng);
  recursiveSplit(node.rightChild, currentDepth + 1, config, rng);
}

/**
 * Traverses the BSP tree and collects all leaf nodes.
 *
 * @param {BspNode} node - The root node of the tree to traverse.
 * @returns {BspNode[]} An array of all leaf nodes in the tree.
 */
function getLeafNodes(node) {
  if (node.isLeaf) {
    return [node];
  }
  const leaves = [];
  if (node.leftChild) {
    leaves.push(...getLeafNodes(node.leftChild));
  }
  if (node.rightChild) {
    leaves.push(...getLeafNodes(node.rightChild));
  }
  return leaves;
}

/**
 * Orchestrates the Binary Space Partitioning process.
 * It creates the root container, recursively splits it, and returns the leaf nodes
 * which represent the final areas for room placement.
 *
 * @param {object} config - The dungeon generation configuration object.
 * @param {import('../utils/rng.js').RNG} rng - The seeded random number generator.
 * @returns {BspNode[]} An array of leaf nodes, each representing a partition.
 */
export function performBsp(config, rng) {
  const { width, height } = config;

  if (width <= 0 || height <= 0) {
    throw new Error('Dungeon dimensions (width, height) must be positive integers.');
  }

  const rootContainer = new Rectangle(0, 0, width, height);
  const rootNode = new BspNode(rootContainer);

  recursiveSplit(rootNode, 0, config, rng);

  return getLeafNodes(rootNode);
}
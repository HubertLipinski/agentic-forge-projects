/**
 * @file examples/scene-graph.js
 * @description Demonstrates using the matrix library to manage transformations in a hierarchical scene graph.
 *
 * This example simulates a common scenario in graphics programming, computer-aided design (CAD),
 * or game development, where objects are organized in a parent-child hierarchy. Each object
 * (or "node") has its own local transformation (e.g., its position and rotation relative to its parent).
 * To find an object's final position, rotation, and scale in the "world" (the global coordinate system),
 * we must compose its local transformation with the world transformations of all its ancestors.
 *
 * This example defines:
 * 1. A `SceneNode` class to represent an object in the graph. Each node has a name, a local
 *    transformation matrix, and a list of children.
 * 2. A function `calculateWorldMatrix` that recursively traverses the graph to compute the
 *    final world matrix for any given node.
 * 3. A sample scene graph representing a simplified solar system (Sun -> Planet -> Moon) to
 *    showcase the concept.
 *
 * Running this script will output the calculated world positions of each celestial body,
 * demonstrating how the nested transformations accumulate.
 */

import { Matrix } from '../src/index.js';
import { PI } from '../src/utils/constants.js';

/**
 * Represents a node in a scene graph.
 * Each node has a local transformation relative to its parent and can have child nodes.
 */
class SceneNode {
  /**
   * @param {string} name - A descriptive name for the node (e.g., "Sun", "Player").
   * @param {Matrix} [localMatrix] - The node's transformation relative to its parent. Defaults to identity.
   */
  constructor(name, localMatrix = new Matrix()) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error('SceneNode must have a non-empty name.');
    }
    if (!(localMatrix instanceof Matrix)) {
      throw new TypeError('localMatrix must be an instance of Matrix.');
    }

    this.name = name;
    /** @type {Matrix} */
    this.localMatrix = localMatrix;
    /** @type {SceneNode | null} */
    this.parent = null;
    /** @type {SceneNode[]} */
    this.children = [];
  }

  /**
   * Adds a child node to this node.
   * Automatically sets the child's parent to this node.
   * @param {SceneNode} child - The child node to add.
   * @returns {this} The current node, for chaining.
   */
  addChild(child) {
    if (!(child instanceof SceneNode)) {
      throw new TypeError('Can only add SceneNode instances as children.');
    }
    if (child.parent) {
      // To maintain a strict tree structure, first remove from the old parent.
      child.parent.removeChild(child);
    }
    this.children.push(child);
    child.parent = this;
    return this;
  }

  /**
   * Removes a child node from this node.
   * @param {SceneNode} child - The child node to remove.
   * @returns {boolean} `true` if the child was found and removed, `false` otherwise.
   */
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
      return true;
    }
    return false;
  }
}

/**
 * Recursively calculates the world transformation matrix for a given scene node.
 *
 * The world matrix is the composition of the node's local matrix with the world
 * matrix of its parent. This process is repeated up to the root of the scene graph.
 *
 * @param {SceneNode} node - The node for which to calculate the world matrix.
 * @returns {Matrix} The final, composed world transformation matrix for the node.
 */
function calculateWorldMatrix(node) {
  if (!(node instanceof SceneNode)) {
    throw new TypeError('Input must be a SceneNode instance.');
  }

  // The base case: if the node has no parent, its world matrix is its local matrix.
  if (!node.parent) {
    return node.localMatrix;
  }

  // Recursive step: Get the parent's world matrix.
  const parentWorldMatrix = calculateWorldMatrix(node.parent);

  // Compose the parent's world matrix with this node's local matrix.
  // The order is crucial: parent's transform is applied first, then the child's local transform.
  // M_world_child = M_world_parent * M_local_child
  return parentWorldMatrix.multiply(node.localMatrix);
}

/**
 * Main function to set up and demonstrate the scene graph.
 */
function main() {
  console.log('--- Scene Graph Transformation Example ---');
  console.log('This example calculates the world positions of objects in a nested hierarchy.\n');

  // --- 1. Define the scene graph structure ---

  // The root of our scene graph. It sits at the world origin.
  const sceneRoot = new SceneNode('SceneRoot');

  // The Sun. It's positioned relative to the scene root.
  // Let's place it at (100, 100) in the world.
  const sun = new SceneNode('Sun', new Matrix().translate(100, 100));

  // A Planet. Its transformation is local to the Sun.
  // It orbits the Sun at a distance of 200 units. Let's say it's at a 45-degree angle.
  const planet = new SceneNode(
    'Planet',
    new Matrix().rotateDeg(45).translate(200, 0),
  );

  // A Moon. Its transformation is local to the Planet.
  // It orbits the Planet at a distance of 50 units and is also scaled down.
  // Let's place it at a -90-degree angle relative to the planet.
  const moon = new SceneNode(
    'Moon',
    new Matrix().rotateDeg(-90).translate(50, 0).scale(0.5),
  );

  // Build the hierarchy: SceneRoot -> Sun -> Planet -> Moon
  sceneRoot.addChild(sun);
  sun.addChild(planet);
  planet.addChild(moon);

  // --- 2. Calculate and display world transformations ---

  const nodesToInspect = [sun, planet, moon];

  for (const node of nodesToInspect) {
    try {
      console.log(`Calculating world transform for: ${node.name}`);

      // Calculate the final world matrix
      const worldMatrix = calculateWorldMatrix(node);

      // A node's world position is the translation component of its world matrix.
      // We can get this by transforming the origin point {x: 0, y: 0}.
      const worldPosition = worldMatrix.transformPoint({ x: 0, y: 0 });

      // We can also decompose the matrix to get rotation and scale.
      const decomposition = worldMatrix.decompose();
      const worldRotationDeg = decomposition.rotation * (180 / PI);
      const worldScale = decomposition.scale;

      console.log(`  - Local Matrix: ${node.localMatrix.toString()}`);
      console.log(`  - World Matrix: ${worldMatrix.toString()}`);
      console.log(`  - World Position: { x: ${worldPosition.x.toFixed(2)}, y: ${worldPosition.y.toFixed(2)} }`);
      console.log(`  - World Rotation: ${worldRotationDeg.toFixed(2)} degrees`);
      console.log(`  - World Scale: { x: ${worldScale.x.toFixed(2)}, y: ${worldScale.y.toFixed(2)} }\n`);

    } catch (error) {
      console.error(`Error processing node "${node.name}":`, error.message);
    }
  }

  console.log('--- Verification ---');
  console.log('Sun position should be (100, 100).');
  console.log('Planet is at 45deg from Sun, 200 units away. Pos = (100 + 200*cos(45), 100 + 200*sin(45)) ≈ (241.42, 241.42).');
  console.log('Moon is at -90deg from Planet, 50 units away. But the Planet system is rotated 45deg. So moon is at 45-90 = -45deg from Sun axis.');
  console.log('Moon Pos ≈ (241.42 + 50*cos(-45), 241.42 + 50*sin(-45)) ≈ (276.78, 206.07).\n');
}

// Execute the main function
main();
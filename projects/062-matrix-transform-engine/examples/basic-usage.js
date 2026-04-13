/**
 * @file examples/basic-usage.js
 * @description Demonstrates the basic features of the Matrix Transform Engine.
 *
 * This example covers:
 * 1. Creating an identity matrix.
 * 2. Chaining transformations (translate, rotate, scale) to create a complex matrix.
 * 3. Transforming a 2D point using the resulting matrix.
 * 4. Serializing the matrix to different formats (array, object, string).
 * 5. Inverting a matrix to "undo" a transformation.
 * 6. Decomposing a matrix to inspect its properties.
 *
 * To run this example from the project root, use the command:
 * `node examples/basic-usage.js`
 */

// Import the default Matrix class from the library's entry point.
import Matrix from '../src/index.js';

/**
 * A simple logging utility to format and print output sections.
 * @param {string} title - The title of the section to log.
 * @param {any} content - The content to display.
 */
function logSection(title, content) {
  console.log(`\n--- ${title} ---`);
  if (typeof content === 'object' && content !== null) {
    // Use JSON.stringify for a clean, indented object/array view.
    // A custom replacer handles floating point precision for cleaner output.
    const replacer = (key, value) =>
      typeof value === 'number' ? parseFloat(value.toFixed(4)) : value;
    console.log(JSON.stringify(content, replacer, 2));
  } else {
    console.log(content);
  }
}

/**
 * Main function to run the demonstration.
 * Using an async function for the main entry point is modern practice,
 * even if this specific script has no top-level await calls.
 */
async function main() {
  console.log('Matrix Transform Engine: Basic Usage Demonstration');
  console.log('=================================================');

  // --- 1. Creating a Matrix ---
  // A new matrix without arguments is an identity matrix (no transformation).
  const identityMatrix = new Matrix();
  logSection('1. Initial Identity Matrix', identityMatrix.toString());

  // --- 2. Chaining Transformations ---
  // The API is immutable and chainable. Each method returns a new Matrix instance.
  // Let's create a transformation that:
  //   a. Scales an object to 150% of its size.
  //   b. Rotates it by 45 degrees clockwise.
  //   c. Translates it 100 units to the right and 50 units down.
  // The order of operations is important! Here, we scale first, then rotate, then translate.
  const transformMatrix = new Matrix()
    .scale(1.5) // Uniform scale by 150%
    .rotateDeg(45) // Rotate 45 degrees
    .translate(100, 50); // Move 100 on x-axis, 50 on y-axis

  logSection('2. Chained Transformation Matrix (Scale -> Rotate -> Translate)', transformMatrix.toString());

  // --- 3. Transforming a Point ---
  // Let's define a point in our local coordinate system.
  const originalPoint = { x: 10, y: 20 };
  logSection('3a. Original Point', originalPoint);

  // Apply the transformation to the point.
  const transformedPoint = transformMatrix.transformPoint(originalPoint);
  logSection('3b. Transformed Point', transformedPoint);

  // --- 4. Matrix Serialization ---
  // The matrix can be converted to various formats.
  logSection('4a. Matrix as Array', transformMatrix.toArray());
  logSection('4b. Matrix as Object', transformMatrix.toObject());
  logSection('4c. Matrix as CSS String', transformMatrix.toString());

  // --- 5. Inverting a Matrix ---
  // The inverse matrix can transform a point from the "world" space back
  // to the original "local" space.
  try {
    const inverseMatrix = transformMatrix.invert();
    logSection('5a. Inverted Matrix', inverseMatrix.toString());

    // Applying the inverse matrix to the transformed point should return the original point.
    const revertedPoint = inverseMatrix.transformPoint(transformedPoint);
    logSection('5b. Point after applying Inverse Matrix (should be original)', revertedPoint);
  } catch (error) {
    console.error('Failed to invert matrix:', error.message);
  }

  // --- 6. Decomposing a Matrix ---
  // Decomposition breaks the matrix down into its fundamental components.
  // This is useful for inspection or for UIs that control individual transform properties.
  const decomposed = transformMatrix.decompose();
  logSection('6. Decomposed Matrix Properties', {
    translation: decomposed.translation,
    // Convert rotation back to degrees for readability.
    rotation_degrees: decomposed.rotation * (180 / Math.PI),
    scale: decomposed.scale,
    skew: decomposed.skew,
  });

  console.log('\nDemonstration complete.');
}

// Execute the main function and handle any potential top-level errors.
main().catch((error) => {
  console.error('\nAn unexpected error occurred during the demonstration:', error);
  process.exit(1);
});
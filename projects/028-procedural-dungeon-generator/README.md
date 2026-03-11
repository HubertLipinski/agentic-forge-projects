# Procedural Dungeon Generator

A zero-dependency Node.js library for creating procedural 2D tile-based dungeons. It's designed for developers building roguelike games, MUDs, or other procedurally generated worlds, providing a flexible engine to generate complex and varied map layouts with rooms and corridors.



## Features

-   **Binary Space Partitioning (BSP)**: Generates robust and organic layouts using the BSP algorithm.
-   **Highly Configurable**: Control dungeon dimensions, room sizes, padding, and generation depth.
-   **Seedable RNG**: Provides a seedable random number generator for creating reproducible maps.
-   **Fully Connected**: Guarantees that all generated rooms are connected by corridors.
-   **Simple Data Format**: Exports the map as a simple 2D array of tile types (`WALL`, `FLOOR`).
-   **Zero Dependencies**: The core library has no production dependencies, making it lightweight and easy to integrate.
-   **CLI Visualizer**: Includes a command-line tool for quickly generating and viewing dungeons in the terminal.

## Installation

You can add the library to your project via npm:

```bash
npm install procedural-dungeon-generator
```

Alternatively, you can clone the repository and install its development dependencies (for using the CLI tool):

```bash
git clone https://github.com/your-username/procedural-dungeon-generator.git
cd procedural-dungeon-generator
npm install
```

## Usage

### As a Library (API)

The primary way to use this package is by importing the `generateDungeon` function into your Node.js project.

```javascript
import { generateDungeon, TILE_TYPES } from 'procedural-dungeon-generator';

// Generate a dungeon with default settings
const { grid, rooms, seed } = generateDungeon();

// TILE_TYPES contains { WALL: 0, FLOOR: 1, DOOR: 2 }
// The `grid` is a 2D array of these tile type numbers.
grid.forEach(row => {
  const rowString = row.map(tile => {
    if (tile === TILE_TYPES.WALL) return '#';
    if (tile === TILE_TYPES.FLOOR) return '.';
    return '+'; // Door
  }).join('');
  console.log(rowString);
});
```

### With the CLI Visualizer

The package includes a handy CLI tool to visualize dungeons directly in your terminal. If installed globally or via `npx`, you can run it anywhere. Otherwise, run it from the project root.

```bash
# Generate a dungeon with default settings
npx procedural-dungeon-generator

# Or using the local binary after `npm install`
./node_modules/.bin/generate-dungeon

# Generate a larger dungeon with a specific seed for reproducibility
npx procedural-dungeon-generator --width 100 --height 60 --seed "my-cool-game"

# See all available options
npx procedural-dungeon-generator --help
```

### Configuration Options

You can pass a configuration object to `generateDungeon` to customize the output.

| Option             | Type                 | Default | Description                                                              |
| ------------------ | -------------------- | ------- | ------------------------------------------------------------------------ |
| `width`            | `number`             | `80`    | The width of the dungeon grid.                                           |
| `height`           | `number`             | `50`    | The height of the dungeon grid.                                          |
| `minRoomWidth`     | `number`             | `5`     | The minimum width of a room.                                             |
| `minRoomHeight`    | `number`             | `5`     | The minimum height of a room.                                            |
| `roomPadding`      | `number`             | `2`     | The minimum empty space (in tiles) to leave around each room.            |
| `bspDepth`         | `number`             | `4`     | The depth of the BSP tree. More depth = more rooms.                      |
| `seed`             | `number` \| `string` | `null`  | The seed for the RNG. `null` results in a time-based (random) seed.      |
| `maxRoomSizeRatio` | `number`             | `0.8`   | Max room size relative to its container (0.0-1.0).                       |
| `bspSplitRatio`    | `number`             | `0.4`   | The range for splitting BSP containers (e.g., 0.4 means 40%-60% split).  |

## Examples

### 1. Basic Usage

This example generates a dungeon with default settings and prints it to the console using simple characters.

```javascript
// examples/basic-usage.js
import { generateDungeon, TILE_TYPES } from 'procedural-dungeon-generator';

const { grid, rooms, seed, config } = generateDungeon();

console.log(`Generated a ${config.width}x${config.height} dungeon with ${rooms.length} rooms.`);
console.log(`Seed: ${seed}`);

const TILE_CHARACTERS = {
  [TILE_TYPES.WALL]: '#',
  [TILE_TYPES.FLOOR]: '.',
  [TILE_TYPES.DOOR]: '+',
};

const output = grid
  .map(row => row.map(tileId => TILE_CHARACTERS[tileId]).join(''))
  .join('\n');

console.log(output);
```

### 2. Custom Configuration

This example creates a larger, reproducible dungeon by providing a custom configuration object with a specific seed.

```javascript
// examples/custom-config.js
import { generateDungeon } from 'procedural-dungeon-generator';

const customConfig = {
  width: 100,
  height: 40,
  minRoomWidth: 6,
  roomPadding: 3,
  bspDepth: 5, // More potential rooms
  seed: 'a-very-specific-seed-123', // This map will always be the same
};

const { grid, rooms } = generateDungeon(customConfig);

console.log(`Generated a reproducible dungeon with ${rooms.length} rooms.`);
// ... (code to print the grid)
```

Running this script multiple times will produce the exact same map layout every time.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
# Terminal Roguelike Engine

A pure JavaScript engine for building turn-based roguelike games that run in the terminal. It provides core systems for map generation, field of view (FOV), pathfinding, and an entity-component-system (ECS) architecture, allowing developers to focus on game logic and content. Ideal for hobbyists and game jam participants wanting to create retro-style games without native dependencies.

## Features

-   **Entity-Component-System (ECS):** A clean, data-oriented architecture for game objects.
-   **Procedural Map Generation:** Uses a Recursive Backtracking algorithm for maze-like dungeons.
-   **Field of View (FOV):** Implements Recursive Shadowcasting for realistic line-of-sight.
-   **A\* Pathfinding:** Built-in pathfinding for intelligent NPC movement.
-   **Turn-Based Game Loop:** Classic roguelike game flow managed via `process.stdin`.
-   **Terminal Rendering:** Simple and fast rendering with colored output via `chalk`.
-   **Save/Load State:** Easily serialize and deserialize the entire game state to JSON.
-   **Zero Native Dependencies:** Runs anywhere Node.js runs.

## Installation

You can clone the repository and install the dependencies directly. This is the recommended approach for building your own game on top of the engine.

```bash
# Clone the repository
git clone https://github.com/your-username/terminal-roguelike-engine.git

# Navigate into the project directory
cd terminal-roguelike-engine

# Install dependencies
npm install
```

## Usage

The engine comes with a simple example game that demonstrates its core features. You can run it directly from the command line.

### Running the Example Game

To start a new game:

```bash
npm start
```

This command executes `bin/game.js`, which sets up and runs the example roguelike defined in `examples/simple-roguelike/`.

### Command-Line Options

The executable supports command-line arguments for loading games or using specific map generation seeds.

-   **Start a new game with a specific seed:**
    A seed ensures the map is generated the same way every time, which is great for debugging or sharing specific layouts.

    ```bash
    npm start -- --seed 12345
    ```

-   **Save and Load a Game:**
    1.  While in-game, press `s` to save the current state. A `savegame.json` file will be created.
    2.  To load the game later, use the `--load-game` flag:

    ```bash
    npm start -- --load-game savegame.json
    ```

### In-Game Controls

-   **Arrow Keys or `hjkl`**: Move the player character (`@`).
-   **`s`**: Save the game.
-   **`q`**: Quit the game.

## API Concepts & Tutorial

This section provides a brief overview of the engine's core concepts and a mini-tutorial on how to use them.

### 1. The `World` Object

The `World` is the heart of your game. It's a container for the three core ECS managers: `entityManager`, `componentManager`, and `systemManager`.

```javascript
// src/ecs/index.js provides the World class
import { World } from './src/ecs/index.js';

const world = new World();
// world.entityManager -> Manages entity creation/destruction
// world.componentManager -> Manages component data
// world.systemManager -> Manages and executes game logic (systems)
```

### 2. Defining Components

Components are pure data objects. You define them as simple factory functions or classes and register them with the `componentManager`.

**File: `my-game/components.js`**

```javascript
// A component for entities that have a position on the map.
export const Position = (x = 0, y = 0) => ({ x, y });

// A component for entities that can be rendered.
export const Renderable = (char = '?', color = 'white') => ({
  char,
  color,
  isVisible: true,
});

// A tag component to identify the player.
export const Player = () => ({});
```

### 3. Creating Entities

An entity is just an ID. You create one and then add components to it to give it properties.

**File: `my-game/main.js`**

```javascript
// ... imports and world setup ...

// Register components
world.componentManager.registerComponent('Position', Position);
world.componentManager.registerComponent('Renderable', Renderable);
world.componentManager.registerComponent('Player', Player);

// Create the player entity
const player = world.entityManager.createEntity();

// Add components to the player
world.componentManager.addComponent(player, 'Position', { x: 10, y: 5 });
world.componentManager.addComponent(player, 'Renderable', { char: '@', color: 'cyan' });
world.componentManager.addComponent(player, 'Player');
```

### 4. Writing Systems

Systems contain all your game logic. A system is an object with an `update` method that runs every game turn. It queries for entities with specific components and modifies their data.

**File: `my-game/systems.js`**

```javascript
// A system that handles player movement.
export class MovementSystem {
  update(world, { playerEntityId, playerAction }) {
    // Check if the action is a move action
    if (playerAction.type !== 'move') return;

    // Get all entities that can move (i.e., have a Position component)
    const entities = world.componentManager.queryEntitiesByComponents(['Position']);

    for (const entityId of entities) {
      // We only care about moving the player in this system
      if (entityId !== playerEntityId) continue;

      const position = world.componentManager.getComponent(entityId, 'Position');
      const { dx, dy } = playerAction.payload;

      const newX = position.x + dx;
      const newY = position.y + dy;

      // TODO: Add collision detection with walls and other entities!
      position.x = newX;
      position.y = newY;
    }
  }
}
```

### 5. Tying It All Together

Finally, you instantiate your systems, register them with the `systemManager`, and start the main `GameLoop`.

**File: `my-game/main.js`**

```javascript
import { World } from './src/ecs/index.js';
import { GameLoop } from './src/core/game-loop.js';
import { Renderer } from './src/core/renderer.js';
import { InputHandler } from './src/core/input-handler.js';
import { MovementSystem } from './my-game/systems.js';
// ... other imports ...

// 1. Create the world
const world = new World();

// 2. Register components (as shown above)
// ...

// 3. Create entities (player, monsters, etc.)
const player = createPlayer(world, 10, 5); // Assume this function exists

// 4. Register systems
world.systemManager.registerSystem(new MovementSystem());
// world.systemManager.registerSystem(new AISystem());
// world.systemManager.registerSystem(new CombatSystem());

// 5. Set up core engine services
const renderer = new Renderer({ width: 80, height: 24 });
const inputHandler = new InputHandler();
const gameLoop = new GameLoop({ world, renderer, inputHandler });

// 6. Start the game!
gameLoop.start(player);
```

This structure allows you to build complex game mechanics by creating small, focused components and systems that operate on them, keeping your code organized and easy to manage.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
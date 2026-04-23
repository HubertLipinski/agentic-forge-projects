# Telnet Roguelike Engine

A feature-rich engine for creating text-based, multiplayer roguelike games accessible via a standard Telnet client. It provides a complete server, entity-component-system (ECS) architecture, and hooks for custom game logic, allowing developers to focus on building their game world, not the underlying network and rendering infrastructure.



## Features

-   **Built-in Telnet Server**: Handles multiple concurrent client connections using Node.js's `net` module.
-   **Terminal Rendering**: Uses ANSI escape codes for color and cursor positioning to create a rich, terminal-based display.
-   **Entity-Component-System (ECS)**: A flexible and data-driven architecture for creating and managing all game objects.
-   **Turn-Based Game Loop**: Manages game turns, processes player actions, and updates the world state.
-   **Procedural Map Generation**: Includes algorithms like Cellular Automata to create unique, cave-like maps for every game.
-   **Configurable via JSON**: Define monsters, items, and other game data in simple JSON files.
-   **Event-Driven**: A world-level event emitter decouples game logic (e.g., `onPlayerMove`, `onEntityDamaged`).
-   **CLI for Server Management**: Start the game server with custom configurations using a simple command-line interface.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/telnet-roguelike-engine.git
    cd telnet-roguelike-engine
    ```

2.  Install the dependencies:
    ```bash
    npm install
    ```

3.  (Optional) Make the CLI globally available:
    ```bash
    npm link
    ```

## Usage

You can start the game server using the provided CLI. The engine comes with a default game configuration to get you started immediately.

### Starting the Server

To start the server with the default game configuration, run:

```bash
npm start
```

Or, if you used `npm link`:

```bash
telnet-roguelike
```

The server will start on the default port (2323) and load the game defined in `games/default/main.js`.

### Connecting with a Telnet Client

Once the server is running, you can connect using any standard Telnet client.

```bash
telnet localhost 2323
```

On Windows, you may need to enable the Telnet client feature first. On macOS and Linux, it's typically available by default.

### CLI Options

The CLI supports several options to customize the server and game instance.

```bash
telnet-roguelike [options]

Options:
  --help      Show help                                                [boolean]
  --version   Show version number                                      [boolean]
  --port, -p  The port to run the Telnet server on.        [number] [default: 2323]
  --game, -g  Path to the game entry file.
                         [string] [default: "games/default/main.js"]
  --log, -l   Set the logging level (error, warn, info, debug).
                                                          [string] [default: "info"]
```

## Examples

### Start the server on a different port

If port 2323 is already in use, you can easily switch to another one.

```bash
telnet-roguelike --port 8000
```

**Expected Output (Server Console):**
```
15:30:00.123  INFO [World] Added system: MovementSystem
15:30:00.124  INFO [World] Added system: CombatSystem
15:30:00.125  INFO [World] Added system: RenderSystem
15:30:00.126  INFO [GameInstance] Game instance initialized for games/default/main.js
15:30:00.127  INFO [TelnetServer] Telnet server started on port 8000
```

### Run a different game configuration

You can create a new game directory and point the engine to it. For example, if you create `games/my-awesome-game/start.js`:

```bash
telnet-roguelike --game "games/my-awesome-game/start.js"
```

### Enable debug logging

For development and troubleshooting, you can increase the log verbosity to see detailed ECS and game loop events.

```bash
telnet-roguelike --log debug
```

**Expected Output (Server Console):**
```
15:35:10.500 DEBUG [World] Created entity 2a1b3c4d-....
15:35:10.501 DEBUG [World] Created new query for components: [Position, WantsToMove]
15:35:11.800 DEBUG [MovementSystem] Entity 2a1b3c4d-... moved to (11, 23)
```

## Architecture Overview

The engine is built around a modern **Entity-Component-System (ECS)** architecture.

*   **Entities**: Simple objects with a unique ID. They are just containers and have no data or logic themselves. (e.g., the player, a goblin, a health potion).
*   **Components**: Pure data containers that represent a single aspect of an entity. They have no logic. (e.g., `Position`, `Renderable`, `CombatStats`).
*   **Systems**: The logic that operates on entities with specific sets of components. All game rules and behaviors are implemented in systems. (e.g., `MovementSystem`, `CombatSystem`, `RenderSystem`).
*   **World**: The central container that manages all entities, components, and systems. It runs the main update loop and provides an event bus for decoupled communication.

This design promotes composition over inheritance, making it easy to create complex game objects by simply attaching different combinations of components.

## Creating a New Game

To create your own game using the engine, follow these steps:

1.  **Create a Game Directory**:
    Create a new folder inside the `games/` directory. For example, `games/my-dungeon/`.

2.  **Add Configuration Files**:
    Inside `games/my-dungeon/`, create a `config/` folder. Here, you can add JSON files to define your game's data, such as `monsters.json` and `items.json`. You can copy the files from `games/default/config/` as a starting point.

    `games/my-dungeon/config/monsters.json`:
    ```json
    {
      "slime": {
        "name": "Green Slime",
        "renderable": { "glyph": "s", "fg": "#00FF00" },
        "combatStats": { "maxHp": 10, "defense": 0, "power": 2 }
      }
    }
    ```

3.  **Create the Game Entry Point**:
    Create a main file for your game, e.g., `games/my-dungeon/main.js`. This file will be responsible for initializing the `GameInstance` with your custom components, systems, and configurations.

    `games/my-dungeon/main.js`:
    ```javascript
    import GameInstance from '../../src/game/game-instance.js';
    import { Position, Renderable } from '../../src/game/components/index.js';
    // Import your custom systems if you have any
    // import MyMagicSystem from './systems/my-magic-system.js';

    /**
     * This function is called by the engine to set up and run the game.
     * @param {GameInstance} game - The game instance to configure.
     */
    export default function setupGame(game) {
      // 1. Load custom config files
      game.loadMonsterConfig('games/my-dungeon/config/monsters.json');

      // 2. Add custom systems (optional)
      // game.world.addSystem(new MyMagicSystem());

      // 3. Define the player creation logic
      game.setPlayerFactory((playerEntity) => {
        playerEntity
          .add(new Position(10, 10))
          .add(new Renderable({ glyph: '@', fg: '#FFFFFF', renderOrder: 99 }));
        // Add other player-specific components
      });

      // 4. Start the game loop
      game.start();
    }
    ```

4.  **Run Your Game**:
    Start the server and point it to your new game's entry file.

    ```bash
    telnet-roguelike --game "games/my-dungeon/main.js"
    ```

Now, when players connect, they will be playing your custom game!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
# Procedural Dungeon Net

## Description

Procedural Dungeon Net is a headless Node.js engine for generating and simulating persistent, multi-agent procedural dungeons. It's designed as a backend for text-based games like MUDs or Roguelikes, managing dungeon state, layout, NPCs, and items over a TCP socket. This allows multiple clients to connect and interact within a shared, dynamic world.

The engine features procedural dungeon generation using a Binary Space Partitioning (BSP) algorithm, persistent world state with periodic disk snapshots, and independent NPC agent simulation via a Finite State Machine.

## Features

-   **Procedural Dungeon Generation**: Creates unique dungeon layouts with rooms and corridors using a modified Binary Space Partitioning (BSP) algorithm.
-   **Deterministic Generation**: Uses a numeric seed for reproducible dungeon layouts.
-   **Persistent World State**: Automatically saves the game state (map, actors, etc.) to a JSON file at regular intervals and on shutdown.
-   **Multi-Client TCP Server**: Manages multiple concurrent client connections, allowing for a shared multiplayer experience.
-   **NPC Simulation**: NPCs operate independently using a Finite State Machine (FSM) with states like `idle`, `wander`, and `aggro`.
-   **A\* Pathfinding**: Efficiently calculates paths for NPC movement and navigation.
-   **Command-Line Interface**: Start and manage the server with simple CLI commands.
-   **Event-Driven Architecture**: A simple event bus decouples game logic for easy extension.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/procedural-dungeon-net.git
    cd procedural-dungeon-net
    ```

2.  Install the dependencies:
    ```bash
    npm install
    ```

3.  Make the CLI script executable (on Unix-like systems):
    ```bash
    npm link
    ```
    This will make the `dungeon-net` command available globally.

## Usage

The server is controlled via the `dungeon-net` command-line interface.

**Start the server:**

The `start` command initializes and runs the server. It will either generate a new world or load an existing one from a snapshot file.

```bash
dungeon-net start [options]
```

**CLI Options:**

-   `--port`, `-p`: The TCP port to listen on. (Default: `8080`)
-   `--host`, `-h`: The host address to bind to. (Default: `127.0.0.1`)
-   `--seed`, `-s`: A numeric seed for deterministic dungeon generation. (Required for a new world)
-   `--width`: Width of the new dungeon map. (Default: `80`)
-   `--height`: Height of the new dungeon map. (Default: `50`)
-   `--snapshot`, `-f`: Path to the world state snapshot file. (Default: `./world-state.json`)
-   `--help`: Show help.

## Examples

### 1. Starting a New World

To start a new server with a freshly generated dungeon, you must provide a seed.

```bash
dungeon-net start --seed 12345
```

The server will start on `127.0.0.1:8080`, generate a new 80x50 dungeon using the seed `12345`, and create a `world-state.json` file in the current directory to persist the state.

### 2. Resuming a Saved World

If a `world-state.json` file exists, you can simply run the `start` command without a seed to load the saved state.

```bash
dungeon-net start
```

The server will load the map, actors, and their positions from `world-state.json` and resume the simulation.

### 3. Connecting to the Server

You can connect to the running server using any standard TCP client, such as `telnet` or `netcat`.

```bash
telnet 127.0.0.1 8080
```

**Expected Output upon Connection:**

Upon connecting, you will be assigned a name and placed in the dungeon. You'll receive a welcome message and a description of your surroundings.

```
Welcome to the dungeon, Player-A4B2!
You are at (40, 25).
You see a vast room. The air is still and damp.
Exits: north, south, east, west
>
```

**Interacting with the World:**

You can issue simple commands to interact with the world.

-   `move <direction>` (e.g., `move north`)
-   `look`
-   `say <message>`

```
> move north
You move north.
You are at (40, 24).
You see a vast room. The air is still and damp.
Exits: north, south, east, west
>
```

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
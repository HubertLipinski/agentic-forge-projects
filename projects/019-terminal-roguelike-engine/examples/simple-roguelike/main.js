/**
 * @file examples/simple-roguelike/main.js
 * @description An example demonstrating how to use the engine to build and run a simple roguelike game.
 *
 * This file sets up a basic game world, including:
 * - Registering custom components (`Position`, `Renderable`, `Player`, `Monster`, etc.).
 * - Registering systems that define game logic (`MovementSystem`, `VisionSystem`, `AISystem`, `CombatSystem`, `DeathSystem`).
 * - Generating a map and populating it with a player and monsters.
 * - Initializing and starting the main game loop.
 */

import { World } from '../../src/ecs/index.js';
import { MapGenerator } from '../../src/map/generator.js';
import { RNG } from '../../src/utils/rng.js';
import {
  Position,
  Renderable,
  Player,
  Monster,
  FieldOfView,
  Health,
  CombatStats,
  TakesTurn,
  Name,
  MessageLog,
} from './components.js';
import {
  MovementSystem,
  VisionSystem,
  AISystem,
  CombatSystem,
  DeathSystem,
  MessageSystem,
} from './systems.js';

/**
 * Creates and populates the ECS world for the game.
 *
 * @param {object} options - Configuration options.
 * @param {import('../../src/map/tile.js').Tile[][]} options.map - The game map.
 * @param {{x: number, y: number}} options.playerStartPosition - The player's starting position.
 * @returns {{world: World, player: string}} An object containing the configured world and the player entity ID.
 */
function createWorld({ map, playerStartPosition }) {
  const world = new World();

  // --- Register Components ---
  // This step tells the ComponentManager about the kinds of data we'll be using.
  world.componentManager.registerComponent('Position', Position);
  world.componentManager.registerComponent('Renderable', Renderable);
  world.componentManager.registerComponent('Player', Player);
  world.componentManager.registerComponent('Monster', Monster);
  world.componentManager.registerComponent('FieldOfView', FieldOfView);
  world.componentManager.registerComponent('Health', Health);
  world.componentManager.registerComponent('CombatStats', CombatStats);
  world.componentManager.registerComponent('TakesTurn', TakesTurn);
  world.componentManager.registerComponent('Name', Name);
  world.componentManager.registerComponent('MessageLog', MessageLog);

  // --- Register Systems ---
  // This step defines the game's logic and the order in which it executes each turn.
  // Order is critical: input/movement should happen before AI, combat before death, etc.
  world.systemManager.registerSystem(new MessageSystem());
  world.systemManager.registerSystem(new MovementSystem());
  world.systemManager.registerSystem(new VisionSystem());
  world.systemManager.registerSystem(new AISystem());
  world.systemManager.registerSystem(new CombatSystem());
  world.systemManager.registerSystem(new DeathSystem());

  // --- Create Player Entity ---
  const player = world.entityManager.createEntity();
  world.componentManager.addComponent(player, 'Player');
  world.componentManager.addComponent(player, 'Position', {
    ...playerStartPosition,
  });
  world.componentManager.addComponent(player, 'Renderable', {
    char: '@',
    color: 'white',
    layer: 3, // Render player on top of monsters/items.
  });
  world.componentManager.addComponent(player, 'FieldOfView', {
    radius: 8,
    visibleTiles: new Set(),
  });
  world.componentManager.addComponent(player, 'Health', { current: 30, max: 30 });
  world.componentManager.addComponent(player, 'CombatStats', { power: 5, defense: 2 });
  world.componentManager.addComponent(player, 'Name', { name: 'You' });

  // --- Create Game State Entity ---
  // A singleton entity to hold global game state like the message log.
  const gameState = world.entityManager.createEntity();
  world.componentManager.addComponent(gameState, 'MessageLog', {
    messages: ['Welcome to the dungeon! Use arrow keys to move.'],
  });

  // --- Create Monster Entities ---
  populateMonsters(world, map, player);

  return { world, player };
}

/**
 * Scatters monsters randomly across the map.
 *
 * @param {World} world - The ECS world.
 * @param {import('../../src/map/tile.js').Tile[][]} map - The game map.
 * @param {string} playerEntityId - The ID of the player entity, to avoid placing monsters on top of the player.
 */
function populateMonsters(world, map, playerEntityId) {
  const rng = new RNG(); // Use a new RNG for monster placement.
  const width = map[0].length;
  const height = map.length;
  const maxMonsters = 10;

  const playerPos = world.componentManager.getComponent(playerEntityId, 'Position');

  for (let i = 0; i < maxMonsters; i++) {
    let x, y;
    // Find a random, walkable tile that isn't occupied by the player.
    do {
      x = rng.nextInt(1, width - 1);
      y = rng.nextInt(1, height - 1);
    } while (!map[y][x].isWalkable || (x === playerPos.x && y === playerPos.y));

    const monsterType = rng.choice(['orc', 'goblin']);
    const monster = world.entityManager.createEntity();

    world.componentManager.addComponent(monster, 'Position', { x, y });
    world.componentManager.addComponent(monster, 'Monster');
    world.componentManager.addComponent(monster, 'TakesTurn');

    if (monsterType === 'orc') {
      world.componentManager.addComponent(monster, 'Renderable', {
        char: 'o',
        color: 'desaturatedGreen',
        layer: 2,
      });
      world.componentManager.addComponent(monster, 'Name', { name: 'Orc' });
      world.componentManager.addComponent(monster, 'Health', { current: 12, max: 12 });
      world.componentManager.addComponent(monster, 'CombatStats', { power: 4, defense: 1 });
    } else { // goblin
      world.componentManager.addComponent(monster, 'Renderable', {
        char: 'g',
        color: 'darkGreen',
        layer: 2,
      });
      world.componentManager.addComponent(monster, 'Name', { name: 'Goblin' });
      world.componentManager.addComponent(monster, 'Health', { current: 8, max: 8 });
      world.componentManager.addComponent(monster, 'CombatStats', { power: 3, defense: 0 });
    }
  }
}

/**
 * The main function to initialize and run the simple roguelike game.
 * This function is exported so it can be called by the main executable script (`bin/game.js`).
 *
 * @param {object} options - Game initialization options.
 * @param {number} [options.width=80] - The width of the game map.
 * @param {number} [options.height=24] - The height of the game map.
 * @param {number} [options.seed] - An optional seed for map generation.
 * @returns {{world: World, player: string, map: import('../../src/map/tile.js').Tile[][]}} The initialized game state.
 */
export function setupGame({ width = 80, height = 23, seed } = {}) {
  // Ensure dimensions are odd for the map generator
  const mapWidth = width % 2 === 0 ? width - 1 : width;
  const mapHeight = height % 2 === 0 ? height - 1 : height;

  // --- Generate Map ---
  const mapGenerator = new MapGenerator({
    width: mapWidth,
    height: mapHeight,
    seed,
  });
  const { map, startPosition } = mapGenerator.generate();

  // --- Create World and Entities ---
  const { world, player } = createWorld({
    map,
    playerStartPosition: startPosition,
  });

  return { world, player, map };
}
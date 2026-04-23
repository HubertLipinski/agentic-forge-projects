/**
 * @file src/game/game-instance.js
 * @description Manages a single game session, tying together the ECS world, game loop, and map.
 * This class acts as the central coordinator for a running game.
 */

import World from '../ecs/world.js';
import GameLoop from './game-loop.js';
import GameMap from '../world/game-map.js';
import MapGenerator from '../world/map-generator.js';
import logger from '../utils/logger.js';
import {
    Position,
    Renderable,
    Player,
    Viewshed,
    Name,
    Stats,
    CombatStats,
    BlocksTile,
    Ai
} from './components/index.js';
import MovementSystem from './systems/movement-system.js';
import RenderSystem from './systems/render-system.js';
import CombatSystem from './systems/combat-system.js';

/**
 * @typedef {import('../net/telnet-client.js').default} TelnetClient
 * @typedef {import('../ecs/entity.js').default} Entity
 */

/**
 * GameInstance orchestrates the entire game session. It is responsible for:
 * - Initializing the ECS World and registering systems.
 * - Generating the game map.
 * - Managing the main game loop.
 * - Handling player connections and disconnections by creating/destroying player entities.
 * - Spawning monsters and other initial game objects.
 */
export default class GameInstance {
    /**
     * The main ECS container for this game session.
     * @type {World}
     */
    world;

    /**
     * The main game loop manager.
     * @type {GameLoop}
     */
    gameLoop;

    /**
     * The data structure representing the game map.
     * @type {GameMap}
     */
    gameMap;

    /**
     * A map of connected Telnet clients, keyed by their associated player entity ID.
     * @type {Map<string, TelnetClient>}
     */
    clients = new Map();

    /**
     * Configuration for the game, such as map dimensions and monster definitions.
     * @type {object}
     * @private
     */
    #config;

    /**
     * @param {object} config - Game configuration options.
     * @param {object} config.map - Map generation settings (width, height, etc.).
     * @param {object} config.monsters - Monster template data loaded from JSON.
     */
    constructor(config) {
        if (!config || !config.map || !config.monsters) {
            throw new Error('GameInstance requires a valid configuration object with map and monster settings.');
        }
        this.#config = config;
        this.world = new World();
        this.gameLoop = new GameLoop(this);

        this.#initialize();
    }

    /**
     * Sets up the game world, systems, and map.
     * @private
     */
    #initialize() {
        logger.info('Initializing game instance...');

        // 1. Register all game systems with the ECS World.
        // The order is important: Movement and Combat should run before Render.
        this.world.addSystem(new MovementSystem());
        this.world.addSystem(new CombatSystem());
        // RenderSystem should be last to draw the final state of the turn.
        this.world.addSystem(new RenderSystem());

        // 2. Generate the game map.
        const { width, height } = this.#config.map;
        const mapGenerator = new MapGenerator(width, height);
        this.gameMap = mapGenerator.generateCellularAutomata();

        // 3. Populate the map with monsters.
        this.#spawnMonsters();

        logger.info('Game instance initialized successfully.');
    }

    /**
     * Starts the main game loop.
     */
    start() {
        if (!this.gameLoop.isRunning()) {
            logger.info('Starting game loop...');
            this.gameLoop.start();
        }
    }

    /**
     * Stops the main game loop.
     */
    stop() {
        if (this.gameLoop.isRunning()) {
            logger.info('Stopping game loop...');
            this.gameLoop.stop();
        }
    }

    /**
     * Handles a new player connecting to the game.
     * @param {TelnetClient} client - The Telnet client for the new player.
     */
    addPlayer(client) {
        logger.info(`Adding new player: ${client.id}`);

        // Find a suitable starting position for the player.
        const startPos = this.gameMap.getRandomFloorPosition();
        if (!startPos) {
            logger.error('Could not find a starting position for the new player. Map may be full or invalid.');
            client.end('Server error: Could not place you in the world. Please try again later.');
            return;
        }

        // Create the player entity and add its components.
        const playerEntity = this.world.createEntity(client.id);
        playerEntity.add(new Position(startPos));
        playerEntity.add(new Renderable({ glyph: '@', fg: '#FFFF00', renderOrder: 100 }));
        playerEntity.add(new Player({ name: `Player ${client.id.substring(0, 4)}` }));
        playerEntity.add(new Name({ name: 'You' }));
        playerEntity.add(new Viewshed({ range: 8, isDirty: true }));
        playerEntity.add(new CombatStats({ maxHp: 100, hp: 100, defense: 2, power: 5 }));
        playerEntity.add(new Stats({ level: 1, xp: 0, nextLevelXp: 100 }));
        playerEntity.add(new BlocksTile());

        // Mark the player's starting position on the map.
        this.gameMap.setEntityAt(startPos.x, startPos.y, playerEntity.id);

        // Associate the client with the player entity.
        this.clients.set(playerEntity.id, client);

        // Add the player's input actions to the game loop's queue.
        client.on('action', (action) => {
            this.gameLoop.addPlayerAction(playerEntity.id, action);
        });

        // Initial FOV calculation and map reveal.
        this.gameMap.computeFov(startPos, 8, true);

        logger.info(`Player ${playerEntity.id} created at (${startPos.x}, ${startPos.y})`);
    }

    /**
     * Handles a player disconnecting from the game.
     * @param {string} clientId - The ID of the client/player that disconnected.
     */
    removePlayer(clientId) {
        const playerEntity = this.world.getEntity(clientId);
        if (!playerEntity) {
            logger.warn(`Attempted to remove non-existent player with ID: ${clientId}`);
            return;
        }

        logger.info(`Removing player: ${clientId}`);

        // Clean up resources associated with the player.
        const position = playerEntity.get(Position);
        if (position) {
            this.gameMap.removeEntityAt(position.x, position.y);
        }

        this.clients.delete(clientId);
        this.world.removeEntity(clientId);

        logger.info(`Player ${clientId} removed successfully.`);
    }

    /**
     * Populates the map with monsters based on the game configuration.
     * @private
     */
    #spawnMonsters() {
        const { maxMonstersPerRoom } = this.#config.map;
        const monsterTemplates = this.#config.monsters;
        const monsterKeys = Object.keys(monsterTemplates);

        if (monsterKeys.length === 0) {
            logger.warn('No monster templates found in configuration. No monsters will be spawned.');
            return;
        }

        logger.info('Spawning monsters...');
        let monstersSpawned = 0;

        // Iterate over rooms (excluding the first one where the player might start).
        for (const room of this.gameMap.rooms.slice(1)) {
            const numMonsters = Math.floor(Math.random() * (maxMonstersPerRoom + 1));

            for (let i = 0; i < numMonsters; i++) {
                const pos = this.gameMap.getRandomPositionInRoom(room);
                if (pos && !this.gameMap.getEntityAt(pos.x, pos.y)) {
                    const monsterKey = monsterKeys[Math.floor(Math.random() * monsterKeys.length)];
                    this.#createMonster(monsterKey, pos);
                    monstersSpawned++;
                }
            }
        }
        logger.info(`Spawned ${monstersSpawned} monsters.`);
    }

    /**
     * Creates a single monster entity at a given position.
     * @param {string} monsterKey - The key for the monster template (e.g., "goblin").
     * @param {{x: number, y: number}} pos - The position to spawn the monster.
     * @private
     */
    #createMonster(monsterKey, pos) {
        const template = this.#config.monsters[monsterKey];
        if (!template) {
            logger.warn(`Attempted to create monster with unknown template key: ${monsterKey}`);
            return;
        }

        const monster = this.world.createEntity();
        monster.add(new Position(pos));
        monster.add(new Renderable(template.renderable));
        monster.add(new Name({ name: template.name }));
        monster.add(new Viewshed(template.viewshed));
        // Use structuredClone to ensure each monster gets its own mutable stats object.
        monster.add(new CombatStats(structuredClone(template.combatStats)));
        monster.add(new BlocksTile());
        if (template.ai) {
            monster.add(new Ai(template.ai));
        }

        this.gameMap.setEntityAt(pos.x, pos.y, monster.id);
    }
}
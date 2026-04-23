/**
 * @file games/default/main.js
 * @description Entry point for the "default" game.
 * This file demonstrates how to configure and start a game instance using the
 * Telnet Roguelike Engine. It sets up the game world, registers systems,
 * defines entity creation logic, and hooks into the engine's lifecycle.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

// Engine Core
import GameInstance from '../../src/game/game-instance.js';
import logger from '../../src/utils/logger.js';
import { loadConfig } from '../../src/config/loader.js';

// Game-specific Components and Systems
import * as components from '../../src/game/components/index.js';
import MovementSystem from '../../src/game/systems/movement-system.js';
import RenderSystem from '../../src/game/systems/render-system.js';
import CombatSystem from '../../src/game/systems/combat-system.js';

// Constants
const __dirname = dirname(fileURLToPath(import.meta.url));
const MONSTER_CONFIG_PATH = join(__dirname, 'config', 'monsters.json');
const MAX_MONSTERS_PER_LEVEL = 5;

/**
 * Creates and configures a new GameInstance for the default game.
 * This function encapsulates the entire setup process for a new game session.
 *
 * @returns {Promise<GameInstance>} A promise that resolves with the fully configured GameInstance.
 */
export async function createDefaultGame() {
    logger.info('Creating default game instance...');

    const game = new GameInstance({
        mapWidth: 80,
        mapHeight: 40,
    });

    // 1. Register Systems
    // The order of registration is important as it determines the execution order.
    game.world.addSystem(new MovementSystem());
    game.world.addSystem(new CombatSystem());
    // RenderSystem should usually be last to draw the final state of the turn.
    game.world.addSystem(new RenderSystem());
    logger.info('Registered core game systems.');

    // 2. Load Game Data
    // Load monster definitions from the JSON configuration file.
    const monsterTemplates = await loadConfig(MONSTER_CONFIG_PATH);
    if (!monsterTemplates) {
        // loadConfig will log the error, but we should stop initialization.
        throw new Error('Failed to load monster configuration. Cannot start game.');
    }
    logger.info(`Loaded ${Object.keys(monsterTemplates).length} monster templates.`);

    // 3. Define Game Logic Hooks
    // The engine uses event-driven hooks to allow for custom game logic.

    /**
     * Hook for when a new player connects and needs to be added to the world.
     * @param {object} event - The event data.
     * @param {import('../../src/ecs/entity.js').default} event.playerEntity - The newly created player entity.
     * @param {import('../../src/world/game-map.js').default} event.map - The game map.
     */
    game.on('player:create', ({ playerEntity, map }) => {
        const { x, y } = map.getEmptyTile();
        logger.info(`Spawning new player ${playerEntity.id} at (${x}, ${y})`);

        playerEntity.add(new components.Position({ x, y }));
        playerEntity.add(new components.Renderable({ glyph: '@', fg: '#FFFF00', renderOrder: 100 }));
        playerEntity.add(new components.Player());
        playerEntity.add(new components.Name({ name: 'Player' }));
        playerEntity.add(new components.Viewshed({ range: 8, isDirty: true }));
        playerEntity.add(new components.CombatStats({ maxHp: 100, hp: 100, defense: 2, power: 5 }));
        playerEntity.add(new components.Stats({ level: 1, xp: 0, nextLevelXp: 100 }));
        playerEntity.add(new components.BlocksTile());

        // Update the map with the player's initial position
        map.setEntityAt(x, y, playerEntity.id);
        map.recalculateFov(x, y, 8);
    });

    /**
     * Hook for populating the map with monsters.
     * This is called when the game instance initializes its map.
     * @param {object} event - The event data.
     * @param {import('../../src/world/game-map.js').default} event.map - The game map.
     * @param {import('../../src/ecs/world.js').default} event.world - The ECS world.
     */
    game.on('map:populate', ({ map, world }) => {
        logger.info(`Populating map with up to ${MAX_MONSTERS_PER_LEVEL} monsters.`);
        const monsterKeys = Object.keys(monsterTemplates);
        if (monsterKeys.length === 0) {
            logger.warn('No monster templates found to populate the map.');
            return;
        }

        const monsterCount = Math.floor(Math.random() * MAX_MONSTERS_PER_LEVEL) + 1;
        for (let i = 0; i < monsterCount; i++) {
            try {
                const { x, y } = map.getEmptyTile();
                const monsterKey = monsterKeys[Math.floor(Math.random() * monsterKeys.length)];
                const template = monsterTemplates[monsterKey];

                const monster = world.createEntity();
                monster.add(new components.Position({ x, y }));
                monster.add(new components.Renderable(template.renderable));
                monster.add(new components.Name({ name: template.name }));
                monster.add(new components.Viewshed({ ...template.viewshed, isDirty: true }));
                // Create a fresh copy of combat stats for each monster
                monster.add(new components.CombatStats({ ...template.combatStats, hp: template.combatStats.maxHp }));
                monster.add(new components.BlocksTile());
                // TODO: Implement AI system and component
                // monster.add(new components.Ai(template.ai));

                map.setEntityAt(x, y, monster.id);
                logger.debug(`Spawned ${template.name} at (${x}, ${y})`);
            } catch (error) {
                logger.error('Failed to spawn a monster:', error.message);
                // This can happen if getEmptyTile() fails, e.g., map is full.
                // We can break the loop to prevent spamming errors.
                break;
            }
        }
    });

    /**
     * Hook for handling player death.
     * @param {object} event - The event data.
     * @param {import('../../src/ecs/entity.js').default} event.player - The player entity that died.
     */
    game.on('player-death', ({ player }) => {
        logger.info(`Player ${player.id} has been defeated.`);
        // In a real game, this might trigger a "Game Over" state,
        // disconnect the client, or move them to a spectator mode.
        // For now, we just log it. The CombatSystem already handles changing
        // the player's appearance to a corpse.
    });

    // 4. Initialize the Game Instance
    // This generates the map and triggers the 'map:populate' event.
    await game.initialize();
    logger.info(chalk.green.bold('Default game instance created and initialized successfully.'));

    return game;
}
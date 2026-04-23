import chalk from 'chalk';
import System from '../../ecs/system.js';
import { Position, Renderable, Player, Viewshed, Name, Stats, CombatStats } from '../components/index.js';
import logger from '../../utils/logger.js';

/**
 * @typedef {import('../../ecs/world.js').default} World
 * @typedef {import('../../world/game-map.js').default} GameMap
 * @typedef {import('../../net/telnet-client.js').default} TelnetClient
 */

/**
 * The RenderSystem is responsible for drawing the game state to each player's screen buffer.
 * It iterates through player entities, calculates what they can see, and constructs the
 * complete screen output, including the map, entities, UI, and messages.
 */
export default class RenderSystem extends System {
    /**
     * The query for player entities that need their screen rendered.
     * @type {import('../../ecs/world.js').Query}
     */
    #playerQuery;

    /**
     * The query for all renderable entities on the map.
     * @type {import('../../ecs/world.js').Query}
     */
    #renderableQuery;

    /**
     * Creates an instance of RenderSystem.
     */
    constructor() {
        super();
        // We only render for players. A player is an entity with Player, Position, and Viewshed components.
        this.#playerQuery = this.world.createQuery(Player, Position, Viewshed);
        // We need to be able to draw any entity that has a visual representation and a location.
        this.#renderableQuery = this.world.createQuery(Position, Renderable);
    }

    /**
     * Executes the rendering logic for each player.
     * @param {World} world - The ECS world.
     * @param {GameMap} gameMap - The game map instance.
     * @param {Map<string, TelnetClient>} clients - A map of entity IDs to their TelnetClient instances.
     */
    update(world, gameMap, clients) {
        if (!gameMap || !clients || clients.size === 0) {
            // No map or no clients, nothing to render.
            return;
        }

        // Create a map of renderable entities by their position for quick lookups.
        const renderableEntities = this.#buildRenderableMap();

        // Iterate over each player and render their unique perspective.
        for (const playerEntity of this.#playerQuery.get()) {
            const client = clients.get(playerEntity.id);
            if (!client) {
                logger.warn(`RenderSystem: No TelnetClient found for player ${playerEntity.id}. Skipping render.`);
                continue;
            }

            // Clear the client's screen buffer for the new frame.
            client.screen.clear();

            const playerViewshed = playerEntity.get(Viewshed);

            this.#renderMap(client, gameMap, playerViewshed, renderableEntities);
            this.#renderUI(client, playerEntity);

            // After drawing everything, tell the client to flush its buffer to the socket.
            client.render();
        }
    }

    /**
     * Builds a map of renderable entities keyed by their position string "x,y".
     * This optimizes the rendering loop by avoiding repeated queries.
     * @returns {Map<string, import('../../ecs/entity.js').default>} A map of position strings to entities.
     */
    #buildRenderableMap() {
        const entityMap = new Map();
        for (const entity of this.#renderableQuery.get()) {
            const position = entity.get(Position);
            // Sort entities by render order so players/monsters draw on top of items.
            // A higher render order means it's drawn later (on top).
            const key = `${position.x},${position.y}`;
            const existing = entityMap.get(key);
            if (!existing || entity.get(Renderable).renderOrder > existing.get(Renderable).renderOrder) {
                entityMap.set(key, entity);
            }
        }
        return entityMap;
    }

    /**
     * Renders the game map from the player's perspective.
     * @param {TelnetClient} client - The client to render for.
     * @param {GameMap} gameMap - The game map.
     * @param {Viewshed} playerViewshed - The player's viewshed component.
     * @param {Map<string, import('../../ecs/entity.js').default>} renderableEntities - Pre-calculated map of renderables.
     */
    #renderMap(client, gameMap, playerViewshed, renderableEntities) {
        const { width, height } = client.screen;
        const playerPos = playerViewshed.owner.get(Position);

        // Calculate camera/viewport position to center the player
        const cameraX = Math.max(0, Math.min(gameMap.width - width, playerPos.x - Math.floor(width / 2)));
        const cameraY = Math.max(0, Math.min(gameMap.height - height, playerPos.y - Math.floor(height / 2)));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const mapX = cameraX + x;
                const mapY = cameraY + y;

                if (gameMap.isInBounds(mapX, mapY)) {
                    const isVisible = playerViewshed.isVisible(mapX, mapY);
                    const isRevealed = gameMap.isTileRevealed(mapX, mapY);

                    if (isVisible || isRevealed) {
                        const tile = gameMap.getTile(mapX, mapY);
                        let tileGlyph = tile.glyph;
                        let tileColor = isVisible ? tile.fg : tile.dark_fg;

                        // Check for an entity at this location
                        const entityKey = `${mapX},${mapY}`;
                        const entity = renderableEntities.get(entityKey);

                        if (entity && isVisible) {
                            const renderable = entity.get(Renderable);
                            tileGlyph = renderable.glyph;
                            tileColor = renderable.fg;
                        }

                        const styledGlyph = chalk.hex(tileColor)(tileGlyph);
                        client.screen.draw(x, y, styledGlyph);
                    }
                }
            }
        }
    }

    /**
     * Renders the User Interface (UI) elements like player stats and messages.
     * @param {TelnetClient} client - The client to render for.
     * @param {import('../../ecs/entity.js').default} playerEntity - The player entity.
     */
    #renderUI(client, playerEntity) {
        const { width, height } = client.screen;

        // --- Render Player Stats ---
        const playerName = playerEntity.get(Name)?.name ?? 'Player';
        const stats = playerEntity.get(Stats);
        const combatStats = playerEntity.get(CombatStats);

        if (stats && combatStats) {
            const hp = `${combatStats.hp} / ${combatStats.maxHp}`;
            const statsLine = ` ${playerName} | HP: ${hp} | Lvl: ${stats.level} | XP: ${stats.xp}/${stats.nextLevelXp} `;
            const uiBar = chalk.bgHex('#333').white.bold(statsLine.padEnd(width));
            client.screen.draw(0, height - 1, uiBar);
        }

        // --- Render Game Messages ---
        // TODO: Implement a proper message log system. For now, this is a placeholder.
        // This would typically pull from a MessageLog component or a world-level event queue.
        const messages = [
            "Welcome to the Telnet Roguelike Engine!",
            "Use arrow keys or vi-keys (h,j,k,l) to move.",
        ];
        let messageY = 0;
        for(const message of messages) {
            if (messageY < height - 2) { // Ensure we don't draw over the stats bar
                client.screen.draw(1, messageY, chalk.yellow(message));
                messageY++;
            }
        }
    }
}
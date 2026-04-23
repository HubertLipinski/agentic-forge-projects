/**
 * @file src/world/game-map.js
 * @description Data structure for representing the game map, including tiles, visibility, and entity locations.
 */

import logger from '../utils/logger.js';

/**
 * Represents a single tile on the game map.
 * This is a simple data object holding the tile's properties.
 */
class Tile {
    /**
     * The character used to render the tile.
     * @type {string}
     */
    glyph;

    /**
     * The foreground color for rendering when visible.
     * @type {string}
     */
    fg;

    /**
     * The foreground color for rendering when revealed but not visible.
     * @type {string}
     */
    dark_fg;

    /**
     * The background color for rendering.
     * @type {string}
     */
    bg;

    /**
     * Indicates if the tile blocks movement.
     * @type {boolean}
     */
    isWalkable;

    /**
     * Indicates if the tile blocks line of sight.
     * @type {boolean}
     */
    isTransparent;

    /**
     * Creates an instance of a Tile.
     * @param {object} props - The properties of the tile.
     * @param {string} props.glyph - The character glyph.
     * @param {string} props.fg - The visible foreground color (hex).
     * @param {string} props.dark_fg - The "memory" foreground color (hex).
     * @param {string} props.bg - The background color (hex).
     * @param {boolean} props.isWalkable - Whether entities can move onto this tile.
     * @param {boolean} props.isTransparent - Whether line of sight can pass through this tile.
     */
    constructor({ glyph, fg, dark_fg, bg, isWalkable, isTransparent }) {
        this.glyph = glyph;
        this.fg = fg;
        this.dark_fg = dark_fg;
        this.bg = bg;
        this.isWalkable = isWalkable;
        this.isTransparent = isTransparent;
    }
}

/**
 * The GameMap class manages the game world's structure, including the grid of tiles,
 * entity locations, and visibility data (Field of View). It acts as the authoritative
 * source for spatial information in the game.
 */
export default class GameMap {
    /**
     * The width of the map in tiles.
     * @type {number}
     */
    width;

    /**
     * The height of the map in tiles.
     * @type {number}
     */
    height;

    /**
     * A 1D array representing the 2D grid of tiles.
     * Access via `tiles[y * width + x]`.
     * @type {Tile[]}
     * @private
     */
    #tiles;

    /**
     * A 1D array storing which tiles have been revealed to the player(s).
     * @type {boolean[]}
     * @private
     */
    #revealedTiles;

    /**
     * A 1D array storing the ID of the entity at each tile, if any.
     * A value of `null` indicates no entity.
     * @type {(string | null)[]}
     * @private
     */
    #entityMap;

    /**
     * Creates an instance of GameMap.
     * @param {number} width - The width of the map.
     * @param {number} height - The height of the map.
     */
    constructor(width, height) {
        if (width <= 0 || height <= 0) {
            throw new Error(`Invalid map dimensions: ${width}x${height}. Width and height must be positive integers.`);
        }
        this.width = width;
        this.height = height;

        const mapSize = width * height;
        this.#tiles = new Array(mapSize);
        this.#revealedTiles = new Array(mapSize).fill(false);
        this.#entityMap = new Array(mapSize).fill(null);

        logger.info(`GameMap created with dimensions ${width}x${height}.`);
    }

    /**
     * Converts 2D coordinates to a 1D array index.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @returns {number} The corresponding index in the 1D arrays.
     * @private
     */
    #getIndex(x, y) {
        return y * this.width + x;
    }

    /**
     * Checks if the given coordinates are within the map's boundaries.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @returns {boolean} True if the coordinates are in bounds, false otherwise.
     */
    isInBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    /**
     * Fills the entire map with a specific tile type.
     * @param {Tile} tile - The tile instance to fill the map with.
     */
    fill(tile) {
        if (!(tile instanceof Tile)) {
            logger.error("Attempted to fill map with an invalid tile object.", tile);
            return;
        }
        this.#tiles.fill(tile);
    }

    /**
     * Sets the tile at a specific coordinate.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @param {Tile} tile - The tile to set.
     */
    setTile(x, y, tile) {
        if (this.isInBounds(x, y) && tile instanceof Tile) {
            const index = this.#getIndex(x, y);
            this.#tiles[index] = tile;
        }
    }

    /**
     * Retrieves the tile at a specific coordinate.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @returns {Tile | null} The tile at the given coordinates, or null if out of bounds.
     */
    getTile(x, y) {
        if (!this.isInBounds(x, y)) {
            return null;
        }
        const index = this.#getIndex(x, y);
        return this.#tiles[index];
    }

    /**
     * Checks if a tile is walkable (i.e., does not block movement).
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @returns {boolean} True if the tile is walkable, false otherwise.
     */
    isTileWalkable(x, y) {
        const tile = this.getTile(x, y);
        return tile?.isWalkable ?? false;
    }

    /**
     * Checks if a tile is transparent (i.e., does not block line of sight).
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @returns {boolean} True if the tile is transparent, false otherwise.
     */
    isTileTransparent(x, y) {
        const tile = this.getTile(x, y);
        return tile?.isTransparent ?? false;
    }

    /**
     * Marks a tile as having been revealed to the player.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     */
    revealTile(x, y) {
        if (this.isInBounds(x, y)) {
            const index = this.#getIndex(x, y);
            this.#revealedTiles[index] = true;
        }
    }

    /**
     * Checks if a tile has been previously revealed.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @returns {boolean} True if the tile has been revealed.
     */
    isTileRevealed(x, y) {
        if (!this.isInBounds(x, y)) {
            return false;
        }
        const index = this.#getIndex(x, y);
        return this.#revealedTiles[index];
    }

    /**
     * Places an entity's ID at a specific location on the map.
     * This overwrites any existing entity at that location.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @param {string} entityId - The unique ID of the entity to place.
     */
    setEntityAt(x, y, entityId) {
        if (this.isInBounds(x, y)) {
            const index = this.#getIndex(x, y);
            this.#entityMap[index] = entityId;
        }
    }

    /**
     * Retrieves the entity ID at a specific location.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @returns {string | null} The entity ID, or null if no entity is present or coordinates are out of bounds.
     */
    getEntityAt(x, y) {
        if (!this.isInBounds(x, y)) {
            return null;
        }
        const index = this.#getIndex(x, y);
        return this.#entityMap[index];
    }

    /**
     * Removes the entity reference from a specific location.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     */
    removeEntityAt(x, y) {
        if (this.isInBounds(x, y)) {
            const index = this.#getIndex(x, y);
            this.#entityMap[index] = null;
        }
    }

    /**
     * Finds a random, walkable, and unoccupied tile on the map.
     * Useful for placing players or monsters.
     * @param {number} [maxAttempts=100] - The maximum number of attempts to find a suitable location.
     * @returns {{x: number, y: number} | null} An object with x and y coordinates, or null if no suitable spot was found.
     */
    findRandomWalkableTile(maxAttempts = 100) {
        for (let i = 0; i < maxAttempts; i++) {
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);

            if (this.isTileWalkable(x, y) && !this.getEntityAt(x, y)) {
                return { x, y };
            }
        }
        logger.warn(`[GameMap] Could not find a random walkable tile after ${maxAttempts} attempts.`);
        return null;
    }
}

// Export the Tile class as well, as it's a fundamental part of the map's definition.
export { Tile };
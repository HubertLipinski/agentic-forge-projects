import logger from '../utils/logger.js';
import GameMap from './game-map.js';

/**
 * @file src/world/map-generator.js
 * @description Procedural map generation logic, using algorithms like Cellular Automata to create cave-like structures.
 */

/**
 * @typedef {Object} CellularAutomataOptions
 * @property {number} width - The width of the map.
 * @property {number} height - The height of the map.
 * @property {number} [fillProbability=0.45] - The initial probability of a tile being a wall (0.0 to 1.0).
 * @property {number} [smoothingIterations=5] - The number of times to apply the smoothing algorithm.
 * @property {number} [wallThreshold=4] - The number of neighboring walls required to turn a floor into a wall during smoothing.
 * @property {number} [floorThreshold=3] - The number of neighboring floors required to turn a wall into a floor during smoothing.
 * @property {number} [minRegionSize=50] - The minimum size for a region to be kept. Smaller regions will be filled in.
 */

/**
 * A utility class for generating procedural maps using various algorithms.
 * Currently focused on Cellular Automata for creating organic, cave-like structures.
 */
export default class MapGenerator {
    /**
     * Generates a cave-like map using the Cellular Automata algorithm.
     *
     * The process involves:
     * 1. Randomly initializing the map with walls and floors.
     * 2. Smoothing the map over several iterations to form larger caves.
     * 3. Identifying contiguous regions of floors.
     * 4. Removing small, isolated regions to ensure connectivity.
     * 5. Creating a GameMap instance from the final tile data.
     *
     * @param {CellularAutomataOptions} options - The configuration for the generator.
     * @returns {GameMap} A new GameMap instance representing the generated world.
     */
    static generateCellularAutomata(options) {
        const {
            width,
            height,
            fillProbability = 0.45,
            smoothingIterations = 5,
            wallThreshold = 4,
            floorThreshold = 3,
            minRegionSize = 50,
        } = options;

        logger.info(`[MapGenerator] Starting Cellular Automata generation with size ${width}x${height}.`);

        // 1. Initialize the map with random walls and floors
        let grid = this.#initializeGrid(width, height, fillProbability);

        // 2. Smooth the map multiple times
        for (let i = 0; i < smoothingIterations; i++) {
            grid = this.#smoothGrid(grid, width, height, wallThreshold, floorThreshold);
        }

        // 3. Identify and remove small regions
        grid = this.#processRegions(grid, width, height, minRegionSize);

        // 4. Create the final GameMap object
        const gameMap = new GameMap(width, height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (grid[y][x] === 1) { // Wall
                    gameMap.setTile(x, y, 'wall');
                } else { // Floor
                    gameMap.setTile(x, y, 'floor');
                }
            }
        }

        logger.info('[MapGenerator] Cellular Automata generation complete.');
        return gameMap;
    }

    /**
     * Creates the initial grid, randomly filling it with walls based on the fill probability.
     * @private
     * @param {number} width - The map width.
     * @param {number} height - The map height.
     * @param {number} fillProbability - The chance for a tile to be a wall.
     * @returns {number[][]} A 2D array representing the grid (1 for wall, 0 for floor).
     */
    static #initializeGrid(width, height, fillProbability) {
        const grid = Array.from({ length: height }, () => Array(width).fill(0));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Enforce a border of walls to contain the map
                if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                    grid[y][x] = 1;
                } else if (Math.random() < fillProbability) {
                    grid[y][x] = 1;
                }
            }
        }
        return grid;
    }

    /**
     * Applies one iteration of the smoothing algorithm to the grid.
     * A new grid is created to avoid mutation issues during iteration.
     * @private
     * @param {number[][]} oldGrid - The grid from the previous iteration.
     * @param {number} width - The map width.
     * @param {number} height - The map height.
     * @param {number} wallThreshold - Neighbor count to become a wall.
     * @param {number} floorThreshold - Neighbor count to become a floor.
     * @returns {number[][]} The new, smoothed grid.
     */
    static #smoothGrid(oldGrid, width, height, wallThreshold, floorThreshold) {
        const newGrid = oldGrid.map(row => [...row]);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const wallNeighbors = this.#countNeighboringWalls(oldGrid, x, y);

                if (wallNeighbors > wallThreshold) {
                    newGrid[y][x] = 1; // Becomes a wall
                } else if (wallNeighbors < floorThreshold) {
                    newGrid[y][x] = 0; // Becomes a floor
                }
            }
        }
        return newGrid;
    }

    /**
     * Counts the number of wall tiles in the 8-tile neighborhood of a given coordinate.
     * @private
     * @param {number[][]} grid - The map grid.
     * @param {number} x - The x-coordinate of the center tile.
     * @param {number} y - The y-coordinate of the center tile.
     * @returns {number} The count of neighboring walls.
     */
    static #countNeighboringWalls(grid, x, y) {
        let count = 0;
        for (let ny = y - 1; ny <= y + 1; ny++) {
            for (let nx = x - 1; nx <= x + 1; nx++) {
                // Skip the center tile itself
                if (nx === x && ny === y) continue;
                // The grid is guaranteed to have a border, so no bounds check is needed here
                // if we only call this for tiles within the border.
                count += grid[ny][nx];
            }
        }
        return count;
    }

    /**
     * Identifies all contiguous regions and fills in any that are smaller than the minimum size.
     * @private
     * @param {number[][]} grid - The map grid.
     * @param {number} width - The map width.
     * @param {number} height - The map height.
     * @param {number} minRegionSize - The minimum size for a region to be kept.
     * @returns {number[][]} The processed grid with small regions removed.
     */
    static #processRegions(grid, width, height, minRegionSize) {
        const visited = Array.from({ length: height }, () => Array(width).fill(false));
        const regions = [];

        // Find all regions (both wall and floor)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (!visited[y][x]) {
                    const regionType = grid[y][x];
                    const newRegion = this.#floodFill(grid, x, y, width, height, visited);
                    regions.push({ tiles: newRegion, type: regionType });
                }
            }
        }

        // Find the largest floor region to ensure it's kept
        const floorRegions = regions.filter(r => r.type === 0);
        if (floorRegions.length === 0) {
            logger.warn('[MapGenerator] No floor regions found. The map will be solid wall.');
            return grid;
        }

        floorRegions.sort((a, b) => b.tiles.length - a.tiles.length);
        const mainRegion = floorRegions[0];

        // Fill in all other floor regions that are not the main one
        for (const region of floorRegions) {
            if (region !== mainRegion) {
                for (const tile of region.tiles) {
                    grid[tile.y][tile.x] = 1; // Turn into a wall
                }
            }
        }

        // Fill in any wall regions that are smaller than the minimum size
        const wallRegions = regions.filter(r => r.type === 1);
        for (const region of wallRegions) {
            if (region.tiles.length < minRegionSize) {
                for (const tile of region.tiles) {
                    grid[tile.y][tile.x] = 0; // Turn into a floor
                }
            }
        }

        return grid;
    }

    /**
     * Performs a flood fill (or breadth-first search) to find all tiles in a contiguous region.
     * @private
     * @param {number[][]} grid - The map grid.
     * @param {number} startX - The starting x-coordinate.
     * @param {number} startY - The starting y-coordinate.
     * @param {number} width - The map width.
     * @param {number} height - The map height.
     * @param {boolean[][]} visited - A grid to track visited tiles.
     * @returns {Array<{x: number, y: number}>} An array of tiles in the region.
     */
    static #floodFill(grid, startX, startY, width, height, visited) {
        const regionTiles = [];
        const queue = [{ x: startX, y: startY }];
        const targetType = grid[startY][startX];
        visited[startY][startX] = true;

        while (queue.length > 0) {
            const { x, y } = queue.shift();
            regionTiles.push({ x, y });

            // Check 4-directional neighbors
            const neighbors = [
                { x: x, y: y - 1 },
                { x: x, y: y + 1 },
                { x: x - 1, y: y },
                { x: x + 1, y: y },
            ];

            for (const neighbor of neighbors) {
                const { x: nx, y: ny } = neighbor;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny][nx] && grid[ny][nx] === targetType) {
                    visited[ny][nx] = true;
                    queue.push(neighbor);
                }
            }
        }
        return regionTiles;
    }
}
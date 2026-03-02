/**
 * @file src/core/renderer.js
 * @description Renders the current game state (map, entities, messages) to the terminal using `chalk` for colors.
 *
 * This module is responsible for translating the abstract game state into a
 * visual representation in the user's terminal. It handles drawing the map,
 * entities, UI elements like player stats, and game messages.
 */

import chalk from 'chalk';

/**
 * The Renderer class handles all drawing operations to the terminal.
 * It builds a character buffer in memory and then flushes it to stdout in a
 * single operation to prevent flickering.
 */
export class Renderer {
  /**
   * @private
   * @type {number} The width of the terminal viewport.
   */
  #width;

  /**
   * @private
   * @type {number} The height of the terminal viewport.
   */
  #height;

  /**
   * @private
   * @type {string[]} A buffer to hold the lines of output before printing.
   */
  #buffer;

  /**
   * Initializes a new Renderer instance.
   *
   * @param {object} options - Configuration for the renderer.
   * @param {number} [options.width=process.stdout.columns] - The width of the rendering area.
   * @param {number} [options.height=process.stdout.rows] - The height of the rendering area.
   */
  constructor({
    width = process.stdout.columns,
    height = process.stdout.rows,
  } = {}) {
    this.#width = width;
    this.#height = height;
    this.#buffer = [];

    // Set up a listener to handle terminal resizing.
    process.stdout.on('resize', this.#onResize.bind(this));
  }

  /**
   * @private
   * Handles terminal resize events to update the renderer's dimensions.
   */
  #onResize() {
    this.#width = process.stdout.columns;
    this.#height = process.stdout.rows;
    // Potentially emit an event or trigger a re-render if the game is active.
  }

  /**
   * Clears the terminal screen and resets the cursor position.
   * @private
   */
  #clearScreen() {
    // ANSI escape codes for clearing the screen and moving cursor to top-left.
    process.stdout.write('\x1b[2J\x1b[H');
  }

  /**
   * The main rendering method. It orchestrates the drawing of all game elements.
   *
   * @param {import('../ecs/index.js').World} world - The ECS world containing the game state.
   * @param {string} playerEntityId - The ID of the player entity, used for centering the view and displaying stats.
   * @param {object} [options={}] - Additional rendering options.
   * @param {boolean} [options.isGameOver=false] - A flag to indicate if the game over screen should be shown.
   */
  render(world, playerEntityId, { isGameOver = false } = {}) {
    this.#clearScreen();
    this.#buffer = [];

    const { map, visibleTiles } = this.#getRenderData(world, playerEntityId);

    if (!map) {
      this.#buffer.push(chalk.red('Error: Map data is missing.'));
      this.#flush();
      return;
    }

    const entitiesToRender = this.#getEntitiesToRender(world, visibleTiles);

    // For simplicity, we'll assume the viewport is the full terminal size for now.
    // A more advanced implementation would have dedicated UI panels.
    this.#drawMap(map, visibleTiles, entitiesToRender);
    this.#drawUI(world, playerEntityId);
    this.#drawMessages(world);

    if (isGameOver) {
      this.#drawGameOver();
    }

    this.#flush();
  }

  /**
   * Gathers the necessary map and visibility data from the world.
   * @private
   * @param {import('../ecs/index.js').World} world - The ECS world.
   * @param {string} playerEntityId - The ID of the player entity.
   * @returns {{map: import('../map/tile.js').Tile[][] | null, visibleTiles: Set<string>}}
   */
  #getRenderData(world, playerEntityId) {
    // In a more complex engine, the map and FOV might be stored in a resource/singleton component.
    // Here we assume they are properties on the world object for simplicity.
    const map = world.map;
    const visibleTiles = world.visibleTiles ?? new Set();
    return { map, visibleTiles };
  }

  /**
   * Collects all renderable entities that are currently visible.
   * @private
   * @param {import('../ecs/index.js').World} world - The ECS world.
   * @param {Set<string>} visibleTiles - The set of currently visible "x,y" tile coordinates.
   * @returns {Map<string, object>} A map from "x,y" coordinates to the highest-z renderable entity at that location.
   */
  #getEntitiesToRender(world, visibleTiles) {
    const entitiesToRender = new Map();
    const renderableEntities = world.componentManager.queryEntitiesByComponents([
      'Position',
      'Renderable',
    ]);

    // Sort entities by their z-index to ensure correct drawing order (e.g., items under monsters).
    renderableEntities.sort((a, b) => {
      const renderA = world.componentManager.getComponent(a, 'Renderable');
      const renderB = world.componentManager.getComponent(b, 'Renderable');
      return (renderA.zIndex ?? 0) - (renderB.zIndex ?? 0);
    });

    for (const entityId of renderableEntities) {
      const pos = world.componentManager.getComponent(entityId, 'Position');
      const key = `${pos.x},${pos.y}`;

      if (visibleTiles.has(key)) {
        const renderable = world.componentManager.getComponent(
          entityId,
          'Renderable'
        );
        entitiesToRender.set(key, { ...renderable, entityId });
      }
    }
    return entitiesToRender;
  }

  /**
   * Draws the map tiles and any visible entities on top of them.
   * @private
   * @param {import('../map/tile.js').Tile[][]} map - The 2D array of map tiles.
   * @param {Set<string>} visibleTiles - The set of currently visible "x,y" tile coordinates.
   * @param {Map<string, object>} entitiesToRender - A map of visible entities to draw.
   */
  #drawMap(map, visibleTiles, entitiesToRender) {
    const mapHeight = map.length;
    const mapWidth = map[0].length;

    // We'll render up to the available height, minus space for UI/messages.
    const renderHeight = Math.min(mapHeight, this.#height - 4);

    for (let y = 0; y < renderHeight; y++) {
      let line = '';
      for (let x = 0; x < mapWidth; x++) {
        const tile = map[y][x];
        const key = `${x},${y}`;
        const isVisible = visibleTiles.has(key);

        if (!isVisible && !tile.isExplored) {
          line += ' '; // Unexplored area
          continue;
        }

        const entity = entitiesToRender.get(key);
        if (entity && isVisible) {
          // Draw the entity
          line += chalk
            .hex(entity.color)
            .bgHex(tile.background)(entity.char);
        } else {
          // Draw the map tile
          const color = isVisible ? tile.foreground : '#333333'; // Dim color for explored but not visible
          line += chalk.hex(color).bgHex(tile.background)(tile.char);
        }
      }
      this.#buffer.push(line);
    }
  }

  /**
   * Draws the UI elements, such as player health and status.
   * @private
   * @param {import('../ecs/index.js').World} world - The ECS world.
   * @param {string} playerEntityId - The ID of the player entity.
   */
  #drawUI(world, playerEntityId) {
    const health = world.componentManager.getComponent(playerEntityId, 'Health');
    const player = world.componentManager.getComponent(playerEntityId, 'Player');

    this.#buffer.push(''); // Spacer line
    let healthBar = 'HP: ';
    if (health) {
      const hpPercentage = health.current / health.max;
      const barWidth = 20;
      const filledWidth = Math.round(hpPercentage * barWidth);
      const hpColor =
        hpPercentage > 0.6 ? 'green' : hpPercentage > 0.3 ? 'yellow' : 'red';
      healthBar +=
        chalk[hpColor](`[${'|'.repeat(filledWidth)}${' '.repeat(barWidth - filledWidth)}]`) +
        ` ${health.current}/${health.max}`;
    } else {
      healthBar += 'N/A';
    }

    const playerName = player?.name ?? 'Player';
    const uiLine = `${chalk.bold.white(playerName)} | ${healthBar}`;
    this.#buffer.push(uiLine);
  }

  /**
   * Draws recent game messages to the screen.
   * @private
   * @param {import('../ecs/index.js').World} world - The ECS world.
   */
  #drawMessages(world) {
    // Assume messages are stored as a resource on the world object.
    const messages = world.messages ?? [];
    const messageLines = messages.slice(-2); // Show the last 2 messages.

    this.#buffer.push(''); // Spacer line
    if (messageLines.length > 0) {
      this.#buffer.push(chalk.italic(messageLines[0]));
      if (messageLines.length > 1) {
        this.#buffer.push(chalk.italic.grey(messageLines[1]));
      }
    }
  }

  /**
   * Draws the "Game Over" message.
   * @private
   */
  #drawGameOver() {
    const gameOverText = ' G A M E   O V E R ';
    const padding = ' '.repeat(Math.floor((this.#width - gameOverText.length) / 2));
    this.#buffer.push('');
    this.#buffer.push(chalk.bgRed.white.bold(padding + gameOverText + padding));
  }

  /**
   * Writes the contents of the buffer to the standard output.
   * @private
   */
  #flush() {
    process.stdout.write(this.#buffer.join('\n'));
  }
}
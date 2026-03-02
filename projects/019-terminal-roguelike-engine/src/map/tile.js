/**
 * @file src/map/tile.js
 * @description Defines the Tile class, representing a single cell in the game map.
 *
 * Each tile holds properties that define its appearance and behavior within the
 * game world, such as whether it's a wall or a floor, if it blocks movement,
 * and if it obstructs the player's line of sight.
 */

/**
 * Represents a single tile on the game map.
 *
 * This class is designed to be a data-rich object, holding all static
 * properties of a map cell. It is intended to be used within a 2D array
 * to form the complete game map.
 */
export class Tile {
  /**
   * The character used to represent the tile when rendered on the terminal.
   * @type {string}
   */
  char;

  /**
   * The foreground color of the tile's character, using a `chalk`-compatible string.
   * @type {string}
   */
  foreground;

  /**
   * The background color of the tile, using a `chalk`-compatible string.
   * @type {string}
   */
  background;

  /**
   * A boolean flag indicating whether this tile blocks movement.
   * For example, walls block movement, while floors do not.
   * @type {boolean}
   */
  isWalkable;

  /**
   * A boolean flag indicating whether this tile blocks line of sight (FOV).
   * Most solid objects like walls will block sight. Some things, like a
   * glass wall or a low fence, might not.
   * @type {boolean}
   */
  isTransparent;

  /**
   * A boolean flag indicating whether the tile has been discovered by the player.
   * This is used to implement "fog of war" where unexplored parts of the map
   * are hidden.
   * @type {boolean}
   */
  isExplored;

  /**
   * Creates a new Tile instance.
   *
   * @param {object} properties - The properties for this tile.
   * @param {string} [properties.char=' '] - The character for rendering.
   * @param {string} [properties.foreground='grey'] - The foreground color.
   * @param {string} [properties.background='black'] - The background color.
   * @param {boolean} [properties.isWalkable=false] - Whether entities can move onto this tile.
   * @param {boolean} [properties.isTransparent=false] - Whether the tile blocks field of view.
   * @param {boolean} [properties.isExplored=false] - Whether the player has seen this tile.
   */
  constructor({
    char = ' ',
    foreground = 'grey',
    background = 'black',
    isWalkable = false,
    isTransparent = false,
    isExplored = false,
  } = {}) {
    this.char = char;
    this.foreground = foreground;
    this.background = background;
    this.isWalkable = isWalkable;
    this.isTransparent = isTransparent;
    this.isExplored = isExplored;
  }

  /**
   * Creates a deep copy of this tile.
   * This is useful for map generation algorithms or any situation where a
   * non-referenced copy of a tile is needed.
   *
   * @returns {Tile} A new Tile instance with the same properties.
   */
  clone() {
    // structuredClone is a modern, efficient way to deep-clone objects.
    // It's perfect here as Tile instances are pure data.
    return structuredClone(this);
  }

  /**
   * Serializes the tile's state into a plain JavaScript object.
   * This is used when saving the game state to a file.
   *
   * @returns {{char: string, foreground: string, background: string, isWalkable: boolean, isTransparent: boolean, isExplored: boolean}}
   * A serializable object representing the tile's properties.
   */
  serialize() {
    return {
      char: this.char,
      foreground: this.foreground,
      background: this.background,
      isWalkable: this.isWalkable,
      isTransparent: this.isTransparent,
      isExplored: this.isExplored,
    };
  }

  /**
   * Creates a Tile instance from a serialized plain object.
   * This is used when loading a game state from a file.
   *
   * @param {object} data - The plain object containing tile properties.
   * @returns {Tile} A new Tile instance.
   * @throws {Error} If the provided data is not a valid object.
   */
  static deserialize(data) {
    if (typeof data !== 'object' || data === null) {
      throw new Error(
        'Invalid data for Tile deserialization. Expected a plain object.'
      );
    }
    return new Tile(data);
  }
}

/**
 * A predefined, immutable tile representing a solid wall.
 * Walls are not walkable and block line of sight.
 */
export const TILE_WALL = Object.freeze(
  new Tile({
    char: '#',
    foreground: 'darkgrey',
    background: 'black',
    isWalkable: false,
    isTransparent: false,
  })
);

/**
 * A predefined, immutable tile representing an open floor.
 * Floors are walkable and do not block line of sight.
 */
export const TILE_FLOOR = Object.freeze(
  new Tile({
    char: '.',
    foreground: 'dimgrey',
    background: 'black',
    isWalkable: true,
    isTransparent: true,
  })
);

/**
 * A predefined, immutable tile representing an empty or void space.
 * This is often used for areas outside the generated map boundaries.
 * It is not walkable and blocks sight, similar to a wall.
 */
export const TILE_VOID = Object.freeze(
  new Tile({
    char: ' ',
    foreground: 'black',
    background: 'black',
    isWalkable: false,
    isTransparent: false,
  })
);
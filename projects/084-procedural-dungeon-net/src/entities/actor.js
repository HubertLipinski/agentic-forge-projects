/**
 * @file src/entities/actor.js
 * @description Base class for all dynamic entities in the world, such as players and NPCs.
 * This class encapsulates common properties and behaviors shared by all "living" or
 * interactive entities within the dungeon, including position, attributes, and inventory.
 * It serves as a foundation for more specialized classes like Player and NPC.
 */

import { generateId } from '../utils/uuid.js';

/**
 * Represents the base for any entity that can act or be acted upon in the game world.
 * This includes players, non-player characters (NPCs), and potentially other dynamic objects.
 */
export class Actor {
  /**
   * The unique identifier for this actor.
   * @type {string}
   */
  id;

  /**
   * The display name of the actor.
   * @type {string}
   */
  name;

  /**
   * The current x-coordinate of the actor on the map.
   * @type {number}
   */
  x;

  /**
   * The current y-coordinate of the actor on the map.
   * @type {number}
   */
  y;

  /**
   * The actor's health points.
   * @type {number}
   */
  hp;

  /**
   * The actor's maximum health points.
   * @type {number}
   */
  maxHp;

  /**
   * The actor's attack power.
   * @type {number}
   */
  attack;

  /**
   * The actor's defense power.
   * @type {number}
   */
  defense;

  /**
   * A list of item IDs in the actor's inventory.
   * @type {string[]}
   */
  inventory;

  /**
   * Creates a new Actor instance.
   *
   * @param {object} options - The configuration options for the actor.
   * @param {string} [options.id] - A unique ID. If not provided, a new UUID will be generated.
   * @param {string} options.name - The name of the actor (e.g., "Goblin", "Player1").
   * @param {number} options.x - The initial x-coordinate.
   * @param {number} options.y - The initial y-coordinate.
   * @param {number} [options.hp=10] - Current health points.
   * @param {number} [options.maxHp=10] - Maximum health points.
   * @param {number} [options.attack=1] - Attack power.
   * @param {number} [options.defense=0] - Defense power.
   * @param {string[]} [options.inventory=[]] - A list of item IDs.
   */
  constructor({ id, name, x, y, hp = 10, maxHp = 10, attack = 1, defense = 0, inventory = [] }) {
    if (!name || typeof name !== 'string') {
      throw new Error('Actor must have a non-empty string name.');
    }
    if (typeof x !== 'number' || typeof y !== 'number') {
      throw new Error('Actor must have valid numeric x and y coordinates.');
    }

    this.id = id ?? generateId();
    this.name = name;
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = maxHp;
    this.attack = attack;
    this.defense = defense;
    this.inventory = Array.isArray(inventory) ? [...inventory] : [];
  }

  /**
   * Checks if the actor is alive (HP > 0).
   * @returns {boolean} True if the actor's health is greater than zero.
   */
  isAlive() {
    return this.hp > 0;
  }

  /**
   * Moves the actor to a new position.
   * No validation is performed here; caller is responsible for ensuring the target location is valid.
   * @param {number} x - The new x-coordinate.
   * @param {number} y - The new y-coordinate.
   */
  moveTo(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * Applies damage to the actor, reducing HP.
   * HP will not go below zero.
   * @param {number} amount - The amount of damage to apply.
   */
  takeDamage(amount) {
    const damageTaken = Math.max(0, amount);
    this.hp = Math.max(0, this.hp - damageTaken);
  }

  /**
   * Heals the actor, increasing HP.
   * HP will not exceed maxHp.
   * @param {number} amount - The amount of health to restore.
   */
  heal(amount) {
    const healingReceived = Math.max(0, amount);
    this.hp = Math.min(this.maxHp, this.hp + healingReceived);
  }

  /**
   * Adds an item's ID to the actor's inventory.
   * @param {string} itemId - The unique ID of the item to add.
   */
  addItem(itemId) {
    if (itemId && !this.inventory.includes(itemId)) {
      this.inventory.push(itemId);
    }
  }

  /**
   * Removes an item's ID from the actor's inventory.
   * @param {string} itemId - The unique ID of the item to remove.
   * @returns {boolean} True if the item was found and removed, false otherwise.
   */
  removeItem(itemId) {
    const index = this.inventory.indexOf(itemId);
    if (index > -1) {
      this.inventory.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Serializes the actor's state into a plain JavaScript object.
   * This is used for saving the game state to disk.
   * @returns {object} A serializable representation of the actor.
   */
  serialize() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      hp: this.hp,
      maxHp: this.maxHp,
      attack: this.attack,
      defense: this.defense,
      inventory: this.inventory,
      // Add a 'type' property for deserialization purposes.
      // Subclasses should override this.
      type: 'Actor',
    };
  }

  /**
   * Creates an Actor instance from a serialized state object.
   * This is used when loading a game state from disk.
   * Note: This is a static method on the class, not an instance method.
   * Subclasses will need their own `deserialize` that calls `new Subclass(data)`.
   *
   * @param {object} data - The serialized actor data.
   * @returns {Actor} A new Actor instance.
   */
  static deserialize(data) {
    if (!data || data.type !== 'Actor') {
      throw new Error('Cannot deserialize: data is not a valid Actor serialization.');
    }
    return new Actor(data);
  }
}
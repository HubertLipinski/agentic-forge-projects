/**
 * @file examples/simple-roguelike/components.js
 * @description Example component definitions for a basic roguelike game.
 *
 * In an Entity-Component-System (ECS) architecture, components are pure data
 * containers. They don't contain logic, only properties that describe an
 * entity. Systems operate on entities that have specific combinations of
 * these components.
 *
 * This file exports an object containing factory functions for each component.
 * A factory function is a simple function that returns a new object with the
 * default state for that component. This pattern is used by the ComponentManager
 * to create new component instances.
 */

/**
 * A collection of factory functions for creating component instances.
 * Each key is the component's name, and the value is a function that
 * returns a new component data object with default values.
 */
export const componentFactories = {
  /**
   * @component Position
   * @description Defines an entity's location on the game map.
   * Required for any entity that exists physically in the game world.
   */
  Position: (x = 0, y = 0) => ({
    x,
    y,
  }),

  /**
   * @component Renderable
   * @description Defines how an entity should be drawn on the screen.
   * Entities without this component will be invisible.
   */
  Renderable: (char = '?', color = 'white', layer = 1) => ({
    char, // The character to display (e.g., '@', 'g').
    color, // A `chalk`-compatible color string.
    layer, // Render layer. Higher numbers are drawn on top of lower numbers. (e.g., 1=corpse, 2=item, 3=actor)
  }),

  /**
   * @component Player
   * @description A "tag" component that identifies the entity as the player.
   * It has no data; its presence is what matters. Systems can query for this
   * component to find the player entity.
   */
  Player: () => ({}),

  /**
   * @component Viewshed
   * @description Stores data related to an entity's field of view (FOV).
   * It holds the set of visible tiles and the range of vision.
   * Typically used by the player and intelligent monsters.
   */
  Viewshed: (radius = 8) => ({
    visibleTiles: new Set(), // A set of "x,y" strings for visible tiles.
    radius, // The maximum distance the entity can see.
    isDirty: true, // A flag to indicate if the FOV needs to be recalculated.
  }),

  /**
   * @component Name
   * @description Gives an entity a proper name for display in messages.
   * e.g., "The Orc" or "Player".
   */
  Name: (name = 'Unnamed') => ({
    name,
  }),

  /**
   * @component Monster
   * @description A "tag" component that identifies an entity as a monster.
   * Used by AI systems to select which entities to process.
   */
  Monster: () => ({}),

  /**
   * @component BlocksMovement
   * @description A "tag" component indicating that an entity occupies a tile
   * and prevents other entities from moving into it.
   * Typically applied to actors like the player and monsters.
   */
  BlocksMovement: () => ({}),

  /**
   * @component CombatStats
   * @description Holds the combat-related attributes of an entity.
   * Essential for any entity that can participate in combat.
   */
  CombatStats: (hp = 10, maxHp = 10, defense = 0, power = 3) => ({
    hp, // Current health points.
    maxHp, // Maximum health points.
    defense, // Damage reduction value.
    power, // Damage dealt value.
  }),

  /**
   * @component WantsToMelee
   * @description An "intent" component. When added to an entity, it signals
   * to the `MeleeCombatSystem` that this entity wishes to attack another.
   * This component is typically added and removed within a single game tick.
   */
  WantsToMelee: (target) => {
    if (!target) {
      throw new Error('WantsToMelee component requires a target entity ID.');
    }
    return {
      target, // The entity ID of the entity being attacked.
    };
  },

  /**
   * @component SufferDamage
   * @description An "effect" component. When added to an entity, it signals
   * that the entity should take damage. The `DamageSystem` will process this
   * component, apply the damage, and then remove the component.
   * This decouples the act of dealing damage from the act of receiving it.
   */
  SufferDamage: (amount = 0) => ({
    amount, // The amount of damage to inflict.
  }),

  /**
   * @component GameLogMessage
   * @description Represents a message to be displayed in the game log.
   * This is not attached to a game entity, but rather used as a data structure
   * within a dedicated message log system or stored on a global log entity.
   * For this example, we'll attach it to a global "Log" entity.
   */
  GameLogMessage: (text, color = 'white') => ({
    text,
    color,
  }),
};
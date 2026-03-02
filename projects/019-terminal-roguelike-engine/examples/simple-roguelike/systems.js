/**
 * @file examples/simple-roguelike/systems.js
 * @description Example systems for a basic roguelike game.
 *
 * Systems contain the game logic. They operate on entities that have a specific
 * set of components. For example, the MovementSystem operates on entities with
 * Position and WantsToMove components.
 */

import { findPath } from '../../src/map/pathfinding.js';

/**
 * Handles player input and translates it into a "WantsToMove" component,
 * which is then processed by the MovementSystem. This system also handles
 * "bump-to-attack" logic by adding a "WantsToAttack" component if the
 * player tries to move into a space occupied by a monster.
 */
export class PlayerInputSystem {
  update(world, { playerEntityId, playerAction }) {
    // This system only cares about player actions.
    if (!playerAction || playerAction.type !== 'move') {
      return;
    }

    const { entityManager, componentManager } = world;
    const { dx, dy } = playerAction.payload;

    // Ensure the player entity still exists and has a position.
    const playerPosition = componentManager.getComponent(playerEntityId, 'Position');
    if (!playerPosition) {
      return;
    }

    const targetX = playerPosition.x + dx;
    const targetY = playerPosition.y + dy;

    // Check for a monster at the target location.
    const entitiesAtTarget = world.getEntitiesAt(targetX, targetY);
    const monster = entitiesAtTarget.find(
      (id) => componentManager.hasComponent(id, 'Monster')
    );

    if (monster) {
      // If there's a monster, the player wants to attack it.
      componentManager.addComponent(playerEntityId, 'WantsToAttack', { target: monster });
    } else {
      // Otherwise, the player wants to move.
      componentManager.addComponent(playerEntityId, 'WantsToMove', { x: targetX, y: targetY });
    }
  }
}

/**
 * Processes entities that have a "WantsToMove" component. It checks if the
 * target location is walkable and updates the entity's Position if it is.
 */
export class MovementSystem {
  update(world) {
    const { componentManager, map } = world;

    // Find all entities that want to move.
    const entities = componentManager.queryEntitiesByComponents(['WantsToMove', 'Position']);

    for (const entityId of entities) {
      const wantsToMove = componentManager.getComponent(entityId, 'WantsToMove');
      const position = componentManager.getComponent(entityId, 'Position');

      const { x: targetX, y: targetY } = wantsToMove;

      // Check map boundaries.
      if (targetX < 0 || targetX >= map.width || targetY < 0 || targetY >= map.height) {
        continue; // Invalid move, do nothing.
      }

      // Check if the tile is walkable.
      if (!map.getTile(targetX, targetY)?.isWalkable) {
        continue; // Can't move into a wall.
      }

      // Check if another entity with "BlocksMovement" is already there.
      const entitiesAtTarget = world.getEntitiesAt(targetX, targetY);
      const isBlocked = entitiesAtTarget.some(
        (id) => componentManager.hasComponent(id, 'BlocksMovement')
      );

      if (isBlocked) {
        continue; // Can't move into an occupied space.
      }

      // If the move is valid, update the entity's position.
      position.x = targetX;
      position.y = targetY;
    }

    // Clean up the "WantsToMove" component from all entities that had it.
    // This is a "one-shot" component that is consumed each turn.
    for (const entityId of entities) {
      componentManager.removeComponent(entityId, 'WantsToMove');
    }
  }
}

/**
 * Updates the Field of View for the player. It calculates the visible tiles
 * and updates the `isExplored` and `isVisible` properties on the map and entities.
 */
export class FOVSystem {
  update(world, { playerEntityId }) {
    const { componentManager, map, fov } = world;

    const playerPosition = componentManager.getComponent(playerEntityId, 'Position');
    const playerFov = componentManager.getComponent(playerEntityId, 'FieldOfView');

    if (!playerPosition || !playerFov) {
      return;
    }

    // First, set all entities to not visible.
    const renderableEntities = componentManager.queryEntitiesByComponents(['Renderable']);
    for (const entityId of renderableEntities) {
        const renderable = componentManager.getComponent(entityId, 'Renderable');
        if (renderable) {
            renderable.isVisible = false;
        }
    }

    // Compute the new FOV.
    const visibleTiles = fov.compute(playerPosition, playerFov.radius);

    // Update map tiles based on FOV.
    map.updateFov(visibleTiles);

    // Update entity visibility.
    for (const coord of visibleTiles) {
        const [x, y] = coord.split(',').map(Number);
        const entitiesAtCoord = world.getEntitiesAt(x, y);
        for (const entityId of entitiesAtCoord) {
            const renderable = componentManager.getComponent(entityId, 'Renderable');
            if (renderable) {
                renderable.isVisible = true;
            }
        }
    }
  }
}

/**
 * Handles basic AI for entities with a "Monster" component.
 * If the player is in the monster's line of sight, the monster will move
 * towards the player. If adjacent, it will attack.
 */
export class MonsterAISystem {
  update(world, { playerEntityId }) {
    const { componentManager, map } = world;
    const playerPosition = componentManager.getComponent(playerEntityId, 'Position');
    if (!playerPosition) return; // Player is gone, AI has nothing to do.

    const monsters = componentManager.queryEntitiesByComponents(['Monster', 'Position', 'FieldOfView']);

    for (const monsterId of monsters) {
      const monsterPosition = componentManager.getComponent(monsterId, 'Position');
      const monsterFov = componentManager.getComponent(monsterId, 'FieldOfView');
      const monsterRenderable = componentManager.getComponent(monsterId, 'Renderable');

      // AI only acts if the player is visible to it.
      // In this simple example, we check if the player is within the monster's FOV radius
      // and if the monster itself is visible to the player (a simple proxy for line of sight).
      const distance = Math.hypot(playerPosition.x - monsterPosition.x, playerPosition.y - monsterPosition.y);

      if (monsterRenderable?.isVisible && distance <= monsterFov.radius) {
        // Player is visible to the monster.
        if (distance <= 1.5) {
          // If adjacent to the player, attack.
          componentManager.addComponent(monsterId, 'WantsToAttack', { target: playerEntityId });
        } else {
          // Otherwise, move towards the player.
          const path = findPath(monsterPosition, playerPosition, map.getTiles());
          if (path && path.length > 0) {
            const nextStep = path[0];
            componentManager.addComponent(monsterId, 'WantsToMove', { x: nextStep.x, y: nextStep.y });
          }
        }
      }
    }
  }
}

/**
 * Processes entities that have a "WantsToAttack" component. It resolves
 * combat by calculating damage and applying it to the target's "Health" component.
 */
export class CombatSystem {
  update(world) {
    const { componentManager, entityManager } = world;
    const attackers = componentManager.queryEntitiesByComponents(['WantsToAttack', 'CombatStats']);

    for (const attackerId of attackers) {
      const wantsToAttack = componentManager.getComponent(attackerId, 'WantsToAttack');
      const attackerStats = componentManager.getComponent(attackerId, 'CombatStats');
      const attackerName = componentManager.getComponent(attackerId, 'Name')?.name ?? 'Attacker';

      const targetId = wantsToAttack.target;
      if (!entityManager.hasEntity(targetId)) continue; // Target might have been destroyed already.

      const targetHealth = componentManager.getComponent(targetId, 'Health');
      const targetStats = componentManager.getComponent(targetId, 'CombatStats');
      const targetName = componentManager.getComponent(targetId, 'Name')?.name ?? 'Target';

      if (!targetHealth || !targetStats) continue; // Target is not attackable.

      // Simple combat calculation: damage = attacker's power - target's defense.
      const damage = Math.max(0, attackerStats.power - targetStats.defense);

      // Add a message to the log.
      const messageLog = world.getMessageLog();
      if (damage > 0) {
        messageLog.addMessage(`${attackerName} attacks ${targetName} for ${damage} damage!`);
        targetHealth.current -= damage;
      } else {
        messageLog.addMessage(`${attackerName} attacks ${targetName} but it has no effect.`);
      }

      // Check for death.
      if (targetHealth.current <= 0) {
        messageLog.addMessage(`${targetName} dies!`);
        entityManager.destroyEntity(targetId);
      }
    }

    // Clean up the "WantsToAttack" component.
    for (const entityId of attackers) {
      componentManager.removeComponent(entityId, 'WantsToAttack');
    }
  }
}
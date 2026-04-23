import System from '../../ecs/system.js';
import { Position, BlocksTile, Player, Name } from '../components/index.js';
import logger from '../../utils/logger.js';

/**
 * @typedef {import('../../ecs/world.js').default} World
 * @typedef {import('../../world/game-map.js').default} GameMap
 * @typedef {import('../components/position.js').default} PositionComponent
 * @typedef {import('../components/wants-to-move.js').default} WantsToMoveComponent
 */

/**
 * The MovementSystem is responsible for processing movement requests from entities.
 * It checks for valid moves, handles collisions with walls and other entities,
 * and updates the entity's Position component upon a successful move.
 */
export default class MovementSystem extends System {
    /**
     * The query for entities that have a position and a desire to move.
     * @type {import('../../ecs/world.js').Query}
     */
    #query;

    /**
     * Creates an instance of MovementSystem.
     */
    constructor() {
        super();
        this.#query = this.world.createQuery(Position, 'WantsToMove');
    }

    /**
     * Executes the movement logic for all entities with a WantsToMove component.
     * @param {World} world - The ECS world.
     * @param {GameMap} gameMap - The game map instance.
     */
    update(world, gameMap) {
        if (!gameMap) {
            logger.warn('MovementSystem: update called without a valid gameMap. Skipping.');
            return;
        }

        for (const entity of this.#query.get()) {
            const position = entity.get(Position);
            const wantsToMove = entity.get('WantsToMove');

            if (!position || !wantsToMove) {
                // This should not happen due to the query, but it's a good safeguard.
                logger.warn(`MovementSystem: Entity ${entity.id} is missing Position or WantsToMove component.`);
                entity.remove('WantsToMove');
                continue;
            }

            const { x, y } = wantsToMove;
            const targetX = position.x + x;
            const targetY = position.y + y;

            // 1. Check if the destination is within map bounds.
            if (!gameMap.isInBounds(targetX, targetY)) {
                if (entity.has(Player)) {
                    this.world.emit('message', {
                        entity,
                        message: "You can't move beyond the edge of the world.",
                        type: 'warn',
                    });
                }
                entity.remove('WantsToMove');
                continue;
            }

            // 2. Check if the destination tile is walkable.
            if (!gameMap.isTileWalkable(targetX, targetY)) {
                if (entity.has(Player)) {
                    this.world.emit('message', {
                        entity,
                        message: 'You bump into a wall.',
                        type: 'info',
                    });
                }
                entity.remove('WantsToMove');
                continue;
            }

            // 3. Check for collisions with other blocking entities.
            const targetEntityId = gameMap.getEntityAt(targetX, targetY);
            if (targetEntityId) {
                const targetEntity = this.world.getEntity(targetEntityId);
                // Ensure the target entity actually exists and blocks tiles.
                if (targetEntity && targetEntity.has(BlocksTile)) {
                    // Instead of just blocking, we can initiate combat by adding a component.
                    // The CombatSystem will handle this.
                    const entityName = entity.get(Name)?.name ?? 'Something';
                    const targetName = targetEntity.get(Name)?.name ?? 'something';

                    logger.info(`[MovementSystem] Collision: ${entityName} (${entity.id}) wants to attack ${targetName} (${targetEntity.id})`);

                    // Add a 'WantsToAttack' component to the moving entity.
                    // This decouples movement from combat logic.
                    entity.add('WantsToAttack', { target: targetEntity });

                    // The move action is consumed, even if it results in an attack.
                    entity.remove('WantsToMove');
                    continue; // Move to the next entity
                }
            }

            // 4. If all checks pass, move the entity.
            // Update the old tile to remove the entity.
            gameMap.removeEntityAt(position.x, position.y);

            // Update the entity's position component.
            position.x = targetX;
            position.y = targetY;

            // Update the new tile to add the entity.
            gameMap.setEntityAt(targetX, targetY, entity.id);

            // Mark the entity's view as dirty so the FOV is recalculated.
            if (entity.has(Player)) {
                const viewshed = entity.get('Viewshed');
                if (viewshed) {
                    viewshed.isDirty = true;
                }
            }

            // The move was successful, so remove the 'WantsToMove' component.
            entity.remove('WantsToMove');
            logger.debug(`[MovementSystem] Entity ${entity.id} moved to (${targetX}, ${targetY})`);
        }
    }
}
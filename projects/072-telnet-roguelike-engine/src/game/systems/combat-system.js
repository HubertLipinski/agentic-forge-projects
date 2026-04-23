import System from '../../ecs/system.js';
import { Name, CombatStats, Player } from '../components/index.js';
import logger from '../../utils/logger.js';

/**
 * @typedef {import('../../ecs/world.js').default} World
 * @typedef {import('../../ecs/entity.js').default} Entity
 */

/**
 * The CombatSystem is responsible for resolving combat between entities.
 * It processes 'WantsToAttack' components, calculates damage based on
 * entity stats, applies the damage, and handles entity death.
 */
export default class CombatSystem extends System {
    /**
     * The query for entities that want to perform an attack.
     * @type {import('../../ecs/world.js').Query}
     */
    #query;

    /**
     * Creates an instance of CombatSystem.
     */
    constructor() {
        super();
        this.#query = this.world.createQuery('WantsToAttack');
    }

    /**
     * Executes the combat logic for all entities with a WantsToAttack component.
     * @param {World} world - The ECS world.
     */
    update(world) {
        const deadEntities = new Set();

        for (const entity of this.#query.get()) {
            const wantsToAttack = entity.get('WantsToAttack');
            const target = wantsToAttack?.target;

            // Defensive checks: Ensure attacker and target are valid for combat.
            if (!this.#isValidCombatant(entity) || !this.#isValidCombatant(target)) {
                if (!target) {
                    logger.warn(`[CombatSystem] Attacker ${entity.id} has WantsToAttack component but no valid target.`);
                } else if (deadEntities.has(target.id)) {
                    // Target was already killed this turn, do nothing.
                } else {
                    logger.warn(`[CombatSystem] Invalid combat scenario between ${entity.id} and ${target.id}. Missing required components.`);
                }
                entity.remove('WantsToAttack');
                continue;
            }

            // An entity cannot attack itself.
            if (entity.id === target.id) {
                entity.remove('WantsToAttack');
                continue;
            }

            // Retrieve combat stats for both attacker and target.
            const attackerStats = entity.get(CombatStats);
            const targetStats = target.get(CombatStats);

            // Calculate damage. Simple formula for now: power - defense.
            // Ensure damage is at least 1 if the attack hits.
            const damage = Math.max(1, attackerStats.power - targetStats.defense);

            // Apply damage to the target.
            targetStats.hp = Math.max(0, targetStats.hp - damage);

            // Log the combat event and emit messages for the UI.
            this.#logAndNotify(entity, target, damage);

            // Check if the target was killed.
            if (targetStats.hp === 0) {
                this.#handleDeath(target);
                deadEntities.add(target.id);
            }

            // The attack action has been processed.
            entity.remove('WantsToAttack');
        }
    }

    /**
     * Checks if an entity is a valid participant in combat.
     * A valid combatant must exist and have CombatStats and a Name.
     * @param {Entity | undefined} entity - The entity to validate.
     * @returns {boolean} - True if the entity is a valid combatant.
     */
    #isValidCombatant(entity) {
        return entity?.has(CombatStats) && entity?.has(Name);
    }

    /**
     * Emits messages for the game log and logs the event to the server console.
     * @param {Entity} attacker - The attacking entity.
     * @param {Entity} target - The entity being attacked.
     * @param {number} damage - The amount of damage dealt.
     */
    #logAndNotify(attacker, target, damage) {
        const attackerName = attacker.get(Name).name;
        const targetName = target.get(Name).name;

        const message = `${attackerName} attacks ${targetName} for ${damage} damage.`;
        logger.info(`[CombatSystem] ${message}`);

        // Emit a world event that can be picked up by the RenderSystem or a message log system.
        // The message is sent to both the attacker and the target if they are players.
        if (attacker.has(Player)) {
            this.world.emit('message', { entity: attacker, message, type: 'combat' });
        }
        if (target.has(Player)) {
            this.world.emit('message', { entity: target, message, type: 'combat' });
        }
    }

    /**
     * Handles the death of an entity.
     * @param {Entity} entity - The entity that has died.
     */
    #handleDeath(entity) {
        const entityName = entity.get(Name).name;
        const message = `${entityName} is defeated!`;

        logger.info(`[CombatSystem] ${message}`);

        // Notify players involved or nearby.
        if (entity.has(Player)) {
            // Special handling for player death (e.g., end game screen).
            this.world.emit('message', { entity, message: 'You have been defeated!', type: 'death' });
            this.world.emit('player-death', { player: entity });
        } else {
            // For non-players, just a general message.
            this.world.emit('message', { message, type: 'info' });
        }

        // Add a 'Dead' component. Other systems (like RenderSystem or CorpseSystem)
        // can use this to change appearance or clean up the entity.
        entity.add('Dead', {});

        // An entity that is dead should not block tiles, attack, or be a target.
        entity.remove('BlocksTile');
        entity.remove('WantsToAttack');
        entity.remove('CombatStats');

        // The Renderable component can be updated to show a corpse.
        const renderable = entity.get('Renderable');
        if (renderable) {
            renderable.glyph = '%';
            renderable.fg = '#BF4040'; // A blood-red color
            renderable.renderOrder = 1; // Render below living entities
        }
    }
}
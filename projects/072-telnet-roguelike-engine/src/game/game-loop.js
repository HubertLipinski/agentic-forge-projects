import logger from '../utils/logger.js';
import { Player } from './components/index.js';

/**
 * @file src/game/game-loop.js
 * @description Manages the main turn-based game loop, processing player inputs and triggering ECS world updates.
 * This module orchestrates the flow of the game, ensuring that player actions are processed,
 * AI takes its turn, and the world state is updated accordingly in a turn-based manner.
 */

/**
 * Represents the different states the game loop can be in.
 * @enum {string}
 */
export const GameLoopState = {
    AWAITING_INPUT: 'AWAITING_INPUT', // The loop is paused, waiting for all players to submit an action.
    PROCESSING_TURN: 'PROCESSING_TURN', // The loop is actively processing a turn (player actions, AI, world updates).
    PAUSED: 'PAUSED', // The loop is explicitly paused.
};

/**
 * Manages the main turn-based game loop for a game instance.
 *
 * The game loop operates in a turn-based fashion. It waits for all human players
 * to input their actions for the turn. Once all players have decided, the loop
 * processes these actions, runs AI systems for non-player characters (NPCs),
 * updates the game world through the ECS systems, and then waits for the next
 * set of player inputs. This ensures a fair and predictable sequence of events
 * in a multiplayer environment.
 */
export default class GameLoop {
    /**
     * The game instance this loop belongs to.
     * @type {import('./game-instance.js').default}
     */
    #gameInstance;

    /**
     * The current state of the game loop.
     * @type {GameLoopState}
     */
    #state = GameLoopState.AWAITING_INPUT;

    /**
     * A queue of actions submitted by players for the current turn.
     * The key is the player's entity ID, and the value is the action to perform.
     * @type {Map<string, { type: string, payload: any }>}
     */
    #playerActionQueue = new Map();

    /**
     * A query to get all player entities from the ECS world.
     * @type {import('../ecs/world.js').Query}
     */
    #playerQuery;

    /**
     * The current turn number.
     * @type {number}
     */
    turn = 0;

    /**
     * Creates an instance of the GameLoop.
     * @param {import('./game-instance.js').default} gameInstance - The parent game instance.
     */
    constructor(gameInstance) {
        if (!gameInstance) {
            throw new Error('GameLoop must be initialized with a GameInstance.');
        }
        this.#gameInstance = gameInstance;
        this.#playerQuery = this.#gameInstance.world.createQuery(Player);
        logger.info('[GameLoop] Initialized.');
    }

    /**
     * Starts the game loop.
     */
    start() {
        logger.info('[GameLoop] Starting...');
        this.#state = GameLoopState.AWAITING_INPUT;
        this.turn = 1;
        // The loop is event-driven, so 'start' primarily sets the initial state.
        // The loop progresses when player actions are received.
    }

    /**
     * Stops the game loop.
     */
    stop() {
        logger.info('[GameLoop] Stopping...');
        this.#state = GameLoopState.PAUSED;
        this.#playerActionQueue.clear();
    }

    /**
     * Gets the current state of the game loop.
     * @returns {GameLoopState} The current state.
     */
    getState() {
        return this.#state;
    }

    /**
     * Queues an action from a player entity.
     * This is the primary entry point for player input to affect the game world.
     *
     * @param {string} playerId - The ID of the player entity performing the action.
     * @param {{ type: string, payload: any }} action - The action object.
     */
    queuePlayerAction(playerId, action) {
        if (this.#state !== GameLoopState.AWAITING_INPUT) {
            logger.warn(`[GameLoop] Action received from player ${playerId} while not awaiting input. State: ${this.#state}. Action ignored.`);
            return;
        }

        if (this.#playerActionQueue.has(playerId)) {
            logger.debug(`[GameLoop] Player ${playerId} changed their action for this turn.`);
        }

        this.#playerActionQueue.set(playerId, action);
        logger.debug(`[GameLoop] Queued action '${action.type}' for player ${playerId}.`);

        // Asynchronously check if all players have submitted their actions.
        // Using setImmediate to allow any other synchronous code to complete first.
        setImmediate(() => this.#tryProcessTurn());
    }

    /**
     * Checks if all active players have submitted an action for the current turn.
     * If so, it transitions the state and processes the turn.
     * @private
     */
    #tryProcessTurn() {
        const activePlayers = this.#playerQuery.get();

        if (activePlayers.length === 0) {
            // No players in the game, so we can't proceed. The loop will remain in AWAITING_INPUT.
            if (this.#playerActionQueue.size > 0) {
                // Clear queue if players disconnected.
                this.#playerActionQueue.clear();
            }
            return;
        }

        const allPlayersReady = activePlayers.every(player => this.#playerActionQueue.has(player.id));

        if (allPlayersReady) {
            logger.info(`[GameLoop] All ${activePlayers.length} players ready. Processing Turn ${this.turn}.`);
            this.#processTurn();
        } else {
            const waitingOn = activePlayers
                .filter(p => !this.#playerActionQueue.has(p.id))
                .map(p => p.id.substring(0, 8))
                .join(', ');
            logger.debug(`[GameLoop] Waiting on players: ${waitingOn}`);
        }
    }

    /**
     * Executes a single turn of the game.
     * This involves processing player actions, running AI, and updating the world.
     * @private
     */
    #processTurn() {
        this.#state = GameLoopState.PROCESSING_TURN;

        try {
            // 1. Process Player Actions
            // Convert queued actions into components that systems can process.
            this.#processPlayerInputs();

            // 2. Update the ECS World
            // This is the core of the turn. Systems will now run in order.
            // - AI systems will run, creating 'WantsToMove' or 'WantsToAttack' components for NPCs.
            // - MovementSystem will process all 'WantsToMove' components.
            // - CombatSystem will process all 'WantsToAttack' components.
            // - Other systems (e.g., for status effects, hunger) will also run.
            this.#gameInstance.world.update(this.#gameInstance.map);

            // 3. Post-turn cleanup and state transition
            this.#playerActionQueue.clear();
            this.turn++;
            this.#state = GameLoopState.AWAITING_INPUT;

            logger.info(`[GameLoop] Turn ${this.turn - 1} complete. Now awaiting input for Turn ${this.turn}.`);

            // The RenderSystem is typically the last system to run in the world update,
            // so the new state is already sent to clients. No extra render call is needed here.

        } catch (error) {
            logger.error('[GameLoop] An error occurred during turn processing:', error);
            // In a real-world scenario, we might try to recover or gracefully shut down.
            // For now, we'll log the error and attempt to reset the state to prevent a deadlock.
            this.#playerActionQueue.clear();
            this.#state = GameLoopState.AWAITING_INPUT;
        }
    }

    /**
     * Translates the actions in the player queue into components on the respective entities.
     * This decouples the game loop from the specifics of the ECS systems.
     * @private
     */
    #processPlayerInputs() {
        for (const [playerId, action] of this.#playerActionQueue.entries()) {
            const playerEntity = this.#gameInstance.world.getEntity(playerId);

            if (!playerEntity) {
                logger.warn(`[GameLoop] Could not find player entity ${playerId} to process action.`);
                continue;
            }

            // Based on the action type, add the appropriate component to the entity.
            // The corresponding system will handle the logic in the world update.
            switch (action.type) {
                case 'move':
                    // The payload should be an object like { x: 0, y: -1 }
                    playerEntity.add('WantsToMove', action.payload);
                    break;
                case 'wait':
                    // A 'wait' action means the player does nothing this turn.
                    // No component is needed; their turn is simply consumed.
                    logger.debug(`Player ${playerId} chose to wait.`);
                    break;
                case 'pickup':
                    // Example for a future system
                    playerEntity.add('WantsToPickupItem', {});
                    break;
                default:
                    logger.warn(`[GameLoop] Unknown action type '${action.type}' from player ${playerId}.`);
            }
        }
    }
}
/**
 * @file src/game/action-handler.js
 * @description Contains the logic for executing parsed commands and updating the world state.
 * This module acts as the bridge between player input and game world mutations. It receives
 * structured command objects from the command parser, validates them, and then calls the
 * appropriate methods on the WorldState to effect changes. It also generates feedback messages
 * for the player.
 */

import { WorldState } from '../state/world-state.js';
import { Actor } from '../entities/actor.js';

/**
 * A map of direction vectors.
 * @type {Readonly<Record<string, {dx: number, dy: number}>>}
 */
const DIRECTION_VECTORS = Object.freeze({
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
});

/**
 * Handles the 'move' action for an actor.
 *
 * @param {Actor} actor - The actor performing the move.
 * @param {{direction: string}} command - The parsed move command.
 * @param {WorldState} worldState - The current state of the world.
 * @returns {string} A feedback message for the client.
 */
function handleMove(actor, command, worldState) {
  const vector = DIRECTION_VECTORS[command.direction];
  if (!vector) {
    return `Invalid direction: ${command.direction}. Try north, south, east, or west.`;
  }

  const newX = actor.x + vector.dx;
  const newY = actor.y + vector.dy;

  // Check for map boundaries and walls first.
  if (!worldState.map.isWalkable(newX, newY)) {
    return "You can't move there; a wall is in the way.";
  }

  // Check if another actor is blocking the path.
  const blockingActor = worldState.getActorAt(newX, newY);
  if (blockingActor) {
    return `${blockingActor.name} is blocking your path.`;
  }

  // If all checks pass, attempt to move the actor.
  const moved = worldState.moveActor(actor.id, newX, newY);
  if (moved) {
    // The 'look' command will be implicitly called by the engine after a successful action,
    // so we don't need to describe the new location here.
    return `You move ${command.direction}.`;
  } else {
    // This case should be rare if our checks are correct, but it's good defensive programming.
    return "You can't move there for some reason.";
  }
}

/**
 * Handles the 'say' action for an actor.
 *
 * @param {Actor} actor - The actor performing the action.
 * @param {{message: string}} command - The parsed say command.
 * @param {WorldState} worldState - The current state of the world.
 * @returns {string} A feedback message for the client.
 */
function handleSay(actor, command, worldState) {
  if (!command.message || command.message.trim() === '') {
    return 'Say what?';
  }

  // Emit a global event that can be broadcast to all nearby players.
  worldState.eventBus.emit('actorSaid', {
    actorId: actor.id,
    actorName: actor.name,
    message: command.message,
  });

  // The client's own message is part of the broadcast, but we can also return a direct confirmation.
  return `You say, "${command.message}"`;
}

/**
 * Handles the 'look' action for an actor.
 *
 * @param {Actor} actor - The actor performing the action.
 * @param {WorldState} worldState - The current state of the world.
 * @returns {string} A description of the actor's current location.
 */
function handleLook(actor, worldState) {
  const { x, y } = actor;
  const descriptionParts = [];

  // For now, a simple room name. This could be expanded to be more descriptive.
  descriptionParts.push(`[You are at (${x}, ${y})]`);

  // Describe other actors in the same location.
  const otherActors = worldState.getAllActors().filter(a => a.id !== actor.id && a.x === x && a.y === y);
  if (otherActors.length > 0) {
    const actorNames = otherActors.map(a => a.name).join(', ');
    descriptionParts.push(`You see: ${actorNames}.`);
  } else {
    descriptionParts.push('You are alone here.');
  }

  // TODO: Describe items on the floor.

  return descriptionParts.join('\n');
}

/**
 * Handles the 'attack' action for an actor.
 *
 * @param {Actor} actor - The actor performing the action.
 * @param {{targetName: string}} command - The parsed attack command.
 * @param {WorldState} worldState - The current state of the world.
 * @returns {string} A feedback message for the client.
 */
function handleAttack(actor, command, worldState) {
  if (!command.targetName) {
    return 'Attack whom?';
  }

  // Find the target in the same location as the attacker.
  const target = worldState.getAllActors().find(a =>
    a.name.toLowerCase() === command.targetName.toLowerCase() &&
    a.x === actor.x &&
    a.y === actor.y &&
    a.id !== actor.id
  );

  if (!target) {
    // Check if a target with that name exists anywhere, for a better error message.
    const targetExists = worldState.getAllActors().some(a => a.name.toLowerCase() === command.targetName.toLowerCase());
    return targetExists ? `There is no one here by the name "${command.targetName}".` : `You see no one named "${command.targetName}" to attack.`;
  }

  if (!target.isAlive()) {
    return `${target.name} is already defeated.`;
  }

  // Execute the attack through the world state.
  worldState.attack(actor.id, target.id);

  // The event bus will handle broadcasting the attack results, but we can provide
  // immediate feedback to the attacker.
  return `You attack ${target.name}.`;
}

/**
 * A map of action handlers.
 * The key is the action name (from the command parser), and the value is the handler function.
 * @type {Readonly<Record<string, Function>>}
 */
const ACTION_HANDLERS = Object.freeze({
  move: handleMove,
  say: handleSay,
  look: (actor, command, worldState) => handleLook(actor, worldState), // Command is unused but passed.
  attack: handleAttack,
  // TODO: Add handlers for 'get', 'drop', 'inventory', 'use', etc.
});

/**
 * Executes a parsed command for a specific actor.
 * This is the main entry point for the action handler system.
 *
 * @param {string} actorId - The ID of the actor performing the action.
 * @param {object} parsedCommand - The command object from the CommandParser.
 *   Example: { action: 'move', direction: 'north' }
 * @param {WorldState} worldState - The current state of the world.
 * @returns {string} A result message to be sent back to the client.
 */
export function executeAction(actorId, parsedCommand, worldState) {
  const actor = worldState.getActorById(actorId);

  if (!actor) {
    console.error(`Action execution failed: Actor with ID ${actorId} not found.`);
    return 'Error: Your character could not be found.';
  }

  if (!actor.isAlive()) {
    return "You can't do that, you've been defeated!";
  }

  const { action } = parsedCommand;
  const handler = ACTION_HANDLERS[action];

  if (handler) {
    try {
      return handler(actor, parsedCommand, worldState);
    } catch (error) {
      console.error(`Error executing action "${action}" for actor ${actorId}:`, error);
      return 'An unexpected error occurred while performing that action.';
    }
  }

  // Handle unknown or un-implemented actions
  const availableActions = Object.keys(ACTION_HANDLERS).join(', ');
  return `Unknown command: "${action}". Try: ${availableActions}.`;
}
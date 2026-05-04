/**
 * @file src/game/command-parser.js
 * @description Parses raw string commands from clients into structured action objects.
 * This module is responsible for interpreting player input and converting it into a
 * format that the ActionHandler can understand and execute. It handles various
 * command structures, from simple single-word commands to more complex multi-word
 * phrases with targets or arguments.
 */

// --- Command Definitions ---

/**
 * A set of common aliases for directions. This allows players to use
 * abbreviations like 'n' for 'north'.
 * @type {Readonly<Map<string, string>>}
 */
const DIRECTION_ALIASES = new Map([
  ['n', 'north'],
  ['s', 'south'],
  ['e', 'east'],
  ['w', 'west'],
  ['u', 'up'],
  ['d', 'down'],
]);

/**
 * A list of valid direction keywords.
 * @type {Readonly<Set<string>>}
 */
const DIRECTIONS = new Set(['north', 'south', 'east', 'west', 'up', 'down']);

/**
 * A map defining the primary action keyword for each command and its expected structure.
 * The `parts` property indicates how many words the command expects after the initial keyword.
 * - A number (e.g., 1) means a fixed number of additional words.
 * - The value 'rest' means all remaining words should be captured as a single argument.
 * - The value 0 means it's a single-word command.
 *
 * @type {Readonly<Map<string, { action: string, parts: number | 'rest' }>>}
 */
const COMMAND_MAP = new Map([
  // Movement
  ['move', { action: 'move', parts: 1 }],
  ['go', { action: 'move', parts: 1 }],
  // Directional shortcuts (n, s, e, w, etc.) are handled separately

  // Interaction
  ['look', { action: 'look', parts: 0 }], // 'look' or 'look <target>' handled by argument count
  ['l', { action: 'look', parts: 0 }],
  ['examine', { action: 'look', parts: 1 }],
  ['ex', { action: 'look', parts: 1 }],
  ['get', { action: 'get', parts: 1 }],
  ['take', { action: 'get', parts: 1 }],
  ['drop', { action: 'drop', parts: 1 }],
  ['attack', { action: 'attack', parts: 1 }],
  ['kill', { action: 'attack', parts: 1 }],

  // Communication
  ['say', { action: 'say', parts: 'rest' }],
  ["'", { action: 'say', parts: 'rest' }], // Common MUD alias for say

  // Informational
  ['help', { action: 'help', parts: 0 }],
  ['inventory', { action: 'inventory', parts: 0 }],
  ['i', { action: 'inventory', parts: 0 }],
  ['score', { action: 'score', parts: 0 }],
  ['who', { action: 'who', parts: 0 }],
]);

// --- Parsing Logic ---

/**
 * Parses a raw input string from a client into a structured command object.
 *
 * @param {string} input - The raw command string from the client (e.g., "move north", "get sword").
 * @returns {{action: string, [key: string]: any} | {error: string}}
 *          A structured action object on success (e.g., { action: 'move', direction: 'north' }),
 *          or an error object on failure (e.g., { error: 'Unknown command.' }).
 */
export function parseCommand(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    return { error: 'Invalid input.' };
  }

  // Normalize input: lowercase, trim whitespace, and split into words.
  const words = input.trim().toLowerCase().split(/\s+/);
  const commandWord = words[0];
  const args = words.slice(1);

  // --- Handle special cases first ---

  // 1. Directional movement shortcuts (e.g., "n", "south")
  const aliasedDirection = DIRECTION_ALIASES.get(commandWord);
  if (aliasedDirection) {
    return { action: 'move', direction: aliasedDirection };
  }
  if (DIRECTIONS.has(commandWord)) {
    return { action: 'move', direction: commandWord };
  }

  // --- Handle standard commands from the COMMAND_MAP ---

  const commandDef = COMMAND_MAP.get(commandWord);

  if (!commandDef) {
    return { error: `Unknown command: "${commandWord}". Type 'help' for a list of commands.` };
  }

  const { action, parts } = commandDef;

  // --- Construct the action object based on command definition ---

  // Case: 'say hello world' -> { action: 'say', message: 'hello world' }
  if (parts === 'rest') {
    if (args.length === 0) {
      return { error: `What do you want to ${action}?` };
    }
    return { action, message: args.join(' ') };
  }

  // Case: 'move north' -> { action: 'move', direction: 'north' }
  if (action === 'move') {
    if (args.length !== 1) {
      return { error: 'Where do you want to move?' };
    }
    const direction = DIRECTION_ALIASES.get(args[0]) ?? args[0];
    if (!DIRECTIONS.has(direction)) {
      return { error: `"${args[0]}" is not a valid direction.` };
    }
    return { action, direction };
  }

  // Case: 'look' or 'look goblin'
  if (action === 'look') {
    // 'look' with no args is valid
    if (args.length === 0) {
      return { action: 'look', target: null };
    }
    // 'look <target>'
    return { action: 'look', target: args.join(' ') };
  }

  // Case: 'get sword', 'attack goblin'
  if (parts === 1) {
    if (args.length === 0) {
      return { error: `What do you want to ${action}?` };
    }
    // For now, treat multi-word targets as a single string.
    // e.g., "get rusty key" -> { action: 'get', target: 'rusty key' }
    return { action, target: args.join(' ') };
  }

  // Case: 'inventory', 'help', 'who' (single-word commands)
  if (parts === 0) {
    if (args.length > 0) {
      // e.g., player types "inventory all"
      return { error: `The "${action}" command does not take any arguments.` };
    }
    return { action };
  }

  // Fallback for unhandled command structures. This should not be reached with the current definitions.
  return { error: 'Could not understand your command.' };
}
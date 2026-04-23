import Ai from './ai.js';
import BlocksTile from './blocks-tile.js';
import CombatStats from './combat-stats.js';
import Dead from './dead.js';
import Name from './name.js';
import Player from './player.js';
import Position from './position.js';
import Renderable from './renderable.js';
import Stats from './stats.js';
import Viewshed from './viewshed.js';
import WantsToAttack from './wants-to-attack.js';
import WantsToMove from './wants-to-move.js';

/**
 * This barrel file re-exports all game-specific components for easy importing
 * from other modules. Instead of importing each component from its own file,
 * other systems and modules can import them all from this single entry point.
 *
 * Example:
 * import { Position, Renderable, Player } from './src/game/components/index.js';
 */
export {
    Ai,
    BlocksTile,
    CombatStats,
    Dead,
    Name,
    Player,
    Position,
    Renderable,
    Stats,
    Viewshed,
    WantsToAttack,
    WantsToMove,
};
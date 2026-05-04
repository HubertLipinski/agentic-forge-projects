/**
 * @file src/utils/uuid.js
 * @description A simple wrapper for the 'uuid' package to generate unique identifiers.
 * This ensures a consistent method for creating IDs for all entities (actors, items, etc.)
 * across the application. Using a wrapper also makes it easier to swap out the underlying
 * UUID generation library or change the ID format in the future without refactoring
 * large parts of the codebase.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a new, unique Version 4 UUID.
 *
 * @returns {string} A unique identifier string in the format 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.
 * @example
 * const newActorId = generateId();
 * // => '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'
 */
export const generateId = () => {
  return uuidv4();
};
/**
 * @file src/utils/type-caster.js
 * @description Provides functionality to cast string values from CLI arguments
 * into their corresponding JavaScript types based on JSDoc type definitions.
 */

/**
 * A custom error class for type casting failures.
 * This helps distinguish casting errors from other application errors.
 */
class TypeCastingError extends Error {
  /**
   * @param {string} message The error message.
   */
  constructor(message) {
    super(message);
    this.name = 'TypeCastingError';
  }
}

/**
 * Casts a string value to a boolean.
 * Handles various string representations of boolean values.
 * - `true`, `t`, `yes`, `y`, `1` are treated as `true`.
 * - `false`, `f`, `no`, `n`, `0` are treated as `false`.
 * For flags without a value (e.g., `--verbose`), yargs-parser provides `true`.
 *
 * @param {string | boolean} value The input value from the CLI.
 * @returns {boolean} The casted boolean value.
 * @throws {TypeCastingError} If the value is an ambiguous string.
 */
function castToBoolean(value) {
  // If yargs-parser already determined it's a boolean (e.g., a bare flag), return it.
  if (typeof value === 'boolean') {
    return value;
  }

  const valueStr = String(value).toLowerCase();

  if (['true', 't', 'yes', 'y', '1'].includes(valueStr)) {
    return true;
  }
  if (['false', 'f', 'no', 'n', '0'].includes(valueStr)) {
    return false;
  }

  throw new TypeCastingError(
    `Cannot cast "${value}" to a boolean. Use 'true', 'false', or a similar value.`
  );
}

/**
 * Casts a string value to a number.
 * Ensures that the entire string is a valid number.
 *
 * @param {string} value The input string value from the CLI.
 * @returns {number} The casted number.
 * @throws {TypeCastingError} If the value is not a valid number.
 */
function castToNumber(value) {
  // The Number() constructor can be too lenient (e.g., Number('') -> 0).
  // We check if the value is a non-empty string and if it's a valid number.
  // The `isFinite` check handles `Infinity` and `-Infinity`.
  // The `!isNaN(parseFloat(value))` handles numeric strings like "123.45".
  if (
    value === null ||
    String(value).trim() === '' ||
    !isFinite(Number(value))
  ) {
    throw new TypeCastingError(`Cannot cast "${value}" to a number.`);
  }
  return Number(value);
}

/**
 * Casts a given value to its target type as specified by JSDoc.
 * This is the primary export of the module.
 *
 * @param {string | boolean} value The raw value from the parsed CLI arguments.
 * @param {string} targetType The JSDoc type (e.g., 'string', 'number', 'boolean').
 * @returns {string | number | boolean} The value cast to the target type.
 * @throws {TypeCastingError} If casting fails or the type is unsupported.
 */
export function castValue(value, targetType) {
  const normalizedType = targetType.toLowerCase();

  switch (normalizedType) {
    case 'string':
      // CLI arguments are strings by default, so we just ensure it's a string.
      return String(value);

    case 'number':
      return castToNumber(value);

    case 'boolean':
      return castToBoolean(value);

    default:
      // For now, we only support primitive types. In the future, this could be
      // extended to support arrays, objects, etc.
      // We return the original value for unknown types to be permissive.
      // A stricter implementation might throw an error here.
      return value;
  }
}
/**
 * @file src/index.js
 * @description Main entry point for the llm-api-sanitizer library.
 * @module llm-api-sanitizer
 *
 * This file serves as the public interface for the library, exporting the
 * core `Sanitizer` class and the default set of input sanitization rules.
 * Users of this package will import these components to build their
 * secure LLM API wrappers.
 */

import { Sanitizer } from './sanitizer.js';
import defaultInputRules from './rules/input-rules.js';

/**
 * The primary Sanitizer class, responsible for orchestrating the sanitization
 * of input prompts and the validation of LLM outputs.
 * @see {@link Sanitizer}
 */
export { Sanitizer };

/**
 * An array of default regular expression-based rules for detecting and
 * handling common prompt injection patterns. This array can be extended or
 * replaced by the user.
 * @see {@link module:rules/input}
 */
export { defaultInputRules };

/**
 * The default export of the library is the Sanitizer class itself,
 * allowing for a more direct import style: `import Sanitizer from 'llm-api-sanitizer';`
 */
export default Sanitizer;
/**
 * @file src/rules/input-rules.js
 * @description Defines default rules for sanitizing LLM input prompts.
 * @module rules/input
 *
 * This file exports an array of regular expressions designed to detect and
 * remove common prompt injection patterns. These rules are a first line of
- * defense and can be customized or extended by the user.
 */

/**
 * @typedef {Object} SanitizationRule
 * @property {RegExp} pattern - The regular expression to match against the input.
 * @property {string} name - A descriptive name for the rule.
 * @property {string} description - A brief explanation of what the rule targets.
 */

/**
 * An array of default sanitization rules for input prompts.
 * Each rule is a regular expression targeting a common prompt injection technique.
 * The 'i' flag is used for case-insensitivity, and 'm' allows '^' and '$' to match
 * the start/end of lines, not just the entire string.
 *
 * @type {Array<SanitizationRule>}
 */
const defaultInputRules = [
  {
    name: 'IgnorePreviousInstructions',
    description: 'Detects phrases that instruct the model to disregard prior context or instructions.',
    pattern: /^(ignore|disregard|forget|override|pay no attention to) (the|your) (previous|above|preceding) (instructions?|directions?|context|prompt|rules?)( and follow these new instructions)?\.?/im,
  },
  {
    name: 'RevealInstructions',
    description: 'Targets attempts to make the model reveal its own system prompt or initial instructions.',
    pattern: /(what are your instructions|reveal your instructions|what is your system prompt|repeat the text above|output your initial prompt|print your instructions)/im,
  },
  {
    name: 'RolePlayAsDeveloper',
    description: 'Catches prompts asking the model to act as a developer or system with special privileges.',
    pattern: /you are now in (developer|dev|god|expert|sudo) mode/im,
  },
  {
    name: 'StopAndStartTokens',
    description: 'Looks for explicit commands to stop processing and start a new, malicious instruction set.',
    pattern: /(<\|im_end\|>|<\|im_start\|>|STOP|START) instruction/im,
  },
  {
    name: 'JailbreakLanguage',
    description: 'Identifies common "jailbreak" phrases used to bypass safety filters.',
    pattern: /(my grandma told me a story about|act as a storyteller|tell me a story about how to)/im,
  },
  {
    name: 'ConfidentialityBypass',
    description: 'Detects attempts to trick the model into revealing information it has been told is confidential.',
    pattern: /display the confidential information above/im,
  },
  {
    name: 'TranslateAndExecute',
    description: 'Catches instructions to translate a benign-looking phrase into a malicious command.',
    pattern: /translate this to a new language and then follow the instructions:/im,
  },
  {
    name: 'ContextSwitching',
    description: 'Identifies phrases that attempt to switch the context of the conversation abruptly.',
    pattern: /that was a test\. now, let's move on to the real task:|that was just a joke\. the real prompt is:/im,
  },
  {
    name: 'InstructionRepetition',
    description: 'Looks for patterns where a user might try to get the model to repeat and thus execute a hidden command.',
    pattern: /repeat the following sentence exactly:/im,
  },
];

export default defaultInputRules;
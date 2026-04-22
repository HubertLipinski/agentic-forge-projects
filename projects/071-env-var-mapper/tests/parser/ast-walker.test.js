/**
 * @file tests/parser/ast-walker.test.js
 * @description Unit tests for the AST walker logic.
 * These tests ensure that `findEnvVarExpressions` correctly identifies various
 * `process.env` access patterns from a given AST.
 */

import { test, describe, it, assert } from 'node:test';
import { parse } from 'acorn';
import { findEnvVarExpressions } from '../../src/parser/ast-walker.js';

/**
 * A helper function to generate an AST from a source code string for testing.
 * @param {string} code - The JavaScript source code.
 * @returns {object} The Acorn-generated AST.
 */
const createAst = (code) => {
  return parse(code, {
    ecmaVersion: 2024,
    sourceType: 'module',
    locations: true,
  });
};

describe('ast-walker', () => {
  describe('findEnvVarExpressions()', () => {
    it('should return an empty array for code with no process.env access', () => {
      const code = `
        const a = 1;
        const b = 'hello';
        function test() { return 'world'; }
      `;
      const ast = createAst(code);
      const result = findEnvVarExpressions(ast);
      assert.deepStrictEqual(result, [], 'Should find no environment variables');
    });

    it('should find a single environment variable using dot notation (MemberExpression)', () => {
      const code = 'const dbHost = process.env.DB_HOST;';
      const ast = createAst(code);
      const result = findEnvVarExpressions(ast);

      assert.strictEqual(result.length, 1, 'Should find exactly one variable');
      assert.strictEqual(result[0].name, 'DB_HOST', 'Variable name should be DB_HOST');
      assert.strictEqual(result[0].loc.start.line, 1, 'Line number should be correct');
    });

    it('should find a single environment variable using bracket notation (Computed MemberExpression)', () => {
      const code = "const port = process.env['PORT'];";
      const ast = createAst(code);
      const result = findEnvVarExpressions(ast);

      assert.strictEqual(result.length, 1, 'Should find exactly one variable');
      assert.strictEqual(result[0].name, 'PORT', 'Variable name should be PORT');
      assert.strictEqual(result[0].loc.start.line, 1, 'Line number should be correct');
    });

    it('should find multiple unique environment variables', () => {
      const code = `
        const apiKey = process.env.API_KEY;
        const apiSecret = process.env['API_SECRET'];
        const nodeEnv = process.env.NODE_ENV;
      `;
      const ast = createAst(code);
      const result = findEnvVarExpressions(ast);
      const names = result.map(v => v.name).sort();

      assert.strictEqual(result.length, 3, 'Should find three variables');
      assert.deepStrictEqual(names, ['API_KEY', 'API_SECRET', 'NODE_ENV'], 'Should find all unique variable names');
    });

    it('should find multiple occurrences of the same environment variable', () => {
      const code = `
        const port1 = process.env.PORT;
        if (process.env.PORT === '3000') {
          console.log('Default port');
        }
        const port3 = process.env['PORT'];
      `;
      const ast = createAst(code);
      const result = findEnvVarExpressions(ast);

      assert.strictEqual(result.length, 3, 'Should find three occurrences');
      assert.ok(result.every(v => v.name === 'PORT'), 'All found variables should be named PORT');
      assert.strictEqual(result[0].loc.start.line, 2, 'First occurrence should be on line 2');
      assert.strictEqual(result[1].loc.start.line, 3, 'Second occurrence should be on line 3');
      assert.strictEqual(result[2].loc.start.line, 6, 'Third occurrence should be on line 6');
    });

    it('should ignore dynamic access with computed properties (variable in brackets)', () => {
      const code = `
        const key = 'MY_VAR';
        const value = process.env[key];
      `;
      const ast = createAst(code);
      const result = findEnvVarExpressions(ast);
      assert.strictEqual(result.length, 0, 'Should not find variables with dynamic keys');
    });

    it('should ignore properties of objects other than process.env', () => {
      const code = `
        const myConfig = { env: { 'DB_HOST': 'localhost' } };
        const host = myConfig.env.DB_HOST;

        const process = { env: { 'FAKE_VAR': 'fake' } };
        const fake = process.env.FAKE_VAR;
      `;
      const ast = createAst(code);
      const result = findEnvVarExpressions(ast);
      assert.strictEqual(result.length, 0, 'Should not find variables from other objects');
    });

    it('should ignore variables found in comments', () => {
      const code = `
        // const url = process.env.DATABASE_URL;
        /*
         * Another one: process.env['SECRET_KEY']
         */
      `;
      const ast = createAst(code);
      const result = findEnvVarExpressions(ast);
      assert.strictEqual(result.length, 0, 'Should ignore variables inside comments');
    });

    it('should ignore variables that are part of a string literal', () => {
      const code = "const message = 'The variable is process.env.MY_VAR';";
      const ast = createAst(code);
      const result = findEnvVarExpressions(ast);
      assert.strictEqual(result.length, 0, 'Should ignore variables inside string literals');
    });

    it('should handle complex expressions involving process.env', () => {
      const code = "const useTls = (process.env.DB_USE_TLS || 'false') === 'true';";
      const ast = createAst(code);
      const result = findEnvVarExpressions(ast);

      assert.strictEqual(result.length, 1, 'Should find one variable in a complex expression');
      assert.strictEqual(result[0].name, 'DB_USE_TLS', 'Variable name should be correct');
    });

    it('should handle nullish coalescing and optional chaining', () => {
      const code = `
        const port = process.env.PORT ?? 3000;
        const host = process.env?.DB_HOST; // This is not process.env but process?.env
      `;
      const ast = createAst(code);
      const result = findEnvVarExpressions(ast);

      assert.strictEqual(result.length, 1, 'Should find one variable and ignore optional chain on process');
      assert.strictEqual(result[0].name, 'PORT', 'Should correctly find PORT');
    });

    it('should ignore access with an empty string literal `process.env[\'\']`', () => {
        const code = "const empty = process.env[''];";
        const ast = createAst(code);
        const result = findEnvVarExpressions(ast);
        assert.strictEqual(result.length, 0, 'Should ignore empty string literal keys');
    });

    it('should handle a mix of valid and invalid patterns correctly', () => {
      const code = `
        const a = process.env.VALID_ONE; // Valid
        const key = 'INVALID';
        const b = process.env[key]; // Invalid
        const c = process.env['VALID_TWO']; // Valid
        // const d = process.env.COMMENTED; // Invalid
        const e = "process.env.STRING"; // Invalid
      `;
      const ast = createAst(code);
      const result = findEnvVarExpressions(ast);
      const names = result.map(v => v.name).sort();

      assert.strictEqual(result.length, 2, 'Should find exactly two valid variables');
      assert.deepStrictEqual(names, ['VALID_ONE', 'VALID_TWO'], 'Should identify the correct variable names');
    });

    it('should return an empty array if a non-AST object is passed', () => {
      assert.deepStrictEqual(findEnvVarExpressions(null), [], 'Should handle null input');
      assert.deepStrictEqual(findEnvVarExpressions(undefined), [], 'Should handle undefined input');
      assert.deepStrictEqual(findEnvVarExpressions({}), [], 'Should handle empty object input');
      assert.deepStrictEqual(findEnvVarExpressions([]), [], 'Should handle array input');
    });
  });
});
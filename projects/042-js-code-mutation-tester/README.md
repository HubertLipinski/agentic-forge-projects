# JS Mutation Tester

A powerful and fast CLI tool that performs mutation testing on your JavaScript/TypeScript codebase. It helps you gauge the quality of your tests by seeing if they can detect small, deliberate defects introduced into your code.

## Description

Mutation testing is a technique used to evaluate the quality of your existing software tests. This tool works by strategically introducing small, controlled defects (called **mutations**) into your source code, one by one. For each mutated version of your code (a **mutant**), it runs your test suite.

- If your tests **fail**, the mutant is considered **killed**. This is good! It means your tests caught the defect.
- If your tests **still pass**, the mutant has **survived**. This indicates a potential weakness in your test suite, as it failed to detect a code change that it arguably should have.

By identifying surviving mutants, you can pinpoint areas where your test coverage needs improvement, leading to a more robust and reliable codebase.

## Features

- **AST-Based Mutations**: Uses Babel to parse code and apply precise mutations, ensuring syntactically valid mutants.
- **High Performance**: Leverages Node.js worker threads to run test suites against mutants in parallel, maximizing CPU usage.
- **Rich Mutators**: Includes a suite of common mutators for `BinaryExpression`, `LogicalExpression`, `StringLiteral`, and more.
- **Clear Reporting**: Generates a detailed summary report with a mutation score, statistics, and a list of survivors.
- **Insightful Diffs**: For every surviving mutant, a colorized, unified diff is displayed to show the exact change that went undetected.
- **Flexible Configuration**: Configure via `package.json`, `.mutationrc.json`, or command-line arguments.
- **Watch Mode**: Automatically re-runs tests on file changes for a rapid feedback loop.
- **File Exclusion**: Easily ignore files or directories using glob patterns.

## Installation

You can install the tool globally to use it across multiple projects, or as a dev dependency in a single project.

**Install globally:**
```bash
npm install -g js-mutation-tester
```

**Or, install as a dev dependency:**
```bash
npm install --save-dev js-mutation-tester
```
If installed locally, you can run it via an npm script or with `npx`.

## Usage

The most common way to run the tool is by pointing it to your source files and telling it which command runs your tests.

### Basic Command

```bash
mutate --sourceFiles "src/**/*.js" --testCommand "npm test"
```

### Configuration

For a better experience, create a `.mutationrc.json` file in your project root or add a `mutation` key to your `package.json`.

**Example `.mutationrc.json`:**
```json
{
  "sourceFiles": ["src/**/*.js", "!src/ignore-this.js"],
  "testCommand": "npm test -- --silent",
  "mutators": ["BinaryExpression", "LogicalExpression"],
  "concurrency": 4,
  "timeout": 5000,
  "ignorePatterns": ["**/node_modules/**", "dist/**"]
}
```

With a config file in place, you can simply run:
```bash
mutate
```

### Command-Line Options

| Option             | Alias | Description                                               | Default                               |
| ------------------ | ----- | --------------------------------------------------------- | ------------------------------------- |
| `--sourceFiles`    | `-s`  | Glob pattern(s) for source files to mutate.               | `["src/**/*.js"]`                     |
| `--testCommand`    | `-t`  | The command to execute your test suite.                   | `"npm test"`                          |
| `--mutators`       | `-m`  | Comma-separated list of mutators to use.                  | `["BinaryExpression", "LogicalExpression", "StringLiteral"]` |
| `--concurrency`    | `-c`  | Number of parallel workers to use.                        | Number of CPU cores                   |
| `--timeout`        |       | Timeout in milliseconds for a single test run.            | `5000`                                |
| `--ignorePatterns` | `-i`  | Glob pattern(s) for files/directories to ignore.          | `["**/node_modules/**"]`               |
| `--watch`          | `-w`  | Enable watch mode to re-run on file changes.              | `false`                               |
| `--config`         |       | Path to a custom configuration file.                      | (auto-discovery)                      |
| `--help`           | `-h`  | Show help screen.                                         |                                       |

## Examples

### Example 1: Running on a Simple Project

Imagine you have a file `src/calculator.js`:
```javascript
// src/calculator.js
export function add(a, b) {
  return a + b;
}

export function isPositive(num) {
  return num > 0;
}
```
And a test file `test/calculator.test.js`:
```javascript
// test/calculator.test.js
import { add, isPositive } from '../src/calculator.js';
import { expect } from 'chai';

describe('calculator', () => {
  it('should add two numbers', () => {
    expect(add(2, 3)).to.equal(5);
  });

  it('should identify a positive number', () => {
    expect(isPositive(5)).to.be.true;
  });
});
```
**Command:**
```bash
mutate --sourceFiles "src/calculator.js" --testCommand "mocha"
```

**Expected Output:**
The tool will generate mutants. One mutant might change `a + b` to `a - b`. The `add` test will fail, so this mutant is **KILLED**.

Another mutant might change `num > 0` to `num >= 0`. Your current test for `isPositive` uses `5`, which is also `>= 0`. The test will pass, and this mutant will **SURVIVE**. The report will show this:

```
...
Mutation Score: 50.00%
----------------------------------
Total mutants   : 2
Mutants killed  : 1
Mutants survived: 1
...

Survivors (1):

1. src/calculator.js:6:16
   Mutator: BinaryExpression
   Change:  Replaced binary operator ">" with ">="
--- Diff ---
@@ -3,7 +3,7 @@
 }
 
 export function isPositive(num) {
-  return num > 0;
+  return num >= 0;
 }
------------
```
This result tells you to add a test case for `isPositive(0)` to improve your test quality.

### Example 2: Using Configuration and Watch Mode

Create a `.mutationrc.json`:
```json
{
  "sourceFiles": ["lib/**/*.js"],
  "testCommand": "jest --silent",
  "ignorePatterns": ["lib/vendor/**"],
  "concurrency": 8
}
```

Now, run in watch mode:
```bash
mutate --watch
```
The tool will perform an initial run. Afterward, it will watch your source files. If you modify `lib/utils.js` and save it, the mutation tests for that file will automatically re-run, giving you instant feedback.

## License

MIT
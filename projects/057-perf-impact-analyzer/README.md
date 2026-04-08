# Performance Impact Analyzer

A CLI tool that analyzes the performance impact of code changes in a Git repository. It programmatically checks out a baseline commit (e.g., `main`) and a feature branch, runs user-defined benchmark scripts against both, and generates a comparative report highlighting performance regressions or improvements.

This helps developers and CI/CD pipelines automatically catch performance degradation before it's merged.

![Demo Screenshot](https://user-images.githubusercontent.com/109856/228293908-344c2434-24e2-4a0e-9244-67b93b3f0b4d.png)

## Features

-   **Compare Any Git Refs**: Analyze performance differences between any two branches, tags, or commit SHAs.
-   **Isolated Environments**: Automatically clones your repository into a temporary directory for clean, isolated benchmark runs.
-   **Custom Benchmark Scripts**: Executes any user-defined benchmark command (e.g., `npm run benchmark`, `node my-script.js`).
-   **Flexible Output Parsing**: Extracts key metrics (like ops/sec or p99 latency) from your script's stdout using configurable regular expressions.
-   **Statistical Analysis**: Runs benchmarks multiple times to calculate mean, standard deviation, and percentage change for stable results.
-   **Clear Terminal Reports**: Generates a color-coded, tabular report in the terminal for easy visual analysis.
-   **CI/CD Integration**: Exits with a non-zero status code on significant performance regressions, perfect for failing a CI build.
-   **JSON Output**: Provides a machine-readable JSON output option for programmatic use in other tools and dashboards.

## Installation

You can install the tool globally via npm to use it in any project:

```bash
npm install -g performance-impact-analyzer
```

Alternatively, you can clone the repository and install its dependencies if you wish to contribute:

```bash
git clone https://github.com/your-username/performance-impact-analyzer.git
cd performance-impact-analyzer
npm install
```

## Usage

The primary use case is comparing a feature branch against your main branch.

### 1. Create a Configuration File

First, create a `.perf-impact-analyzer.json` file in your project's root directory. This file tells the analyzer how to run your benchmarks and what to measure.

**`.perf-impact-analyzer.json`**
```json
{
  "benchmarkCommand": "npm run benchmark",
  "runs": 10,
  "metrics": [
    {
      "name": "ops/sec",
      "regex": "Fibonacci Calculation: (\\d+\\.?\\d*) ops/sec"
    },
    {
      "name": "p99 latency (ms)",
      "regex": "Simulated I/O Latency: (\\d+\\.?\\d*) ms \\(p99\\)"
    }
  ],
  "regressionThreshold": -5.0,
  "failOnRegression": true
}
```

### 2. Create a Benchmark Script

Ensure your `benchmarkCommand` (e.g., `npm run benchmark`) executes a script that prints metrics to standard output in a format that matches your configured `regex`.

**`package.json` (example script entry)**
```json
{
  "scripts": {
    "benchmark": "node ./benchmarks/my-benchmark.js"
  }
}
```

**`benchmarks/my-benchmark.js` (example script)**
```javascript
// This script must output lines that the regex in your config can parse.
// For example:
console.log('Fibonacci Calculation: 150.34 ops/sec');
console.log('Simulated I/O Latency: 12.34 ms (p99)');
```

### 3. Run the Analyzer

Execute the CLI command, providing the baseline and feature refs you want to compare.

```bash
perf-impact-analyzer <baseline> <feature> [options]
```

## Examples

### Example 1: Basic Comparison

Compare the `feature/new-algorithm` branch against the `main` branch.

**Command:**
```bash
perf-impact-analyzer main feature/new-algorithm
```

**Expected Output:**
```
✔ Configuration loaded successfully.
✔ Checked out main at commit a1b2c3d
✔ Completed run 10/10 for main
✔ Statistics calculated for main
✔ Checked out feature/new-algorithm at commit f4e5d6c
✔ Completed run 10/10 for feature/new-algorithm
✔ Statistics calculated for feature/new-algorithm

Performance Impact Analysis Report

Baseline: main (a1b2c3d) - "refactor: improve caching logic"
Feature:  feature/new-algorithm (f4e5d6c) - "feat: implement new fibonacci algorithm"

┌──────────────────┬──────────────────────┬──────────────────────────┬────────────┬─────────────┐
│ Metric           │ Baseline (main)      │ Feature (feature/ne...)  │ Change (%) │ Conclusion  │
├──────────────────┼──────────────────────┼──────────────────────────┼────────────┼─────────────┤
│ ops/sec          │ 150.34 ± 3.12        │ 185.67 ± 4.51            │     +23.50%│ Improvement │
│ p99 latency (ms) │ 12.34 ± 0.55         │ 12.99 ± 0.60             │      -5.26%│ Regression  │
└──────────────────┴──────────────────────┴──────────────────────────┴────────────┴─────────────┘

Regression threshold: -5.0%. Runs per ref: 10.

⚠ Significant regression detected for metric "p99 latency (ms)": -5.26% is below the threshold of -5.0%.
✖ A significant performance regression was detected.
```
*(The tool would exit with status 1 in this case)*

### Example 2: CI/CD Integration with JSON Output

In a CI/CD pipeline, you might want to compare the current commit (`HEAD`) against the main branch and get a JSON report for further processing.

**Command:**
```bash
perf-impact-analyzer main HEAD --json --fail-on-regression=true
```

**Expected Output (JSON):**
```json
{
  "meta": {
    "createdAt": "2024-01-01T12:00:00.000Z",
    "runs": 10,
    "regressionThreshold": -5.0
  },
  "baseline": {
    "ref": "main",
    "commit": { "sha": "a1b2c3d", "message": "..." },
    "stats": {
      "ops/sec": {
        "mean": 150.34,
        "stdev": 3.12,
        "values": [ ... ]
      }
    }
  },
  "feature": {
    "ref": "HEAD",
    "commit": { "sha": "f4e5d6c", "message": "..." },
    "stats": {
      "ops/sec": {
        "mean": 140.11,
        "stdev": 2.98,
        "values": [ ... ]
      }
    }
  },
  "comparison": {
    "ops/sec": {
      "baselineMean": 150.34,
      "featureMean": 140.11,
      "percentageChange": -6.80
    }
  }
}
```
*(The CI job would fail because the percentage change (-6.80%) is below the threshold (-5.0%) and `fail-on-regression` is true.)*

### Configuration File Reference (`.perf-impact-analyzer.json`)

| Key                   | Type      | Required | Default | Description                                                                                                                              |
| --------------------- | --------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `benchmarkCommand`    | `string`  | Yes      | -       | The command to execute to run your benchmark suite (e.g., `npm run benchmark`).                                                          |
| `metrics`             | `array`   | Yes      | -       | An array of objects, each defining a metric to extract from the benchmark output.                                                        |
| `metrics[].name`      | `string`  | Yes      | -       | The display name for the metric (e.g., "Requests per second").                                                                           |
| `metrics[].regex`     | `string`  | Yes      | -       | A JavaScript regular expression with **one capturing group** to extract the numerical value of the metric from the command's `stdout`. |
| `runs`                | `number`  | No       | `5`     | The number of times to run the benchmark command for each Git ref to ensure statistical stability.                                       |
| `regressionThreshold` | `number`  | No       | `-5.0`  | A negative percentage value. If a metric's performance drops by more than this amount, it's flagged as a significant regression.         |
| `failOnRegression`    | `boolean` | No       | `true`  | If `true`, the tool will exit with a non-zero status code if any metric shows a significant regression.                                  |

## License

This project is licensed under the MIT License.
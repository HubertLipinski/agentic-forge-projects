# Vector Stats JS

[![NPM version](https://img.shields.io/npm/v/vector-stats-js.svg)](https://www.npmjs.com/package/vector-stats-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight, zero-dependency Node.js utility for performing basic statistical analysis on numerical vectors (arrays of numbers). It is designed for students, data science hobbyists, and developers who need quick statistical calculations without the overhead of a large math library. It provides common descriptive statistics functions that are easy to use and understand.

## Features

- Calculate **mean** (average), **median**, and **mode**.
- Compute **variance** and **standard deviation** (both sample and population).
- Determine **range**, **min**, **max**, and **sum**.
- Calculate **quartiles** (Q1, Q3) and the **interquartile range** (IQR).
- **Command-line interface** to perform calculations on data from files or stdin.
- Pure JavaScript implementation with **no external math dependencies**.
- Functions handle empty arrays and non-numeric data gracefully.

## Installation

You can install the package globally to use the command-line tool anywhere, or locally in your project.

**Global installation (for CLI):**

```bash
npm install -g vector-stats-js
```

**Local installation (for programmatic use):**

```bash
npm install vector-stats-js
```

Alternatively, you can clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/vector-stats-js.git
cd vector-stats-js
npm install
```

## Usage

`vector-stats-js` can be used in two ways: through its command-line interface (CLI) or programmatically within your own Node.js projects.

### Command-Line Interface (CLI)

The `vector-stats` command allows you to perform calculations on numerical data from files or standard input.

**Syntax:**

```
vector-stats [command] [options]
```

**Global Options:**

- `-f, --file <path>`: Path to the input data file. Data can be space-separated or one number per line. If omitted, reads from stdin.
- `-p, --precision <digits>`: Number of decimal places for results (default: 4).
- `-v, --version`: Output the current version.
- `-h, --help`: Display help for a command.

**Commands:**

| Command        | Description                                     |
|----------------|-------------------------------------------------|
| `all`          | Calculate and display all descriptive statistics. |
| `mean`         | Calculate the mean (average).                   |
| `median`       | Calculate the median.                           |
| `mode`         | Calculate the mode(s).                          |
| `sum`          | Calculate the sum of all values.                |
| `min`          | Find the minimum value.                         |
| `max`          | Find the maximum value.                         |
| `range`        | Calculate the range (max - min).                |
| `variance`     | Calculate the sample variance.                  |
| `variance-pop` | Calculate the population variance.              |
| `stddev`       | Calculate the sample standard deviation.        |
| `stddev-pop`   | Calculate the population standard deviation.    |
| `q1`           | Calculate the first quartile (25th percentile). |
| `q3`           | Calculate the third quartile (75th percentile). |
| `iqr`          | Calculate the interquartile range (Q3 - Q1).    |

### Programmatic API

Import the functions you need directly into your Node.js project. The library uses ES Modules.

```javascript
import { mean, median, sanitizeNumericArray } from 'vector-stats-js';

const rawData = ['1', 5, '2', null, 8, 'invalid'];
const numbers = sanitizeNumericArray(rawData); // -> [1, 5, 2, 8]

console.log(`Mean: ${mean(numbers)}`);     // -> Mean: 4
console.log(`Median: ${median(numbers)}`); // -> Median: 3.5
```

The `sanitizeNumericArray` utility is also exported, allowing you to preprocess data using the same logic the library uses internally. It filters out non-numeric values and converts valid numeric strings to numbers.

## Examples

### Example 1: Get a full statistical summary from a file

Create a file `data.txt` with the following content:

```
10 2 38 23 38 23 21
```

Run the `all` command:

```bash
vector-stats all -f data.txt
```

**Expected Output:**

```
--- Vector Statistics Summary ---
Count                   : 7
Sum                     : 155.0000
Min                     : 2.0000
Max                     : 38.0000
Range                   : 36.0000
Mean                    : 22.1429
Median                  : 23.0000
Mode                    : 23, 38
Q1 (25th percentile)    : 15.5000
Q3 (75th percentile)    : 30.5000
IQR (Interquartile Range): 15.0000
Variance (Sample)       : 156.1429
Std Dev (Sample)        : 12.4957
Variance (Population)   : 133.8367
Std Dev (Population)    : 11.5688
---------------------------------
```

### Example 2: Pipe data from `echo` to calculate the median

You can pipe data directly to the CLI. This is useful for quick, one-off calculations.

```bash
echo "1 5 2 8 3 10" | vector-stats median
```

**Expected Output:**

```
3.5000
```

### Example 3: Programmatic use with data sanitization

This example shows how to use the library in a script to analyze a "messy" array.

```javascript
// my-analysis.js
import { mean, mode, sanitizeNumericArray } from 'vector-stats-js';

const messyData = [
  '10', 2, null, '38', 23, '38', 'not a number', 21, undefined
];

const sanitizedData = sanitizeNumericArray(messyData);
// sanitizedData is now [10, 2, 38, 23, 38, 21]

console.log(`The mean is: ${mean(sanitizedData).toFixed(2)}`);
console.log(`The mode is: ${mode(sanitizedData)}`);
```

Run the script:

```bash
node my-analysis.js
```

**Expected Output:**

```
The mean is: 22.00
The mode is: 38
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
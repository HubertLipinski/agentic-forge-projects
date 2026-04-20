# Git PR Metrics

A command-line tool that analyzes a local git repository to generate key performance metrics for pull requests within a specified date range. It helps engineering managers and team leads understand team velocity, review cycles, and code churn without relying on third-party SaaS platforms.

## Features

-   **Local-First Analysis**: Works entirely with your local git repository. No API keys, network access, or SaaS subscriptions required.
-   **Key Metric Calculation**:
    -   **Time to Merge**: Measures the full lifecycle of a PR from the first commit to the merge.
    -   **PR Size**: Categorizes PRs by lines of code changed (XS, S, M, L, XL).
    -   **Code Churn**: Reports on total lines added, deleted, and the net change.
-   **Outlier Identification**: Instantly spots the largest and longest-open pull requests in the selected period.
-   **Powerful Filtering**: Analyze the whole team or filter by a specific author, and specify any date range from the last week to a specific quarter.
-   **Clean Terminal UI**: Outputs a clean, colorful, and easy-to-read summary table directly in your terminal.

## Installation

You can install `git-pr-metrics` globally via npm to make it available as a shell command.

```bash
npm install -g git-pr-metrics
```

Alternatively, you can clone the repository and run it locally:

```bash
git clone https://github.com/your-username/git-pr-metrics.git
cd git-pr-metrics
npm install
# Run using:
# node bin/git-pr-metrics.js --path /path/to/your/repo
```

## Usage

Navigate to your local git repository and run the `git-pr-metrics` command.

```bash
cd /path/to/your/project
git-pr-metrics [options]
```

### Options

| Option             | Alias | Description                                                  | Default                    |
| ------------------ | ----- | ------------------------------------------------------------ | -------------------------- |
| `--since <date>`   | `-s`  | The start date for the analysis (YYYY-MM-DD).                | 30 days ago                |
| `--until <date>`   | `-u`  | The end date for the analysis (YYYY-MM-DD).                  | Today                      |
| `--author <name>`  | `-a`  | Filter PRs by a specific author's email or name.             | All authors                |
| `--path <path>`    | `-p`  | Path to the local git repository.                            | Current working directory  |
| `--help`           | `-h`  | Show help.                                                   |                            |
| `--version`        | `-v`  | Show version number.                                         |                            |

## Examples

### 1. Analyze PRs from the last 30 days (default)

Simply run the command inside a git repository to get a summary for the last 30 days.

```bash
git-pr-metrics
```

**Expected Output:**

```console
✔ Found 28 merged pull request(s) in the specified period.
✔ Metrics calculation complete.
✔ Aggregation complete.

 Git PR Metrics Summary 

Period: 9/27/2024 to 10/27/2024

--- Key Metrics ---
  Total Pull Requests:           28
  Avg. Time to Merge:            45.2h
  Median Time to Merge:          28.5h

--- Code & Churn ---
  Lines Added:                   +3,104
  Lines Deleted:                 -1,288
  Net Code Churn:                +1,816

--- PR Size ---
  Avg. PR Size:                  157 lines
  Median PR Sise:                88 lines
  Size Distribution:             XS: 3 | S: 12 | M: 11 | L: 2

--- Outliers ---
  Longest Open PR:               #431 (210h)
  Largest PR:                    #455 (850 lines)

```

### 2. Analyze PRs for a specific quarter

Use the `--since` and `--until` flags to define a custom date range, like Q3 2024.

```bash
git-pr-metrics --since 2024-07-01 --until 2024-09-30
```

### 3. Analyze PRs for a specific author

Use the `--author` flag to focus the analysis on a single contributor.

```bash
git-pr-metrics --author "jane.doe@example.com"
```

**Expected Output (for a user with fewer PRs):**

```console
✔ Found 4 merged pull request(s) in the specified period.
✔ Metrics calculation complete.
✔ Aggregation complete.

 Git PR Metrics Summary 

Period: 9/27/2024 to 10/27/2024
Author: jane.doe@example.com

--- Key Metrics ---
  Total Pull Requests:           4
  Avg. Time to Merge:            18.1h
  Median Time to Merge:          16.5h

--- Code & Churn ---
  Lines Added:                   +450
  Lines Deleted:                 -120
  Net Code Churn:                +330

--- PR Size ---
  Avg. PR Size:                  142 lines
  Median PR Sise:                95 lines
  Size Distribution:             S: 2 | M: 2

--- Outliers ---
  Longest Open PR:               #440 (25h)
  Largest PR:                    #421 (280 lines)

```

## License

This project is licensed under the MIT License.
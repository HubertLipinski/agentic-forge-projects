# Auto PR Merger

A GitHub Action and CLI tool to automatically merge pull requests that meet a set of configurable criteria. It's designed for repository maintainers who want to automate their merge workflow for dependency updates (like Dependabot), minor fixes, or contributions from trusted authors, without manual intervention.

![Auto PR Merger Demo](https://user-images.githubusercontent.com/1010414/123456789-abcdef.gif) <!-- Placeholder for a cool demo GIF -->

---

## Features

-   **Configurable Rules**: Merge pull requests based on labels, authors, branch patterns, and CI status.
-   **Dual-Mode Operation**:
    -   **GitHub Action**: Seamless integration with your repository workflows.
    -   **CLI Tool**: Run locally or in any CI/CD environment.
-   **Multiple Merge Strategies**: Supports `merge`, `squash`, and `rebase`.
-   **Dry-Run Mode**: Preview which PRs would be merged without making any changes.
-   **Concurrency Control**: Processes multiple PRs in parallel safely to avoid API rate limits.
-   **Robust Validation**: Validates your configuration file to catch errors early.

## Installation

### As a CLI Tool

You can install the tool globally via npm to use it in any local repository.

```bash
npm install -g auto-pr-merger
```

Alternatively, you can clone the repository and install dependencies for development or local use.

```bash
git clone https://github.com/your-username/auto-pr-merger.git
cd auto-pr-merger
npm install
```

## Usage

### 1. GitHub Action

To use Auto PR Merger as a GitHub Action, create a workflow file (e.g., `.github/workflows/auto-merge.yml`) in your repository.

The action typically runs on a schedule or on `workflow_dispatch` to periodically check for mergeable PRs.

```yaml
# .github/workflows/auto-merge.yml
name: Auto Merge PRs

on:
  schedule:
    # Run every 15 minutes
    - cron: '*/15 * * * *'
  workflow_dispatch:

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    steps:
      - name: Run Auto PR Merger
        uses: your-username/auto-pr-merger@v1
        with:
          # Required: The GITHUB_TOKEN is used to interact with the GitHub API.
          token: ${{ secrets.GITHUB_TOKEN }}
          
          # Optional: Path to your configuration file.
          # Defaults to '.github/auto-merge.yml'.
          config-path: '.github/auto-merge.yml'
          
          # Optional: Set to true to simulate merging without any real action.
          # Defaults to false.
          dry-run: false
```

### 2. Command-Line Interface (CLI)

To use the CLI, you need a GitHub Personal Access Token with `repo` scope. Export it as an environment variable:

```bash
export GITHUB_TOKEN="your_github_pat"
# Or use GH_TOKEN
export GH_TOKEN="your_github_pat"
```

Then, run the command, pointing it to your repository and configuration file.

```bash
auto-pr-merger --repo your-org/your-repo --config-path .github/auto-merge.yml
```

**CLI Options:**

| Option          | Alias | Description                                        | Default                    |
| --------------- | ----- | -------------------------------------------------- | -------------------------- |
| `--repo`        | `-r`  | The target repository in `owner/repo` format.      | **Required**               |
| `--config-path` | `-c`  | Path to the YAML configuration file.               | `.github/auto-merge.yml`   |
| `--dry-run`     |       | Simulate without performing merges.                | `false`                    |
| `--concurrency` |       | Number of PRs to process concurrently.             | `5`                        |
| `--version`     | `-v`  | Show version number.                               |                            |
| `--help`        | `-h`  | Show help screen.                                  |                            |

### 3. Configuration File

Create a configuration file (e.g., `.github/auto-merge.yml`) to define your merge rules. Rules are processed in order, and the first matching rule is applied.

```yaml
# .github/auto-merge.yml
rules:
  # Rule 1: Merge Dependabot PRs
  - when:
      - "author:dependabot[bot]"
    merge: squash
    checks: stable # 'stable' allows skipped/neutral checks, 'all' requires success

  # Rule 2: Merge PRs with an 'auto-merge' label
  - when:
      - "label:auto-merge"
    merge: merge
    checks: all

  # Rule 3: Merge hotfixes into main
  - when:
      - "branch:hotfix/*<-main" # Matches head_branch <- base_branch
    merge: rebase
```

**Condition Prefixes:**

-   `author:<pattern>`: Matches the PR author's username (supports glob patterns).
-   `label:<name>`: Requires the PR to have the specified label.
-   `branch:<pattern>`: Matches branch names. Use `head<-base` format (supports glob patterns).

## Examples

### Example 1: Merge a Dependabot PR

**Configuration (`.github/auto-merge.yml`):**

```yaml
rules:
  - when:
      - "author:dependabot[bot]"
    merge: squash
    checks: stable
```

**Scenario:**
A pull request is opened by `dependabot[bot]` to update a dependency. All required CI checks pass successfully.

**Execution:**

```bash
auto-pr-merger --repo my-org/my-app
```

**Expected Output:**

```
[INFO] Starting Auto PR Merger CLI...
[INFO] Attempting to load configuration from: /path/to/repo/.github/auto-merge.yml
[SUCCESS] Configuration loaded and validated successfully.
[INFO] Starting auto-merge process for my-org/my-app
[INFO] Fetching open pull requests for my-org/my-app...
[INFO] Found 1 open pull request(s).
[INFO] Processing PR #42: "build(deps): bump library from 1.2.3 to 1.2.4"
[INFO] Fetching details for PR #42...
[INFO] PR #42 is a match for rule with conditions: [author:dependabot[bot]]
[MERGE] PR #42 matched rule [author:dependabot[bot]] and will be merged with strategy 'squash'.
[MERGE]   - Author 'dependabot[bot]' matches pattern 'dependabot[bot]'.
[MERGE]   - CI checks passed the 'stable' policy.
[INFO] Attempting to merge PR #42 using 'squash' strategy...
[SUCCESS] Successfully merged PR #42. New commit SHA: a1b2c3d4
--- Processing Summary ---
Total pull requests processed: 1
Successfully merged: 1
Skipped: 0
Failed to merge: 0
--------------------------
[SUCCESS] CLI execution completed successfully.
```

### Example 2: Dry-Run for a Labeled PR

**Configuration (`.github/auto-merge.yml`):**

```yaml
rules:
  - when:
      - "label:auto-merge"
      - "label:docs"
    merge: merge
    checks: all
```

**Scenario:**
A pull request with the labels `auto-merge` and `docs` is ready. We want to check if it would be merged without actually doing it.

**Execution:**

```bash
auto-pr-merger --repo my-org/my-app --dry-run
```

**Expected Output:**

```
[INFO] Starting Auto PR Merger CLI...
[DRY-RUN] Dry-run mode is enabled. No pull requests will be merged.
...
[INFO] Processing PR #55: "docs: update installation guide"
[INFO] Fetching details for PR #55...
[INFO] PR #55 is a match for rule with conditions: [label:auto-merge, label:docs]
[DRY-RUN] PR #55 matched rule [label:auto-merge, label:docs] and would be merged with strategy 'merge'.
[DRY-RUN]   - All required labels found: [auto-merge, docs].
[DRY-RUN]   - CI checks passed the 'all' policy.
--- Processing Summary ---
Total pull requests processed: 1
Pull requests that would be merged: 1
Skipped: 0
Failed to merge: 0
--------------------------
[SUCCESS] CLI execution completed successfully.
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
# Docker Image Pruner

An interactive CLI tool for intelligently pruning local Docker images. It helps developers and CI/CD runners reclaim disk space by safely removing obsolete image layers.

## Description

This tool identifies Docker images that are no longer associated with running or stopped containers and are not part of a recent build cache. It presents them for deletion in a user-friendly way, supporting various filters to give you full control over what gets removed. It's a safe and efficient way to keep your local Docker environment clean and reclaim valuable disk space.

## Features

-   ✅ **Interactive Mode**: Select images to prune from a list with checkboxes.
-   🔍 **Dry-Run Mode**: Preview which images would be deleted without actually removing them.
-   🛡️ **Safe by Default**: Automatically preserves images used by existing containers.
-   🕒 **Filter by Age**: Target images older than a specified number of days.
-   📦 **Filter by Size**: Target images larger than a certain size (e.g., `1GB`).
-   🏷️ **Filter by Name**: Use wildcard patterns (`*`, `?`) to match repository names or tags.
-   📊 **Sortable Results**: Sort candidate images by size, name, or creation date.
-   📈 **Reclaim Summary**: See a summary of the total disk space reclaimed after pruning.
-    gracefully **Error Handling**: Gracefully handles Docker daemon connection issues.

## Installation

You can install `docker-image-pruner` globally via npm to make the `prune-images` command available in your system path.

```bash
npm install -g docker-image-pruner
```

Alternatively, you can clone the repository and run the tool directly:

```bash
git clone https://github.com/your-username/docker-image-pruner.git
cd docker-image-pruner
npm install
npm link # To create the global 'prune-images' command
```

## Usage

The tool can be run in several modes. By default, it runs in a safe, interactive mode.

**Command:** `prune-images [options]`

### Options

| Option                  | Alias | Type      | Description                                                              | Default    |
| ----------------------- | ----- | --------- | ------------------------------------------------------------------------ | ---------- |
| `--interactive`         | `-i`  | `boolean` | Run in interactive mode to select images for deletion.                   | `true`¹    |
| `--dry-run`             | `-d`  | `boolean` | Show which images would be pruned without deleting them.                 | `false`    |
| `--age <days>`          | `-a`  | `number`  | Filter images older than a specified number of days (e.g., 30).          | -          |
| `--size <size>`         | `-s`  | `string`  | Filter images larger than a specified size (e.g., "1GB", "500MB").       | -          |
| `--name <pattern>`      | `-n`  | `string`  | Filter images by repository/tag using wildcards (e.g., "app:\*").        | -          |
| `--sort-by <key>`       | -     | `string`  | Sort candidate images by `size`, `name`, or `date`.                        | `size`     |
| `--sort-order <order>`  | -     | `string`  | Set the sort order to `asc` or `desc`.                                   | `desc`     |
| `--help`                | `-h`  | -         | Show the help message.                                                   | -          |
| `--version`             | `-v`  | -         | Show the version number.                                                 | -          |

¹ Interactive mode is the default when no filters or modes (`--dry-run`) are specified. If any filter is used, the tool will perform a non-interactive deletion of all matching images.

## Examples

### 1. Interactive Pruning (Default)

Run the command without any arguments to launch the interactive session. You'll be presented with a list of all prunable images, sorted by size.

```bash
prune-images
```

**Expected Output:**

You will see an interactive prompt where you can use the spacebar to select images and enter to confirm deletion.

```
? Found 5 prunable images (total size: 2.1 GB).
Select images to delete (Space to select, Enter to confirm):
❯ ◯ 2a4b6c8d9e0f | Size: 950 MB    | Created: 3 weeks ago    | Tags: my-app:feature-branch
  ◯ 1a2b3c4d5e6f | Size: 750 MB    | Created: 2 months ago   | Tags: (untagged)
  ◯ f1e2d3c4b5a6 | Size: 300 MB    | Created: 4 days ago     | Tags: another-app:dev
  ...
```

### 2. Dry Run with Filters

Preview all images older than 60 days and larger than 500MB without deleting them.

```bash
prune-images --dry-run --age 60 --size "500MB"
```

**Expected Output:**

A summary of images that match the criteria will be printed to the console.

```
✔ Connected to Docker daemon.
✔ Fetched Docker data.

--- Dry Run: Images that would be pruned ---
  - 1a2b3c4d5e6f | Size: 750 MB    | Tags: (untagged)
  - 9f8e7d6c5b4a | Size: 620 MB    | Tags: old-project:1.0
----------------------------------------------

Summary: 2 images would be pruned, reclaiming approximately 1.37 GB.
Run without --dry-run to execute the deletion.
```

### 3. Non-Interactive Deletion

Automatically delete all images tagged with `my-app:staging-*` that are older than 7 days. This is useful for CI/CD cleanup scripts.

```bash
prune-images --name "my-app:staging-*" --age 7
```

**Expected Output:**

The tool will find all matching images and delete them directly, showing progress and a final summary.

```
✔ Connected to Docker daemon.
✔ Fetched Docker data.

Found 3 prunable image(s). Proceeding with non-interactive deletion.

Attempting to prune 3 image(s)...
✔ Deleted 3a4b5c6d7e8f (my-app:staging-123)
✔ Deleted 9a8b7c6d5e4f (my-app:staging-122)
✔ Deleted 1a2b3c4d5e6f (my-app:staging-121)

--- Pruning Complete ---
Successfully deleted 3 image(s).
Total disk space reclaimed: 1.2 GB
------------------------
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
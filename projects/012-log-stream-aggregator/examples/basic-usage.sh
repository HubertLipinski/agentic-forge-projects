#!/bin/bash

# examples/basic-usage.sh
#
# This script demonstrates a basic usage scenario for the log-aggregator.
# It performs the following actions:
# 1. Creates a temporary directory and two log files (`app1.log`, `app2.log`).
# 2. Starts the `log-aggregator` in the background, configured to:
#    - Tail `app1.log` and `app2.log`.
#    - Listen for input from stdin.
#    - Pipe its structured JSON output to a file named `aggregated.log`.
# 3. Simulates log activity by:
#    - Writing messages to `app1.log` and `app2.log` in a loop.
#    - Piping a message from an `echo` command to the aggregator's stdin.
# 4. After a short demonstration period, it cleans up by stopping the
#    aggregator and removing the temporary files.

# --- Configuration ---
# Use a temporary directory for our log files and output.
DEMO_DIR=$(mktemp -d -t log-aggregator-demo-XXXXXX)
LOG_FILE_1="$DEMO_DIR/app1.log"
LOG_FILE_2="$DEMO_DIR/app2.log"
AGGREGATED_OUTPUT_FILE="$DEMO_DIR/aggregated.log"

# Path to the log-aggregator executable.
# Assumes `npm link` or `npm install -g` has been run, or that it's in the current project's node_modules.
# If the command is not in your PATH, you might need to specify the full path,
# e.g., ../bin/log-aggregator or ./node_modules/.bin/log-aggregator
AGGREGATOR_CMD="log-aggregator"

# --- Helper Functions ---

# Function to print a message with a timestamp.
log() {
  echo "[$(date +'%H:%M:%S')] $1"
}

# Function to clean up resources on exit.
cleanup() {
  log "Cleaning up..."
  if kill -0 "$AGGREGATOR_PID" 2>/dev/null; then
    log "Stopping log-aggregator (PID: $AGGREGATOR_PID)..."
    # Send SIGINT for graceful shutdown.
    kill -SIGINT "$AGGREGATOR_PID"
    # Wait for the process to terminate.
    wait "$AGGREGATOR_PID" 2>/dev/null
  fi
  log "Removing temporary directory: $DEMO_DIR"
  rm -rf "$DEMO_DIR"
  log "Cleanup complete."
  exit 0
}

# --- Main Script ---

# Trap SIGINT (Ctrl+C) and EXIT signals to run the cleanup function.
trap cleanup SIGINT EXIT

log "Setting up demo environment in: $DEMO_DIR"
touch "$LOG_FILE_1" "$LOG_FILE_2"

# Check if the log-aggregator command exists.
if ! command -v "$AGGREGATOR_CMD" &> /dev/null; then
    echo "Error: '$AGGREGATOR_CMD' command not found." >&2
    echo "Please ensure the package is installed and in your PATH." >&2
    echo "You can run 'npm install' and then try './node_modules/.bin/log-aggregator' or 'npm link'." >&2
    exit 1
fi

log "Starting log-aggregator in the background..."
log "Tailing files: $LOG_FILE_1, $LOG_FILE_2"
log "Listening on stdin."
log "Aggregated output will be saved to: $AGGREGATED_OUTPUT_FILE"

# Start the aggregator.
# -f: Tail a file (specified twice).
# -s: Read from stdin.
# --pretty-logs=false: Disable pretty printing for internal logs to keep stderr clean.
# The `&` runs the command in the background.
# `>` redirects stdout (the JSON logs) to our output file.
# `2> >(while read -r line; do echo "[aggregator-log] $line"; done)` redirects stderr
# to a subshell that prefixes internal logs, making them easy to identify.
"$AGGREGATOR_CMD" \
  -f "$LOG_FILE_1" \
  -f "$LOG_FILE_2" \
  -s \
  --pretty-logs=false > "$AGGREGATED_OUTPUT_FILE" 2> >(while read -r line; do echo "[aggregator-log] $line"; done) &

# Capture the Process ID (PID) of the backgrounded aggregator.
AGGREGATOR_PID=$!

# Give the aggregator a moment to start up.
sleep 2

log "Simulating log generation for 10 seconds..."

# Simulate log entries from stdin.
echo "This is a log message piped from stdin." | "$AGGREGATOR_CMD" -s --pretty-logs=false >> "$AGGREGATED_OUTPUT_FILE"

# Simulate log entries being written to the files in a loop.
for i in {1..5}; do
  TIMESTAMP=$(date)
  echo "$TIMESTAMP [INFO] Service 1 is processing task #$i." >> "$LOG_FILE_1"
  log "Wrote to app1.log"
  sleep 1
  echo "$TIMESTAMP [WARN] Service 2 detected high memory usage." >> "$LOG_FILE_2"
  log "Wrote to app2.log"
  sleep 1
done

log "Simulation finished."
echo
log "Displaying the last 10 lines of the aggregated output:"
echo "-----------------------------------------------------"
tail -n 10 "$AGGREGATED_OUTPUT_FILE"
echo "-----------------------------------------------------"
echo

# The script will now exit, and the `trap` will trigger the cleanup function.
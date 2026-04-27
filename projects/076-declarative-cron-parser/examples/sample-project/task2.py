# examples/sample-project/task2.py
# Description: An example Python task script for cleaning up temporary files.
# This script demonstrates a declarative cron comment using Python's '#' syntax.
# The `declarative-cron-parser` tool will detect this and add it to the system's crontab.

# @cron: 0 2 * * 0 /usr/bin/python3 /path/to/your/project/examples/sample-project/task2.py --directory /tmp --older-than 7
# The above line schedules this script to run at 2:00 AM every Sunday.
# It will clean up files in the /tmp directory that are older than 7 days.

import os
import time
import argparse
from datetime import datetime, timedelta

def get_files_to_clean(directory, older_than_days):
    """
    Identifies files in a directory that are older than a specified number of days.

    Args:
        directory (str): The absolute path to the directory to scan.
        older_than_days (int): The age in days. Files older than this will be targeted.

    Returns:
        list: A list of absolute paths to the files that should be cleaned up.
    """
    if not os.path.isdir(directory):
        print(f"Error: Directory not found at '{directory}'")
        return []

    print(f"Scanning directory '{directory}' for files older than {older_than_days} days...")
    files_to_remove = []
    cutoff_time = time.time() - (older_than_days * 24 * 60 * 60)

    for root, _, files in os.walk(directory):
        for filename in files:
            file_path = os.path.join(root, filename)
            try:
                # Use stat to get file metadata, including modification time
                file_mod_time = os.stat(file_path).st_mtime
                if file_mod_time < cutoff_time:
                    files_to_remove.append(file_path)
            except FileNotFoundError:
                # The file might have been deleted between os.walk and os.stat
                print(f"Warning: File not found during scan, skipping: {file_path}")
            except Exception as e:
                print(f"Error accessing file {file_path}: {e}")

    return files_to_remove

def perform_cleanup(files, dry_run=False):
    """
    Deletes a list of files.

    Args:
        files (list): A list of file paths to delete.
        dry_run (bool): If True, prints which files would be deleted without actually deleting them.
    """
    if not files:
        print("No old files found to clean up.")
        return

    if dry_run:
        print("\n[DRY RUN] The following files would be deleted:")
        for file_path in files:
            print(f"  - {file_path}")
        print(f"\n[DRY RUN] Total files to be deleted: {len(files)}")
    else:
        print("\nStarting cleanup...")
        deleted_count = 0
        for file_path in files:
            try:
                os.remove(file_path)
                deleted_count += 1
                print(f"  - Deleted: {file_path}")
            except OSError as e:
                print(f"Error deleting file {file_path}: {e}")
        print(f"\nCleanup complete. Total files deleted: {deleted_count}")


def main():
    """
    Main execution function. Parses arguments and orchestrates the cleanup process.
    """
    parser = argparse.ArgumentParser(
        description="Clean up old files in a specified directory."
    )
    parser.add_argument(
        "--directory",
        required=True,
        help="The directory to clean."
    )
    parser.add_argument(
        "--older-than",
        type=int,
        required=True,
        help="Delete files older than this many days."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate the cleanup without deleting any files."
    )

    args = parser.parse_args()

    print(f"--- Cleanup Task Started: {datetime.now().isoformat()} ---")
    
    if args.older_than <= 0:
        print("Error: --older-than must be a positive integer.")
        return

    files_to_delete = get_files_to_clean(args.directory, args.older_than)
    perform_cleanup(files_to_delete, args.dry_run)

    print(f"--- Cleanup Task Finished: {datetime.now().isoformat()} ---")


if __name__ == "__main__":
    main()
#!/bin/bash

# Task Master Backup Restore Script
# Restores configuration from timestamped backups

set -e

BACKUP_DIR="$HOME/task-master-backups"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Task Master Backup Restore${NC}"
echo "=========================="
echo

# Check if backup directory exists
if [[ ! -d "$BACKUP_DIR" ]]; then
    echo -e "${RED}Error: Backup directory not found at $BACKUP_DIR${NC}"
    echo "No backups available to restore."
    exit 1
fi

# List available backups
cd "$BACKUP_DIR"
BACKUPS=($(ls -dt backup_* 2>/dev/null || true))

if [[ ${#BACKUPS[@]} -eq 0 ]]; then
    echo -e "${RED}No backups found in $BACKUP_DIR${NC}"
    exit 1
fi

echo "Available backups:"
echo
for i in "${!BACKUPS[@]}"; do
    backup="${BACKUPS[$i]}"
    timestamp=$(echo "$backup" | sed 's/backup_//')
    formatted_date=$(date -j -f "%Y%m%d_%H%M%S" "$timestamp" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$timestamp")
    size=$(du -sh "$backup" 2>/dev/null | cut -f1)
    echo "  $((i+1))) $formatted_date ($size)"
done

echo
read -p "Select backup to restore (1-${#BACKUPS[@]}): " choice

# Validate choice
if [[ ! "$choice" =~ ^[0-9]+$ ]] || [[ "$choice" -lt 1 ]] || [[ "$choice" -gt ${#BACKUPS[@]} ]]; then
    echo -e "${RED}Invalid selection.${NC}"
    exit 1
fi

SELECTED_BACKUP="${BACKUPS[$((choice-1))]}"
BACKUP_PATH="$BACKUP_DIR/$SELECTED_BACKUP"

echo
echo -e "${YELLOW}Selected backup:${NC} $SELECTED_BACKUP"
echo -e "${YELLOW}Backup path:${NC} $BACKUP_PATH"
echo

# Show what will be restored
echo "Files that will be restored:"
find "$BACKUP_PATH" -type f | sed "s|$BACKUP_PATH/||" | sort

echo
echo -e "${YELLOW}Warning:${NC} This will overwrite current configuration files."
read -p "Continue with restore? (y/N): " confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo
echo "Restoring backup..."

# Change to project directory
cd "$PROJECT_DIR"

# Create backup of current state before restore
CURRENT_BACKUP="$BACKUP_DIR/pre-restore-$(date '+%Y%m%d_%H%M%S')"
mkdir -p "$CURRENT_BACKUP"

echo "Creating backup of current state at: $CURRENT_BACKUP"

# Files to backup before restore
declare -a FILES_TO_BACKUP=(
    ".taskmaster/config.json"
    ".cursor/mcp.json"
    ".env"
    ".taskmaster/tasks/tasks.json"
)

for file in "${FILES_TO_BACKUP[@]}"; do
    if [[ -f "$file" ]]; then
        backup_file_dir="$CURRENT_BACKUP/$(dirname "$file")"
        mkdir -p "$backup_file_dir"
        cp "$file" "$CURRENT_BACKUP/$file"
        echo "  Backed up current: $file"
    fi
done

echo
echo "Restoring files from backup..."

# Restore files (excluding .env for security unless explicitly confirmed)
find "$BACKUP_PATH" -type f | while read -r file; do
    relative_path="${file#$BACKUP_PATH/}"
    
    # Skip .env file unless user explicitly wants to restore it
    if [[ "$relative_path" == ".env" ]]; then
        echo
        read -p "Restore .env file (contains API keys)? (y/N): " restore_env
        if [[ ! "$restore_env" =~ ^[Yy]$ ]]; then
            echo "  Skipped: $relative_path"
            continue
        fi
    fi
    
    # Create directory structure if needed
    target_dir="$(dirname "$relative_path")"
    if [[ "$target_dir" != "." ]]; then
        mkdir -p "$target_dir"
    fi
    
    # Copy file
    cp "$file" "$relative_path"
    echo "  Restored: $relative_path"
done

echo
echo -e "${GREEN}Restore completed successfully!${NC}"
echo
echo "Restored from backup: $SELECTED_BACKUP"
echo "Pre-restore backup saved at: $CURRENT_BACKUP"
echo
echo "You may need to restart any running services or reload configuration."

# Offer to verify configuration
echo
read -p "Verify Task Master configuration? (y/N): " verify
if [[ "$verify" =~ ^[Yy]$ ]]; then
    echo
    echo "Verifying Task Master configuration..."
    if command -v npx >/dev/null 2>&1; then
        npx task-master models 2>/dev/null || echo "Note: Run 'npx task-master models' to verify configuration"
    else
        echo "Note: Run 'npx task-master models' to verify configuration"
    fi
fi
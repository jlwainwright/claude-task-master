#!/bin/bash

# Task Master Automated Backup Script
# Safely backs up configuration and tasks to git with timestamps

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$HOME/task-master-backups"
LOG_FILE="$BACKUP_DIR/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log "Starting Task Master backup process..."

# Change to project directory
cd "$PROJECT_DIR" || {
    error "Failed to change to project directory: $PROJECT_DIR"
    exit 1
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error "Not in a git repository. Please run from Task Master project directory."
    exit 1
fi

# Create timestamped backup directory
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
TIMESTAMPED_BACKUP="$BACKUP_DIR/backup_$TIMESTAMP"
mkdir -p "$TIMESTAMPED_BACKUP"

log "Creating timestamped backup at: $TIMESTAMPED_BACKUP"

# Files to backup (relative to project root)
declare -a BACKUP_FILES=(
    ".taskmaster/config.json"
    ".cursor/mcp.json"
    ".env"
    ".taskmaster/tasks/tasks.json"
    "package.json"
    "package-lock.json"
)

# Copy files to timestamped backup
for file in "${BACKUP_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        # Create directory structure in backup
        backup_file_dir="$TIMESTAMPED_BACKUP/$(dirname "$file")"
        mkdir -p "$backup_file_dir"
        
        cp "$file" "$TIMESTAMPED_BACKUP/$file"
        log "Backed up: $file"
    else
        warning "File not found, skipping: $file"
    fi
done

# Git operations
log "Checking git status..."

# Check if there are any changes
if git diff --quiet && git diff --staged --quiet; then
    log "No changes detected. Skipping git operations."
else
    log "Changes detected. Proceeding with git backup..."
    
    # Add configuration files (but not .env for security)
    git add .taskmaster/config.json .cursor/mcp.json 2>/dev/null || warning "Some config files may not exist"
    
    # Add tasks if they exist
    if [[ -f ".taskmaster/tasks/tasks.json" ]]; then
        git add .taskmaster/tasks/tasks.json
        log "Added tasks.json to git"
    fi
    
    # Add package files if they changed
    if git diff --name-only | grep -E "(package\.json|package-lock\.json)" > /dev/null; then
        git add package.json package-lock.json 2>/dev/null || true
        log "Added package files to git"
    fi
    
    # Check if there's anything staged
    if git diff --staged --quiet; then
        log "No staged changes after adding files."
    else
        # Create commit with timestamp
        COMMIT_MSG="Auto-backup Task Master config and tasks - $(date '+%Y-%m-%d %H:%M:%S')"
        
        if git commit -m "$COMMIT_MSG"; then
            success "Git commit created: $COMMIT_MSG"
            
            # Optional: Push to remote (uncomment if desired)
            # if git push origin main 2>/dev/null; then
            #     success "Changes pushed to remote repository"
            # else
            #     warning "Failed to push to remote (this is optional)"
            # fi
        else
            error "Failed to create git commit"
        fi
    fi
fi

# Clean up old backups (keep last 10)
log "Cleaning up old backups..."
cd "$BACKUP_DIR"
ls -dt backup_* 2>/dev/null | tail -n +11 | xargs rm -rf 2>/dev/null || true

# Summary
BACKUP_COUNT=$(ls -d backup_* 2>/dev/null | wc -l)
success "Backup completed successfully!"
log "Current backup: $TIMESTAMPED_BACKUP"
log "Total backups retained: $BACKUP_COUNT"

# Display backup size
BACKUP_SIZE=$(du -sh "$TIMESTAMPED_BACKUP" | cut -f1)
log "Backup size: $BACKUP_SIZE"

success "Task Master backup process completed at $(date '+%Y-%m-%d %H:%M:%S')"
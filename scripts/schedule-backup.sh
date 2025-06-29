#!/bin/bash

# Task Master Backup Scheduler
# Sets up automated backups using cron

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-taskmaster.sh"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Task Master Backup Scheduler${NC}"
echo "================================"
echo

# Check if backup script exists
if [[ ! -f "$BACKUP_SCRIPT" ]]; then
    echo -e "${RED}Error: Backup script not found at $BACKUP_SCRIPT${NC}"
    exit 1
fi

# Make sure backup script is executable
chmod +x "$BACKUP_SCRIPT"

echo "Available backup schedules:"
echo "1) Every hour"
echo "2) Every 6 hours" 
echo "3) Daily at 2 AM"
echo "4) Daily at 9 AM"
echo "5) Weekly (Sundays at 2 AM)"
echo "6) Custom schedule"
echo "7) Remove all Task Master backup schedules"
echo "8) View current cron jobs"
echo

read -p "Select an option (1-8): " choice

case $choice in
    1)
        CRON_SCHEDULE="0 * * * *"
        DESCRIPTION="every hour"
        ;;
    2)
        CRON_SCHEDULE="0 */6 * * *"
        DESCRIPTION="every 6 hours"
        ;;
    3)
        CRON_SCHEDULE="0 2 * * *"
        DESCRIPTION="daily at 2 AM"
        ;;
    4)
        CRON_SCHEDULE="0 9 * * *"
        DESCRIPTION="daily at 9 AM"
        ;;
    5)
        CRON_SCHEDULE="0 2 * * 0"
        DESCRIPTION="weekly on Sundays at 2 AM"
        ;;
    6)
        echo "Enter custom cron schedule (e.g., '0 */2 * * *' for every 2 hours):"
        read -p "Cron schedule: " CRON_SCHEDULE
        DESCRIPTION="custom schedule: $CRON_SCHEDULE"
        ;;
    7)
        echo "Removing all Task Master backup schedules..."
        # Remove lines containing the backup script path
        (crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" | crontab -) || true
        echo -e "${GREEN}All Task Master backup schedules removed.${NC}"
        exit 0
        ;;
    8)
        echo "Current cron jobs:"
        crontab -l 2>/dev/null || echo "No cron jobs found."
        exit 0
        ;;
    *)
        echo "Invalid option selected."
        exit 1
        ;;
esac

# Validate cron schedule format (basic check)
if [[ ! "$CRON_SCHEDULE" =~ ^[0-9*,/-]+[[:space:]]+[0-9*,/-]+[[:space:]]+[0-9*,/-]+[[:space:]]+[0-9*,/-]+[[:space:]]+[0-9*,/-]+$ ]]; then
    echo "Invalid cron schedule format. Please use standard cron syntax."
    exit 1
fi

echo
echo "Setting up backup to run $DESCRIPTION"
echo "Cron schedule: $CRON_SCHEDULE"
echo "Backup script: $BACKUP_SCRIPT"
echo

read -p "Proceed with scheduling? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Scheduling cancelled."
    exit 0
fi

# Create new cron entry
CRON_ENTRY="$CRON_SCHEDULE $BACKUP_SCRIPT >> $HOME/task-master-backups/backup.log 2>&1"

# Remove any existing Task Master backup entries and add the new one
(
    crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" || true
    echo "$CRON_ENTRY"
) | crontab -

echo -e "${GREEN}Success!${NC} Task Master backup scheduled to run $DESCRIPTION"
echo
echo "To verify the schedule was added, run:"
echo "  crontab -l"
echo
echo "To view backup logs:"
echo "  tail -f ~/task-master-backups/backup.log"
echo
echo "To test the backup manually:"
echo "  $BACKUP_SCRIPT"
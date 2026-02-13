#!/usr/bin/env python3
"""
SafeTube Auto-Cleanup Script
Runs daily via cron to delete videos older than the retention period.
Reads the retention_days setting from the SQLite database.
"""

import os
import sqlite3
import time

DB_PATH = "/app/data/safetube.db"
MEDIA_DIR = "/app/media"


def get_retention_days():
    """Read retention_days setting from the database."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.execute(
            "SELECT value FROM settings WHERE key = 'retention_days'"
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return int(row[0])
    except Exception as e:
        print(f"[SafeTube Cleanup] Error reading settings: {e}")
    return 7  # Default 7 days


def cleanup():
    """Delete videos older than retention period."""
    retention_days = get_retention_days()
    cutoff_timestamp = time.time() - (retention_days * 86400)

    print(f"[SafeTube Cleanup] Removing videos older than {retention_days} days")

    try:
        conn = sqlite3.connect(DB_PATH)

        # Find expired videos
        cursor = conn.execute(
            "SELECT id, local_path, thumbnail_path FROM videos WHERE created_at < ?",
            (int(cutoff_timestamp),)
        )
        expired = cursor.fetchall()

        if not expired:
            print("[SafeTube Cleanup] No expired videos found.")
            conn.close()
            return

        for video_id, local_path, thumb_path in expired:
            # Delete files
            video_file = os.path.join(MEDIA_DIR, local_path) if local_path else None
            thumb_file = os.path.join(MEDIA_DIR, thumb_path) if thumb_path else None

            if video_file and os.path.exists(video_file):
                os.remove(video_file)
                print(f"  Deleted: {video_file}")

            if thumb_file and os.path.exists(thumb_file):
                os.remove(thumb_file)
                print(f"  Deleted: {thumb_file}")

            # Remove DB record
            conn.execute("DELETE FROM videos WHERE id = ?", (video_id,))
            print(f"  Removed DB record: id={video_id}")

        conn.commit()
        conn.close()
        print(f"[SafeTube Cleanup] Cleaned up {len(expired)} video(s).")

    except Exception as e:
        print(f"[SafeTube Cleanup] Error: {e}")


if __name__ == "__main__":
    cleanup()

import os
import shutil
import time
import threading
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any

from core.config import settings, STORAGE_DIR
from core.database import get_oldest_recordings, delete_recording, get_setting

logger = logging.getLogger("video_analytics.janitor")

class StorageJanitor:
    def __init__(self):
        self.is_running = False
        self.thread: Optional[threading.Thread] = None

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._run, daemon=True, name="StorageJanitor")
        self.thread.start()
        logger.info("Storage Janitor thread started.")

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        logger.info("Storage Janitor thread stopped.")

    def get_storage_stats(self) -> Dict[str, Any]:
        """
        Returns disk usage statistics for the storage drive and folder.
        """
        try:
            total, used, free = shutil.disk_usage(str(STORAGE_DIR))
            used_pct = round((used / total) * 100.0, 1) if total > 0 else 0.0

            # Calculate total size of STORAGE_DIR
            storage_size_bytes = 0
            for root, _, files in os.walk(str(STORAGE_DIR)):
                for f in files:
                    fp = os.path.join(root, f)
                    if os.path.exists(fp):
                        storage_size_bytes += os.path.getsize(fp)

            retention_days = int(get_setting("retention_days", str(settings.RETENTION_DAYS)))
            max_disk_pct = float(get_setting("max_disk_usage_percent", str(settings.MAX_DISK_USAGE_PERCENT)))

            return {
                "total_disk_gb": round(total / (1024**3), 2),
                "used_disk_gb": round(used / (1024**3), 2),
                "free_disk_gb": round(free / (1024**3), 2),
                "used_disk_percent": used_pct,
                "recordings_size_mb": round(storage_size_bytes / (1024**2), 2),
                "retention_days": retention_days,
                "max_disk_usage_percent": max_disk_pct,
                "storage_healthy": used_pct < max_disk_pct
            }
        except Exception as e:
            logger.error(f"Error calculating storage stats: {e}")
            return {
                "total_disk_gb": 0,
                "used_disk_gb": 0,
                "free_disk_gb": 0,
                "used_disk_percent": 0.0,
                "recordings_size_mb": 0.0,
                "retention_days": settings.RETENTION_DAYS,
                "max_disk_usage_percent": settings.MAX_DISK_USAGE_PERCENT,
                "storage_healthy": True
            }

    def purge_old_recordings(self):
        """
        Purges oldest video recordings if disk threshold is exceeded or retention days expired.
        """
        stats = self.get_storage_stats()
        max_pct = stats["max_disk_usage_percent"]
        used_pct = stats["used_disk_percent"]
        retention_days = stats["retention_days"]

        cutoff_date = datetime.now() - timedelta(days=retention_days)

        oldest_records = get_oldest_recordings(limit=50)
        purged_count = 0

        for rec in oldest_records:
            # Check if older than retention or disk is over limit
            rec_start = datetime.strptime(rec["start_time"], "%Y-%m-%d %H:%M:%S")
            is_expired = rec_start < cutoff_date
            is_disk_full = used_pct >= max_pct

            if is_expired or is_disk_full:
                file_rel = rec["file_path"].lstrip("/").replace("/", os.sep)
                file_abs = settings.BASE_DIR / file_rel

                if os.path.exists(file_abs):
                    try:
                        os.remove(file_abs)
                        logger.info(f"Purged old video: {file_abs}")
                    except Exception as e:
                        logger.warning(f"Could not delete video file {file_abs}: {e}")

                delete_recording(rec["id"])
                purged_count += 1

                # Re-check disk stats after every few deletes
                if is_disk_full and purged_count % 5 == 0:
                    stats = self.get_storage_stats()
                    if stats["used_disk_percent"] < (max_pct - 5.0):
                        break

        if purged_count > 0:
            logger.info(f"Janitor purged {purged_count} oldest recordings.")

    def _run(self):
        while self.is_running:
            try:
                self.purge_old_recordings()
            except Exception as e:
                logger.error(f"Storage Janitor exception: {e}")

            # Sleep interval (default 15 minutes)
            for _ in range(settings.JANITOR_INTERVAL_MINUTES * 60):
                if not self.is_running:
                    break
                time.sleep(1.0)

# Global singleton instance
storage_janitor = StorageJanitor()

"""
Pipeline: Sync LEGO sets from Rebrickable API into the database.

Wraps the existing refresh_sets.sync_cache_to_db() with logging and error handling
suitable for background scheduler execution.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger("bricktrack.pipeline.rebrickable_sync")


def run_rebrickable_sync() -> dict:
    """
    Fetch sets from Rebrickable API and sync to database.

    Called by:
    - APScheduler (daily at 3 AM UTC)
    - POST /admin/pipelines/rebrickable_sync/run
    """
    from scripts.refresh_sets import sync_cache_to_db

    logger.info("Starting Rebrickable sync...")
    t0 = time.time()

    try:
        stats = sync_cache_to_db(skip_fetch=False)
        elapsed = time.time() - t0
        logger.info(
            "Rebrickable sync complete: %d total, %d new, %d updated (%.1fs)",
            stats.get("total", 0),
            stats.get("inserted", 0),
            stats.get("updated", 0),
            elapsed,
        )
        stats["elapsed_seconds"] = round(elapsed, 1)
        stats["completed_at"] = datetime.now(timezone.utc).isoformat()
        return stats
    except Exception:
        logger.exception("Rebrickable sync failed")
        return {"error": "sync_failed", "completed_at": datetime.now(timezone.utc).isoformat()}

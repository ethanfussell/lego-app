"""
Background job scheduler using APScheduler.

Runs inside the FastAPI process. Jobs are defined with cron-like schedules.
All jobs are idempotent -- safe to re-run if a previous run failed.
"""
from __future__ import annotations

import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger("bricktrack.scheduler")

scheduler = BackgroundScheduler(daemon=True)

_is_testing = os.getenv("PYTEST_CURRENT_TEST") is not None


def register_jobs() -> None:
    """Register all periodic data pipeline jobs."""
    if _is_testing:
        logger.info("Scheduler disabled in test mode")
        return

    from app.pipelines.rebrickable_sync import run_rebrickable_sync
    from app.pipelines.brickset_sync import run_brickset_sync
    from app.pipelines.retirement_scraper import run_retirement_scrape
    from app.pipelines.price_scraper import run_price_scrape
    from app.pipelines.bricklink_prices import run_bricklink_prices

    # Rebrickable sync: daily at 3 AM UTC
    scheduler.add_job(
        run_rebrickable_sync,
        CronTrigger(hour=3, minute=0),
        id="rebrickable_sync",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Brickset sync: daily at 3:30 AM UTC (after Rebrickable, enriches launch_date/prices)
    scheduler.add_job(
        run_brickset_sync,
        CronTrigger(hour=3, minute=30),
        id="brickset_sync",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Retirement scrape: daily at 4 AM UTC
    scheduler.add_job(
        run_retirement_scrape,
        CronTrigger(hour=4, minute=0),
        id="retirement_scrape",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Price scrape: every 6 hours
    scheduler.add_job(
        run_price_scrape,
        CronTrigger(hour="*/6", minute=30),
        id="price_scrape",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # BrickLink aftermarket prices: daily at 5 AM UTC
    scheduler.add_job(
        run_bricklink_prices,
        CronTrigger(hour=5, minute=0),
        id="bricklink_prices",
        replace_existing=True,
        misfire_grace_time=3600,
    )


def start_scheduler() -> None:
    """Start the scheduler (called from FastAPI lifespan)."""
    if _is_testing:
        return
    register_jobs()
    scheduler.start()
    logger.info("Scheduler started with %d jobs", len(scheduler.get_jobs()))


def shutdown_scheduler() -> None:
    """Shutdown the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")

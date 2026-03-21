# backend/app/routers/sets.py

import json
import math
import os
import time
import threading
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.properties import RelationshipProperty

from app.schemas.set import SetBulkOut

from ..core.auth import get_current_user, get_current_user_optional
from ..core.limiter import limiter
from ..data.sets import get_set_by_num, load_cached_sets
from ..data import reviews as reviews_data
from ..data import offers as offers_data  # used by /sets/{set_num}/offers
from ..db import get_db
from ..models import Offer as OfferModel
from ..models import Review as ReviewModel
from ..models import Set as SetModel
from ..models import User as UserModel
from ..models import AdminSetting
from ..models import List as ListModel, ListItem as ListItemModel

router = APIRouter()


# ---------------- helpers ----------------

import html as _html_mod
import re as _re

def _short_description(raw: Optional[str], max_chars: int = 200) -> Optional[str]:
    """Return first 1-2 sentences, cleaned of HTML entities, capped at max_chars."""
    if not raw:
        return None
    text = _html_mod.unescape(raw).strip()
    # Take first two sentences
    parts = _re.split(r'(?<=[.!?])\s+', text, maxsplit=2)
    short = " ".join(parts[:2]).strip()
    if len(short) > max_chars:
        short = short[:max_chars].rsplit(" ", 1)[0] + "…"
    return short or None


def _use_memory_reviews() -> bool:
    return os.getenv("PYTEST_CURRENT_TEST") is not None and hasattr(reviews_data, "REVIEWS")


def _fuzzy_score_for_set(s: Dict[str, Any], q: str) -> float:
    q = (q or "").strip().lower()
    if not q:
        return 0.0

    candidates = [
        (s.get("name") or "").lower(),
        (s.get("ip") or "").lower(),
        (s.get("theme") or "").lower(),
    ]

    best = 0.0
    for text in candidates:
        if not text:
            continue
        best = max(best, SequenceMatcher(None, q, text).ratio())
    return best


def _matches_query(s: Dict[str, Any], q: str) -> bool:
    q = (q or "").strip().lower()
    if not q:
        return True

    name = (s.get("name") or "").lower()
    theme = (s.get("theme") or "").lower()
    set_num = (s.get("set_num") or "").lower()
    plain = (s.get("set_num_plain") or "").lower()

    return (q in name) or (q in theme) or (q in set_num) or (q == plain)


def _relevance_score(s: Dict[str, Any], q: str) -> int:
    q = (q or "").strip().lower()
    if not q:
        return 0

    name = (s.get("name") or "").lower()
    theme = (s.get("theme") or "").lower()
    set_num = (s.get("set_num") or "").lower()
    plain = (s.get("set_num_plain") or "").lower()

    score = 0
    if plain and plain == q:
        score += 100
    if set_num and set_num == q:
        score += 90
    if name.startswith(q):
        score += 60
    if q in name:
        score += 40
    if q in theme:
        score += 20
    return score


def _sort_key(sort: str):
    if sort == "name":
        return lambda r: (r.get("name") or "").lower()
    if sort == "year":
        return lambda r: (r.get("year") or 0)
    if sort == "pieces":
        return lambda r: (r.get("pieces") or 0)
    if sort == "rating":
        return lambda r: (r.get("_avg_rating") or 0.0, r.get("_rating_count") or 0)
    if sort == "price":
        return lambda r: (r.get("retail_price") or 0.0)
    return lambda r: (r.get("name") or "").lower()


def _rating_stats_for_set(db: Session, set_num: str) -> Tuple[Optional[float], int]:
    """
    Returns (avg_rating, rating_count) where rating_count counts ONLY non-null ratings.
    """
    if _use_memory_reviews():
        vals = [
            float(r["rating"])
            for r in (reviews_data.REVIEWS or [])
            if str(r.get("set_num")) == str(set_num) and r.get("rating") is not None
        ]
        if not vals:
            return (None, 0)
        return (round(sum(vals) / len(vals), 2), len(vals))

    row = db.execute(
        select(func.avg(ReviewModel.rating), func.count(ReviewModel.rating))
        .where(ReviewModel.set_num == set_num, ReviewModel.rating.is_not(None))
    ).one()

    avg, cnt = row
    cnt_i = int(cnt or 0)
    if cnt_i <= 0 or avg is None:
        return (None, 0)
    return (round(float(avg), 2), cnt_i)


def _review_count_for_set(db: Session, set_num: str) -> int:
    """
    Count written reviews (non-empty text) for a set.
    Separate from rating_count (which counts ratings).
    """
    if _use_memory_reviews():
        cnt = 0
        for r in (reviews_data.REVIEWS or []):
            if str(r.get("set_num")) != str(set_num):
                continue
            text = r.get("text")
            if text is None:
                continue
            if str(text).strip() == "":
                continue
            cnt += 1
        return cnt

    cnt = db.execute(
        select(func.count())
        .select_from(ReviewModel)
        .where(
            ReviewModel.set_num == set_num,
            ReviewModel.text.is_not(None),
            func.length(func.trim(ReviewModel.text)) > 0,
        )
    ).scalar_one()

    return int(cnt or 0)


def _set_tags_map(db: Session, set_nums: Optional[List[str]] = None) -> Dict[str, str]:
    """Map set_num -> set_tag for sets that have a tag. If set_nums given, filter to those only."""
    q = select(SetModel.set_num, SetModel.set_tag).where(SetModel.set_tag.isnot(None))
    if set_nums:
        q = q.where(SetModel.set_num.in_(set_nums))
    rows = db.execute(q).all()
    return {r[0]: r[1] for r in rows if r[1]}


def _enrich_with_tags(db: Session, items: List[Dict[str, Any]]) -> None:
    """Add set_tag to a list of set dicts from DB tags."""
    if not items:
        return
    set_nums = [item.get("set_num", "") for item in items if item.get("set_num")]
    tags = _set_tags_map(db, set_nums)
    if not tags:
        return
    for item in items:
        sn = item.get("set_num", "")
        tag = tags.get(sn)
        if tag:
            item["set_tag"] = tag


_ratings_cache_lock = threading.Lock()
_ratings_cache: Dict[str, Any] = {"ts": 0.0, "val": None}
_RATINGS_TTL = 60  # seconds

_review_counts_cache_lock = threading.Lock()
_review_counts_cache: Dict[str, Any] = {"ts": 0.0, "val": None}

_price_cache_lock = threading.Lock()
_price_cache: Dict[str, Any] = {"ts": 0.0, "val": None}
_PRICE_TTL = 300  # 5 minutes


def invalidate_ratings_cache() -> None:
    """Call after a review is created/updated/deleted to bust the cache."""
    with _ratings_cache_lock:
        _ratings_cache["ts"] = 0.0
        _ratings_cache["val"] = None
    with _review_counts_cache_lock:
        _review_counts_cache["ts"] = 0.0
        _review_counts_cache["val"] = None


def _price_map(db: Session) -> Dict[str, float]:
    """Map set_num -> retail_price from DB, with TTL cache."""
    now = time.monotonic()
    with _price_cache_lock:
        if now - _price_cache["ts"] < _PRICE_TTL and _price_cache["val"] is not None:
            return _price_cache["val"]

    rows = db.execute(
        select(SetModel.set_num, SetModel.retail_price)
        .where(SetModel.retail_price.isnot(None), SetModel.retail_price > 0)
    ).all()
    result = {r.set_num: float(r.retail_price) for r in rows}

    with _price_cache_lock:
        _price_cache["ts"] = time.monotonic()
        _price_cache["val"] = result
    return result


def _ratings_map(db: Session) -> Dict[str, Tuple[Optional[float], int]]:
    """
    Map set_num -> (avg_rating, rating_count) where rating_count counts only non-null ratings.
    """
    if _use_memory_reviews():
        buckets: Dict[str, List[float]] = {}
        for r in (reviews_data.REVIEWS or []):
            rating = r.get("rating")
            if rating is None:
                continue
            key = str(r.get("set_num"))
            buckets.setdefault(key, []).append(float(rating))

        out: Dict[str, Tuple[Optional[float], int]] = {}
        for set_num, vals in buckets.items():
            if not vals:
                out[set_num] = (None, 0)
            else:
                out[set_num] = (round(sum(vals) / len(vals), 2), len(vals))
        return out

    now = time.monotonic()
    with _ratings_cache_lock:
        if now - _ratings_cache["ts"] < _RATINGS_TTL and _ratings_cache["val"] is not None:
            return _ratings_cache["val"]

    rows = db.execute(
        select(ReviewModel.set_num, func.avg(ReviewModel.rating), func.count(ReviewModel.rating))
        .where(ReviewModel.rating.is_not(None))
        .group_by(ReviewModel.set_num)
    ).all()

    out: Dict[str, Tuple[Optional[float], int]] = {}
    for set_num, avg, cnt in rows:
        cnt_i = int(cnt or 0)
        avg_f: Optional[float] = round(float(avg), 2) if (avg is not None and cnt_i > 0) else None
        out[str(set_num)] = (avg_f, cnt_i)

    with _ratings_cache_lock:
        _ratings_cache["ts"] = time.monotonic()
        _ratings_cache["val"] = out
    return out


def _review_counts_map(db: Session) -> Dict[str, int]:
    """
    Map set_num -> review_count where review_count counts only non-empty text reviews.
    """
    if _use_memory_reviews():
        counts: Dict[str, int] = {}
        for r in (reviews_data.REVIEWS or []):
            txt = r.get("text")
            if txt is None or str(txt).strip() == "":
                continue
            key = str(r.get("set_num"))
            counts[key] = counts.get(key, 0) + 1
        return counts

    now = time.monotonic()
    with _review_counts_cache_lock:
        if now - _review_counts_cache["ts"] < _RATINGS_TTL and _review_counts_cache["val"] is not None:
            return _review_counts_cache["val"]

    rows = db.execute(
        select(ReviewModel.set_num, func.count(ReviewModel.id))
        .where(
            ReviewModel.text.is_not(None),
            func.length(func.trim(ReviewModel.text)) > 0,
        )
        .group_by(ReviewModel.set_num)
    ).all()

    out: Dict[str, int] = {}
    for set_num, cnt in rows:
        out[str(set_num)] = int(cnt or 0)

    with _review_counts_cache_lock:
        _review_counts_cache["ts"] = time.monotonic()
        _review_counts_cache["val"] = out
    return out


def _user_rating_for_set(
    db: Session,
    username: str,
    set_num: str,
    set_num_plain: Optional[str],
) -> Optional[float]:
    """
    Return the user's most recent non-null rating for a set.
    """
    user_attr = getattr(ReviewModel, "user", None) or getattr(ReviewModel, "username", None)
    if user_attr is None:
        raise RuntimeError("ReviewModel is missing a user field (expected .user or .username)")

    prop = getattr(user_attr, "property", None)
    if isinstance(prop, RelationshipProperty):
        UserRel = prop.mapper.class_
        if hasattr(UserRel, "username"):
            user_filter = user_attr.has(username=username)
        elif hasattr(UserRel, "user"):
            user_filter = user_attr.has(user=username)
        elif hasattr(UserRel, "name"):
            user_filter = user_attr.has(name=username)
        else:
            raise RuntimeError(
                "ReviewModel.user is a relationship, but User model has no username/user/name field to filter on."
            )
    else:
        user_filter = (user_attr == username)

    order_col = getattr(ReviewModel, "created_at", None) or getattr(ReviewModel, "id", None)

    def query_for(target_set_num: str):
        q = (
            select(ReviewModel.rating)
            .where(
                ReviewModel.set_num == target_set_num,
                user_filter,
                ReviewModel.rating.is_not(None),
            )
            .limit(1)
        )
        if order_col is not None:
            q = q.order_by(order_col.desc())
        return q

    r = db.execute(query_for(set_num)).scalar_one_or_none()
    if r is not None:
        return float(r)

    if set_num_plain:
        r2 = db.execute(query_for(set_num_plain)).scalar_one_or_none()
        if r2 is not None:
            return float(r2)

    return None


# ---------------- on-demand price scrape ----------------

import logging as _logging

_od_logger = _logging.getLogger("bricktrack.on_demand_scrape")

def _try_on_demand_scrape(
    db: Session,
    canonical_set_num: str,
    plain: str,
    name: str,
) -> List[Dict[str, Any]]:
    """
    Scrape LEGO.com for a single set and create offers on the fly.

    Called when a user views a set that has no LEGO offer yet, so we
    don't have to wait for the next batch scraper run.
    """
    from app.pipelines.price_scraper import (
        scrape_lego_product_page,
        build_amazon_url,
        build_target_url,
        build_walmart_url,
        HEADERS,
        REQUEST_TIMEOUT,
    )
    import httpx

    now = datetime.now(timezone.utc)

    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            lego_data = scrape_lego_product_page(client, plain)
    except Exception:
        _od_logger.debug("On-demand scrape failed for %s", plain)
        lego_data = None

    if not lego_data or not lego_data.get("price"):
        return offers_data.get_offers_for_set(db, plain)

    # Upsert LEGO offer
    _upsert_on_demand_offer(
        db, plain, "LEGO",
        lego_data["price"], lego_data.get("currency", "USD"),
        lego_data["url"], lego_data.get("in_stock"),
        now,
    )

    # Also update Set.retail_price
    set_row = db.execute(
        select(SetModel).where(SetModel.set_num == canonical_set_num)
    ).scalar_one_or_none()
    if set_row:
        set_row.retail_price = lego_data["price"]
        set_row.retail_currency = lego_data.get("currency", "USD")

    # Generate retailer search links
    _upsert_on_demand_offer(db, plain, "Amazon", None, "USD", build_amazon_url(plain, name), None, now)
    _upsert_on_demand_offer(db, plain, "Target", None, "USD", build_target_url(plain), None, now)
    _upsert_on_demand_offer(db, plain, "Walmart", None, "USD", build_walmart_url(plain), None, now)

    db.commit()
    _od_logger.info("On-demand scrape created offers for %s ($%s)", plain, lego_data["price"])

    return offers_data.get_offers_for_set(db, plain)


def _upsert_on_demand_offer(
    db: Session,
    set_num_plain: str,
    store: str,
    price: Optional[float],
    currency: str,
    url: str,
    in_stock: Optional[bool],
    now: datetime,
) -> None:
    from sqlalchemy import and_
    existing = db.execute(
        select(OfferModel).where(
            and_(OfferModel.set_num == set_num_plain, OfferModel.store == store)
        )
    ).scalar_one_or_none()

    if existing:
        if price is not None:
            existing.price = price
        existing.currency = currency
        existing.url = url
        if in_stock is not None:
            existing.in_stock = in_stock
        existing.last_checked = now
    else:
        db.add(OfferModel(
            set_num=set_num_plain,
            store=store,
            price=price,
            currency=currency,
            url=url,
            in_stock=in_stock,
            last_checked=now,
        ))


# ---------------- endpoints ----------------

@router.get("")
@limiter.limit("30/minute")
def list_sets(
    request: Request,
    response: Response,
    q: Optional[str] = Query(None),

    year: Optional[int] = Query(None, ge=1900, le=2100),
    min_year: Optional[int] = Query(None, ge=1900, le=2100),
    max_year: Optional[int] = Query(None, ge=1900, le=2100),

    pieces: Optional[int] = Query(None, ge=0),
    min_pieces: Optional[int] = Query(None, ge=0),
    max_pieces: Optional[int] = Query(None, ge=0),

    min_parts: Optional[int] = Query(None, ge=0),
    max_parts: Optional[int] = Query(None, ge=0),
    min_num_parts: Optional[int] = Query(None, ge=0),
    max_num_parts: Optional[int] = Query(None, ge=0),

    theme: Optional[str] = Query(None),
    min_rating: Optional[float] = Query(None, ge=0, le=5),

    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),

    availability: Optional[str] = Query(None),

    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str = Query("relevance"),
    order: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    all_sets = load_cached_sets()
    sets = all_sets

    q_clean = (q or "").strip()

    if q_clean:
        direct = [s for s in all_sets if _matches_query(s, q_clean)]
        if direct:
            sets = direct
        else:
            scored: List[Tuple[float, Dict[str, Any]]] = []
            for s in all_sets:
                score = _fuzzy_score_for_set(s, q_clean)
                if score >= 0.55:
                    scored.append((score, s))
            scored.sort(key=lambda t: t[0], reverse=True)
            sets = [s for _, s in scored[:100]]

    if year is not None:
        y = int(year)
        sets = [s for s in sets if int(s.get("year") or 0) == y]
    else:
        if min_year is not None:
            y0 = int(min_year)
            sets = [s for s in sets if int(s.get("year") or 0) >= y0]
        if max_year is not None:
            y1 = int(max_year)
            sets = [s for s in sets if int(s.get("year") or 0) <= y1]

    if pieces is not None:
        p = int(pieces)
        sets = [s for s in sets if int(s.get("pieces") or 0) == p]
    else:
        lo = min_pieces
        hi = max_pieces

        if lo is None:
            lo = min_parts if min_parts is not None else min_num_parts
        if hi is None:
            hi = max_parts if max_parts is not None else max_num_parts

        if lo is not None:
            p0 = int(lo)
            sets = [s for s in sets if int(s.get("pieces") or 0) >= p0]
        if hi is not None:
            p1 = int(hi)
            sets = [s for s in sets if int(s.get("pieces") or 0) <= p1]

    theme_clean = (theme or "").strip()
    if theme_clean:
        tl = theme_clean.lower()
        sets = [s for s in sets if (s.get("theme") or "").strip().lower() == tl]

    prices = _price_map(db) if (min_price is not None or max_price is not None) else {}
    if min_price is not None:
        sets = [s for s in sets if prices.get(s.get("set_num") or "", 0) >= min_price]
    if max_price is not None:
        sets = [s for s in sets if 0 < prices.get(s.get("set_num") or "", float("inf")) <= max_price]

    if availability is not None:
        allowed = set(v.strip().lower() for v in availability.split(",") if v.strip())
        status_rows = db.execute(
            select(SetModel.set_num, SetModel.retirement_status)
            .where(SetModel.retirement_status.in_([v for v in allowed]))
        ).all()
        allowed_nums = {r.set_num for r in status_rows}
        sets = [s for s in sets if (s.get("set_num") or "") in allowed_nums]

    ratings = _ratings_map(db)
    review_counts = _review_counts_map(db)
    if not prices:
        prices = _price_map(db)

    enriched: List[Dict[str, Any]] = []
    for s in sets:
        canonical = s.get("set_num") or ""
        avg, cnt = ratings.get(canonical, (None, 0))
        rev_cnt = int(review_counts.get(canonical, 0))

        r = dict(s)
        price = prices.get(canonical)
        if price is not None:
            r["retail_price"] = price
        r["_avg_rating"] = avg
        r["_rating_count"] = cnt
        r["_review_count"] = rev_cnt
        enriched.append(r)

    if min_rating is not None:
        mr = float(min_rating)
        enriched = [r for r in enriched if (r.get("_avg_rating") or 0.0) >= mr]

    allowed_sorts = {"relevance", "name", "year", "pieces", "rating", "price"}
    if sort not in allowed_sorts:
        raise HTTPException(status_code=400, detail=f"Invalid sort '{sort}'")

    if order is None:
        order = "desc" if sort in {"relevance", "rating"} else "asc"
    reverse = (order == "desc")

    if sort == "relevance":
        if q_clean:
            for r in enriched:
                r["_relevance"] = _relevance_score(r, q_clean)
            enriched.sort(
                key=lambda r: (
                    r.get("_relevance") or 0,
                    int(r.get("year") or 0),
                    r.get("_rating_count") or 0,
                    (r.get("_avg_rating") or 0.0),
                ),
                reverse=True,
            )
        else:
            enriched.sort(key=_sort_key("year"), reverse=True)
    else:
        enriched.sort(key=_sort_key(sort), reverse=reverse)

    total = len(enriched)
    start = (page - 1) * limit
    end = start + limit
    page_rows = enriched[start:end]

    for r in page_rows:
        avg = r.pop("_avg_rating", None)
        cnt = r.pop("_rating_count", 0)
        rev_cnt = r.pop("_review_count", 0)
        r.pop("_relevance", None)

        r["rating_avg"] = avg
        r["rating_count"] = int(cnt or 0)
        r["review_count"] = int(rev_cnt or 0)

    response.headers["X-Total-Count"] = str(total)
    offers_data.enrich_with_best_prices(db, page_rows)
    _enrich_with_tags(db, page_rows)
    return page_rows


@router.get("/suggest")
@limiter.limit("30/minute")
def suggest_sets(
    request: Request,
    q: str = Query(..., min_length=1),
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
):
    q_clean = (q or "").strip().lower()
    if not q_clean:
        return []

    all_sets = load_cached_sets()
    ratings = _ratings_map(db)

    candidates: List[Tuple[float, int, int, Dict[str, Any]]] = []
    for s in all_sets:
        name = (s.get("name") or "").lower()
        theme = (s.get("theme") or "").lower()
        set_num = (s.get("set_num") or "").lower()
        plain = (s.get("set_num_plain") or "").lower()

        base_score = 0.0
        direct = False

        if plain and plain == q_clean:
            base_score += 120
            direct = True
        if set_num and set_num == q_clean:
            base_score += 110
            direct = True
        if name.startswith(q_clean):
            base_score += 80
            direct = True
        if q_clean in name:
            base_score += 60
            direct = True
        if q_clean in theme:
            base_score += 30
            direct = True

        if not direct:
            fuzzy = _fuzzy_score_for_set(s, q_clean)
            if fuzzy < 0.5:
                continue
            base_score += fuzzy * 50.0

        canonical = s.get("set_num") or ""
        _, cnt = ratings.get(canonical, (None, 0))
        pop_score = min(int(cnt), 50)

        total_score = base_score + pop_score
        year = int(s.get("year") or 0)
        candidates.append((total_score, int(cnt), year, s))

    candidates.sort(key=lambda t: (t[0], t[1], t[2]), reverse=True)
    top = [s for _, _, _, s in candidates[:limit]]

    return [
        {
            "set_num": s.get("set_num"),
            "name": s.get("name"),
            "ip": s.get("ip") or s.get("theme"),
            "year": s.get("year"),
        }
        for s in top
    ]


@router.get("/{set_num}/rating")
def get_set_rating_summary(set_num: str, db: Session = Depends(get_db)):
    s = get_set_by_num(set_num)
    if not s:
        raise HTTPException(status_code=404, detail="Set not found")

    canonical = s.get("set_num") or set_num
    avg, cnt = _rating_stats_for_set(db, canonical)
    return {"set_num": canonical, "average": avg, "count": cnt}


@router.get("/{set_num}/offers")
def get_set_offers(set_num: str, db: Session = Depends(get_db)):
    s = get_set_by_num(set_num)
    if not s:
        raise HTTPException(status_code=404, detail="Set not found")

    canonical = s.get("set_num") or set_num
    plain = s.get("set_num_plain") or canonical.split("-")[0]
    name = s.get("name") or ""

    offers = offers_data.get_offers_for_set(db, plain)

    # On-demand scrape: if no LEGO offer exists, try LEGO.com right now
    has_lego_offer = any(o.get("store") == "LEGO" for o in offers)
    if not has_lego_offer:
        offers = _try_on_demand_scrape(db, canonical, plain, name)

    # summary.updated_at = newest offer updated_at (ISO strings compare lexicographically)
    updated_at: Optional[str] = None
    for o in offers:
        ts = o.get("updated_at")
        if isinstance(ts, str) and ts:
            updated_at = ts if updated_at is None else max(updated_at, ts)

    return {
        "set_num": canonical,
        "summary": {"status": "unknown", "best_offer_id": None, "updated_at": updated_at},
        "offers": offers,
    }


@router.get(
    "/bulk",
    response_model=List[SetBulkOut],
    summary="Bulk fetch sets",
    description=(
        "Fetch multiple sets by set_num. Returns cached set fields plus rating stats "
        "(rating_avg, rating_count) and review_count (non-empty text). If authenticated, includes user_rating."
    ),
)
def bulk_get_sets(
    set_nums: str = Query(
        ...,
        description="Comma-separated set numbers like 10305-1,21357-1",
        examples=["10305-1,21357-1"],
    ),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_current_user_optional),
):
    raw = (set_nums or "").strip()
    if not raw:
        raise HTTPException(status_code=422, detail="set_nums_required")

    requested: List[str] = [s.strip() for s in raw.split(",") if s.strip()]
    if not requested:
        raise HTTPException(status_code=422, detail="set_nums_required")

    found: List[Dict[str, Any]] = []
    canonicals: List[str] = []
    plain_map: Dict[str, Optional[str]] = {}

    for x in requested:
        s = get_set_by_num(x)
        if not s:
            continue
        canonical = s.get("set_num") or x
        canonicals.append(canonical)
        plain_map[canonical] = s.get("set_num_plain")
        found.append(s)

    if not canonicals:
        return []

    rows = db.execute(
        select(
            ReviewModel.set_num,
            func.avg(ReviewModel.rating),
            func.count(ReviewModel.rating),
        )
        .where(
            ReviewModel.rating.is_not(None),
            ReviewModel.set_num.in_(canonicals),
        )
        .group_by(ReviewModel.set_num)
    ).all()

    ratings: Dict[str, Tuple[Optional[float], int]] = {}
    for set_num, avg, cnt in rows:
        cnt_i = int(cnt or 0)
        avg_f: Optional[float] = round(float(avg), 2) if (avg is not None and cnt_i > 0) else None
        ratings[str(set_num)] = (avg_f, cnt_i)

    review_rows = db.execute(
        select(
            ReviewModel.set_num,
            func.count(ReviewModel.id),
        )
        .where(
            ReviewModel.set_num.in_(canonicals),
            ReviewModel.text.is_not(None),
            func.length(func.trim(ReviewModel.text)) > 0,
        )
        .group_by(ReviewModel.set_num)
    ).all()

    review_counts: Dict[str, int] = {}
    for set_num, cnt in review_rows:
        review_counts[str(set_num)] = int(cnt or 0)

    username: Optional[str] = current_user.username if current_user else None

    out: List[Dict[str, Any]] = []
    for s in found:
        canonical = s.get("set_num") or ""
        avg, cnt = ratings.get(canonical, (None, 0))
        rev_cnt = int(review_counts.get(canonical, 0))

        user_rating = None
        if username:
            user_rating = _user_rating_for_set(db, username, canonical, plain_map.get(canonical))

        r = dict(s)
        r["rating_avg"] = avg
        r["rating_count"] = int(cnt or 0)
        r["review_count"] = int(rev_cnt or 0)
        r["user_rating"] = user_rating
        out.append(r)

    offers_data.enrich_with_best_prices(db, out)
    _enrich_with_tags(db, out)
    return out


@router.get("/reviews/me")
def list_my_reviews(
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    username = current_user.username

    rows = db.execute(
        select(ReviewModel, SetModel)
        .join(SetModel, SetModel.set_num == ReviewModel.set_num)
        .where(ReviewModel.user.has(username=username))
        .order_by(func.coalesce(ReviewModel.updated_at, ReviewModel.created_at).desc())
        .limit(int(limit))
    ).all()

    out: List[Dict[str, Any]] = []
    for (rev, s) in rows:
        img = s.image_url
        if not img:
            cached = get_set_by_num(rev.set_num)
            img = (cached or {}).get("image_url")

        out.append(
            {
                "set_num": rev.set_num,
                "set_name": s.name,
                "image_url": img,
                "rating": float(rev.rating) if rev.rating is not None else None,
                "text": rev.text,
                "created_at": rev.created_at,
                "updated_at": getattr(rev, "updated_at", None),
            }
        )
    return out

@router.get("/new")
def list_new_sets(
    response: Response,
    days: Optional[int] = Query(None, ge=1, le=730),
    page: int = Query(1, ge=1),
    limit: int = Query(80, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    """
    Recent LEGO releases based on official launch dates (from Brickset).

    - Without `days`: returns all sets with a known launch_date, newest first.
    - With `days=N`: returns sets launched within the last N days.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    base_q = select(SetModel).where(
        SetModel.launch_date.isnot(None),
        SetModel.launch_date <= today,  # Only sets that have actually launched
    )

    if days is not None:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=int(days))).strftime("%Y-%m-%d")
        base_q = base_q.where(SetModel.launch_date >= cutoff)

    base_q = base_q.order_by(SetModel.launch_date.desc(), SetModel.set_num.asc())

    # Total count
    total = db.execute(select(func.count()).select_from(base_q.subquery())).scalar_one()
    response.headers["X-Total-Count"] = str(total)

    # Pagination
    offset = (page - 1) * limit
    rows = db.execute(base_q.offset(offset).limit(limit)).scalars().all()

    # Ratings enrichment
    ratings = _ratings_map(db)
    review_counts = _review_counts_map(db)

    out: List[Dict[str, Any]] = []
    for s in rows:
        canonical = s.set_num
        avg, cnt = ratings.get(canonical, (None, 0))
        rev_cnt = int(review_counts.get(canonical, 0))

        out.append(
            {
                "set_num": s.set_num,
                "name": s.name,
                "year": s.year,
                "theme": s.theme,
                "pieces": s.pieces,
                "image_url": s.image_url,
                "rating_avg": avg,
                "rating_count": int(cnt or 0),
                "review_count": int(rev_cnt or 0),
                "retail_price": s.retail_price,
                "launch_date": s.launch_date,
            }
        )

    offers_data.enrich_with_best_prices(db, out)
    _enrich_with_tags(db, out)
    return out


@router.get("/deals")
@limiter.limit("30/minute")
def list_deals(
    request: Request,
    response: Response,
    sort: str = Query("discount", description="Sort by: discount, price, savings, name"),
    order: Optional[str] = Query(None),
    theme: Optional[str] = Query(None),
    min_discount: Optional[int] = Query(None, ge=1, le=99, description="Minimum discount percentage"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum sale price"),
    page: int = Query(1, ge=1),
    limit: int = Query(60, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Sets currently on sale — where the best in-stock offer is below retail price.
    Returns sets enriched with discount_pct, savings, sale_price, original_price.
    """
    # Subquery: best (cheapest) in-stock offer per set
    # Exclude aftermarket sellers (BrickLink) — not comparable to retail deals
    best_offer_sq = (
        select(
            OfferModel.set_num,
            func.min(OfferModel.price).label("best_price"),
        )
        .where(
            OfferModel.price.isnot(None),
            func.coalesce(OfferModel.in_stock, True).is_(True),
            OfferModel.store != "BrickLink",
        )
        .group_by(OfferModel.set_num)
        .subquery()
    )

    # Join sets with their best offer, filter where best_price < retail_price
    q = (
        select(
            SetModel,
            best_offer_sq.c.best_price,
        )
        .join(
            best_offer_sq,
            SetModel.set_num == func.concat(best_offer_sq.c.set_num, "-1"),
        )
        .where(
            SetModel.retail_price.isnot(None),
            SetModel.retail_price > 0,
            best_offer_sq.c.best_price < SetModel.retail_price,
        )
    )

    # Theme filter
    theme_clean = (theme or "").strip()
    if theme_clean:
        q = q.where(func.lower(SetModel.theme) == theme_clean.lower())

    # Min discount filter
    if min_discount is not None:
        q = q.where(
            (1.0 - best_offer_sq.c.best_price / SetModel.retail_price) * 100 >= min_discount
        )

    # Max price filter
    if max_price is not None:
        q = q.where(best_offer_sq.c.best_price <= max_price)

    # Sorting
    discount_expr = (1.0 - best_offer_sq.c.best_price / SetModel.retail_price)
    savings_expr = SetModel.retail_price - best_offer_sq.c.best_price

    allowed_sorts = {"discount", "price", "savings", "name"}
    if sort not in allowed_sorts:
        raise HTTPException(status_code=400, detail=f"Invalid sort '{sort}'")

    if order is None:
        order = "asc" if sort == "name" else "desc"
    reverse = (order == "desc")

    if sort == "discount":
        order_col = discount_expr.desc() if reverse else discount_expr.asc()
    elif sort == "price":
        order_col = best_offer_sq.c.best_price.asc() if not reverse else best_offer_sq.c.best_price.desc()
    elif sort == "savings":
        order_col = savings_expr.desc() if reverse else savings_expr.asc()
    else:  # name
        order_col = SetModel.name.asc() if not reverse else SetModel.name.desc()

    q = q.order_by(order_col, SetModel.name.asc())

    # Total count
    total = db.execute(select(func.count()).select_from(q.subquery())).scalar_one()
    response.headers["X-Total-Count"] = str(total)

    # Pagination
    offset = (page - 1) * limit
    rows = db.execute(q.offset(offset).limit(limit)).all()

    # Enrich with ratings
    ratings = _ratings_map(db)
    review_counts = _review_counts_map(db)

    # Collect themes for the filter dropdown
    theme_q = (
        select(func.distinct(SetModel.theme))
        .join(
            best_offer_sq,
            SetModel.set_num == func.concat(best_offer_sq.c.set_num, "-1"),
        )
        .where(
            SetModel.retail_price.isnot(None),
            SetModel.retail_price > 0,
            best_offer_sq.c.best_price < SetModel.retail_price,
            SetModel.theme.isnot(None),
        )
    )
    deal_themes = sorted(
        [r[0] for r in db.execute(theme_q).all() if r[0]],
        key=str.lower,
    )

    out: List[Dict[str, Any]] = []
    for s, best_price in rows:
        canonical = s.set_num
        avg, cnt = ratings.get(canonical, (None, 0))
        rev_cnt = int(review_counts.get(canonical, 0))

        retail = float(s.retail_price)
        sale = float(best_price)
        savings = round(retail - sale, 2)
        discount_pct = round((1.0 - sale / retail) * 100)

        out.append(
            {
                "set_num": s.set_num,
                "name": s.name,
                "year": s.year,
                "theme": s.theme,
                "pieces": s.pieces,
                "image_url": s.image_url,
                "rating_avg": avg,
                "rating_count": int(cnt or 0),
                "review_count": int(rev_cnt or 0),
                "retail_price": retail,
                "original_price": retail,
                "sale_price": sale,
                "savings": savings,
                "discount_pct": discount_pct,
                "retirement_status": s.retirement_status,
                "set_tag": s.set_tag,
            }
        )

    _enrich_with_tags(db, out)

    return {
        "results": out,
        "total": total,
        "total_pages": max(1, -(-total // limit)),
        "page": page,
        "themes": deal_themes,
    }


@router.get("/retiring")
def list_retiring_sets(
    response: Response,
    page: int = Query(1, ge=1),
    limit: int = Query(60, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Sets with retirement_status='retiring_soon', ordered by retirement_date.
    Returns empty until retirement data is populated (via BrickEconomy or manual curation).
    """
    base_q = (
        select(SetModel)
        .where(SetModel.retirement_status == "retiring_soon")
        .order_by(SetModel.retirement_date.asc(), SetModel.name.asc())
    )

    total = db.execute(select(func.count()).select_from(base_q.subquery())).scalar_one()
    response.headers["X-Total-Count"] = str(total)

    offset = (page - 1) * limit
    rows = db.execute(base_q.offset(offset).limit(limit)).scalars().all()

    ratings = _ratings_map(db)
    review_counts = _review_counts_map(db)

    out: List[Dict[str, Any]] = []
    for s in rows:
        canonical = s.set_num
        avg, cnt = ratings.get(canonical, (None, 0))
        rev_cnt = int(review_counts.get(canonical, 0))

        out.append(
            {
                "set_num": s.set_num,
                "name": s.name,
                "year": s.year,
                "theme": s.theme,
                "pieces": s.pieces,
                "image_url": s.image_url,
                "rating_avg": avg,
                "rating_count": int(cnt or 0),
                "review_count": int(rev_cnt or 0),
                "retail_price": s.retail_price,
                "retirement_date": s.retirement_date,
                "exit_date": s.exit_date,
                "set_tag": s.set_tag,
            }
        )

    offers_data.enrich_with_best_prices(db, out)
    _enrich_with_tags(db, out)
    return out


_COMING_SOON_EXCLUDED_THEMES = {
    "Promotional", "LEGO Brand Store", "Service Packs", "Key Chains",
    "Magnets", "Gear", "Miscellaneous", "Books", "Bulk Bricks",
    "FIRST LEGO League",
}


@router.get("/coming-soon")
def list_coming_soon_sets(
    response: Response,
    page: int = Query(1, ge=1),
    limit: int = Query(60, ge=1, le=200),
    min_pieces: int = Query(50, ge=0),
    db: Session = Depends(get_db),
):
    """
    Sets marked as coming_soon. Filters out small promotional sets
    and junk themes by default.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    base_q = (
        select(SetModel)
        .where(
            or_(
                SetModel.launch_date > today,
                SetModel.retirement_status == "coming_soon",
            ),
            # Exclude promo/junk themes
            or_(
                SetModel.theme.notin_(_COMING_SOON_EXCLUDED_THEMES),
                SetModel.theme.is_(None),
            ),
            # Minimum piece count (keep NULLs — new sets may not have data yet)
            or_(
                SetModel.pieces >= min_pieces,
                SetModel.pieces.is_(None),
            ),
        )
        .order_by(SetModel.launch_date.asc().nulls_last(), SetModel.name.asc())
    )

    total = db.execute(select(func.count()).select_from(base_q.subquery())).scalar_one()
    response.headers["X-Total-Count"] = str(total)

    offset = (page - 1) * limit
    rows = db.execute(base_q.offset(offset).limit(limit)).scalars().all()

    out: List[Dict[str, Any]] = []
    for s in rows:
        out.append(
            {
                "set_num": s.set_num,
                "name": s.name,
                "year": s.year,
                "theme": s.theme,
                "pieces": s.pieces,
                "image_url": s.image_url,
                "retail_price": s.retail_price,
                "launch_date": s.launch_date,
            }
        )

    offers_data.enrich_with_best_prices(db, out)
    _enrich_with_tags(db, out)
    return out


# ===================================================================
# Public /new page config (no auth — consumed by Next.js ISR)
# ===================================================================

@router.get("/new-page-config")
def new_page_config(db: Session = Depends(get_db)):
    """Return spotlight + featured themes settings for the /new page.

    This is a public endpoint so the Next.js server component can fetch it at
    build/ISR time without needing an auth token.
    """
    settings: Dict[str, Any] = {}
    rows = db.execute(
        select(AdminSetting).where(
            AdminSetting.key.in_(["spotlight_set_num", "featured_themes"])
        )
    ).scalars().all()

    for row in rows:
        settings[row.key] = row.value

    return settings


# ===================================================================
# Public /retiring page config (no auth — consumed by Next.js ISR)
# ===================================================================

@router.get("/retiring-page-config")
def retiring_page_config(db: Session = Depends(get_db)):
    """Return hidden sets + excluded themes for the retiring page."""
    settings: Dict[str, Any] = {}
    rows = db.execute(
        select(AdminSetting).where(
            AdminSetting.key.in_([
                "retiring_hidden_sets",
                "retiring_excluded_themes",
            ])
        )
    ).scalars().all()

    for row in rows:
        settings[row.key] = row.value

    return settings


# ===================================================================
# Homepage aggregated data
# ===================================================================

@router.get("/homepage")
def homepage_data(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Single endpoint returning all data the homepage needs:
    - featured: top-rated available sets (with images)
    - deals: best current deals (discount_pct > 0)
    - retiring: sets retiring soon
    - trending: most-reviewed sets
    """
    ratings = _ratings_map(db)
    review_counts = _review_counts_map(db)

    def _set_to_dict(s, extra: dict | None = None) -> dict:
        canonical = s.set_num
        avg, cnt = ratings.get(canonical, (None, 0))
        rev_cnt = int(review_counts.get(canonical, 0))
        d = {
            "set_num": s.set_num,
            "name": s.name,
            "year": s.year,
            "theme": s.theme,
            "pieces": s.pieces,
            "image_url": s.image_url,
            "rating_avg": avg,
            "rating_count": int(cnt or 0),
            "review_count": rev_cnt,
            "retail_price": s.retail_price,
            "retirement_status": s.retirement_status,
            "set_tag": s.set_tag,
        }
        if extra:
            d.update(extra)
        return d

    # --- Featured: top-rated available sets with images ---
    featured_rows = db.execute(
        select(SetModel)
        .where(
            SetModel.image_url.isnot(None),
            SetModel.image_url != "",
            SetModel.retail_price.isnot(None),
            SetModel.retirement_status.in_(["available", "retiring_soon"]),
        )
        .order_by(SetModel.year.desc(), SetModel.pieces.desc())
        .limit(200)
    ).scalars().all()

    # Sort by rating, pick top 8
    featured_with_ratings = []
    for s in featured_rows:
        avg, cnt = ratings.get(s.set_num, (None, 0))
        if avg and cnt >= 1:
            featured_with_ratings.append((s, avg, cnt))
    featured_with_ratings.sort(key=lambda x: (-x[1], -x[2]))
    featured = [_set_to_dict(s) for s, _, _ in featured_with_ratings[:8]]

    # If not enough rated sets, fill with recent available sets
    if len(featured) < 4:
        featured_nums = {f["set_num"] for f in featured}
        for s in featured_rows:
            if s.set_num not in featured_nums:
                featured.append(_set_to_dict(s))
                if len(featured) >= 8:
                    break

    # --- Deals: best current deals ---
    best_offer_sq = (
        select(
            OfferModel.set_num,
            func.min(OfferModel.price).label("best_price"),
        )
        .where(
            OfferModel.price.isnot(None),
            func.coalesce(OfferModel.in_stock, True).is_(True),
            OfferModel.store != "BrickLink",
        )
        .group_by(OfferModel.set_num)
        .subquery()
    )

    deal_rows = db.execute(
        select(SetModel, best_offer_sq.c.best_price)
        .join(
            best_offer_sq,
            SetModel.set_num == func.concat(best_offer_sq.c.set_num, "-1"),
        )
        .where(
            SetModel.retail_price.isnot(None),
            SetModel.retail_price > 0,
            best_offer_sq.c.best_price < SetModel.retail_price,
        )
        .order_by(
            (1.0 - best_offer_sq.c.best_price / SetModel.retail_price).desc()
        )
        .limit(12)
    ).all()

    deals = []
    for s, best_price in deal_rows:
        retail = float(s.retail_price)
        sale = float(best_price)
        savings = round(retail - sale, 2)
        discount_pct = round((1.0 - sale / retail) * 100)
        deals.append(_set_to_dict(s, {
            "original_price": retail,
            "sale_price": sale,
            "savings": savings,
            "discount_pct": discount_pct,
        }))

    # --- Retiring soon ---
    retiring_rows = db.execute(
        select(SetModel)
        .where(SetModel.retirement_status == "retiring_soon")
        .order_by(SetModel.retirement_date.asc(), SetModel.name.asc())
        .limit(12)
    ).scalars().all()

    retiring = [_set_to_dict(s, {"retirement_date": s.retirement_date, "exit_date": s.exit_date}) for s in retiring_rows]
    offers_data.enrich_with_best_prices(db, retiring)

    # --- Trending: most-reviewed sets ---
    trending_rows = db.execute(
        select(SetModel, func.count(ReviewModel.id).label("rev_count"))
        .join(ReviewModel, ReviewModel.set_num == SetModel.set_num)
        .where(ReviewModel.text.isnot(None), ReviewModel.text != "")
        .group_by(SetModel.set_num)
        .order_by(func.count(ReviewModel.id).desc())
        .limit(6)
    ).all()

    trending = [_set_to_dict(s) for s, _ in trending_rows]

    _enrich_with_tags(db, featured)
    _enrich_with_tags(db, deals)
    _enrich_with_tags(db, trending)

    return {
        "featured": featured,
        "deals": deals,
        "retiring": retiring,
        "trending": trending,
    }


# ── Quick explore card auto-generation ──────────────────────────

_CARD_COLORS = {
    "green": "from-green-50 to-emerald-50 border-green-200 hover:border-green-300",
    "blue": "from-blue-50 to-sky-50 border-blue-200 hover:border-blue-300",
    "amber": "from-amber-50 to-yellow-50 border-amber-200 hover:border-amber-300",
    "purple": "from-purple-50 to-violet-50 border-purple-200 hover:border-purple-300",
    "orange": "from-orange-50 to-red-50 border-orange-200 hover:border-orange-300",
    "teal": "from-teal-50 to-cyan-50 border-teal-200 hover:border-teal-300",
    "rose": "from-rose-50 to-pink-50 border-rose-200 hover:border-rose-300",
    "zinc": "from-zinc-50 to-slate-50 border-zinc-200 hover:border-zinc-300",
}

_explore_cache_lock = threading.Lock()
_explore_cache: Dict[str, Any] = {"ts": 0.0, "val": None}
_EXPLORE_TTL = 3600  # 1 hour


def _generate_explore_cards(db: Session) -> List[Dict[str, str]]:
    """Auto-generate quick explore cards from DB statistics."""
    candidates: List[Dict[str, Any]] = []

    # --- Price candidates ---
    _active_statuses = ("available", "retiring_soon")
    for max_p, label in [(30, "Under $30"), (50, "Under $50"), (100, "Under $100")]:
        count = db.execute(
            select(func.count()).select_from(SetModel)
            .where(SetModel.retail_price > 0, SetModel.retail_price <= max_p,
                   SetModel.retirement_status.in_(_active_statuses))
        ).scalar_one()
        if count >= 10:
            candidates.append({
                "label": label, "href": f"/affordable?max={max_p}",
                "icon": "💰", "color": _CARD_COLORS["green"],
                "category": "price", "priority": 10, "count": count,
            })

    # --- Pieces candidates ---
    for min_p, label, icon in [
        (500, "500+ Pieces", "🧱"),
        (1000, "1000+ Pieces", "🏗️"),
        (2000, "2000+ Pieces", "🏰"),
    ]:
        count = db.execute(
            select(func.count()).select_from(SetModel)
            .where(SetModel.pieces >= min_p)
        ).scalar_one()
        if count >= 10:
            candidates.append({
                "label": label, "href": f"/big-builds?min={min_p}",
                "icon": icon, "color": _CARD_COLORS["blue"],
                "category": "pieces", "priority": 8, "count": count,
            })

    # --- Top Rated ---
    ratings = _ratings_map(db)
    top_rated_count = sum(1 for avg, cnt in ratings.values() if avg is not None and avg >= 4.0 and cnt >= 2)
    if top_rated_count >= 5:
        candidates.append({
            "label": "Top Rated", "href": "/top-rated",
            "icon": "⭐", "color": _CARD_COLORS["amber"],
            "category": "rating", "priority": 9, "count": top_rated_count,
        })

    # --- New this year ---
    current_year = datetime.now().year
    count_new = db.execute(
        select(func.count()).select_from(SetModel)
        .where(SetModel.year == current_year)
    ).scalar_one()
    if count_new >= 5:
        candidates.append({
            "label": f"New in {current_year}", "href": "/new",
            "icon": "🆕", "color": _CARD_COLORS["purple"],
            "category": "year", "priority": 7, "count": count_new,
        })

    # --- Retiring soon ---
    count_retiring = db.execute(
        select(func.count()).select_from(SetModel)
        .where(SetModel.retirement_status == "retiring_soon")
    ).scalar_one()
    if count_retiring >= 3:
        candidates.append({
            "label": "Retiring Soon", "href": "/retiring-soon",
            "icon": "⏰", "color": _CARD_COLORS["rose"],
            "category": "special", "priority": 7, "count": count_retiring,
        })

    # --- On Sale ---
    from ..models import Offer as OfferModel2
    best_offer_sq = (
        select(
            OfferModel2.set_num,
            func.min(OfferModel2.price).label("best_price"),
        )
        .where(OfferModel2.price > 0)
        .group_by(OfferModel2.set_num)
        .subquery()
    )
    deals_count = db.execute(
        select(func.count()).select_from(SetModel)
        .join(best_offer_sq, best_offer_sq.c.set_num == SetModel.set_num)
        .where(
            SetModel.retail_price.isnot(None),
            SetModel.retail_price > 0,
            best_offer_sq.c.best_price < SetModel.retail_price,
        )
    ).scalar_one()
    if deals_count >= 3:
        candidates.append({
            "label": "On Sale", "href": "/sale",
            "icon": "🏷️", "color": _CARD_COLORS["green"],
            "category": "deals", "priority": 8, "count": deals_count,
        })

    # --- Most Pieces page ---
    candidates.append({
        "label": "Most Pieces", "href": "/pieces/most",
        "icon": "🧩", "color": _CARD_COLORS["teal"],
        "category": "misc", "priority": 5, "count": 60,
    })

    # --- Select best 6 with diversity (max 1 per category) ---
    candidates.sort(key=lambda c: (c["priority"], math.log(max(c["count"], 1))), reverse=True)

    selected: List[Dict[str, str]] = []
    used_categories: Dict[str, int] = {}
    for c in candidates:
        cat = c["category"]
        if used_categories.get(cat, 0) >= 1:
            continue
        selected.append({
            "label": c["label"],
            "href": c["href"],
            "icon": c["icon"],
            "color": c["color"],
            "count": c["count"],
        })
        used_categories[cat] = used_categories.get(cat, 0) + 1
        if len(selected) >= 6:
            break

    return selected


def _get_cached_explore_cards(db: Session) -> List[Dict[str, str]]:
    now = time.monotonic()
    with _explore_cache_lock:
        if now - _explore_cache["ts"] < _EXPLORE_TTL and _explore_cache["val"] is not None:
            return _explore_cache["val"]

    cards = _generate_explore_cards(db)

    with _explore_cache_lock:
        _explore_cache["ts"] = time.monotonic()
        _explore_cache["val"] = cards
    return cards


@router.get("/discover-page-config")
def discover_page_config(db: Session = Depends(get_db)):
    """Return admin settings for the /discover page, with auto-generated cards fallback."""
    settings: Dict[str, Any] = {}
    rows = db.execute(
        select(AdminSetting).where(
            AdminSetting.key.in_(["discover_hidden_sections", "discover_section_config", "quick_explore_cards"])
        )
    ).scalars().all()

    for row in rows:
        settings[row.key] = row.value

    # If no admin override, auto-generate cards from data
    admin_cards = settings.get("quick_explore_cards")
    has_admin_cards = False
    if admin_cards:
        try:
            parsed = json.loads(admin_cards)
            has_admin_cards = isinstance(parsed, list) and len(parsed) > 0
        except (json.JSONDecodeError, TypeError):
            pass

    if not has_admin_cards:
        auto_cards = _get_cached_explore_cards(db)
        settings["quick_explore_cards"] = json.dumps(auto_cards)

    return settings


# ---------------------------------------------------------------------------
# Collection stats (public aggregate)
# ---------------------------------------------------------------------------

@router.get("/{set_num}/collection-stats")
def collection_stats(set_num: str, db: Session = Depends(get_db)):
    """Public aggregate counts: how many users own / wishlist / have this set in custom lists."""
    # Ensure we use the full set_num with suffix (e.g. "76456-1") to match ListItem.set_num
    full = set_num if "-" in set_num else f"{set_num}-1"

    def _count(system_key: Optional[str] = None, is_system: bool = True) -> int:
        q = (
            select(func.count(func.distinct(ListModel.owner_id)))
            .select_from(ListItemModel)
            .join(ListModel, ListModel.id == ListItemModel.list_id)
            .where(ListItemModel.set_num == full)
        )
        if is_system and system_key:
            q = q.where(ListModel.is_system.is_(True), ListModel.system_key == system_key)
        elif not is_system:
            q = q.where(ListModel.is_system.is_(False))
        return db.execute(q).scalar() or 0

    return {
        "owned_count": _count("owned"),
        "wishlist_count": _count("wishlist"),
        "custom_list_count": _count(is_system=False),
    }


@router.get("/{set_num}")
def get_set(
    set_num: str,
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_current_user_optional),
):
    s = get_set_by_num(set_num)
    if not s:
        raise HTTPException(status_code=404, detail="Set not found")

    canonical = s.get("set_num") or set_num
    plain = s.get("set_num_plain")

    avg, cnt = _rating_stats_for_set(db, canonical)
    review_cnt = _review_count_for_set(db, canonical)

    user_rating = None
    if current_user:
        user_rating = _user_rating_for_set(db, current_user.username, canonical, plain)

    out = dict(s)
    out["rating_avg"] = avg
    out["rating_count"] = cnt
    out["review_count"] = review_cnt
    out["user_rating"] = user_rating

    # Enrich with Brickset data from DB
    db_set = db.execute(
        select(SetModel).where(SetModel.set_num == canonical)
    ).scalar_one_or_none()
    if db_set:
        out["description"] = _short_description(db_set.description)
        out["subtheme"] = db_set.subtheme
        out["minifigs"] = db_set.minifigs
        out["age_min"] = db_set.age_min
        out["age_max"] = db_set.age_max
        out["dimensions"] = {
            "height": db_set.dimensions_height,
            "width": db_set.dimensions_width,
            "depth": db_set.dimensions_depth,
        } if any([db_set.dimensions_height, db_set.dimensions_width, db_set.dimensions_depth]) else None
        out["weight_kg"] = db_set.weight_kg
        out["launch_date"] = db_set.launch_date
        out["exit_date"] = db_set.exit_date
        out["retirement_status"] = db_set.retirement_status
        out["retirement_date"] = db_set.retirement_date
        out["retail_price"] = db_set.retail_price
        out["retail_currency"] = db_set.retail_currency
        out["set_tag"] = db_set.set_tag

    return out


# Public site stats (for home page)
# ---------------------------------------------------------------------------

@router.get("/site-stats")
def site_stats(db: Session = Depends(get_db)):
    """Lightweight public stats for the home page."""
    set_count = db.execute(select(func.count()).select_from(SetModel)).scalar() or 0
    user_count = db.execute(select(func.count()).select_from(UserModel)).scalar() or 0
    review_count = db.execute(select(func.count()).select_from(ReviewModel)).scalar() or 0
    return {
        "set_count": set_count,
        "user_count": user_count,
        "review_count": review_count,
    }



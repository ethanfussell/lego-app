# app/data/reviews_stats.py
from typing import List, Dict, Any, Tuple
from .reviews import REVIEWS

def rating_stats_for_set(set_num: str) -> Tuple[float, int]:
    rs: List[Dict[str, Any]] = [r for r in REVIEWS if r["set_num"] == set_num]
    if not rs:
        return (0.0, 0)
    total = sum(int(r["rating"]) for r in rs)
    count = len(rs)
    avg = round(total / count, 2)
    return (avg, count)  # ← exactly two values

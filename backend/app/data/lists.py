"""
Test/seed fixtures for Lists.

Tests import:
- from app.data.lists import LISTS
- from app.data import lists as lists_data
"""

from __future__ import annotations

from typing import Any, Dict, List

# Minimal shape most tests expect:
# title (str), description (str|None), is_public (bool), items (list[str set_num/plain])
LISTS: List[Dict[str, Any]] = []
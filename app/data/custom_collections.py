# app/data/collections.py
from typing import List, Dict, Any

# Simple in-memory stores. We'll replace with DB later.
OWNED: List[Dict[str, Any]] = []
WISHLIST: List[Dict[str, Any]] = []
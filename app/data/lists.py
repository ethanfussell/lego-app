# app/data/lists.py
from datetime import datetime

LISTS: list[dict] = []
# List shape
# {
#   "id": int,
#   "owner": str,
#   "name": str,
#   "description": str | None,
#   "is_public": bool
#   "created_at": datetime,
#   "updated_at": datetime,
#   "items": list[{
#       "set_num": str}]
#       "note": str | None,
#       "position": int,
#       "added_at": datetime
#   }]
# }
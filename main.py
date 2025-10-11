from fastapi import FastAPI
from typing import Optional

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Hello from your first API!"}

@app.get("/about")
def about():
    return {"creator": "Me", "app": "Learning FastAPI"}

# Our "database" for now (just a list)
SETS = [
    {"set_num": "10305", "name": "Lion Knights' Castle", "pieces": 4514, "theme": "Castle", "year": 2022},
    {"set_num": "21318", "name": "Tree House", "pieces": 3036, "theme": "Ideas",  "year": 2019},
    {"set_num": "75257", "name": "Millennium Falcon", "pieces": 1353, "theme": "Star Wars", "year": 2019},
]

@app.get("/sets")
def get_sets(q: Optional[str] = None):
    """
    q is an optional query parameter.
    If provided, we filter sets whose name contains q (case-insensitive).
    """
    items = SETS
    if q:
        q_lower = q.lower()
        items = [s for s in items if q_lower in s["name"].lower()]
    return items
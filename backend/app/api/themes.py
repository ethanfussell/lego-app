# backend/app/api/themes.py

from fastapi import APIRouter

router = APIRouter(
    prefix="/themes",
    tags=["themes"],
)

# For now we don't implement any real theme endpoints.
# Your frontend ThemesPage is using a hard-coded list of themes,
# so this router just exists so that `app.main` can include it
# without crashing. We can wire this up to the database later.
# app/core/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

router = APIRouter(tags=["auth"])

# ---------- Pydantic models ----------
class Token(BaseModel):
    access_token: str
    token_type: str

class User(BaseModel):
    id: int
    email: str
    username: str

# ---------- Fake user + token ----------
DEMO_USER = User(
    id=1,
    email="demo@example.com",
    username="demo",          # <--- username you'll type in Swagger
)
DEMO_PASSWORD = "password123" # <--- password you'll type in Swagger
DEMO_TOKEN = "lego-demo-token"

# ---------- OAuth2PasswordBearer ----------
# tokenUrl must match the *route path* of your login endpoint.
# Since we'll mount POST /auth/login, the full path is /auth/login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ---------- Routes ----------
@router.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Fake login:
    - username must be DEMO_USER.username
    - password must be DEMO_PASSWORD
    Returns a fixed bearer token.
    """
    if form_data.username != DEMO_USER.username or form_data.password != DEMO_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password",
        )

    return Token(access_token=DEMO_TOKEN, token_type="bearer")


@router.get("/auth/me", response_model=User)
async def read_me(current_user: "User" = Depends(lambda: get_current_user())):
    """
    Simple 'who am I' endpoint to verify auth.
    """
    return current_user


# ---------- Dependency used by other routers ----------
async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Extracts the Bearer token from the Authorization header,
    checks it against DEMO_TOKEN, and returns DEMO_USER if valid.
    """
    if token != DEMO_TOKEN:
        # FastAPI will also handle the 401 + WWW-Authenticate header correctly
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return DEMO_USER
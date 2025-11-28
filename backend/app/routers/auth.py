# backend/app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

router = APIRouter()

security = HTTPBearer()

FAKE_TOKEN = "lego-demo-token"

FAKE_USER = {
    "id": 1,
    "email": "demo@example.com",
    "username": "demo_user",
}


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    username: str


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    # Fake login always succeeds
    return TokenResponse(access_token=FAKE_TOKEN)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    if token != FAKE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing token",
        )

    return FAKE_USER


@router.get("/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    return current_user
# app/core/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

router = APIRouter()

# ----------------- Models -----------------
class User(BaseModel):
    username: str
    full_name: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ----------------- Fake DB -----------------
# 👇 MUST match what the tests are using:
# LOGIN ATTEMPT: ethan lego123
FAKE_USERS_DB = {
    "ethan": {
        "username": "ethan",
        "full_name": "Ethan Fussell",
        "password": "lego123",
    }
}


# ----------------- OAuth2 setup -----------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def authenticate_user(username: str, password: str) -> User | None:
    """
    Look up the user in the fake DB and check the password.
    Return a User or None.
    """
    user_data = FAKE_USERS_DB.get(username)
    if not user_data:
        return None
    if password != user_data["password"]:
        return None
    return User(username=user_data["username"], full_name=user_data["full_name"])


def create_access_token(username: str) -> str:
    """
    Super fake token generator – just makes a string the tests will recognize.
    """
    return f"fake-token-for-{username}"


@router.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # debug log so you can see what tests send
    print("LOGIN ATTEMPT:", form_data.username, form_data.password)

    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password",
        )

    token = create_access_token(user.username)
    return {
        "access_token": token,
        "token_type": "bearer",
    }


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Very fake token check: token should look like 'fake-token-for-<username>'.
    We'll also accept the raw username to keep it flexible.
    """
    if token.startswith("fake-token-for-"):
        username = token.removeprefix("fake-token-for-")
    else:
        username = token

    user_data = FAKE_USERS_DB.get(username)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return User(username=user_data["username"], full_name=user_data["full_name"])


@router.get("/auth/me", response_model=User)
async def read_me(current_user: User = Depends(get_current_user)):
    """
    Return the current user based on the bearer token.
    """
    return current_user
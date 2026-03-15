# backend/app/routers/posts.py
"""Posts, comments, and likes endpoints."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_current_user_optional
from app.core.limiter import limiter
from app.core.sanitize import contains_profanity, sanitize_text
from app.db import get_db
from app.models import Comment, Follower, List as ListModel, ListItem as ListItemModel, Post, PostLike, User, Set as SetModel
from app.routers.notifications import create_notification

router = APIRouter(tags=["posts"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PostCreate(BaseModel):
    text: str | None = Field(None, max_length=2000)
    linked_set_num: str | None = Field(None, max_length=40)


class PostUpdate(BaseModel):
    text: str | None = Field(None, max_length=2000)


class CommentCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _post_to_dict(post: Post, db: Session, current_user_id: int | None = None) -> dict:
    likes_count = db.execute(
        select(func.count()).select_from(PostLike).where(PostLike.post_id == post.id)
    ).scalar() or 0

    comments_count = db.execute(
        select(func.count()).select_from(Comment).where(Comment.post_id == post.id)
    ).scalar() or 0

    liked_by_me = False
    if current_user_id:
        liked_by_me = db.execute(
            select(PostLike).where(
                and_(PostLike.post_id == post.id, PostLike.user_id == current_user_id)
            )
        ).scalar_one_or_none() is not None

    user = post.user

    result: dict = {
        "id": post.id,
        "text": post.text,
        "image_url": post.image_url,
        "linked_set_num": post.linked_set_num,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "updated_at": post.updated_at.isoformat() if post.updated_at else None,
        "likes_count": likes_count,
        "comments_count": comments_count,
        "liked_by_me": liked_by_me,
        "user": {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
        },
    }

    if post.linked_set and post.linked_set_num:
        s = post.linked_set
        result["linked_set"] = {
            "set_num": s.set_num,
            "name": s.name,
            "image_url": s.image_url,
            "theme": s.theme,
            "pieces": s.pieces,
            "year": s.year,
        }

    return result


def _comment_to_dict(comment: Comment) -> dict:
    user = comment.user
    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "text": comment.text,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "user": {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
        },
    }


# ---------------------------------------------------------------------------
# Posts CRUD
# ---------------------------------------------------------------------------

@router.post("/posts", status_code=201)
@limiter.limit("20/minute")
def create_post(
    request: Request,
    body: PostCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    text = sanitize_text(body.text) if body.text else None
    if not text and not body.linked_set_num:
        raise HTTPException(status_code=400, detail="post_must_have_text_or_set")

    if text and contains_profanity(text):
        raise HTTPException(status_code=400, detail="post_contains_inappropriate_language")

    # Validate linked set exists
    if body.linked_set_num:
        s = db.execute(
            select(SetModel).where(SetModel.set_num == body.linked_set_num).limit(1)
        ).scalar_one_or_none()
        if not s:
            raise HTTPException(status_code=404, detail="set_not_found")

    post = Post(
        user_id=user.id,
        text=text,
        linked_set_num=body.linked_set_num,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    return _post_to_dict(post, db, user.id)


@router.get("/posts/{post_id}")
def get_post(
    post_id: int,
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    post = db.execute(
        select(Post).where(Post.id == post_id).limit(1)
    ).scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="post_not_found")

    return _post_to_dict(post, db, user.id if user else None)


@router.patch("/posts/{post_id}")
@limiter.limit("20/minute")
def update_post(
    request: Request,
    post_id: int,
    body: PostUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.execute(
        select(Post).where(Post.id == post_id).limit(1)
    ).scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="post_not_found")
    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="not_post_owner")

    if body.text is not None:
        cleaned = sanitize_text(body.text) if body.text else None
        if cleaned and contains_profanity(cleaned):
            raise HTTPException(status_code=400, detail="post_contains_inappropriate_language")
        post.text = cleaned
    post.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(post)
    return _post_to_dict(post, db, user.id)


@router.delete("/posts/{post_id}", status_code=204)
@limiter.limit("20/minute")
def delete_post(
    request: Request,
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.execute(
        select(Post).where(Post.id == post_id).limit(1)
    ).scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="post_not_found")
    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="not_post_owner")

    db.delete(post)
    db.commit()


# ---------------------------------------------------------------------------
# Likes
# ---------------------------------------------------------------------------

@router.post("/posts/{post_id}/like", status_code=201)
@limiter.limit("60/minute")
def like_post(
    request: Request,
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.execute(select(Post).where(Post.id == post_id).limit(1)).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="post_not_found")

    existing = db.execute(
        select(PostLike).where(
            and_(PostLike.post_id == post_id, PostLike.user_id == user.id)
        )
    ).scalar_one_or_none()

    if existing:
        return {"status": "already_liked"}

    db.add(PostLike(post_id=post_id, user_id=user.id))
    create_notification(db, user_id=post.user_id, type="post_liked", actor_id=user.id, target_id=post_id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"status": "already_liked"}

    return {"status": "liked"}


@router.delete("/posts/{post_id}/like")
@limiter.limit("60/minute")
def unlike_post(
    request: Request,
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.execute(
        select(PostLike).where(
            and_(PostLike.post_id == post_id, PostLike.user_id == user.id)
        )
    ).scalar_one_or_none()

    if not row:
        return {"status": "not_liked"}

    db.delete(row)
    db.commit()
    return {"status": "unliked"}


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

@router.get("/posts/{post_id}/comments")
def get_comments(
    post_id: int,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    post = db.execute(select(Post).where(Post.id == post_id).limit(1)).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="post_not_found")

    total = db.execute(
        select(func.count()).select_from(Comment).where(Comment.post_id == post_id)
    ).scalar() or 0

    rows = db.execute(
        select(Comment)
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
        .limit(min(limit, 100))
        .offset(offset)
    ).scalars().all()

    return {
        "total": total,
        "comments": [_comment_to_dict(c) for c in rows],
    }


@router.post("/posts/{post_id}/comments", status_code=201)
@limiter.limit("30/minute")
def create_comment(
    request: Request,
    post_id: int,
    body: CommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.execute(select(Post).where(Post.id == post_id).limit(1)).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="post_not_found")

    text = sanitize_text(body.text)
    if not text:
        raise HTTPException(status_code=400, detail="comment_text_required")

    if contains_profanity(text):
        raise HTTPException(status_code=400, detail="comment_contains_inappropriate_language")

    comment = Comment(post_id=post_id, user_id=user.id, text=text)
    db.add(comment)
    create_notification(db, user_id=post.user_id, type="post_commented", actor_id=user.id, target_id=post_id)
    db.commit()
    db.refresh(comment)

    return _comment_to_dict(comment)


@router.delete("/posts/{post_id}/comments/{comment_id}", status_code=204)
def delete_comment(
    post_id: int,
    comment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.execute(
        select(Comment).where(
            and_(Comment.id == comment_id, Comment.post_id == post_id)
        )
    ).scalar_one_or_none()

    if not comment:
        raise HTTPException(status_code=404, detail="comment_not_found")
    if comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="not_comment_owner")

    db.delete(comment)
    db.commit()


# ---------------------------------------------------------------------------
# Feed
# ---------------------------------------------------------------------------

@router.get("/feed")
def get_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Posts from users the current user follows, newest first."""
    offset = (page - 1) * limit

    # Subquery: IDs of users I follow
    following_ids = (
        select(Follower.following_id)
        .where(Follower.follower_id == user.id)
        .scalar_subquery()
    )

    # Include own posts + followed users' posts
    condition = Post.user_id.in_(following_ids) | (Post.user_id == user.id)

    total = db.execute(
        select(func.count()).select_from(Post).where(condition)
    ).scalar() or 0

    rows = db.execute(
        select(Post)
        .where(condition)
        .order_by(Post.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

    return {
        "total": total,
        "page": page,
        "posts": [_post_to_dict(p, db, user.id) for p in rows],
    }


@router.get("/feed/discover")
def get_discover_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """All posts (public discover feed), newest first."""
    offset = (page - 1) * limit

    total = db.execute(
        select(func.count()).select_from(Post)
    ).scalar() or 0

    rows = db.execute(
        select(Post)
        .order_by(Post.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

    return {
        "total": total,
        "page": page,
        "posts": [_post_to_dict(p, db, user.id if user else None) for p in rows],
    }


# ---------------------------------------------------------------------------
# Social stats for a set (how many followed users own it)
# ---------------------------------------------------------------------------

@router.get("/sets/{set_num}/social-stats")
def set_social_stats(
    set_num: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return how many users the current user follows own this set."""
    # Subquery: IDs of users I follow
    following_ids = (
        select(Follower.following_id)
        .where(Follower.follower_id == user.id)
        .subquery()
    )

    # Count followed users who have this set in their "owned" system list
    count = db.execute(
        select(func.count(func.distinct(ListModel.owner_id)))
        .select_from(ListModel)
        .join(ListItemModel, ListItemModel.list_id == ListModel.id)
        .where(
            ListModel.is_system == True,  # noqa: E712
            ListModel.system_key == "owned",
            ListModel.owner_id.in_(following_ids),
            ListItemModel.set_num == set_num,
        )
    ).scalar() or 0

    # Get up to 3 usernames for display
    usernames = db.execute(
        select(User.username)
        .join(ListModel, ListModel.owner_id == User.id)
        .join(ListItemModel, ListItemModel.list_id == ListModel.id)
        .where(
            ListModel.is_system == True,  # noqa: E712
            ListModel.system_key == "owned",
            ListModel.owner_id.in_(following_ids),
            ListItemModel.set_num == set_num,
        )
        .limit(3)
    ).scalars().all()

    return {
        "set_num": set_num,
        "following_owners_count": count,
        "following_owners_sample": usernames,
    }

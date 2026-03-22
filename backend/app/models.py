# backend/app/models.py
from __future__ import annotations

import json

from sqlalchemy import (
    Column,
    String,
    Integer,
    Text,
    DateTime,
    ForeignKey,
    Numeric,
    BigInteger,
    CheckConstraint,
    UniqueConstraint,
    Index,
    Boolean,
    Float,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .db import Base


class User(Base):
    __tablename__ = "users"

    # IMPORTANT for SQLite auto-increment:
    id = Column(Integer, primary_key=True, autoincrement=True)

    clerk_id = Column(String, unique=True, nullable=True, index=True)

    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=True, index=True)

    # Kept nullable for backwards compat; unused with Clerk auth
    password_hash = Column(String, nullable=True)

    is_admin = Column(Boolean, nullable=False, server_default="false")

    # Profile fields
    display_name = Column(String(100), nullable=True)
    bio = Column(String(500), nullable=True)
    avatar_url = Column(String, nullable=True)
    location = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    reviews = relationship(
        "Review",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    lists = relationship(
        "List",
        back_populates="owner",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Follower(Base):
    __tablename__ = "followers"

    follower_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    following_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    follower = relationship("User", foreign_keys=[follower_id])
    following = relationship("User", foreign_keys=[following_id])

    __table_args__ = (
        CheckConstraint("follower_id != following_id", name="followers_no_self_follow"),
        Index("idx_followers_follower_id", "follower_id"),
        Index("idx_followers_following_id", "following_id"),
    )


class Set(Base):
    __tablename__ = "sets"

    set_num = Column(String, primary_key=True)
    name = Column(String, nullable=False, index=True)
    year = Column(Integer)
    theme = Column(String, index=True)
    pieces = Column(Integer)
    image_url = Column(String)
    ip = Column(String, nullable=True, index=True)

    first_seen_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Price data
    retail_price = Column(Float, nullable=True)  # MSRP/RRP
    retail_currency = Column(String(8), nullable=True, server_default="USD")

    # Brickset enrichment data
    description = Column(String, nullable=True)
    subtheme = Column(String, nullable=True, index=True)
    minifigs = Column(Integer, nullable=True)
    age_min = Column(Integer, nullable=True)
    age_max = Column(Integer, nullable=True)
    dimensions_height = Column(Float, nullable=True)  # box height cm
    dimensions_width = Column(Float, nullable=True)   # box width cm
    dimensions_depth = Column(Float, nullable=True)   # box depth cm
    weight_kg = Column(Float, nullable=True)
    barcode_ean = Column(String, nullable=True)
    barcode_upc = Column(String, nullable=True)
    launch_date = Column(String, nullable=True)  # e.g. "2024-01-01"
    exit_date = Column(String, nullable=True)    # e.g. "2026-12-31"

    # Retirement tracking (populated via Brickset)
    retirement_status = Column(String, nullable=True)  # "coming_soon" | "available" | "retiring_soon" | "retired"
    retirement_date = Column(String, nullable=True)     # e.g. "2026-12"

    # True when the set appears on LEGO.com's coming-soon category page
    lego_com_coming_soon = Column(Boolean, nullable=False, server_default="false", default=False)

    # Custom tag (e.g. "GWP", "Insider Reward") — displayed instead of price
    set_tag = Column(String, nullable=True)

    # Admin overrides — tracks which fields were manually set by an admin.
    # JSON array of field names, e.g. '["image_url", "launch_date"]'
    admin_locked_fields = Column(Text, nullable=True)

    reviews = relationship(
        "Review",
        back_populates="set",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    set_num = Column(String, ForeignKey("sets.set_num", ondelete="CASCADE"), nullable=False, index=True)

    rating = Column(Numeric(2, 1), nullable=True)
    text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="reviews")
    set = relationship("Set", back_populates="reviews")
    votes = relationship(
        "ReviewVote",
        back_populates="review",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "set_num", name="reviews_user_set_unique"),
        CheckConstraint("rating IS NULL OR (rating >= 0.5 AND rating <= 5.0)", name="reviews_rating_check"),
        Index("idx_reviews_set_num", "set_num"),
        Index("idx_reviews_user_set_num", "user_id", "set_num"),
        Index("idx_reviews_created_at", "created_at"),
    )



class ReviewVote(Base):
    __tablename__ = "review_votes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    review_id = Column(Integer, ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    vote_type = Column(String, nullable=False)  # "up" or "down"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    review = relationship("Review", back_populates="votes")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("review_id", "user_id", name="review_votes_review_user_unique"),
        CheckConstraint("vote_type IN ('up', 'down')", name="review_votes_type_check"),
    )


class List(Base):
    __tablename__ = "lists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_public = Column(Boolean, nullable=False, server_default="true")

    position = Column(Integer, nullable=False, server_default="0")

    is_system = Column(Boolean, nullable=False, server_default="false")
    system_key = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    owner = relationship("User", back_populates="lists")

    items = relationship(
        "ListItem",
        back_populates="list",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_lists_owner_position", "owner_id", "position"),
        Index("idx_lists_owner_system_key", "owner_id", "is_system", "system_key"),
    )


class ListItem(Base):
    __tablename__ = "list_items"

    list_id = Column(Integer, ForeignKey("lists.id", ondelete="CASCADE"), primary_key=True)
    set_num = Column(String, ForeignKey("sets.set_num", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    position = Column(Integer, nullable=True)
    
    list = relationship("List", back_populates="items")
    set = relationship("Set")

    __table_args__ = (
        Index("idx_list_items_list_id", "list_id"),
        Index("idx_list_items_set_num", "set_num"),
    )

class EmailSignup(Base):
    __tablename__ = "email_signups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, nullable=False, unique=True, index=True)
    source = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class AffiliateClick(Base):
    __tablename__ = "affiliate_clicks"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Optional user (if logged in)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    set_num = Column(String, nullable=False, index=True)
    store = Column(String, nullable=False, index=True)

    price = Column(Float, nullable=True)
    currency = Column(String(8), nullable=True)

    offer_rank = Column(Integer, nullable=True)

    page_path = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    set_num = Column(String, nullable=False, index=True)
    store = Column(String, nullable=False)
    price = Column(Float, nullable=True)  # Null for affiliate-only links without price data
    currency = Column(String(8), nullable=False, server_default="USD")
    url = Column(String, nullable=False)
    in_stock = Column(Boolean, nullable=True)  # True / False / None (unknown)
    asin = Column(String, nullable=True)  # Amazon Standard Identification Number
    last_checked = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String, nullable=False)  # "review" or "list"
    target_id = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)  # "spam", "offensive", "inappropriate", "other"
    notes = Column(Text, nullable=True)
    status = Column(String, nullable=False, server_default="pending")  # "pending", "resolved", "dismissed"
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    reporter = relationship("User")

    __table_args__ = (
        UniqueConstraint("reporter_id", "target_type", "target_id", name="reports_reporter_target_unique"),
        CheckConstraint("target_type IN ('review', 'list')", name="reports_target_type_check"),
        CheckConstraint("reason IN ('spam', 'offensive', 'inappropriate', 'other')", name="reports_reason_check"),
        CheckConstraint("status IN ('pending', 'resolved', 'dismissed')", name="reports_status_check"),
    )


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pipeline_name = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False)  # "running", "success", "failed"
    stats_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class DealAlert(Base):
    __tablename__ = "deal_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    set_num = Column(String, nullable=False, index=True)
    alert_type = Column(String, nullable=False)  # "price_drop" or "retiring"
    active = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("user_id", "set_num", "alert_type", name="deal_alerts_user_set_type_unique"),
        CheckConstraint("alert_type IN ('price_drop', 'retiring')", name="deal_alerts_type_check"),
    )


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    linked_set_num = Column(String, ForeignKey("sets.set_num", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
    linked_set = relationship("Set")
    comments = relationship(
        "Comment",
        back_populates="post",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    likes = relationship(
        "PostLike",
        back_populates="post",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_posts_user_id", "user_id"),
        Index("idx_posts_created_at", "created_at"),
    )


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    post = relationship("Post", back_populates="comments")
    user = relationship("User")

    __table_args__ = (
        Index("idx_comments_post_id", "post_id"),
    )


class PostLike(Base):
    __tablename__ = "post_likes"

    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    post = relationship("Post", back_populates="likes")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="post_likes_post_user_unique"),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False)  # "new_follower", "post_liked", "post_commented"
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    target_id = Column(Integer, nullable=True)  # post_id, comment_id, etc.
    read = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    actor = relationship("User", foreign_keys=[actor_id])

    __table_args__ = (
        CheckConstraint(
            "type IN ('new_follower', 'post_liked', 'post_commented', 'review_voted')",
            name="notifications_type_check",
        ),
        Index("idx_notifications_user_read", "user_id", "read"),
        Index("idx_notifications_created_at", "created_at"),
    )


class AdminSetting(Base):
    """Key-value store for admin site settings (spotlight, featured themes, etc.)."""
    __tablename__ = "admin_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by = Column(String, nullable=True)  # admin username


# ---------------------------------------------------------------------------
# Helpers for admin_locked_fields on Set
# ---------------------------------------------------------------------------

def get_locked_fields(set_row: Set) -> list[str]:
    """Parse the admin_locked_fields JSON array from a Set row."""
    raw = set_row.admin_locked_fields
    if not raw:
        return []
    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def add_locked_fields(set_row: Set, fields: list[str]) -> None:
    """Add field names to the locked list (deduplicated)."""
    current = set(get_locked_fields(set_row))
    current.update(fields)
    set_row.admin_locked_fields = json.dumps(sorted(current))


def remove_locked_fields(set_row: Set, fields: list[str]) -> None:
    """Remove field names from the locked list."""
    current = set(get_locked_fields(set_row))
    current -= set(fields)
    set_row.admin_locked_fields = json.dumps(sorted(current)) if current else None
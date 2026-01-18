# backend/app/models.py
from __future__ import annotations

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
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .db import Base


class User(Base):
    __tablename__ = "users"

    # IMPORTANT for SQLite auto-increment:
    id = Column(Integer, primary_key=True, autoincrement=True)

    username = Column(String, unique=True, nullable=False, index=True)

    # tests create users with password_hash=None, and your fake login doesn’t need it
    password_hash = Column(String, nullable=True)

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


class Set(Base):
    __tablename__ = "sets"

    set_num = Column(String, primary_key=True)
    name = Column(String, nullable=False, index=True)
    year = Column(Integer)
    theme = Column(String, index=True)
    pieces = Column(Integer)
    image_url = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


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

    __table_args__ = (
        UniqueConstraint("user_id", "set_num", name="reviews_user_set_unique"),
        CheckConstraint("rating IS NULL OR (rating >= 0.5 AND rating <= 5.0)", name="reviews_rating_check"),
        Index("idx_reviews_set_num", "set_num"),
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
# backend/app/models.py
from sqlalchemy import (
    Column, String, Integer, Text, BigInteger, ForeignKey, CheckConstraint,
    UniqueConstraint, Numeric
)
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.sql import func
from .db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(BigInteger, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

class Set(Base):
    __tablename__ = "sets"
    set_num = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    year = Column(Integer)
    theme = Column(String)
    pieces = Column(Integer)
    image_url = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

class Collection(Base):
    __tablename__ = "collections"
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    set_num = Column(String, ForeignKey("sets.set_num", ondelete="CASCADE"), primary_key=True)
    type = Column(String, primary_key=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("type in ('owned','wishlist')", name="collections_type_check"),
    )

class Review(Base):
    __tablename__ = "reviews"
    id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    set_num = Column(String, ForeignKey("sets.set_num", ondelete="CASCADE"), nullable=False)
    rating = Column(Numeric(2, 1))
    text = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "set_num", name="reviews_user_set_unique"),
        CheckConstraint("(rating is null) or (rating >= 0.5 and rating <= 5.0)", name="reviews_rating_check"),
    )
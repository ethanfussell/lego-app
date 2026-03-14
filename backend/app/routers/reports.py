# backend/app/routers/reports.py
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_admin_user
from app.core.sanitize import sanitize_text
from app.core.limiter import limiter
from app.db import get_db
from app.models import Report as ReportModel, User as UserModel, Review as ReviewModel, List as ListModel

router = APIRouter(tags=["reports"])


# ---- Schemas ----

class ReportCreate(BaseModel):
    target_type: str
    target_id: int
    reason: str
    notes: Optional[str] = Field(default=None, max_length=200)

    @field_validator("notes", mode="before")
    @classmethod
    def sanitize_notes(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return sanitize_text(v) or None

    @field_validator("target_type")
    @classmethod
    def validate_target_type(cls, v: str) -> str:
        if v not in ("review", "list"):
            raise ValueError("target_type must be 'review' or 'list'")
        return v

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if v not in ("spam", "offensive", "inappropriate", "other"):
            raise ValueError("reason must be 'spam', 'offensive', 'inappropriate', or 'other'")
        return v


class ReportUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("resolved", "dismissed"):
            raise ValueError("status must be 'resolved' or 'dismissed'")
        return v


# ---- Endpoints ----

@router.post("/reports", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
def create_report(
    request: Request,
    payload: ReportCreate = Body(...),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Submit a report on a review or list."""
    # Verify target exists
    if payload.target_type == "review":
        target = db.execute(
            select(ReviewModel).where(ReviewModel.id == payload.target_id)
        ).scalar_one_or_none()
        if target is None:
            raise HTTPException(status_code=404, detail="review_not_found")
        # Don't allow reporting your own review
        if target.user_id == current_user.id:
            raise HTTPException(status_code=400, detail="cannot_report_own_content")
    elif payload.target_type == "list":
        target = db.execute(
            select(ListModel).where(ListModel.id == payload.target_id)
        ).scalar_one_or_none()
        if target is None:
            raise HTTPException(status_code=404, detail="list_not_found")
        if target.owner_id == current_user.id:
            raise HTTPException(status_code=400, detail="cannot_report_own_content")

    report = ReportModel(
        reporter_id=current_user.id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        reason=payload.reason,
        notes=payload.notes,
    )
    db.add(report)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="already_reported")

    db.refresh(report)
    return {
        "id": report.id,
        "target_type": report.target_type,
        "target_id": report.target_id,
        "reason": report.reason,
        "status": report.status,
        "created_at": report.created_at,
    }


@router.get("/admin/reports")
def list_reports(
    request: Request,
    report_status: Literal["pending", "resolved", "dismissed"] = "pending",
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    admin: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """List reports for admin moderation."""
    query = (
        select(ReportModel, UserModel.username)
        .join(ReportModel.reporter)
        .where(ReportModel.status == report_status)
        .order_by(ReportModel.created_at.desc())
        .offset(int(offset))
        .limit(int(limit))
    )
    rows = db.execute(query).all()

    # Batch-fetch target snippets
    review_ids = [r.target_id for r, _ in rows if r.target_type == "review"]
    list_ids = [r.target_id for r, _ in rows if r.target_type == "list"]

    review_snippets: Dict[int, str] = {}
    if review_ids:
        review_rows = db.execute(
            select(ReviewModel.id, ReviewModel.text).where(ReviewModel.id.in_(review_ids))
        ).all()
        for rid, text in review_rows:
            review_snippets[rid] = (text or "")[:80]

    list_snippets: Dict[int, str] = {}
    if list_ids:
        list_rows = db.execute(
            select(ListModel.id, ListModel.title).where(ListModel.id.in_(list_ids))
        ).all()
        for lid, title in list_rows:
            list_snippets[lid] = (title or "")[:80]

    # Count total pending
    total = db.execute(
        select(func.count()).select_from(ReportModel).where(ReportModel.status == report_status)
    ).scalar_one()

    result: List[Dict[str, Any]] = []
    for report, reporter_username in rows:
        snippet = ""
        if report.target_type == "review":
            snippet = review_snippets.get(report.target_id, "[deleted]")
        elif report.target_type == "list":
            snippet = list_snippets.get(report.target_id, "[deleted]")

        result.append({
            "id": report.id,
            "reporter": reporter_username,
            "target_type": report.target_type,
            "target_id": report.target_id,
            "target_snippet": snippet,
            "reason": report.reason,
            "notes": report.notes,
            "status": report.status,
            "created_at": report.created_at,
        })

    return result


@router.patch("/admin/reports/{report_id}")
def update_report(
    report_id: int,
    payload: ReportUpdate,
    admin: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Resolve or dismiss a report."""
    report = db.execute(
        select(ReportModel).where(ReportModel.id == report_id)
    ).scalar_one_or_none()

    if report is None:
        raise HTTPException(status_code=404, detail="report_not_found")

    report.status = payload.status
    report.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(report)

    return {
        "id": report.id,
        "status": report.status,
        "resolved_at": report.resolved_at,
    }

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import UUID
from contextlib import suppress

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select, or_, and_

from app.db.database import SessionLocal
from app.models.models import Lead
from app.schemas.lead import LeadOut

router = APIRouter()


def _fetch_new_leads(last_seen_created_at: datetime, last_seen_id: UUID):
    db = SessionLocal()
    try:
        condition = or_(
            Lead.created_at > last_seen_created_at,
            and_(Lead.created_at == last_seen_created_at, Lead.id > last_seen_id),
        )

        rows = db.execute(
            select(Lead)
            .where(condition)
            .order_by(Lead.created_at.asc(), Lead.id.asc())
        ).scalars().all()

        payloads = []
        for lead in rows:
            payloads.append(
                {
                    "event": "new_lead",
                    "data": LeadOut.model_validate(lead).model_dump(mode="json"),
                }
            )

        if rows:
            last_lead = rows[-1]
            last_seen_created_at = last_lead.created_at or last_seen_created_at
            last_seen_id = last_lead.id

        return payloads, last_seen_created_at, last_seen_id
    finally:
        db.close()


@router.websocket("/ws/leads/live")
async def live_leads(websocket: WebSocket):
    await websocket.accept()
    last_seen_created_at = datetime.now(timezone.utc)
    last_seen_id: UUID = UUID(int=0)

    try:
        while True:
            payloads, last_seen_created_at, last_seen_id = await asyncio.to_thread(
                _fetch_new_leads,
                last_seen_created_at,
                last_seen_id,
            )

            for payload in payloads:
                await websocket.send_json(payload)

            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    except Exception:
        with suppress(Exception):
            await websocket.close(code=1011)
        raise
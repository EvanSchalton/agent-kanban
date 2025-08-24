from typing import Optional

from sqlmodel import Session

from app.models import TicketHistory


def record_ticket_change(
    session: Session,
    ticket_id: int,
    field_name: str,
    old_value: Optional[str],
    new_value: Optional[str],
    changed_by: str,
):
    history = TicketHistory(
        ticket_id=ticket_id,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        changed_by=changed_by,
    )
    session.add(history)
    session.commit()

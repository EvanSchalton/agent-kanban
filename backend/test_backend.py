#!/usr/bin/env python3
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))


from app.core import create_db_and_tables, get_session
from app.models import Board, Comment, Ticket


def test_database():
    print("Testing database setup...")

    create_db_and_tables()
    print("✓ Database tables created")

    with next(get_session()) as session:
        board = Board(name="Test Board")
        session.add(board)
        session.commit()
        session.refresh(board)
        print(f"✓ Created board: {board.name} (ID: {board.id})")

        ticket = Ticket(
            title="Test Task", description="This is a test task", board_id=board.id, priority="1.0"
        )
        session.add(ticket)
        session.commit()
        session.refresh(ticket)
        print(f"✓ Created ticket: {ticket.title} (ID: {ticket.id})")

        comment = Comment(ticket_id=ticket.id, text="Test comment", author="test_user")
        session.add(comment)
        session.commit()
        print(f"✓ Created comment for ticket {ticket.id}")

    print("\n✅ All database tests passed!")


if __name__ == "__main__":
    test_database()

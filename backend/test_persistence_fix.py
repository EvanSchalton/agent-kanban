#!/usr/bin/env python3
"""Test script to verify database persistence fixes"""

import sys
from datetime import datetime

sys.path.insert(0, "/workspaces/agent-kanban/backend")

from sqlmodel import select

from app.core.database import get_session
from app.models import Board, Comment, Ticket


def test_persistence():
    """Test that changes persist to the database"""

    print("=" * 60)
    print("TESTING DATABASE PERSISTENCE FIXES")
    print("=" * 60)

    # Test 1: Create a ticket
    print("\n1. Creating test ticket...")
    with next(get_session()) as session:
        # Ensure we have a board
        board = session.exec(select(Board).limit(1)).first()
        if not board:
            board = Board(name="Test Board", columns="todo,in_progress,done")
            session.add(board)
            session.commit()
            session.refresh(board)
            print(f"   Created test board: {board.name}")

        test_ticket = Ticket(
            title=f"Test Persistence {datetime.now().isoformat()}",
            description="Testing database persistence",
            priority="high",
            current_column="todo",
            board_id=board.id,
        )
        session.add(test_ticket)
        session.commit()
        session.refresh(test_ticket)
        ticket_id = test_ticket.id
        print(f"   ✓ Created ticket ID: {ticket_id}")

    # Test 2: Verify ticket exists in new session
    print("\n2. Verifying ticket persists in new session...")
    with next(get_session()) as session:
        retrieved_ticket = session.get(Ticket, ticket_id)
        if retrieved_ticket:
            print(f"   ✓ Ticket found: {retrieved_ticket.title}")
        else:
            print(f"   ✗ ERROR: Ticket {ticket_id} not found!")
            return False

    # Test 3: Update the ticket
    print("\n3. Updating ticket...")
    with next(get_session()) as session:
        ticket = session.get(Ticket, ticket_id)
        if ticket:
            original_column = ticket.current_column
            ticket.current_column = "in_progress"
            ticket.assignee = "test_bot"
            session.add(ticket)
            session.commit()
            print(f"   ✓ Updated ticket - moved from {original_column} to {ticket.current_column}")
        else:
            print("   ✗ ERROR: Could not find ticket to update!")
            return False

    # Test 4: Verify update persisted
    print("\n4. Verifying update persisted...")
    with next(get_session()) as session:
        ticket = session.get(Ticket, ticket_id)
        if ticket and ticket.current_column == "in_progress" and ticket.assignee == "test_bot":
            print(
                f"   ✓ Update persisted: column={ticket.current_column}, assignee={ticket.assignee}"
            )
        else:
            print("   ✗ ERROR: Update did not persist!")
            return False

    # Test 5: Add a comment
    print("\n5. Adding comment to ticket...")
    with next(get_session()) as session:
        comment = Comment(
            ticket_id=ticket_id, text="Test comment for persistence", author="test_bot"
        )
        session.add(comment)
        session.commit()
        session.refresh(comment)
        comment_id = comment.id
        print(f"   ✓ Created comment ID: {comment_id}")

    # Test 6: Verify comment exists
    print("\n6. Verifying comment persisted...")
    with next(get_session()) as session:
        comment = session.get(Comment, comment_id)
        if comment and comment.ticket_id == ticket_id:
            print(f"   ✓ Comment found: {comment.text}")
        else:
            print("   ✗ ERROR: Comment not found!")
            return False

    # Test 7: Check foreign key constraint
    print("\n7. Testing foreign key constraint...")
    with next(get_session()) as session:
        try:
            # Try to create a comment with invalid ticket_id
            bad_comment = Comment(
                ticket_id=999999,
                text="This should fail",
                author="test_bot",  # Non-existent ticket
            )
            session.add(bad_comment)
            session.commit()
            print("   ✗ ERROR: Foreign key constraint not working!")
            return False
        except Exception as e:
            print(f"   ✓ Foreign key constraint working: {type(e).__name__}")

    # Test 8: Clean up test data
    print("\n8. Cleaning up test data...")
    with next(get_session()) as session:
        # Delete comment first (foreign key)
        comment = session.get(Comment, comment_id)
        if comment:
            session.delete(comment)

        # Delete ticket
        ticket = session.get(Ticket, ticket_id)
        if ticket:
            session.delete(ticket)

        session.commit()
        print("   ✓ Test data cleaned up")

    print("\n" + "=" * 60)
    print("✅ ALL PERSISTENCE TESTS PASSED!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    try:
        success = test_persistence()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ TEST FAILED WITH ERROR: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)

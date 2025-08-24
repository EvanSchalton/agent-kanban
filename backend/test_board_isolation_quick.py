#!/usr/bin/env python3
"""
Quick test to verify board isolation is working.
"""

import asyncio

import httpx


async def test_board_isolation():
    async with httpx.AsyncClient(base_url="http://localhost:18000") as client:
        # Test board 1 tickets
        r1 = await client.get("/api/boards/1/tickets")
        data1 = r1.json()
        print(f"Board 1 has {len(data1['tickets'])} tickets")
        print(f"Board ID in response: {data1.get('board_id')}")

        # Check first few tickets
        for ticket in data1["tickets"][:3]:
            print(
                f"  - Ticket {ticket['id']}: board_id={ticket.get('board_id')}, title={ticket['title'][:30]}"
            )

        print()

        # Test board 2 tickets
        r2 = await client.get("/api/boards/2/tickets")
        data2 = r2.json()
        print(f"Board 2 has {len(data2['tickets'])} tickets")
        print(f"Board ID in response: {data2.get('board_id')}")

        # Check first few tickets
        for ticket in data2["tickets"][:3]:
            print(
                f"  - Ticket {ticket['id']}: board_id={ticket.get('board_id')}, title={ticket['title'][:30]}"
            )

        print()

        # Check for cross-contamination
        board1_ticket_ids = set(t["id"] for t in data1["tickets"])
        board2_ticket_ids = set(t["id"] for t in data2["tickets"])

        overlap = board1_ticket_ids.intersection(board2_ticket_ids)
        if overlap:
            print(f"❌ WARNING: Found {len(overlap)} tickets appearing in both boards: {overlap}")
        else:
            print("✅ No ticket overlap between boards - isolation working!")

        # Check board_id consistency
        board1_wrong = [t for t in data1["tickets"] if t.get("board_id") != 1]
        board2_wrong = [t for t in data2["tickets"] if t.get("board_id") != 2]

        if board1_wrong:
            print(f"❌ ERROR: Board 1 has {len(board1_wrong)} tickets with wrong board_id")
            for t in board1_wrong[:3]:
                print(f"    - Ticket {t['id']} has board_id={t.get('board_id')}")
        if board2_wrong:
            print(f"❌ ERROR: Board 2 has {len(board2_wrong)} tickets with wrong board_id")
            for t in board2_wrong[:3]:
                print(f"    - Ticket {t['id']} has board_id={t.get('board_id')}")

        if not board1_wrong and not board2_wrong:
            print("✅ All tickets have correct board_id")

        # Test creating a ticket with specific board_id
        print("\nTesting ticket creation:")
        create_response = await client.post(
            "/api/tickets/",
            json={
                "title": "Board Isolation Test Ticket",
                "description": "Testing that this ticket goes to board 2 only",
                "board_id": 2,
                "current_column": "Backlog",
            },
        )

        if create_response.status_code == 201:
            created_ticket = create_response.json()
            print(
                f"✅ Created ticket {created_ticket['id']} with board_id={created_ticket.get('board_id')}"
            )

            # Verify it appears in board 2
            r2_after = await client.get("/api/boards/2/tickets")
            data2_after = r2_after.json()
            if any(t["id"] == created_ticket["id"] for t in data2_after["tickets"]):
                print("✅ Ticket appears in board 2")
            else:
                print("❌ Ticket does NOT appear in board 2")

            # Verify it does NOT appear in board 1
            r1_after = await client.get("/api/boards/1/tickets")
            data1_after = r1_after.json()
            if any(t["id"] == created_ticket["id"] for t in data1_after["tickets"]):
                print("❌ ERROR: Ticket incorrectly appears in board 1!")
            else:
                print("✅ Ticket correctly absent from board 1")

            # Clean up
            await client.delete(f"/api/tickets/{created_ticket['id']}")
        else:
            print(f"❌ Failed to create ticket: {create_response.status_code}")


if __name__ == "__main__":
    asyncio.run(test_board_isolation())

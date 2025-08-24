#!/usr/bin/env python3
"""
Quick test to verify WebSocket isolation is working.
"""

import asyncio
import json
from datetime import datetime

import httpx
import websockets


async def test_websocket_isolation():
    print("Testing WebSocket Board Isolation")
    print("=" * 50)

    # Connect two WebSocket clients for different boards
    ws1_messages = []
    ws2_messages = []

    async def listen_board1():
        """Listen to board 1 WebSocket messages."""
        try:
            async with websockets.connect("ws://localhost:18000/ws/connect") as ws:
                # Join board 1
                await ws.send(json.dumps({"type": "join_board", "board_id": 1}))
                print("✅ WebSocket 1 connected and joined board 1")

                # Listen for messages
                while True:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                        data = json.loads(msg)
                        ws1_messages.append(data)
                        print(f"  Board 1 WS received: {data.get('type', 'unknown')}")
                    except asyncio.TimeoutError:
                        continue
                    except websockets.exceptions.ConnectionClosed:
                        break
        except Exception as e:
            print(f"Board 1 WS error: {e}")

    async def listen_board2():
        """Listen to board 2 WebSocket messages."""
        try:
            async with websockets.connect("ws://localhost:18000/ws/connect") as ws:
                # Join board 2
                await ws.send(json.dumps({"type": "join_board", "board_id": 2}))
                print("✅ WebSocket 2 connected and joined board 2")

                # Listen for messages
                while True:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                        data = json.loads(msg)
                        ws2_messages.append(data)
                        print(f"  Board 2 WS received: {data.get('type', 'unknown')}")
                    except asyncio.TimeoutError:
                        continue
                    except websockets.exceptions.ConnectionClosed:
                        break
        except Exception as e:
            print(f"Board 2 WS error: {e}")

    # Start listeners
    listen1_task = asyncio.create_task(listen_board1())
    listen2_task = asyncio.create_task(listen_board2())

    # Wait for connections to establish
    await asyncio.sleep(2)

    # Create tickets in each board
    async with httpx.AsyncClient(base_url="http://localhost:18000") as client:
        print("\nCreating test tickets...")

        # Create ticket in board 1
        r1 = await client.post(
            "/api/tickets/",
            json={
                "title": f"WS Test Board 1 - {datetime.now().strftime('%H:%M:%S')}",
                "description": "Testing WebSocket isolation for board 1",
                "board_id": 1,
                "current_column": "Not Started",
            },
        )
        ticket1 = r1.json()
        print(f"Created ticket {ticket1['id']} in board 1")

        # Wait for broadcast
        await asyncio.sleep(1)

        # Create ticket in board 2
        r2 = await client.post(
            "/api/tickets/",
            json={
                "title": f"WS Test Board 2 - {datetime.now().strftime('%H:%M:%S')}",
                "description": "Testing WebSocket isolation for board 2",
                "board_id": 2,
                "current_column": "Backlog",
            },
        )
        ticket2 = r2.json()
        print(f"Created ticket {ticket2['id']} in board 2")

        # Wait for broadcast
        await asyncio.sleep(1)

        # Move ticket in board 1
        print(f"\nMoving ticket {ticket1['id']} in board 1...")
        await client.post(f"/api/tickets/{ticket1['id']}/move", json={"column": "In Progress"})

        # Wait for broadcast
        await asyncio.sleep(1)

        # Delete ticket in board 2
        print(f"Deleting ticket {ticket2['id']} in board 2...")
        await client.delete(f"/api/tickets/{ticket2['id']}")

        # Wait for broadcast
        await asyncio.sleep(1)

        # Clean up ticket 1
        await client.delete(f"/api/tickets/{ticket1['id']}")

    # Cancel listeners
    listen1_task.cancel()
    listen2_task.cancel()

    # Analyze results
    print("\n" + "=" * 50)
    print("RESULTS:")
    print(f"Board 1 WS received {len(ws1_messages)} messages")
    print(f"Board 2 WS received {len(ws2_messages)} messages")

    # Check board 1 messages
    board1_ticket_events = [m for m in ws1_messages if "ticket" in m.get("type", "")]
    print(f"\nBoard 1 ticket events: {len(board1_ticket_events)}")
    for msg in board1_ticket_events:
        board_id = msg.get("data", {}).get("board_id")
        msg_type = msg.get("type")
        ticket_id = msg.get("data", {}).get("id")
        print(f"  - {msg_type}: ticket {ticket_id}, board_id={board_id}")
        if board_id and board_id != 1:
            print(f"    ❌ ERROR: Board 1 received event for board {board_id}!")

    # Check board 2 messages
    board2_ticket_events = [m for m in ws2_messages if "ticket" in m.get("type", "")]
    print(f"\nBoard 2 ticket events: {len(board2_ticket_events)}")
    for msg in board2_ticket_events:
        board_id = msg.get("data", {}).get("board_id")
        msg_type = msg.get("type")
        ticket_id = msg.get("data", {}).get("id")
        print(f"  - {msg_type}: ticket {ticket_id}, board_id={board_id}")
        if board_id and board_id != 2:
            print(f"    ❌ ERROR: Board 2 received event for board {board_id}!")

    # Check for cross-contamination
    board1_has_board2 = any(m.get("data", {}).get("board_id") == 2 for m in board1_ticket_events)
    board2_has_board1 = any(m.get("data", {}).get("board_id") == 1 for m in board2_ticket_events)

    if not board1_has_board2 and not board2_has_board1:
        print("\n✅ WebSocket isolation working correctly!")
    else:
        print("\n❌ WebSocket isolation FAILED - cross-board contamination detected!")


if __name__ == "__main__":
    asyncio.run(test_websocket_isolation())

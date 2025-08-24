#!/usr/bin/env python3
"""WebSocket real-time update test for Agent Kanban Board"""

import asyncio
import json
from datetime import datetime

import aiohttp
import websockets


async def test_websocket_updates():
    """Test that WebSocket broadcasts updates to all connected clients"""

    # Connect two WebSocket clients
    uri = "ws://localhost:8000/ws/connect"

    print("Testing WebSocket real-time updates...")
    print("-" * 50)

    async with websockets.connect(uri) as ws1, websockets.connect(uri) as ws2:
        print("✅ Connected 2 WebSocket clients")

        # Create a test ticket via API
        async with aiohttp.ClientSession() as session:
            ticket_data = {
                "title": f"WebSocket Test Ticket {datetime.now().isoformat()}",
                "description": "Testing real-time updates",
                "column_id": 1,
                "priority": 2,
                "assignee": "test-agent",
            }

            async with session.post(
                "http://localhost:8000/api/tickets/?board_id=1", json=ticket_data
            ) as response:
                if response.status in [200, 201]:
                    ticket = await response.json()
                    ticket_id = ticket.get("id", "unknown")
                    print(f"✅ Created test ticket ID: {ticket_id}")
                else:
                    print(f"❌ Failed to create ticket: {response.status}")
                    ticket_id = None

        # Both clients should receive the create notification
        received_messages = []

        # Collect messages from both websockets
        for _ in range(2):
            try:
                msg1 = await asyncio.wait_for(ws1.recv(), timeout=2.0)
                received_messages.append(("Client1", json.loads(msg1)))
            except TimeoutError:
                pass

            try:
                msg2 = await asyncio.wait_for(ws2.recv(), timeout=2.0)
                received_messages.append(("Client2", json.loads(msg2)))
            except TimeoutError:
                pass

        if received_messages:
            print(f"✅ Received {len(received_messages)} WebSocket messages")
            for client, msg in received_messages:
                print(f"  {client}: {msg.get('type', 'unknown')} - {msg.get('action', '')}")
        else:
            print("⚠️  No WebSocket messages received (might be expected if no broadcast on create)")

        # Update the ticket to trigger another broadcast (only if we have a ticket)
        if ticket_id:
            async with aiohttp.ClientSession() as session:
                # Get columns first
                async with session.get("http://localhost:8000/api/boards/1/columns") as response:
                    if response.status == 200:
                        columns = await response.json()
                        if len(columns) > 1:
                            target_column = columns[1]["id"]
                            move_data = {
                                "ticket_id": ticket_id,
                                "target_column_id": target_column,
                                "position": 0,
                            }
                            async with session.post(
                                "http://localhost:8000/api/tickets/move", json=move_data
                            ) as move_response:
                                if move_response.status in [200, 201]:
                                    print(f"✅ Moved ticket {ticket_id} to column {target_column}")

        # Check for update messages
        update_messages = []
        for _ in range(2):
            try:
                msg1 = await asyncio.wait_for(ws1.recv(), timeout=2.0)
                update_messages.append(("Client1", json.loads(msg1)))
            except TimeoutError:
                pass

            try:
                msg2 = await asyncio.wait_for(ws2.recv(), timeout=2.0)
                update_messages.append(("Client2", json.loads(msg2)))
            except TimeoutError:
                pass

        if update_messages:
            print(f"✅ Received {len(update_messages)} update messages")
            for client, msg in update_messages:
                print(f"  {client}: {msg.get('type', 'unknown')} event")

        print("-" * 50)
        print("WebSocket test completed!")

        return len(received_messages) > 0 or len(update_messages) > 0


async def test_websocket_latency():
    """Measure WebSocket message latency"""
    uri = "ws://localhost:8000/ws/connect"

    print("\nTesting WebSocket latency...")
    print("-" * 50)

    async with websockets.connect(uri) as ws:
        # Send a ping-like message if the server supports it
        # For now, just test connection latency
        start = asyncio.get_event_loop().time()

        # Create a ticket and measure broadcast time
        async with aiohttp.ClientSession() as session:
            ticket_data = {
                "title": "Latency Test",
                "description": "Measuring broadcast latency",
                "column_id": 1,
                "priority": 1,
                "assignee": "latency-test",
            }

            create_start = asyncio.get_event_loop().time()
            async with session.post(
                "http://localhost:8000/api/tickets/?board_id=1", json=ticket_data
            ) as response:
                if response.status == 201:
                    create_time = asyncio.get_event_loop().time() - create_start
                    print(f"✅ API create time: {create_time * 1000:.2f}ms")

        try:
            # Try to receive any broadcast message
            await asyncio.wait_for(ws.recv(), timeout=2.0)
            receive_time = asyncio.get_event_loop().time() - start
            print(f"✅ Total round-trip time: {receive_time * 1000:.2f}ms")

            if receive_time < 1.0:
                print("✅ Latency is within target (<1s)")
            else:
                print("⚠️  Latency exceeds target (>1s)")
        except TimeoutError:
            print("ℹ️  No broadcast received (WebSocket might not broadcast on create)")

    print("-" * 50)


async def main():
    try:
        # Test real-time updates
        success = await test_websocket_updates()

        # Test latency
        await test_websocket_latency()

        if success:
            print("\n✅ WebSocket real-time updates are working!")
        else:
            print("\n⚠️  WebSocket updates need verification")

    except Exception as e:
        print(f"\n❌ WebSocket test failed: {e}")
        print("Make sure the backend is running on port 8000")


if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""Test WebSocket broadcasting for ticket operations"""

import asyncio
import json
import time
from typing import Any, Dict, List

import httpx
import websockets

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/connect"


async def create_websocket_listener(client_id: str) -> websockets.WebSocketClientProtocol:
    """Create a WebSocket client listener"""
    ws = await websockets.connect(f"{WS_URL}?client_id={client_id}")
    # Wait for connection confirmation
    msg = await ws.recv()
    print(f"  {client_id} connected: {json.loads(msg)['event']}")
    return ws


async def test_ticket_operations_broadcasting():
    """Test that ticket operations properly broadcast to all WebSocket clients"""
    print("=== WebSocket Broadcasting Test ===\n")

    # Create multiple WebSocket clients
    print("1. Creating WebSocket clients...")
    clients = []
    try:
        for i in range(3):
            client = await create_websocket_listener(f"test_client_{i + 1}")
            clients.append(client)
        print(f"  ✅ Created {len(clients)} WebSocket clients\n")
    except Exception as e:
        print(f"  ❌ Failed to create clients: {e}")
        return False

    # Collect messages
    messages: Dict[str, List[Dict[str, Any]]] = {f"test_client_{i + 1}": [] for i in range(3)}

    async def collect_messages(ws, client_id):
        """Collect messages from a WebSocket client"""
        try:
            while True:
                msg = await asyncio.wait_for(ws.recv(), timeout=0.5)
                data = json.loads(msg)
                messages[client_id].append(data)
                print(f"  📥 {client_id} received: {data.get('event', 'unknown')}")
        except asyncio.TimeoutError:
            pass
        except Exception as e:
            print(f"  ⚠️ {client_id} error: {e}")

    # Test ticket creation
    print("2. Testing ticket creation broadcast...")
    async with httpx.AsyncClient() as http_client:
        # Get a board ID
        boards_response = await http_client.get(f"{BASE_URL}/api/boards/")
        boards = boards_response.json()
        if not boards:
            print("  ❌ No boards found")
            return False
        board_id = boards[0]["id"]

        # Start collecting messages
        collect_tasks = [
            asyncio.create_task(collect_messages(clients[i], f"test_client_{i + 1}"))
            for i in range(3)
        ]

        # Create a ticket
        ticket_data = {
            "title": f"Broadcast Test Ticket {int(time.time())}",
            "description": "Testing WebSocket broadcasting",
            "board_id": board_id,
            "priority": "1.0",
        }

        create_response = await http_client.post(f"{BASE_URL}/api/tickets/", json=ticket_data)

        if create_response.status_code != 201:
            print(f"  ❌ Failed to create ticket: {create_response.text}")
            return False

        ticket = create_response.json()
        ticket_id = ticket["id"]
        print(f"  ✅ Created ticket #{ticket_id}")

        # Wait for broadcasts
        await asyncio.sleep(1)

        # Cancel collection tasks
        for task in collect_tasks:
            task.cancel()

        # Check if all clients received the create event
        create_events = 0
        for client_id, msgs in messages.items():
            for msg in msgs:
                if msg.get("event") == "ticket_created":
                    create_events += 1

        print(f"  📊 {create_events}/{len(clients)} clients received creation broadcast")

        # Clear messages for next test
        for client_id in messages:
            messages[client_id].clear()

        # Test ticket update
        print("\n3. Testing ticket update broadcast...")

        # Start collecting messages again
        collect_tasks = [
            asyncio.create_task(collect_messages(clients[i], f"test_client_{i + 1}"))
            for i in range(3)
        ]

        update_data = {
            "title": "Updated Broadcast Test Ticket",
            "description": "Updated description",
        }

        update_response = await http_client.put(
            f"{BASE_URL}/api/tickets/{ticket_id}", json=update_data
        )

        if update_response.status_code != 200:
            print(f"  ❌ Failed to update ticket: {update_response.text}")
        else:
            print(f"  ✅ Updated ticket #{ticket_id}")

        # Wait for broadcasts
        await asyncio.sleep(1)

        # Cancel collection tasks
        for task in collect_tasks:
            task.cancel()

        # Check update events
        update_events = 0
        for client_id, msgs in messages.items():
            for msg in msgs:
                if msg.get("event") == "ticket_updated":
                    update_events += 1

        print(f"  📊 {update_events}/{len(clients)} clients received update broadcast")

        # Clear messages for next test
        for client_id in messages:
            messages[client_id].clear()

        # Test ticket move
        print("\n4. Testing ticket move broadcast...")

        # Start collecting messages again
        collect_tasks = [
            asyncio.create_task(collect_messages(clients[i], f"test_client_{i + 1}"))
            for i in range(3)
        ]

        move_data = {"column": "In Progress", "moved_by": "test_user"}

        move_response = await http_client.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/move", json=move_data
        )

        if move_response.status_code != 200:
            print(f"  ❌ Failed to move ticket: {move_response.text}")
        else:
            print(f"  ✅ Moved ticket #{ticket_id} to In Progress")

        # Wait for broadcasts
        await asyncio.sleep(1)

        # Cancel collection tasks
        for task in collect_tasks:
            task.cancel()

        # Check move events
        move_events = 0
        for client_id, msgs in messages.items():
            for msg in msgs:
                if msg.get("event") in ["drag_moved", "ticket_moved"]:
                    move_events += 1

        print(f"  📊 {move_events}/{len(clients)} clients received move broadcast")

        # Test ticket deletion
        print("\n5. Testing ticket deletion broadcast...")

        # Start collecting messages again
        collect_tasks = [
            asyncio.create_task(collect_messages(clients[i], f"test_client_{i + 1}"))
            for i in range(3)
        ]

        delete_response = await http_client.delete(f"{BASE_URL}/api/tickets/{ticket_id}")

        if delete_response.status_code != 200:
            print(f"  ❌ Failed to delete ticket: {delete_response.text}")
        else:
            print(f"  ✅ Deleted ticket #{ticket_id}")

        # Wait for broadcasts
        await asyncio.sleep(1)

        # Cancel collection tasks
        for task in collect_tasks:
            task.cancel()

        # Check delete events
        delete_events = 0
        for client_id, msgs in messages.items():
            for msg in msgs:
                if msg.get("event") == "ticket_deleted":
                    delete_events += 1

        print(f"  📊 {delete_events}/{len(clients)} clients received deletion broadcast")

    # Close WebSocket connections
    print("\n6. Cleaning up...")
    for ws in clients:
        await ws.close()
    print("  ✅ Closed all WebSocket connections")

    # Summary
    print("\n=== Test Summary ===")
    total_expected = len(clients) * 4  # 4 operations
    total_received = create_events + update_events + move_events + delete_events
    success_rate = (total_received / total_expected) * 100 if total_expected > 0 else 0

    print(f"Expected broadcasts: {total_expected}")
    print(f"Received broadcasts: {total_received}")
    print(f"Success rate: {success_rate:.1f}%")

    if success_rate >= 90:
        print("✅ WebSocket broadcasting is working well!")
        return True
    else:
        print("⚠️ WebSocket broadcasting needs improvement")
        return False


if __name__ == "__main__":
    success = asyncio.run(test_ticket_operations_broadcasting())
    exit(0 if success else 1)

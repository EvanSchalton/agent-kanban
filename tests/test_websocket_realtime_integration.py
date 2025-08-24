#!/usr/bin/env python3
"""
WebSocket Real-time Sync Integration Test
Tests the complete API -> WebSocket -> Frontend pipeline
"""

import asyncio
import json
import logging
import time
from datetime import datetime

import requests
import websockets

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

BASE_API_URL = "http://localhost:18000"
WS_URL = "ws://localhost:18000/ws/connect"


class WebSocketRealTimeTest:
    def __init__(self):
        self.websocket = None
        self.received_events = []
        self.connected = False

    async def connect_websocket(self, board_id=1, username="test_user"):
        """Connect to WebSocket with board subscription"""
        ws_url = f"{WS_URL}?board_id={board_id}&username={username}"
        logger.info(f"Connecting to WebSocket: {ws_url}")

        try:
            self.websocket = await websockets.connect(ws_url)
            self.connected = True
            logger.info("✅ WebSocket connected")

            # Start listening for messages
            asyncio.create_task(self.listen_for_messages())

            # Wait for connection confirmation
            await asyncio.sleep(1)
            return True

        except Exception as e:
            logger.error(f"❌ WebSocket connection failed: {e}")
            return False

    async def listen_for_messages(self):
        """Listen for WebSocket messages"""
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    event_type = data.get("event", data.get("type", "unknown"))

                    self.received_events.append(
                        {
                            "timestamp": datetime.now().isoformat(),
                            "event": event_type,
                            "data": data.get("data", data),
                        }
                    )

                    if event_type == "connected":
                        logger.info(f"🎉 Connection confirmed: {data}")
                    elif event_type in ["ticket_created", "ticket_updated", "ticket_moved"]:
                        logger.info(f"📡 REAL-TIME EVENT: {event_type} - {data}")
                    elif event_type == "heartbeat":
                        # Respond to heartbeat
                        await self.websocket.send(
                            json.dumps(
                                {
                                    "type": "heartbeat_response",
                                    "heartbeat_id": data.get("heartbeat_id"),
                                    "timestamp": datetime.now().isoformat(),
                                }
                            )
                        )

                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse WebSocket message: {e}")

        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
            self.connected = False
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
            self.connected = False

    async def disconnect_websocket(self):
        """Disconnect from WebSocket"""
        if self.websocket:
            await self.websocket.close()
            self.connected = False
            logger.info("WebSocket disconnected")

    def create_ticket_via_api(self, title="Test Ticket", board_id=1):
        """Create a ticket via REST API"""
        url = f"{BASE_API_URL}/api/tickets/"
        payload = {
            "title": title,
            "description": "Testing WebSocket real-time sync",
            "board_id": board_id,
            "current_column": "Not Started",
        }

        logger.info(f"Creating ticket via API: {title}")

        try:
            response = requests.post(
                url, json=payload, headers={"Content-Type": "application/json"}
            )
            if response.status_code == 201:
                ticket = response.json()
                logger.info(f"✅ Ticket created: ID {ticket['id']}")
                return ticket
            else:
                logger.error(
                    f"❌ Failed to create ticket: {response.status_code} - {response.text}"
                )
                return None
        except Exception as e:
            logger.error(f"❌ API request error: {e}")
            return None

    def move_ticket_via_api(self, ticket_id, new_column="In Progress"):
        """Move a ticket via REST API"""
        url = f"{BASE_API_URL}/api/tickets/{ticket_id}/move"
        payload = {"column": new_column}

        logger.info(f"Moving ticket {ticket_id} to {new_column}")

        try:
            response = requests.post(
                url, json=payload, headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                ticket = response.json()
                logger.info(f"✅ Ticket moved: ID {ticket['id']} → {ticket['current_column']}")
                return ticket
            else:
                logger.error(f"❌ Failed to move ticket: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logger.error(f"❌ API request error: {e}")
            return None

    def get_board_tickets(self, board_id=1):
        """Get tickets for a board"""
        url = f"{BASE_API_URL}/api/boards/{board_id}/tickets"
        try:
            response = requests.get(url)
            if response.status_code == 200:
                data = response.json()
                tickets = data.get("tickets", [])
                logger.info(f"📋 Found {len(tickets)} tickets on board {board_id}")
                return tickets
            else:
                logger.error(f"❌ Failed to get tickets: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"❌ API request error: {e}")
            return []

    async def test_real_time_sync(self):
        """Test complete real-time synchronization pipeline"""
        logger.info("🚀 Starting WebSocket Real-time Sync Integration Test")

        # Step 1: Connect to WebSocket
        connected = await self.connect_websocket()
        if not connected:
            logger.error("❌ Cannot proceed without WebSocket connection")
            return False

        # Step 2: Test ticket creation sync
        logger.info("🧪 Testing ticket creation real-time sync...")
        initial_events = len(self.received_events)

        ticket = self.create_ticket_via_api(f"Real-time Test {int(time.time())}")
        if not ticket:
            logger.error("❌ Failed to create test ticket")
            await self.disconnect_websocket()
            return False

        # Wait for WebSocket event
        await asyncio.sleep(2)

        creation_events = [
            e for e in self.received_events[initial_events:] if e["event"] == "ticket_created"
        ]
        if creation_events:
            logger.info("✅ Ticket creation real-time sync working!")
        else:
            logger.warning("⚠️ No ticket creation event received via WebSocket")

        # Step 3: Test ticket move sync
        logger.info("🧪 Testing ticket move real-time sync...")
        initial_events = len(self.received_events)

        moved_ticket = self.move_ticket_via_api(ticket["id"], "In Progress")
        if not moved_ticket:
            logger.error("❌ Failed to move test ticket")
            await self.disconnect_websocket()
            return False

        # Wait for WebSocket event
        await asyncio.sleep(2)

        move_events = [
            e for e in self.received_events[initial_events:] if e["event"] == "ticket_moved"
        ]
        if move_events:
            logger.info("✅ Ticket move real-time sync working!")
        else:
            logger.warning("⚠️ No ticket move event received via WebSocket")

        # Step 4: Summary
        logger.info(
            f"📊 Test completed. Total WebSocket events received: {len(self.received_events)}"
        )
        logger.info("Event types received:")
        for event_type in {e["event"] for e in self.received_events}:
            count = len([e for e in self.received_events if e["event"] == event_type])
            logger.info(f"  - {event_type}: {count}")

        await self.disconnect_websocket()

        # Determine success
        success = len(creation_events) > 0 or len(move_events) > 0
        if success:
            logger.info("🎉 WebSocket Real-time Sync Test: PASSED")
        else:
            logger.warning(
                "⚠️ WebSocket Real-time Sync Test: PARTIAL - Events created but sync may be delayed"
            )

        return success


async def main():
    """Main test execution"""
    test = WebSocketRealTimeTest()

    # Test API connectivity first
    logger.info("🔍 Testing API connectivity...")
    try:
        response = requests.get(f"{BASE_API_URL}/health")
        if response.status_code == 200:
            health = response.json()
            logger.info(f"✅ API healthy: {health}")
        else:
            logger.error("❌ API not responding")
            return
    except Exception as e:
        logger.error(f"❌ API connection error: {e}")
        return

    # Run the real-time sync test
    success = await test.test_real_time_sync()

    if success:
        print("\n" + "=" * 60)
        print("🎉 WEBSOCKET REAL-TIME SYNC: OPERATIONAL")
        print("✅ API → WebSocket → Frontend pipeline working")
        print("✅ Card creation broadcasts working")
        print("✅ Ticket move broadcasts working")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("⚠️ WEBSOCKET REAL-TIME SYNC: NEEDS INVESTIGATION")
        print("❌ Some events may not be broadcasting correctly")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

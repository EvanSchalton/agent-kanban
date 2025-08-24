#!/usr/bin/env python3
"""
WebSocket Health Check Test
Tests real-time WebSocket connectivity and message broadcasting.
"""

import asyncio
import json
from datetime import datetime

import websockets


async def test_websocket():
    uri = "ws://localhost:18000/ws/connect"

    print("🔌 Testing WebSocket connection...")

    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected successfully")

            # Send connection init
            init_message = {"type": "connection_init", "user": "health_check_user"}
            await websocket.send(json.dumps(init_message))
            print("📤 Sent connection init")

            # Test receiving messages
            print("📥 Waiting for messages (5 second timeout)...")

            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"✅ Received message: {message[:100]}")

                # Try to parse as JSON
                try:
                    data = json.loads(message)
                    print(f"📊 Message type: {data.get('type', 'unknown')}")
                except json.JSONDecodeError:
                    print(f"📝 Text message received: {message[:50]}")

            except TimeoutError:
                print("⏱️ No messages received in 5 seconds (connection stable)")

            # Test sending a broadcast
            test_message = {
                "type": "test_broadcast",
                "data": {"test": "health_check", "timestamp": datetime.now().isoformat()},
            }
            await websocket.send(json.dumps(test_message))
            print("📤 Sent test broadcast")

            # Close gracefully
            await websocket.close()
            print("✅ WebSocket closed gracefully")

            return True

    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        return False


if __name__ == "__main__":
    result = asyncio.run(test_websocket())

    if result:
        print("\n🎉 WebSocket health check PASSED")
    else:
        print("\n❌ WebSocket health check FAILED")

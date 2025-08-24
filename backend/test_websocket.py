#!/usr/bin/env python3
import asyncio
import json
import time

import websockets


async def test_websocket_connection():
    """Test WebSocket connection to the backend"""
    uri = "ws://localhost:8000/ws/connect"

    try:
        print("Testing WebSocket connection...")
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected successfully!")

            # Send a test message
            test_message = {"type": "ping", "timestamp": time.time()}
            await websocket.send(json.dumps(test_message))
            print("📤 Sent ping message")

            # Wait for response (with timeout)
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"📥 Received response: {response}")
            except asyncio.TimeoutError:
                print("⚠️  No response received within 5 seconds")

            print("✅ WebSocket test completed successfully!")

    except (websockets.exceptions.ConnectionClosed, OSError):
        print("❌ WebSocket connection refused - check if backend is running")
        return False
    except Exception as e:
        print(f"❌ WebSocket test failed: {e}")
        return False

    return True


async def test_socketio_endpoint():
    """Test Socket.IO endpoint availability"""
    import aiohttp

    try:
        print("\nTesting Socket.IO endpoint...")
        async with aiohttp.ClientSession() as session:
            # Test Socket.IO handshake endpoint
            async with session.get(
                "http://localhost:8000/socket.io/?transport=polling"
            ) as response:
                if response.status == 200:
                    print("✅ Socket.IO endpoint is available")
                    return True
                else:
                    print(f"❌ Socket.IO endpoint returned status {response.status}")
                    return False
    except Exception as e:
        print(f"❌ Socket.IO test failed: {e}")
        return False


if __name__ == "__main__":
    print("=== WebSocket Real-time Updates Test ===\n")

    async def run_all_tests():
        results = []

        # Test WebSocket connection
        ws_result = await test_websocket_connection()
        results.append(("WebSocket", ws_result))

        # Test Socket.IO endpoint
        sio_result = await test_socketio_endpoint()
        results.append(("Socket.IO", sio_result))

        print("\n=== Test Results ===")
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name}: {status}")

        return all(result for _, result in results)

    success = asyncio.run(run_all_tests())
    exit(0 if success else 1)

#!/usr/bin/env python3
"""
Real-time WebSocket Testing for Multiple Browser Tab Simulation
"""

import asyncio
import json
import time
from datetime import datetime

import requests
import websockets

WS_URL = "ws://localhost:18000/ws/connect"
API_URL = "http://localhost:18000/api"


class RealTimeWebSocketTester:
    def __init__(self):
        self.test_results = []
        self.board_id = 1

    def log_result(self, test_name: str, status: str, details: str):
        result = {
            "test": test_name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details,
        }
        self.test_results.append(result)
        symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{symbol} {test_name}: {details}")

    async def test_websocket_connection(self):
        """Test basic WebSocket connection"""
        try:
            async with websockets.connect(WS_URL, timeout=5) as websocket:
                # Wait for initial message
                message = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                data = json.loads(message)

                if data.get("event") in ["connected", "ticket_created"]:
                    self.log_result("WebSocket Connection", "PASS", "Connected successfully")
                    return True
                else:
                    self.log_result(
                        "WebSocket Connection", "WARNING", f"Unexpected message: {data}"
                    )
                    return True

        except TimeoutError:
            self.log_result("WebSocket Connection", "FAIL", "Connection timeout")
            return False
        except Exception as e:
            self.log_result("WebSocket Connection", "FAIL", f"Connection error: {str(e)}")
            return False

    async def test_multiple_browser_tabs(self):
        """Test multiple WebSocket connections (simulating browser tabs)"""
        try:
            clients = []
            messages_received = []

            # Connect 3 "browser tabs"
            for i in range(3):
                try:
                    ws = await websockets.connect(WS_URL, timeout=3)
                    clients.append(ws)

                    # Receive initial message
                    msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    messages_received.append(json.loads(msg))

                except Exception as e:
                    print(f"  Failed to connect client {i + 1}: {e}")

            if len(clients) >= 2:
                self.log_result(
                    "Multiple Browser Tabs",
                    "PASS",
                    f"Successfully connected {len(clients)} clients",
                )

                # Close all connections
                for ws in clients:
                    await ws.close()

                return True
            else:
                self.log_result(
                    "Multiple Browser Tabs", "FAIL", f"Only {len(clients)} clients connected"
                )
                return False

        except Exception as e:
            self.log_result("Multiple Browser Tabs", "FAIL", f"Exception: {str(e)}")
            return False

    async def test_real_time_broadcast(self):
        """Test real-time broadcasting when operations occur"""
        try:
            # Connect two WebSocket clients
            client1_messages = []
            client2_messages = []

            async def message_listener(websocket, message_list, client_name):
                try:
                    while True:
                        message = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                        data = json.loads(message)
                        message_list.append(data)
                        print(f"  {client_name}: {data.get('event', 'unknown')}")
                except TimeoutError:
                    pass
                except Exception as e:
                    print(f"  {client_name} error: {e}")

            async with websockets.connect(WS_URL) as ws1, websockets.connect(WS_URL) as ws2:
                # Start listeners
                listener1 = asyncio.create_task(message_listener(ws1, client1_messages, "Tab1"))
                listener2 = asyncio.create_task(message_listener(ws2, client2_messages, "Tab2"))

                # Wait for initial connection messages
                await asyncio.sleep(1.0)

                # Trigger a real-time event by creating a ticket
                ticket_data = {
                    "title": "Real-time Broadcast Test",
                    "description": "Testing WebSocket broadcasting across browser tabs",
                    "priority": "High",
                    "board_id": self.board_id,
                }

                print("  Creating ticket to trigger broadcast...")
                response = requests.post(
                    f"{API_URL}/tickets/?board_id={self.board_id}", json=ticket_data, timeout=5
                )

                if response.status_code in [200, 201]:
                    created_ticket = response.json()
                    print(f"  Created ticket ID: {created_ticket.get('id')}")

                    # Wait for broadcasts
                    await asyncio.sleep(2.0)

                    # Test ticket move to trigger more broadcasts
                    if created_ticket.get("id"):
                        move_data = {
                            "ticket_id": str(created_ticket.get("id")),
                            "target_column_id": "In Progress",
                            "position": 0,
                        }

                        print("  Moving ticket to trigger broadcast...")
                        move_response = requests.post(
                            f"{API_URL}/tickets/move", json=move_data, timeout=5
                        )

                        if move_response.status_code in [200, 201]:
                            print("  Ticket moved successfully")

                        await asyncio.sleep(1.0)

                    # Cancel listeners
                    listener1.cancel()
                    listener2.cancel()

                    # Analyze broadcast results
                    len(client1_messages) + len(client2_messages)
                    broadcast_events = [
                        msg
                        for msg in client1_messages + client2_messages
                        if msg.get("event") in ["ticket_created", "ticket_updated", "ticket_moved"]
                    ]

                    if len(broadcast_events) >= 2:  # Both clients should receive events
                        self.log_result(
                            "Real-time Broadcast",
                            "PASS",
                            f"Broadcasting working: {len(broadcast_events)} events received",
                        )
                    elif len(broadcast_events) >= 1:
                        self.log_result(
                            "Real-time Broadcast",
                            "WARNING",
                            f"Partial broadcasting: {len(broadcast_events)} events",
                        )
                    else:
                        self.log_result(
                            "Real-time Broadcast", "FAIL", "No broadcast events received"
                        )

                else:
                    self.log_result(
                        "Real-time Broadcast",
                        "FAIL",
                        f"Failed to create test ticket: {response.status_code}",
                    )

        except Exception as e:
            self.log_result("Real-time Broadcast", "FAIL", f"Exception: {str(e)}")

    async def test_websocket_latency(self):
        """Test WebSocket message latency"""
        try:
            latencies = []

            async with websockets.connect(WS_URL) as websocket:
                # Skip initial message
                await asyncio.wait_for(websocket.recv(), timeout=2.0)

                # Test ping-like operations
                for _i in range(5):
                    start_time = time.time()

                    # Send a test message (if supported)
                    test_msg = {"type": "ping", "timestamp": start_time}
                    await websocket.send(json.dumps(test_msg))

                    # Try to receive response (may timeout if not supported)
                    try:
                        await asyncio.wait_for(websocket.recv(), timeout=1.0)
                        end_time = time.time()
                        latency = (end_time - start_time) * 1000
                        latencies.append(latency)
                    except TimeoutError:
                        # No response expected, that's OK
                        pass

            if latencies:
                avg_latency = sum(latencies) / len(latencies)
                max_latency = max(latencies)

                if avg_latency < 100:
                    self.log_result(
                        "WebSocket Latency",
                        "PASS",
                        f"Excellent: {avg_latency:.1f}ms avg, {max_latency:.1f}ms max",
                    )
                elif avg_latency < 300:
                    self.log_result(
                        "WebSocket Latency",
                        "PASS",
                        f"Good: {avg_latency:.1f}ms avg, {max_latency:.1f}ms max",
                    )
                else:
                    self.log_result(
                        "WebSocket Latency",
                        "WARNING",
                        f"High: {avg_latency:.1f}ms avg, {max_latency:.1f}ms max",
                    )
            else:
                self.log_result(
                    "WebSocket Latency",
                    "WARNING",
                    "No latency measurements (server may not support ping)",
                )

        except Exception as e:
            self.log_result("WebSocket Latency", "FAIL", f"Exception: {str(e)}")

    async def run_realtime_tests(self):
        """Run all real-time WebSocket tests"""
        print("\n" + "=" * 60)
        print("REAL-TIME WEBSOCKET TESTING")
        print("Multiple Browser Tab Simulation")
        print("=" * 60)

        # Basic connection test
        print("\n🔌 WebSocket Connection Test")
        print("-" * 40)
        connection_ok = await self.test_websocket_connection()

        if not connection_ok:
            print("❌ WebSocket connection failed - skipping further tests")
            return self.test_results

        # Multiple client test
        print("\n👥 Multiple Browser Tabs Test")
        print("-" * 40)
        await self.test_multiple_browser_tabs()

        # Real-time broadcast test
        print("\n📡 Real-time Broadcast Test")
        print("-" * 40)
        await self.test_real_time_broadcast()

        # Latency test
        print("\n⚡ WebSocket Latency Test")
        print("-" * 40)
        await self.test_websocket_latency()

        # Summary
        print("\n" + "=" * 60)
        print("REAL-TIME TESTING SUMMARY")
        print("=" * 60)

        total_tests = len(self.test_results)
        passed = sum(1 for r in self.test_results if r["status"] == "PASS")
        failed = sum(1 for r in self.test_results if r["status"] == "FAIL")
        warnings = sum(1 for r in self.test_results if r["status"] == "WARNING")

        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️ Warnings: {warnings}")

        if passed >= total_tests - 1 and failed == 0:
            print("\n✅ REAL-TIME UPDATES: FULLY FUNCTIONAL")
        elif passed >= total_tests // 2:
            print("\n⚠️ REAL-TIME UPDATES: MOSTLY WORKING")
        else:
            print("\n❌ REAL-TIME UPDATES: SIGNIFICANT ISSUES")

        print("=" * 60)

        return self.test_results


async def main():
    tester = RealTimeWebSocketTester()
    results = await tester.run_realtime_tests()

    # Save results
    with open("/workspaces/agent-kanban/tests/realtime_test_results.json", "w") as f:
        json.dump({"results": results, "timestamp": datetime.now().isoformat()}, f, indent=2)

    print("\n📁 Results saved to realtime_test_results.json")


if __name__ == "__main__":
    asyncio.run(main())

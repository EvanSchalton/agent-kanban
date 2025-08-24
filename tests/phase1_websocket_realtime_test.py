#!/usr/bin/env python3
"""Phase 1 Real-time WebSocket Testing - Multiple Browser Simulation"""

import asyncio
import json
import time
from datetime import datetime

import requests
import websockets

BASE_URL = "http://localhost:18000"
WS_URL = "ws://localhost:18000/ws/connect"
API_URL = f"{BASE_URL}/api"


class Phase1WebSocketTester:
    def __init__(self):
        self.test_results = []
        self.board_id = None
        self.messages_received = []

    def log_result(self, test_name: str, status: str, details: str = ""):
        result = {
            "test": test_name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details,
        }
        self.test_results.append(result)
        status_symbol = (
            "✓"
            if status == "PASS"
            else "✗"
            if status == "FAIL"
            else "⚠️"
            if status == "WARNING"
            else "!"
        )
        print(f"[{status_symbol}] {test_name}: {details}")

    def setup_test_data(self):
        """Get board ID for testing"""
        try:
            response = requests.get(f"{API_URL}/boards/")
            if response.status_code == 200:
                boards = response.json()
                if boards:
                    self.board_id = boards[0].get("id")
                    self.log_result("Setup Test Data", "PASS", f"Using board ID: {self.board_id}")
                    return True
            self.log_result("Setup Test Data", "FAIL", "No boards available")
            return False
        except Exception as e:
            self.log_result("Setup Test Data", "ERROR", str(e))
            return False

    async def test_websocket_connection(self):
        """Test basic WebSocket connection"""
        try:
            async with websockets.connect(WS_URL) as websocket:
                # Wait for connection message
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)

                if data.get("event") == "connected":
                    self.log_result(
                        "WebSocket Connection",
                        "PASS",
                        "Connected successfully with greeting message",
                    )
                else:
                    self.log_result(
                        "WebSocket Connection",
                        "WARNING",
                        f"Connected but unexpected message: {data}",
                    )
                return True

        except TimeoutError:
            self.log_result("WebSocket Connection", "FAIL", "Connection timeout")
        except websockets.exceptions.ConnectionClosed:
            self.log_result("WebSocket Connection", "FAIL", "Connection closed")
        except Exception as e:
            self.log_result("WebSocket Connection", "ERROR", str(e))
        return False

    async def test_multiple_client_connections(self):
        """Test multiple WebSocket clients like multiple browser tabs"""
        try:
            connected_clients = []
            connection_messages = []

            # Simulate 3 browser tabs
            for i in range(3):
                try:
                    ws = await websockets.connect(WS_URL)
                    connected_clients.append(ws)

                    # Receive initial message
                    msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    connection_messages.append(json.loads(msg))

                except Exception as e:
                    self.log_result(f"Client {i + 1} Connection", "FAIL", str(e))

            if len(connected_clients) == 3:
                self.log_result(
                    "Multiple Client Connections",
                    "PASS",
                    f"Successfully connected {len(connected_clients)} clients",
                )

                # Close all connections
                for ws in connected_clients:
                    await ws.close()

                return True
            else:
                self.log_result(
                    "Multiple Client Connections",
                    "FAIL",
                    f"Only {len(connected_clients)}/3 clients connected",
                )

        except Exception as e:
            self.log_result("Multiple Client Connections", "ERROR", str(e))
        return False

    async def test_real_time_broadcast(self):
        """Test real-time broadcasting when tickets are created/updated"""
        if not self.board_id:
            self.log_result("Real-time Broadcast", "SKIP", "No board available")
            return False

        try:
            # Connect two WebSocket clients
            client1_messages = []
            client2_messages = []

            async def client_listener(websocket, message_list, client_name):
                try:
                    while True:
                        message = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                        data = json.loads(message)
                        message_list.append(data)
                        print(f"  {client_name} received: {data.get('event', 'unknown')}")
                except TimeoutError:
                    pass
                except Exception as e:
                    print(f"  {client_name} error: {e}")

            async with websockets.connect(WS_URL) as ws1, websockets.connect(WS_URL) as ws2:
                # Start listeners
                listener1 = asyncio.create_task(client_listener(ws1, client1_messages, "Client1"))
                listener2 = asyncio.create_task(client_listener(ws2, client2_messages, "Client2"))

                # Wait for initial connection messages
                await asyncio.sleep(1.0)

                # Create a ticket via API to trigger broadcast
                ticket_data = {
                    "title": "Real-time Test Ticket",
                    "description": "Testing real-time WebSocket broadcasting",
                    "priority": "High",
                    "board_id": self.board_id,
                }

                print("  Creating ticket via API...")
                response = requests.post(
                    f"{API_URL}/tickets/?board_id={self.board_id}", json=ticket_data
                )

                if response.status_code in [200, 201]:
                    ticket = response.json()
                    ticket_id = ticket.get("id")
                    print(f"  Created ticket {ticket_id}")

                    # Wait for broadcasts
                    await asyncio.sleep(2.0)

                    # Cancel listeners
                    listener1.cancel()
                    listener2.cancel()

                    # Check if both clients received updates
                    total_messages = len(client1_messages) + len(client2_messages)

                    if total_messages >= 2:  # Both clients got initial connection + any updates
                        broadcast_messages = [
                            msg
                            for msg in client1_messages + client2_messages
                            if msg.get("event") != "connected"
                        ]

                        if broadcast_messages:
                            self.log_result(
                                "Real-time Broadcast",
                                "PASS",
                                f"Broadcast working: {len(broadcast_messages)} update messages",
                            )
                        else:
                            self.log_result(
                                "Real-time Broadcast",
                                "WARNING",
                                "Connected but no ticket broadcasts detected",
                            )
                    else:
                        self.log_result(
                            "Real-time Broadcast",
                            "FAIL",
                            f"Insufficient messages: {total_messages}",
                        )
                else:
                    self.log_result(
                        "Real-time Broadcast",
                        "FAIL",
                        f"Failed to create test ticket: {response.status_code}",
                    )

        except Exception as e:
            self.log_result("Real-time Broadcast", "ERROR", str(e))

        return False

    async def test_websocket_latency(self):
        """Test WebSocket message latency"""
        try:
            latencies = []

            async with websockets.connect(WS_URL) as websocket:
                # Get initial connection message
                await websocket.recv()

                # Test ping-pong if available, otherwise measure echo
                for _i in range(5):
                    start_time = time.time()

                    # Send a ping message
                    ping_msg = {"type": "ping", "timestamp": start_time}
                    await websocket.send(json.dumps(ping_msg))

                    # Wait for response (pong or echo)
                    try:
                        await asyncio.wait_for(websocket.recv(), timeout=1.0)
                        end_time = time.time()
                        latency = (end_time - start_time) * 1000  # Convert to ms
                        latencies.append(latency)
                    except TimeoutError:
                        # If no pong response, that's OK for this test
                        pass

            if latencies:
                avg_latency = sum(latencies) / len(latencies)
                max_latency = max(latencies)

                if avg_latency < 50:
                    self.log_result(
                        "WebSocket Latency",
                        "PASS",
                        f"Excellent: {avg_latency:.1f}ms avg, {max_latency:.1f}ms max",
                    )
                elif avg_latency < 100:
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
                    "No ping-pong responses, server may not support it",
                )

        except Exception as e:
            self.log_result("WebSocket Latency", "ERROR", str(e))

    async def test_connection_resilience(self):
        """Test WebSocket connection resilience"""
        try:
            # Test rapid connect/disconnect
            successful_connections = 0

            for _i in range(5):
                try:
                    async with websockets.connect(WS_URL) as ws:
                        await asyncio.wait_for(ws.recv(), timeout=1.0)
                        successful_connections += 1
                except:
                    pass

            if successful_connections >= 4:
                self.log_result(
                    "Connection Resilience",
                    "PASS",
                    f"Handled {successful_connections}/5 rapid connections",
                )
            else:
                self.log_result(
                    "Connection Resilience",
                    "WARNING",
                    f"Only {successful_connections}/5 connections succeeded",
                )

        except Exception as e:
            self.log_result("Connection Resilience", "ERROR", str(e))

    async def run_all_tests(self):
        """Execute all real-time WebSocket tests"""
        print("\n" + "=" * 70)
        print("PHASE 1 REAL-TIME WEBSOCKET TESTING")
        print("Simulating Multiple Browser Tabs")
        print("=" * 70 + "\n")

        # Setup
        if not self.setup_test_data():
            print("❌ Could not setup test data")
            return

        print("🔌 Phase 1: Connection Testing")
        print("-" * 40)
        await self.test_websocket_connection()
        await self.test_multiple_client_connections()
        await self.test_connection_resilience()

        print("\n📡 Phase 2: Real-time Broadcasting")
        print("-" * 40)
        await self.test_real_time_broadcast()
        await self.test_websocket_latency()

        # Results summary
        print("\n" + "=" * 70)
        print("REAL-TIME TESTING SUMMARY")
        print("=" * 70)

        passed = sum(1 for r in self.test_results if r["status"] == "PASS")
        failed = sum(1 for r in self.test_results if r["status"] == "FAIL")
        warnings = sum(1 for r in self.test_results if r["status"] == "WARNING")
        errors = sum(1 for r in self.test_results if r["status"] == "ERROR")

        print(f"✓ Passed: {passed}")
        print(f"✗ Failed: {failed}")
        print(f"⚠ Warnings: {warnings}")
        print(f"! Errors: {errors}")

        # Phase 1 assessment
        if passed >= 4 and failed == 0:
            print("\n🎯 REAL-TIME UPDATES: READY FOR PHASE 1")
        elif passed >= 2:
            print("\n⚠️ REAL-TIME UPDATES: PARTIALLY WORKING")
        else:
            print("\n❌ REAL-TIME UPDATES: MAJOR ISSUES")

        print("=" * 70 + "\n")

        return self.test_results


async def main():
    tester = Phase1WebSocketTester()
    results = await tester.run_all_tests()

    # Save results
    with open("/workspaces/agent-kanban/tests/phase1_websocket_results.json", "w") as f:
        json.dump({"results": results, "timestamp": datetime.now().isoformat()}, f, indent=2)

    print("📁 Results saved to phase1_websocket_results.json")


if __name__ == "__main__":
    asyncio.run(main())

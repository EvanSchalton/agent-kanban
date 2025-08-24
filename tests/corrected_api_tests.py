#!/usr/bin/env python3
"""
Corrected API Test Suite for Agent Kanban Board
Fixed endpoint paths and comprehensive testing for Phase 1 demo
"""

import json
import logging
import time
from datetime import datetime

import requests
import websocket

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CorrectedAPITests:
    """Corrected API test suite with proper endpoint paths"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        logger.info(f"{status} {name}")
        if details:
            logger.info(f"   {details}")

        self.test_results.append(
            {
                "test": name,
                "success": success,
                "details": details,
                "timestamp": datetime.now().isoformat(),
            }
        )

    def test_corrected_endpoints(self):
        """Test all endpoints with corrected paths"""
        logger.info("🔧 Testing Corrected API Endpoints")

        # 1. Health check
        try:
            response = self.session.get(f"{self.base_url}/health")
            self.log_test(
                "Health Check", response.status_code == 200, f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_test("Health Check", False, str(e))

        # 2. List boards (with trailing slash)
        try:
            response = self.session.get(f"{self.base_url}/api/boards/")
            boards = response.json()
            self.log_test(
                "List Boards (corrected)",
                response.status_code == 200,
                f"Found {len(boards)} boards",
            )
        except Exception as e:
            self.log_test("List Boards (corrected)", False, str(e))

        # 3. Get specific board
        try:
            response = self.session.get(f"{self.base_url}/api/boards/1")
            board = response.json()
            self.log_test(
                "Get Board 1", response.status_code == 200, f"Board: {board.get('name', 'unknown')}"
            )
        except Exception as e:
            self.log_test("Get Board 1", False, str(e))

        # 4. Get board tickets
        try:
            response = self.session.get(f"{self.base_url}/api/tickets/?board_id=1")
            tickets_data = response.json()
            tickets = (
                tickets_data.get("items", tickets_data)
                if isinstance(tickets_data, dict)
                else tickets_data
            )
            self.log_test(
                "Get Board 1 Tickets", response.status_code == 200, f"Found {len(tickets)} tickets"
            )
        except Exception as e:
            self.log_test("Get Board 1 Tickets", False, str(e))

        # 5. Create ticket (with trailing slash)
        try:
            ticket_data = {
                "title": "QA Corrected Test Ticket",
                "description": "Test from corrected API suite",
                "current_column": "todo",
                "priority": "1.0",
                "board_id": 1,
            }
            response = self.session.post(f"{self.base_url}/api/tickets/", json=ticket_data)
            if response.status_code == 200:
                ticket = response.json()
                ticket_id = ticket["id"]
                self.log_test("Create Test Ticket", True, f"Created ticket ID {ticket_id}")

                # 6. Move ticket
                try:
                    move_data = {"column_id": "in_progress"}
                    response = self.session.post(
                        f"{self.base_url}/api/tickets/{ticket_id}/move", json=move_data
                    )
                    self.log_test(
                        "Move Ticket",
                        response.status_code == 200,
                        f"Status: {response.status_code}",
                    )
                except Exception as e:
                    self.log_test("Move Ticket", False, str(e))

                # 7. Delete test ticket (cleanup)
                try:
                    response = self.session.delete(f"{self.base_url}/api/tickets/{ticket_id}")
                    self.log_test(
                        "Delete Test Ticket",
                        response.status_code == 204,
                        f"Status: {response.status_code}",
                    )
                except Exception as e:
                    self.log_test("Delete Test Ticket", False, str(e))
            else:
                self.log_test("Create Test Ticket", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Create Test Ticket", False, str(e))

        # 8. Test problematic endpoints
        try:
            response = self.session.get(f"{self.base_url}/api/boards/default")
            self.log_test(
                "Get Default Board",
                response.status_code == 200,
                f"Status: {response.status_code} (should work now)",
            )
        except Exception as e:
            self.log_test("Get Default Board", False, str(e))

    def test_websocket_simple(self):
        """Simple WebSocket test using websocket-client library"""
        logger.info("🔌 Testing WebSocket Connection (Simple)")

        try:
            # Use standard websocket library
            ws_url = self.base_url.replace("http", "ws") + "/ws/connect"

            def on_message(ws, message):
                logger.info(f"WebSocket received: {message}")

            def on_error(ws, error):
                logger.error(f"WebSocket error: {error}")

            def on_close(ws, close_status_code, close_msg):
                logger.info("WebSocket closed")

            def on_open(ws):
                logger.info("WebSocket opened")
                # Send test message
                test_msg = json.dumps({"type": "ping", "data": {"timestamp": time.time()}})
                ws.send(test_msg)
                # Close after sending
                time.sleep(1)
                ws.close()

            ws = websocket.WebSocketApp(
                ws_url, on_open=on_open, on_message=on_message, on_error=on_error, on_close=on_close
            )

            # Run with timeout
            ws.run_forever(ping_timeout=10, ping_interval=30)

            self.log_test("WebSocket Connection", True, "Connected and sent message")

        except Exception as e:
            self.log_test("WebSocket Connection", False, str(e))

    def run_performance_test(self, iterations: int = 5):
        """Run performance test on corrected endpoints"""
        logger.info(f"📊 Performance Test ({iterations} iterations)")

        endpoints = [
            ("GET", "/api/boards/", "List Boards"),
            ("GET", "/api/boards/1", "Get Board 1"),
            ("GET", "/api/tickets/?board_id=1", "List Tickets"),
        ]

        for method, endpoint, name in endpoints:
            times = []
            for _i in range(iterations):
                start_time = time.time()
                try:
                    if method == "GET":
                        response = self.session.get(f"{self.base_url}{endpoint}")
                        if response.status_code == 200:
                            response_time = (time.time() - start_time) * 1000
                            times.append(response_time)
                except Exception as e:
                    logger.error(f"Performance test failed: {e}")

            if times:
                avg_time = sum(times) / len(times)
                self.log_test(
                    f"{name} Performance",
                    True,
                    f"Avg: {avg_time:.1f}ms, Min: {min(times):.1f}ms, Max: {max(times):.1f}ms",
                )

    def generate_summary(self):
        """Generate test summary"""
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])

        logger.info("=" * 50)
        logger.info("📋 CORRECTED API TEST SUMMARY")
        logger.info(f"Total Tests: {total_tests}")
        logger.info(f"✅ Passed: {passed_tests}")
        logger.info(f"❌ Failed: {total_tests - passed_tests}")
        logger.info(f"Success Rate: {(passed_tests / total_tests) * 100:.1f}%")

        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = f"/workspaces/agent-kanban/tests/corrected_api_results_{timestamp}.json"
        with open(results_file, "w") as f:
            json.dump(
                {
                    "summary": {
                        "total": total_tests,
                        "passed": passed_tests,
                        "failed": total_tests - passed_tests,
                        "success_rate": (passed_tests / total_tests) * 100,
                    },
                    "results": self.test_results,
                },
                f,
                indent=2,
            )

        logger.info(f"📄 Results saved: {results_file}")


def main():
    """Main execution"""
    logger.info("🎯 Corrected API Test Suite - Phase 1 Demo Validation")

    tester = CorrectedAPITests()

    # Run all tests
    tester.test_corrected_endpoints()
    tester.test_websocket_simple()
    tester.run_performance_test(iterations=3)

    # Generate summary
    tester.generate_summary()


if __name__ == "__main__":
    main()

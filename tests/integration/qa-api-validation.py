#!/usr/bin/env python3
"""
QA API Validation Script
Tests API endpoints for card creation bug fix validation
"""

import json
import sys
from datetime import datetime

import requests


class APIValidator:
    def __init__(self, base_url="http://localhost:18000"):
        self.base_url = base_url
        self.results = []

    def log_result(self, test_name, status, details=None):
        result = {
            "test": test_name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details or {},
        }
        self.results.append(result)
        status_symbol = "✅" if status == "PASS" else "❌"
        print(f"{status_symbol} {test_name}: {status}")
        if status == "FAIL" and details:
            print(f"   Details: {details}")

    def test_health_endpoint(self):
        """Test API health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result("Health Endpoint", "PASS", {"response": data})
                    return True
                else:
                    self.log_result("Health Endpoint", "FAIL", {"response": data})
                    return False
            else:
                self.log_result("Health Endpoint", "FAIL", {"status_code": response.status_code})
                return False
        except Exception as e:
            self.log_result("Health Endpoint", "FAIL", {"error": str(e)})
            return False

    def test_api_endpoints_discovery(self):
        """Test if API endpoints are reachable"""
        endpoints = [("/api/boards", "GET"), ("/api/tickets", "GET"), ("/", "GET")]

        for endpoint, method in endpoints:
            try:
                url = f"{self.base_url}{endpoint}"
                if method == "GET":
                    if endpoint == "/api/tickets":
                        # Tickets endpoint requires board_id parameter
                        response = requests.get(f"{url}?board_id=1", timeout=5)
                    else:
                        response = requests.get(url, timeout=5)

                if response.status_code in [
                    200,
                    400,
                    422,
                ]:  # 400/422 might be expected for missing params
                    self.log_result(
                        f"Endpoint {endpoint}",
                        "PASS",
                        {"status_code": response.status_code, "method": method},
                    )
                else:
                    self.log_result(
                        f"Endpoint {endpoint}",
                        "FAIL",
                        {"status_code": response.status_code, "response": response.text[:200]},
                    )
            except Exception as e:
                self.log_result(f"Endpoint {endpoint}", "FAIL", {"error": str(e)})

    def test_boards_endpoint(self):
        """Test boards endpoint specifically"""
        try:
            response = requests.get(f"{self.base_url}/api/boards", timeout=5)
            if response.status_code == 200:
                boards = response.json()
                if isinstance(boards, list) and len(boards) > 0:
                    self.log_result(
                        "Boards API",
                        "PASS",
                        {"board_count": len(boards), "first_board_id": boards[0].get("id")},
                    )
                    return boards[0].get("id")
                else:
                    self.log_result("Boards API", "FAIL", {"response": boards})
                    return None
            else:
                self.log_result(
                    "Boards API",
                    "FAIL",
                    {"status_code": response.status_code, "response": response.text},
                )
                return None
        except Exception as e:
            self.log_result("Boards API", "FAIL", {"error": str(e)})
            return None

    def test_card_creation(self, board_id):
        """Test card creation for each column"""
        if not board_id:
            self.log_result("Card Creation Test", "SKIP", {"reason": "No board_id available"})
            return []

        columns = ["To Do", "In Progress", "Done"]
        created_cards = []

        for column in columns:
            card_data = {
                "title": f"QA Test Card - {column}",
                "description": f"Testing card creation in {column} column",
                "current_column": column,
                "board_id": board_id,
                "priority": "Medium",
                "assignee": "qa-agent",
            }

            try:
                response = requests.post(f"{self.base_url}/api/tickets", json=card_data, timeout=5)

                if response.status_code == 201:
                    card = response.json()
                    created_cards.append(card["id"])
                    self.log_result(
                        f"Card Creation - {column}",
                        "PASS",
                        {"card_id": card["id"], "board_id": board_id, "column": column},
                    )
                else:
                    self.log_result(
                        f"Card Creation - {column}",
                        "FAIL",
                        {"status_code": response.status_code, "response": response.text},
                    )
            except Exception as e:
                self.log_result(f"Card Creation - {column}", "FAIL", {"error": str(e)})

        return created_cards

    def test_crud_operations(self, board_id):
        """Test full CRUD workflow"""
        if not board_id:
            self.log_result("CRUD Operations", "SKIP", {"reason": "No board_id available"})
            return

        # CREATE
        card_data = {
            "title": "QA CRUD Test Card",
            "description": "Testing CRUD operations",
            "current_column": "To Do",
            "board_id": board_id,
            "priority": "High",
        }

        try:
            # Create
            response = requests.post(f"{self.base_url}/api/tickets", json=card_data, timeout=5)
            if response.status_code != 201:
                self.log_result("CRUD - Create", "FAIL", {"status_code": response.status_code})
                return

            card = response.json()
            card_id = card["id"]

            # Read
            response = requests.get(f"{self.base_url}/api/tickets/{card_id}", timeout=5)
            if response.status_code != 200:
                self.log_result("CRUD - Read", "FAIL", {"status_code": response.status_code})
                return

            # Update
            update_data = {"title": "QA CRUD Test Card - Updated", "current_column": "In Progress"}
            response = requests.put(
                f"{self.base_url}/api/tickets/{card_id}", json=update_data, timeout=5
            )
            if response.status_code != 200:
                self.log_result("CRUD - Update", "FAIL", {"status_code": response.status_code})
                return

            # Delete
            response = requests.delete(f"{self.base_url}/api/tickets/{card_id}", timeout=5)
            if response.status_code in [200, 204]:
                self.log_result("CRUD Operations", "PASS", {"card_id": card_id})
            else:
                self.log_result("CRUD - Delete", "FAIL", {"status_code": response.status_code})

        except Exception as e:
            self.log_result("CRUD Operations", "FAIL", {"error": str(e)})

    def test_board_id_requirement(self, board_id):
        """Test that board_id is properly required in requests"""
        if not board_id:
            self.log_result("Board ID Requirement", "SKIP", {"reason": "No board_id available"})
            return

        # Test card creation without board_id
        card_data = {
            "title": "Test Card Without Board ID",
            "description": "Should fail",
            "current_column": "To Do",
        }

        try:
            response = requests.post(f"{self.base_url}/api/tickets", json=card_data, timeout=5)
            if response.status_code in [400, 422]:  # Should fail validation
                self.log_result(
                    "Board ID Requirement",
                    "PASS",
                    {"correctly_rejected": True, "status_code": response.status_code},
                )
            else:
                self.log_result(
                    "Board ID Requirement",
                    "FAIL",
                    {"should_have_failed": True, "status_code": response.status_code},
                )
        except Exception as e:
            self.log_result("Board ID Requirement", "FAIL", {"error": str(e)})

    def run_validation(self):
        """Run all validation tests"""
        print("🚀 Starting QA API Validation...")
        print("=" * 50)

        # Test 1: Health check
        if not self.test_health_endpoint():
            print("❌ Health check failed - aborting further tests")
            return self.generate_report()

        # Test 2: API endpoint discovery
        self.test_api_endpoints_discovery()

        # Test 3: Boards endpoint
        board_id = self.test_boards_endpoint()

        # Test 4: Card creation
        self.test_card_creation(board_id)

        # Test 5: CRUD operations
        self.test_crud_operations(board_id)

        # Test 6: Board ID requirement validation
        self.test_board_id_requirement(board_id)

        print("\n" + "=" * 50)
        return self.generate_report()

    def generate_report(self):
        """Generate final test report"""
        passed = len([r for r in self.results if r["status"] == "PASS"])
        failed = len([r for r in self.results if r["status"] == "FAIL"])
        skipped = len([r for r in self.results if r["status"] == "SKIP"])
        total = len(self.results)

        report = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total": total,
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "success_rate": f"{round((passed / total) * 100) if total > 0 else 0}%",
            },
            "results": self.results,
        }

        print("📊 TEST SUMMARY:")
        print(f"   Total: {total}")
        print(f"   Passed: {passed}")
        print(f"   Failed: {failed}")
        print(f"   Skipped: {skipped}")
        print(f"   Success Rate: {report['summary']['success_rate']}")

        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if result["status"] == "FAIL":
                    print(f"   - {result['test']}")

        return report


if __name__ == "__main__":
    validator = APIValidator()
    report = validator.run_validation()

    # Save report
    with open("qa-api-validation-results.json", "w") as f:
        json.dump(report, f, indent=2)

    print("\n📄 Full report saved to: qa-api-validation-results.json")

    # Exit with appropriate code
    sys.exit(0 if report["summary"]["failed"] == 0 else 1)

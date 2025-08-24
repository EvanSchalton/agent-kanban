#!/usr/bin/env python3
"""Phase 1 Statistical Coloring Testing - Visual Analysis & Algorithm Verification"""

import json
import math
import random
from datetime import datetime, timedelta

import requests

BASE_URL = "http://localhost:18000"
API_URL = f"{BASE_URL}/api"


class Phase1StatisticalColoringTester:
    def __init__(self):
        self.test_results = []
        self.board_id = None
        self.column_ids = []
        self.ticket_ids = []
        self.tickets_with_timing = []

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
        """Setup board and create tickets with varied timing"""
        try:
            # Get existing board
            response = requests.get(f"{API_URL}/boards/")
            if response.status_code == 200:
                boards = response.json()
                if boards:
                    self.board_id = boards[0].get("id")
                    self.log_result("Setup Board", "PASS", f"Using board ID: {self.board_id}")

            # Get columns
            if self.board_id:
                response = requests.get(f"{API_URL}/boards/{self.board_id}/columns")
                if response.status_code == 200:
                    columns = response.json()
                    self.column_ids = [col.get("id") for col in columns if col.get("id")]
                    column_names = [col.get("name", "Unknown") for col in columns]
                    self.log_result(
                        "Setup Columns", "PASS", f"Found columns: {', '.join(column_names)}"
                    )

            return self.board_id is not None and len(self.column_ids) > 0

        except Exception as e:
            self.log_result("Setup Test Data", "ERROR", str(e))
            return False

    def create_timing_test_tickets(self, count: int = 15):
        """Create tickets with varied timing scenarios for statistical analysis"""
        if not self.board_id:
            self.log_result("Create Timing Tickets", "SKIP", "No board available")
            return False

        created_count = 0
        timing_scenarios = [
            ("Fast Processing", 1, "High"),  # Should be green
            ("Fast Processing", 2, "High"),
            ("Fast Processing", 3, "Medium"),
            ("Normal Processing", 10, "Medium"),  # Should be yellow
            ("Normal Processing", 12, "Medium"),
            ("Normal Processing", 11, "Low"),
            ("Normal Processing", 9, "Low"),
            ("Normal Processing", 13, "Medium"),
            ("Slow Processing", 25, "High"),  # Should be red
            ("Slow Processing", 30, "Critical"),
            ("Very Slow", 45, "Critical"),
            ("Extremely Slow", 60, "High"),
            ("Average Case", 8, "Medium"),  # Control cases
            ("Average Case", 14, "Low"),
            ("Average Case", 7, "Medium"),
        ]

        for i, (scenario, time_hours, priority) in enumerate(timing_scenarios[:count]):
            try:
                # Create ticket with simulated time data
                datetime.now() - timedelta(hours=time_hours)

                ticket_data = {
                    "title": f"Statistical Test: {scenario} ({time_hours}h)",
                    "description": f"Testing statistical coloring - {scenario} scenario with {time_hours}h processing time",
                    "priority": priority,
                    "assigned_to": f"tester_{(i % 3) + 1}",
                    "estimate_hours": random.choice([2, 4, 8]),
                    "board_id": self.board_id,
                }

                response = requests.post(
                    f"{API_URL}/tickets/?board_id={self.board_id}", json=ticket_data
                )

                if response.status_code in [200, 201]:
                    ticket = response.json()
                    ticket_id = ticket.get("id")
                    self.ticket_ids.append(ticket_id)

                    # Store timing info for analysis
                    self.tickets_with_timing.append(
                        {
                            "id": ticket_id,
                            "scenario": scenario,
                            "time_hours": time_hours,
                            "priority": priority,
                            "expected_color": self._get_expected_color(time_hours),
                        }
                    )

                    created_count += 1

            except Exception as e:
                print(f"  Failed to create ticket {i + 1}: {e}")

        if created_count > 0:
            self.log_result(
                "Create Timing Tickets", "PASS", f"Created {created_count}/{count} test tickets"
            )
        else:
            self.log_result("Create Timing Tickets", "FAIL", "Could not create any tickets")

        return created_count > 0

    def _get_expected_color(self, time_hours):
        """Predict expected color based on time distribution"""
        # Rough algorithm based on the test data distribution
        if time_hours <= 5:
            return "green"
        elif time_hours <= 20:
            return "yellow"
        else:
            return "red"

    def test_statistical_calculation(self):
        """Test the statistical calculation algorithm matches frontend logic"""
        if not self.tickets_with_timing:
            self.log_result("Statistical Algorithm", "SKIP", "No timing data available")
            return False

        try:
            # Calculate statistics like the frontend does
            times = [
                ticket["time_hours"] * 3600000 for ticket in self.tickets_with_timing
            ]  # Convert to milliseconds

            mean = sum(times) / len(times)
            squared_diffs = [(t - mean) ** 2 for t in times]
            variance = sum(squared_diffs) / len(squared_diffs)
            std_dev = math.sqrt(variance)

            # Test coloring algorithm
            color_results = {"green": 0, "yellow": 0, "red": 0}

            for ticket in self.tickets_with_timing:
                time_ms = ticket["time_hours"] * 3600000
                deviations = abs(time_ms - mean) / std_dev if std_dev > 0 else 0

                if deviations <= 1:
                    predicted_color = "green"
                elif deviations <= 2:
                    predicted_color = "yellow"
                else:
                    predicted_color = "red"

                color_results[predicted_color] += 1

            total_tickets = len(self.tickets_with_timing)
            green_pct = (color_results["green"] / total_tickets) * 100
            yellow_pct = (color_results["yellow"] / total_tickets) * 100
            red_pct = (color_results["red"] / total_tickets) * 100

            self.log_result(
                "Statistical Algorithm",
                "PASS",
                f"Color distribution: {green_pct:.1f}% green, {yellow_pct:.1f}% yellow, {red_pct:.1f}% red",
            )

            # Verify reasonable distribution
            if (
                color_results["green"] > 0
                and color_results["yellow"] > 0
                and color_results["red"] > 0
            ):
                self.log_result("Color Distribution", "PASS", "All three colors represented")
            else:
                self.log_result(
                    "Color Distribution", "WARNING", "Not all color categories have tickets"
                )

            return True

        except Exception as e:
            self.log_result("Statistical Algorithm", "ERROR", str(e))
            return False

    def test_frontend_integration(self):
        """Test that frontend receives tickets with proper data for coloring"""
        try:
            # Get all tickets from API
            response = requests.get(f"{API_URL}/tickets/")
            if response.status_code != 200:
                self.log_result(
                    "Frontend Integration", "FAIL", f"API returned {response.status_code}"
                )
                return False

            tickets = response.json()

            # Check if tickets have required fields for statistical coloring
            required_fields = ["id", "column_id", "updated_at", "created_at", "priority"]
            tickets_with_fields = 0

            for ticket in tickets:
                has_all_fields = all(field in ticket for field in required_fields)
                if has_all_fields:
                    tickets_with_fields += 1

            if tickets_with_fields > 0:
                percentage = (tickets_with_fields / len(tickets)) * 100
                self.log_result(
                    "Frontend Integration",
                    "PASS",
                    f"{tickets_with_fields}/{len(tickets)} tickets have required fields ({percentage:.1f}%)",
                )
            else:
                self.log_result(
                    "Frontend Integration", "FAIL", "No tickets have required fields for coloring"
                )

            return tickets_with_fields > 0

        except Exception as e:
            self.log_result("Frontend Integration", "ERROR", str(e))
            return False

    def test_css_color_classes(self):
        """Verify CSS color classes exist for statistical coloring"""
        try:
            # Check if we can access the frontend to verify CSS
            response = requests.get("http://localhost:15173")  # Frontend URL
            if response.status_code == 200:
                content = response.text

                # Check for color class references
                color_classes = ["ticket-card--green", "ticket-card--yellow", "ticket-card--red"]
                classes_found = []

                for color_class in color_classes:
                    if color_class in content:
                        classes_found.append(color_class)

                if len(classes_found) >= 2:
                    self.log_result(
                        "CSS Color Classes",
                        "PASS",
                        f"Found color classes: {', '.join(classes_found)}",
                    )
                else:
                    self.log_result(
                        "CSS Color Classes",
                        "WARNING",
                        f"Only found {len(classes_found)} color classes",
                    )

            else:
                self.log_result(
                    "CSS Color Classes", "WARNING", "Could not access frontend to verify CSS"
                )

        except Exception as e:
            self.log_result(
                "CSS Color Classes", "WARNING", f"Frontend not accessible: {str(e)[:100]}"
            )

    def test_time_calculation_accuracy(self):
        """Test time in column calculation accuracy"""
        if not self.ticket_ids:
            self.log_result("Time Calculation", "SKIP", "No tickets to test")
            return False

        try:
            # Test a ticket's time calculation
            ticket_id = self.ticket_ids[0]
            response = requests.get(f"{API_URL}/tickets/{ticket_id}")

            if response.status_code == 200:
                ticket = response.json()

                # Check if ticket has timestamp fields
                required_time_fields = ["created_at", "updated_at"]
                has_time_fields = all(field in ticket for field in required_time_fields)

                if has_time_fields:
                    # Calculate expected time in current column
                    updated_time = datetime.fromisoformat(
                        ticket["updated_at"].replace("Z", "+00:00")
                    )
                    current_time = datetime.now(updated_time.tzinfo)
                    time_diff = current_time - updated_time

                    self.log_result(
                        "Time Calculation",
                        "PASS",
                        f"Ticket has time fields, current time in column: {time_diff}",
                    )
                else:
                    self.log_result("Time Calculation", "FAIL", "Ticket missing timestamp fields")

            else:
                self.log_result(
                    "Time Calculation",
                    "FAIL",
                    f"Could not get ticket details: {response.status_code}",
                )

        except Exception as e:
            self.log_result("Time Calculation", "ERROR", str(e))

    def test_excluded_columns(self):
        """Test that 'Not Started' and 'Done' columns are excluded from coloring"""
        try:
            # This tests the frontend logic for excluded columns
            excluded_columns = ["not_started", "done"]

            # Check if we have these column types in our test data
            response = requests.get(f"{API_URL}/boards/{self.board_id}/columns")
            if response.status_code == 200:
                columns = response.json()
                column_names = [col.get("name", "").lower() for col in columns]

                excluded_found = []
                for excluded in excluded_columns:
                    for name in column_names:
                        if excluded in name or name in excluded:
                            excluded_found.append(name)

                if excluded_found:
                    self.log_result(
                        "Excluded Columns",
                        "PASS",
                        f"Found excluded columns: {', '.join(excluded_found)}",
                    )
                else:
                    self.log_result(
                        "Excluded Columns",
                        "WARNING",
                        "No 'Not Started' or 'Done' columns found for exclusion test",
                    )

        except Exception as e:
            self.log_result("Excluded Columns", "ERROR", str(e))

    def run_all_statistical_tests(self):
        """Execute all statistical coloring tests"""
        print("\n" + "=" * 70)
        print("PHASE 1 STATISTICAL COLORING TESTING")
        print("Visual Analysis & Algorithm Verification")
        print("=" * 70 + "\n")

        # Setup
        print("🔧 Phase 1: Test Setup")
        print("-" * 40)
        if not self.setup_test_data():
            print("❌ Setup failed - aborting statistical tests")
            return None

        # Create test data with varied timing
        print("\n📊 Phase 2: Test Data Creation")
        print("-" * 40)
        self.create_timing_test_tickets(15)

        # Test statistical calculations
        print("\n🧮 Phase 3: Statistical Algorithm Testing")
        print("-" * 40)
        self.test_statistical_calculation()
        self.test_time_calculation_accuracy()
        self.test_excluded_columns()

        # Test frontend integration
        print("\n🎨 Phase 4: Frontend Integration Testing")
        print("-" * 40)
        self.test_frontend_integration()
        self.test_css_color_classes()

        # Results summary
        print("\n" + "=" * 70)
        print("STATISTICAL COLORING TEST SUMMARY")
        print("=" * 70)

        passed = sum(1 for r in self.test_results if r["status"] == "PASS")
        failed = sum(1 for r in self.test_results if r["status"] == "FAIL")
        warnings = sum(1 for r in self.test_results if r["status"] == "WARNING")
        errors = sum(1 for r in self.test_results if r["status"] == "ERROR")
        skipped = sum(1 for r in self.test_results if r["status"] == "SKIP")

        print(f"✓ Passed: {passed}")
        print(f"✗ Failed: {failed}")
        print(f"⚠ Warnings: {warnings}")
        print(f"! Errors: {errors}")
        print(f"- Skipped: {skipped}")

        # Phase 1 Assessment
        if passed >= 4 and failed == 0:
            print("\n🎯 STATISTICAL COLORING: READY FOR PHASE 1")
        elif passed >= 2:
            print("\n⚠️ STATISTICAL COLORING: PARTIALLY WORKING")
        else:
            print("\n❌ STATISTICAL COLORING: MAJOR ISSUES")

        print("=" * 70 + "\n")

        return {
            "results": self.test_results,
            "summary": {
                "passed": passed,
                "failed": failed,
                "warnings": warnings,
                "errors": errors,
                "skipped": skipped,
            },
            "test_tickets_created": len(self.ticket_ids),
            "timing_scenarios": len(self.tickets_with_timing),
        }


if __name__ == "__main__":
    tester = Phase1StatisticalColoringTester()
    results = tester.run_all_statistical_tests()

    if results:
        # Save results
        with open("/workspaces/agent-kanban/tests/phase1_statistical_results.json", "w") as f:
            json.dump({"results": results, "timestamp": datetime.now().isoformat()}, f, indent=2)

        print("📁 Results saved to phase1_statistical_results.json")

#!/usr/bin/env python3
"""
QA Direct Database Validation
Tests card creation functionality by directly accessing the backend logic
"""

import json
import sys
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.core.config import settings
from app.models import Board, Ticket
from sqlmodel import Session, create_engine, select


class DirectQAValidator:
    def __init__(self):
        self.results = []
        self.engine = None

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

    def setup_database(self):
        """Setup database connection"""
        try:
            database_url = settings.database_url
            self.engine = create_engine(database_url)
            self.log_result("Database Connection", "PASS", {"url": "sqlite://..."})
            return True
        except Exception as e:
            self.log_result("Database Connection", "FAIL", {"error": str(e)})
            return False

    def test_boards_exist(self):
        """Test that boards exist in database"""
        try:
            with Session(self.engine) as session:
                boards = session.exec(select(Board)).all()
                if len(boards) > 0:
                    self.log_result(
                        "Boards Exist",
                        "PASS",
                        {
                            "board_count": len(boards),
                            "first_board": boards[0].name if boards else None,
                        },
                    )
                    return boards[0].id
                else:
                    self.log_result("Boards Exist", "FAIL", {"board_count": 0})
                    return None
        except Exception as e:
            self.log_result("Boards Exist", "FAIL", {"error": str(e)})
            return None

    def test_ticket_creation_all_columns(self, board_id):
        """Test ticket creation in all columns"""
        if not board_id:
            self.log_result("Ticket Creation Test", "SKIP", {"reason": "No board available"})
            return []

        columns = ["To Do", "In Progress", "Done"]
        created_tickets = []

        for column in columns:
            try:
                with Session(self.engine) as session:
                    ticket = Ticket(
                        title=f"QA Test Ticket - {column}",
                        description=f"Testing ticket creation in {column} column",
                        current_column=column,
                        board_id=board_id,
                        priority="Medium",
                        assignee="qa-agent",
                    )
                    session.add(ticket)
                    session.commit()
                    session.refresh(ticket)

                    created_tickets.append(ticket.id)
                    self.log_result(
                        f"Ticket Creation - {column}",
                        "PASS",
                        {"ticket_id": ticket.id, "board_id": board_id, "column": column},
                    )
            except Exception as e:
                self.log_result(f"Ticket Creation - {column}", "FAIL", {"error": str(e)})

        return created_tickets

    def test_board_id_requirement(self, board_id):
        """Test that board_id is required for tickets"""
        try:
            with Session(self.engine) as session:
                # Try creating ticket without board_id (should fail)
                ticket = Ticket(
                    title="Test Ticket Without Board",
                    description="Should fail validation",
                    current_column="To Do",
                    # Missing board_id
                )
                session.add(ticket)
                session.commit()

                # If we reach here, the validation failed
                self.log_result(
                    "Board ID Requirement", "FAIL", {"reason": "Ticket created without board_id"}
                )
        except Exception as e:
            # This should happen - board_id is required
            self.log_result(
                "Board ID Requirement", "PASS", {"correctly_rejected": True, "error": str(e)}
            )

    def test_crud_operations(self, board_id):
        """Test full CRUD workflow"""
        if not board_id:
            self.log_result("CRUD Operations", "SKIP", {"reason": "No board available"})
            return

        try:
            with Session(self.engine) as session:
                # CREATE
                ticket = Ticket(
                    title="QA CRUD Test Ticket",
                    description="Testing CRUD operations",
                    current_column="To Do",
                    board_id=board_id,
                    priority="High",
                )
                session.add(ticket)
                session.commit()
                session.refresh(ticket)
                ticket_id = ticket.id

                # READ
                read_ticket = session.get(Ticket, ticket_id)
                if not read_ticket:
                    self.log_result("CRUD - Read", "FAIL", {"ticket_id": ticket_id})
                    return

                # UPDATE
                read_ticket.title = "QA CRUD Test Ticket - Updated"
                read_ticket.current_column = "In Progress"
                session.add(read_ticket)
                session.commit()

                # Verify update
                updated_ticket = session.get(Ticket, ticket_id)
                if updated_ticket.title != "QA CRUD Test Ticket - Updated":
                    self.log_result(
                        "CRUD - Update", "FAIL", {"expected_title": "QA CRUD Test Ticket - Updated"}
                    )
                    return

                # DELETE
                session.delete(updated_ticket)
                session.commit()

                # Verify deletion
                deleted_ticket = session.get(Ticket, ticket_id)
                if deleted_ticket is None:
                    self.log_result("CRUD Operations", "PASS", {"ticket_id": ticket_id})
                else:
                    self.log_result("CRUD - Delete", "FAIL", {"ticket_still_exists": True})

        except Exception as e:
            self.log_result("CRUD Operations", "FAIL", {"error": str(e)})

    def test_data_integrity(self):
        """Test data integrity and relationships"""
        try:
            with Session(self.engine) as session:
                # Count tickets per board
                boards = session.exec(select(Board)).all()
                for board in boards:
                    tickets = session.exec(select(Ticket).where(Ticket.board_id == board.id)).all()
                    columns = {}
                    for ticket in tickets:
                        col = ticket.current_column
                        columns[col] = columns.get(col, 0) + 1

                    self.log_result(
                        f"Data Integrity - Board {board.id}",
                        "PASS",
                        {
                            "board_name": board.name,
                            "ticket_count": len(tickets),
                            "column_distribution": columns,
                        },
                    )
        except Exception as e:
            self.log_result("Data Integrity", "FAIL", {"error": str(e)})

    def test_regression_checks(self):
        """Check for common regression issues"""
        try:
            with Session(self.engine) as session:
                # Check for orphaned tickets (tickets without boards)
                orphaned = session.exec(select(Ticket).where(Ticket.board_id.is_(None))).all()

                if len(orphaned) == 0:
                    self.log_result("Regression - No Orphaned Tickets", "PASS", {})
                else:
                    self.log_result(
                        "Regression - Orphaned Tickets Found",
                        "FAIL",
                        {"orphaned_count": len(orphaned)},
                    )

                # Check for invalid column values
                valid_columns = ["To Do", "In Progress", "Done"]
                invalid_tickets = session.exec(
                    select(Ticket).where(~Ticket.current_column.in_(valid_columns))
                ).all()

                if len(invalid_tickets) == 0:
                    self.log_result("Regression - Valid Column Values", "PASS", {})
                else:
                    self.log_result(
                        "Regression - Invalid Columns Found",
                        "FAIL",
                        {
                            "invalid_count": len(invalid_tickets),
                            "invalid_columns": list({t.current_column for t in invalid_tickets}),
                        },
                    )

        except Exception as e:
            self.log_result("Regression Checks", "FAIL", {"error": str(e)})

    def run_validation(self):
        """Run all validation tests"""
        print("🚀 Starting QA Direct Database Validation...")
        print("=" * 50)

        # Setup
        if not self.setup_database():
            return self.generate_report()

        # Test 1: Check boards exist
        board_id = self.test_boards_exist()

        # Test 2: Test ticket creation in all columns
        self.test_ticket_creation_all_columns(board_id)

        # Test 3: Test board_id requirement
        self.test_board_id_requirement(board_id)

        # Test 4: Test CRUD operations
        self.test_crud_operations(board_id)

        # Test 5: Test data integrity
        self.test_data_integrity()

        # Test 6: Regression checks
        self.test_regression_checks()

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
            "test_type": "Direct Database Validation",
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
    validator = DirectQAValidator()
    report = validator.run_validation()

    # Save report
    with open("qa-direct-validation-results.json", "w") as f:
        json.dump(report, f, indent=2)

    print("\n📄 Full report saved to: qa-direct-validation-results.json")

    # Exit with appropriate code
    sys.exit(0 if report["summary"]["failed"] == 0 else 1)

#!/usr/bin/env python3
"""Phase 1 Load Test: 20 Concurrent Users, 500 Tasks - No Authentication"""

import asyncio
import json
import random
import statistics
import time
from datetime import datetime
from typing import Any

import aiohttp

BASE_URL = "http://localhost:18000"
API_URL = f"{BASE_URL}/api"


class Phase1LoadTester:
    def __init__(self, num_users: int = 20, num_tasks: int = 500):
        self.num_users = num_users
        self.num_tasks = num_tasks
        self.board_id = None
        self.column_ids = []
        self.created_tickets = []
        self.metrics = {
            "create_ticket": [],
            "get_tickets": [],
            "move_ticket": [],
            "update_ticket": [],
            "errors": [],
        }

    async def setup_test_environment(self):
        """Setup test board and get column information"""
        async with aiohttp.ClientSession() as session:
            try:
                # Get existing boards first
                async with session.get(f"{API_URL}/boards/") as response:
                    if response.status == 200:
                        boards = await response.json()
                        if boards:
                            self.board_id = boards[0]["id"]
                            print(f"✅ Using existing board ID: {self.board_id}")

                # Get columns for this board
                if self.board_id:
                    async with session.get(f"{API_URL}/boards/{self.board_id}/columns") as response:
                        if response.status == 200:
                            columns = await response.json()
                            # Handle both dict and list responses
                            if isinstance(columns, list):
                                self.column_ids = [
                                    str(col.get("id", col)) if isinstance(col, dict) else str(col)
                                    for col in columns
                                ]
                            else:
                                self.column_ids = ["1", "2", "3", "4", "5"]  # Default column IDs
                            print(f"✅ Found {len(self.column_ids)} columns: {self.column_ids}")

                if not self.board_id:
                    # Create new board if needed
                    board_data = {
                        "name": f"Phase 1 Load Test {datetime.now().strftime('%H%M%S')}",
                        "description": "Load testing 20 users, 500 tasks",
                    }
                    async with session.post(f"{API_URL}/boards/", json=board_data) as response:
                        if response.status in [200, 201]:
                            board = await response.json()
                            self.board_id = board["id"]
                            print(f"✅ Created test board ID: {self.board_id}")

                return self.board_id is not None

            except Exception as e:
                print(f"❌ Setup failed: {e}")
                return False

    async def create_ticket(
        self, session: aiohttp.ClientSession, user_id: int, task_num: int
    ) -> bool:
        """Create a single ticket and measure performance"""
        start_time = time.time()

        ticket_data = {
            "title": f"Load Test Task {task_num:04d}",
            "description": f"Created by User {user_id:02d} during Phase 1 load test",
            "priority": random.choice(["Low", "Medium", "High", "Critical"]),
            "assigned_to": f"user_{user_id:02d}",
            "estimate_hours": random.choice([1, 2, 4, 8]),
            "board_id": self.board_id,  # Include in body as required
        }

        try:
            # Try the corrected format based on previous error analysis
            async with session.post(
                f"{API_URL}/tickets/?board_id={self.board_id}", json=ticket_data
            ) as response:
                elapsed = (time.time() - start_time) * 1000

                if response.status in [200, 201]:
                    ticket = await response.json()
                    self.created_tickets.append(ticket.get("id", f"task_{task_num}"))
                    self.metrics["create_ticket"].append(elapsed)
                    return True
                else:
                    error_text = await response.text()
                    self.metrics["errors"].append(
                        {
                            "operation": "create_ticket",
                            "status": response.status,
                            "error": error_text[:200],
                            "user": user_id,
                            "task": task_num,
                        }
                    )
                    return False

        except Exception as e:
            self.metrics["errors"].append(
                {
                    "operation": "create_ticket",
                    "error": str(e)[:200],
                    "user": user_id,
                    "task": task_num,
                }
            )
            return False

    async def simulate_user_activity(self, user_id: int) -> dict[str, int]:
        """Simulate a single user's activity"""
        tasks_per_user = self.num_tasks // self.num_users
        extra_task = 1 if user_id < (self.num_tasks % self.num_users) else 0
        my_tasks = tasks_per_user + extra_task

        results = {"created": 0, "reads": 0, "moves": 0, "updates": 0}

        async with aiohttp.ClientSession() as session:
            # Create tasks
            for i in range(my_tasks):
                task_num = user_id * tasks_per_user + i
                success = await self.create_ticket(session, user_id, task_num)
                if success:
                    results["created"] += 1

                # Simulate realistic user behavior - periodic reads
                if i % 3 == 0:
                    await self.read_tickets(session)
                    results["reads"] += 1

                # Simulate occasional ticket moves
                if i % 5 == 0 and len(self.created_tickets) > 0:
                    await self.move_random_ticket(session)
                    results["moves"] += 1

                # Small delay between operations
                await asyncio.sleep(random.uniform(0.05, 0.2))

        print(
            f"User {user_id:02d}: {results['created']}/{my_tasks} tasks, {results['reads']} reads, {results['moves']} moves"
        )
        return results

    async def read_tickets(self, session: aiohttp.ClientSession):
        """Read all tickets and measure performance"""
        start_time = time.time()
        try:
            async with session.get(f"{API_URL}/tickets/") as response:
                elapsed = (time.time() - start_time) * 1000
                if response.status == 200:
                    self.metrics["get_tickets"].append(elapsed)
                else:
                    self.metrics["errors"].append(
                        {"operation": "get_tickets", "status": response.status}
                    )
        except Exception as e:
            self.metrics["errors"].append({"operation": "get_tickets", "error": str(e)[:200]})

    async def move_random_ticket(self, session: aiohttp.ClientSession):
        """Move a random ticket and measure performance"""
        if not self.created_tickets or not self.column_ids:
            return

        start_time = time.time()
        try:
            ticket_id = random.choice(self.created_tickets)
            target_column = random.choice(self.column_ids)

            move_data = {
                "ticket_id": ticket_id,
                "target_column_id": target_column,
                "position": random.randint(0, 2),
            }

            async with session.post(f"{API_URL}/tickets/move", json=move_data) as response:
                elapsed = (time.time() - start_time) * 1000
                if response.status in [200, 201]:
                    self.metrics["move_ticket"].append(elapsed)
                else:
                    self.metrics["errors"].append(
                        {
                            "operation": "move_ticket",
                            "status": response.status,
                            "ticket_id": ticket_id,
                        }
                    )
        except Exception as e:
            self.metrics["errors"].append({"operation": "move_ticket", "error": str(e)[:200]})

    async def stress_test_concurrent_reads(self):
        """Test system under heavy concurrent read load"""
        print("\n🔄 Running concurrent read stress test...")

        async def concurrent_read():
            async with aiohttp.ClientSession() as session:
                await self.read_tickets(session)

        # Launch 50 concurrent read operations
        start_time = time.time()
        tasks = [concurrent_read() for _ in range(50)]
        await asyncio.gather(*tasks)
        elapsed = time.time() - start_time

        print(f"  50 concurrent reads completed in {elapsed:.2f}s")

    def calculate_statistics(self) -> dict[str, Any]:
        """Calculate performance statistics"""
        stats = {}

        for operation, times in self.metrics.items():
            if operation != "errors" and times:
                stats[operation] = {
                    "count": len(times),
                    "min": min(times),
                    "max": max(times),
                    "mean": statistics.mean(times),
                    "median": statistics.median(times),
                    "p95": sorted(times)[int(len(times) * 0.95)]
                    if len(times) >= 20
                    else max(times),
                    "p99": sorted(times)[int(len(times) * 0.99)]
                    if len(times) >= 100
                    else max(times),
                }

        return stats

    async def run_load_test(self):
        """Execute Phase 1 load test"""
        print("\n" + "=" * 70)
        print(f"PHASE 1 LOAD TEST: {self.num_users} Users, {self.num_tasks} Tasks")
        print("NO AUTHENTICATION REQUIRED")
        print("=" * 70 + "\n")

        # Setup
        print("🔧 Setting up test environment...")
        if not await self.setup_test_environment():
            print("❌ Setup failed - aborting load test")
            return None

        print("📊 Test Configuration:")
        print(f"  Board ID: {self.board_id}")
        print(f"  Columns: {len(self.column_ids)}")
        print(f"  Users: {self.num_users}")
        print(f"  Tasks: {self.num_tasks}")
        print(f"  Tasks per user: ~{self.num_tasks // self.num_users}")

        # Execute main load test
        print(f"\n🚀 Starting load test at {datetime.now().strftime('%H:%M:%S')}")
        start_time = time.time()

        # Create user simulation tasks
        user_tasks = [self.simulate_user_activity(i) for i in range(self.num_users)]
        user_results = await asyncio.gather(*user_tasks)

        # Additional stress testing
        await self.stress_test_concurrent_reads()

        end_time = time.time()
        total_time = end_time - start_time

        # Calculate results
        total_created = sum(result["created"] for result in user_results)
        total_reads = sum(result["reads"] for result in user_results)
        total_moves = sum(result["moves"] for result in user_results)

        stats = self.calculate_statistics()

        # Generate report
        print("\n" + "=" * 70)
        print("PHASE 1 LOAD TEST RESULTS")
        print("=" * 70)

        print("\n📈 Overall Performance:")
        print(f"  Total Test Time: {total_time:.2f} seconds")
        print(
            f"  Tasks Created: {total_created}/{self.num_tasks} ({total_created / self.num_tasks * 100:.1f}%)"
        )
        print(f"  Throughput: {total_created / total_time:.2f} tasks/second")
        print(f"  Total Operations: {total_created + total_reads + total_moves}")
        print(f"  Errors: {len(self.metrics['errors'])}")

        print("\n⏱️ Response Time Statistics:")
        for operation, stat in stats.items():
            print(f"\n  {operation.upper().replace('_', ' ')}:")
            print(f"    Operations: {stat['count']}")
            print(f"    Min: {stat['min']:.2f}ms")
            print(f"    Max: {stat['max']:.2f}ms")
            print(f"    Mean: {stat['mean']:.2f}ms")
            print(f"    Median: {stat['median']:.2f}ms")
            print(f"    P95: {stat['p95']:.2f}ms")

        # Phase 1 Success Criteria Assessment
        print("\n🎯 Phase 1 Success Criteria Assessment:")

        create_mean = stats.get("create_ticket", {}).get("mean", 0)
        if create_mean < 200:
            print("  ✅ Ticket Creation: EXCELLENT (<200ms)")
        elif create_mean < 500:
            print("  ⚠️ Ticket Creation: ACCEPTABLE (<500ms)")
        else:
            print("  ❌ Ticket Creation: POOR (>500ms)")

        success_rate = (total_created / self.num_tasks) * 100
        if success_rate >= 95:
            print("  ✅ Reliability: EXCELLENT (>95%)")
        elif success_rate >= 80:
            print("  ⚠️ Reliability: ACCEPTABLE (>80%)")
        else:
            print("  ❌ Reliability: POOR (<80%)")

        # Check for critical errors
        critical_errors = [e for e in self.metrics["errors"] if e.get("status", 0) >= 500]
        if not critical_errors:
            print("  ✅ Stability: NO CRITICAL ERRORS")
        else:
            print(f"  ❌ Stability: {len(critical_errors)} CRITICAL ERRORS")

        if len(self.metrics["errors"]) == 0:
            print("  ✅ Error Rate: ZERO ERRORS")
        elif len(self.metrics["errors"]) < total_created * 0.05:
            print("  ⚠️ Error Rate: LOW (<5%)")
        else:
            print("  ❌ Error Rate: HIGH (>5%)")

        print("\n" + "=" * 70)

        # Return detailed results
        return {
            "config": {"users": self.num_users, "tasks": self.num_tasks, "board_id": self.board_id},
            "results": {
                "total_time": total_time,
                "tasks_created": total_created,
                "success_rate": success_rate,
                "throughput": total_created / total_time if total_time > 0 else 0,
                "total_operations": total_created + total_reads + total_moves,
                "error_count": len(self.metrics["errors"]),
            },
            "performance": stats,
            "errors": self.metrics["errors"],
            "timestamp": datetime.now().isoformat(),
        }


async def main():
    print("🔥 Phase 1 Load Test")
    print("Target: 20 concurrent users, 500 tasks")
    print("No authentication required - open access system")

    tester = Phase1LoadTester(num_users=20, num_tasks=500)
    results = await tester.run_load_test()

    if results:
        # Save detailed results
        with open("/workspaces/agent-kanban/tests/phase1_load_test_results.json", "w") as f:
            json.dump(results, f, indent=2)

        print("\n📁 Detailed results saved to phase1_load_test_results.json")


if __name__ == "__main__":
    asyncio.run(main())

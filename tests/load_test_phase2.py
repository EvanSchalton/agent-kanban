#!/usr/bin/env python3
"""Phase 2 Load Testing Script - 50 Agents, 1000 Tasks"""

import asyncio
import json
import random
import statistics
import time
from datetime import datetime

import aiohttp

BASE_URL = "http://localhost:18000"
API_URL = f"{BASE_URL}/api"


class Phase2LoadTester:
    def __init__(self, num_agents: int = 50, num_tasks: int = 1000):
        self.num_agents = num_agents
        self.num_tasks = num_tasks
        self.board_id = None
        self.column_ids = []
        self.ticket_ids = []
        self.metrics = {
            "create": [],
            "read": [],
            "update": [],
            "move": [],
            "delete": [],
            "websocket": [],
        }
        self.errors = []
        self.start_time = None
        self.end_time = None

    async def setup(self):
        """Setup test environment"""
        async with aiohttp.ClientSession() as session:
            # Create load test board
            board_data = {
                "name": f"Load Test Phase 2 - {datetime.now().strftime('%H%M%S')}",
                "description": f"Testing {self.num_agents} agents with {self.num_tasks} tasks",
            }

            try:
                async with session.post(f"{API_URL}/boards/", json=board_data) as response:
                    if response.status in [200, 201]:
                        board = await response.json()
                        self.board_id = board["id"]
                        print(f"✅ Created load test board: {self.board_id}")

                        # Get columns
                        async with session.get(
                            f"{API_URL}/boards/{self.board_id}/columns"
                        ) as col_response:
                            if col_response.status == 200:
                                columns = await col_response.json()
                                self.column_ids = [c["id"] for c in columns]
                                print(f"✅ Found {len(self.column_ids)} columns")
                                return True
            except Exception as e:
                print(f"❌ Setup failed: {e}")
                return False

        return False

    async def create_ticket_batch(
        self, session: aiohttp.ClientSession, agent_id: int, batch_size: int
    ):
        """Create a batch of tickets for an agent"""
        created = 0
        batch_start = time.time()

        for i in range(batch_size):
            task_num = agent_id * (self.num_tasks // self.num_agents) + i

            ticket_data = {
                "title": f"Task #{task_num:04d} - Agent {agent_id}",
                "description": f"Load test task {task_num} managed by Agent {agent_id}. Priority: {random.choice(['Low', 'Medium', 'High', 'Critical'])}",
                "priority": random.choice(["Low", "Medium", "High", "Critical"]),
                "assigned_to": f"Agent_{agent_id:02d}",
                "estimate_hours": random.choice([1, 2, 4, 8, 16]),
                "tags": [f"batch_{agent_id}", "load_test", "phase2"],
            }

            try:
                start = time.time()
                async with session.post(
                    f"{API_URL}/tickets/?board_id={self.board_id}", json=ticket_data
                ) as response:
                    elapsed = (time.time() - start) * 1000

                    if response.status in [200, 201]:
                        ticket = await response.json()
                        self.ticket_ids.append(ticket["id"])
                        self.metrics["create"].append(elapsed)
                        created += 1
                    else:
                        self.errors.append(f"Create failed: {response.status}")

            except Exception as e:
                self.errors.append(f"Create error: {str(e)[:50]}")

        batch_time = time.time() - batch_start
        return created, batch_time

    async def simulate_agent_activity(self, agent_id: int):
        """Simulate realistic agent activity"""
        async with aiohttp.ClientSession() as session:
            tasks_per_agent = self.num_tasks // self.num_agents
            extra_tasks = self.num_tasks % self.num_agents

            # Distribute extra tasks to first few agents
            my_tasks = tasks_per_agent + (1 if agent_id < extra_tasks else 0)

            # Create tickets in batches
            batch_size = min(10, my_tasks)
            batches = my_tasks // batch_size

            total_created = 0

            for batch in range(batches):
                created, batch_time = await self.create_ticket_batch(session, agent_id, batch_size)
                total_created += created

                # Simulate realistic behavior between batches
                if batch % 3 == 0 and self.ticket_ids:
                    # Read operations
                    try:
                        start = time.time()
                        async with session.get(f"{API_URL}/tickets/") as response:
                            if response.status == 200:
                                self.metrics["read"].append((time.time() - start) * 1000)
                    except:
                        pass

                if batch % 5 == 0 and len(self.ticket_ids) > 10:
                    # Move operation
                    try:
                        ticket_id = random.choice(self.ticket_ids[-10:])
                        target_column = random.choice(self.column_ids) if self.column_ids else None

                        if target_column:
                            move_data = {
                                "ticket_id": ticket_id,
                                "target_column_id": target_column,
                                "position": 0,
                            }

                            start = time.time()
                            async with session.post(
                                f"{API_URL}/tickets/move", json=move_data
                            ) as response:
                                if response.status in [200, 201]:
                                    self.metrics["move"].append((time.time() - start) * 1000)
                    except:
                        pass

                # Small delay to avoid overwhelming the server
                await asyncio.sleep(random.uniform(0.1, 0.3))

            # Handle remaining tasks
            remaining = my_tasks % batch_size
            if remaining > 0:
                created, _ = await self.create_ticket_batch(session, agent_id, remaining)
                total_created += created

            print(f"Agent {agent_id:02d}: Created {total_created}/{my_tasks} tasks")
            return total_created

    async def test_concurrent_operations(self):
        """Test system under heavy concurrent load"""
        print("\n🚀 Starting concurrent operations test...")

        # Create multiple concurrent sessions
        async with aiohttp.ClientSession() as session:
            concurrent_tasks = []

            # Simulate burst of reads
            for _ in range(20):
                concurrent_tasks.append(session.get(f"{API_URL}/tickets/"))

            # Simulate burst of creates
            for i in range(10):
                ticket_data = {
                    "title": f"Concurrent Test {i}",
                    "description": "Testing concurrent creation",
                    "priority": "High",
                }
                concurrent_tasks.append(
                    session.post(f"{API_URL}/tickets/?board_id={self.board_id}", json=ticket_data)
                )

            # Execute all concurrently
            start = time.time()
            responses = await asyncio.gather(*concurrent_tasks, return_exceptions=True)
            elapsed = time.time() - start

            successful = sum(1 for r in responses if not isinstance(r, Exception))
            print(f"  Concurrent operations: {successful}/30 successful in {elapsed:.2f}s")

    async def test_websocket_connections(self):
        """Test WebSocket scalability"""
        print("\n🔌 Testing WebSocket connections...")

        import websockets

        connected = 0
        failed = 0

        async def connect_ws(agent_id):
            nonlocal connected, failed
            try:
                uri = "ws://localhost:18000/ws/connect"
                async with websockets.connect(uri) as ws:
                    await ws.send(json.dumps({"type": "agent_connect", "agent_id": agent_id}))
                    connected += 1
                    await asyncio.sleep(1)  # Keep connection open briefly
            except:
                failed += 1

        # Try to connect multiple agents simultaneously
        tasks = [connect_ws(i) for i in range(min(20, self.num_agents))]

        try:
            await asyncio.gather(*tasks)
            print(f"  WebSocket connections: {connected} connected, {failed} failed")
        except Exception as e:
            print(f"  WebSocket test error: {e}")

    async def measure_system_degradation(self):
        """Measure how system performance degrades with load"""
        print("\n📊 Measuring system degradation...")

        async with aiohttp.ClientSession() as session:
            measurements = []

            # Take measurements at different load levels
            load_levels = [0, 25, 50, 75, 100]  # Percentage of total tickets created

            for level in load_levels:
                expected_tickets = int(self.num_tasks * level / 100)
                actual_tickets = len(self.ticket_ids)

                if actual_tickets >= expected_tickets:
                    # Measure response time at this load level
                    start = time.time()
                    try:
                        async with session.get(f"{API_URL}/tickets/") as response:
                            if response.status == 200:
                                elapsed = (time.time() - start) * 1000
                                measurements.append(
                                    {
                                        "load_level": level,
                                        "tickets": actual_tickets,
                                        "response_time": elapsed,
                                    }
                                )
                                print(
                                    f"  Load {level}% ({actual_tickets} tickets): {elapsed:.2f}ms"
                                )
                    except:
                        pass

            return measurements

    def calculate_statistics(self):
        """Calculate detailed performance statistics"""
        stats = {}

        for operation, times in self.metrics.items():
            if times:
                stats[operation] = {
                    "count": len(times),
                    "min": min(times),
                    "max": max(times),
                    "mean": statistics.mean(times),
                    "median": statistics.median(times),
                    "stdev": statistics.stdev(times) if len(times) > 1 else 0,
                    "p95": sorted(times)[int(len(times) * 0.95)] if times else 0,
                    "p99": sorted(times)[int(len(times) * 0.99)] if times else 0,
                }

        return stats

    async def run_load_test(self):
        """Execute Phase 2 load test"""
        print("\n" + "=" * 70)
        print(f"PHASE 2 LOAD TEST: {self.num_agents} Agents, {self.num_tasks} Tasks")
        print("=" * 70 + "\n")

        # Setup
        if not await self.setup():
            print("❌ Setup failed, aborting load test")
            return None

        print("\n📊 Test Configuration:")
        print(f"  Agents: {self.num_agents}")
        print(f"  Tasks: {self.num_tasks}")
        print(f"  Tasks per agent: ~{self.num_tasks // self.num_agents}")

        # Start load test
        self.start_time = time.time()
        print(f"\n🚀 Starting load test at {datetime.now().strftime('%H:%M:%S')}")

        # Phase 1: Agent simulation
        print("\n📝 Phase 1: Creating tasks with multiple agents...")
        agent_tasks = [self.simulate_agent_activity(i) for i in range(self.num_agents)]
        results = await asyncio.gather(*agent_tasks)
        total_created = sum(results)

        # Phase 2: Concurrent operations
        await self.test_concurrent_operations()

        # Phase 3: WebSocket testing
        await self.test_websocket_connections()

        # Phase 4: Performance degradation
        degradation = await self.measure_system_degradation()

        self.end_time = time.time()
        total_time = self.end_time - self.start_time

        # Calculate statistics
        stats = self.calculate_statistics()

        # Generate report
        print("\n" + "=" * 70)
        print("LOAD TEST RESULTS")
        print("=" * 70)

        print("\n📈 Overall Performance:")
        print(f"  Total Time: {total_time:.2f} seconds")
        print(
            f"  Tasks Created: {total_created}/{self.num_tasks} ({total_created / self.num_tasks * 100:.1f}%)"
        )
        print(f"  Throughput: {total_created / total_time:.2f} tasks/second")
        print(f"  Errors: {len(self.errors)}")

        print("\n⏱️ Response Time Statistics (ms):")
        for op, stat in stats.items():
            if stat["count"] > 0:
                print(f"\n  {op.upper()}:")
                print(f"    Count: {stat['count']}")
                print(f"    Min: {stat['min']:.2f}ms")
                print(f"    Max: {stat['max']:.2f}ms")
                print(f"    Mean: {stat['mean']:.2f}ms")
                print(f"    Median: {stat['median']:.2f}ms")
                print(f"    StdDev: {stat['stdev']:.2f}ms")
                print(f"    P95: {stat['p95']:.2f}ms")
                print(f"    P99: {stat['p99']:.2f}ms")

        print("\n🔍 System Behavior:")
        print(f"  Successful API calls: {sum(s['count'] for s in stats.values() if 'count' in s)}")
        print(f"  Failed operations: {len(self.errors)}")
        if self.errors:
            print(f"  Sample errors: {self.errors[:3]}")

        # Performance assessment
        print("\n✅ Performance Assessment:")
        create_mean = stats.get("create", {}).get("mean", 0)
        if create_mean and create_mean < 100:
            print("  ✅ CREATE performance: EXCELLENT (<100ms)")
        elif create_mean and create_mean < 200:
            print("  ⚠️ CREATE performance: ACCEPTABLE (<200ms)")
        else:
            print("  ❌ CREATE performance: POOR (>200ms)")

        if total_created >= self.num_tasks * 0.95:
            print("  ✅ Reliability: EXCELLENT (>95% success)")
        elif total_created >= self.num_tasks * 0.80:
            print("  ⚠️ Reliability: ACCEPTABLE (>80% success)")
        else:
            print("  ❌ Reliability: POOR (<80% success)")

        print("\n" + "=" * 70)

        # Save detailed report
        report = {
            "config": {
                "agents": self.num_agents,
                "tasks": self.num_tasks,
                "board_id": self.board_id,
            },
            "results": {
                "total_time": total_time,
                "tasks_created": total_created,
                "throughput": total_created / total_time if total_time > 0 else 0,
                "errors": len(self.errors),
            },
            "statistics": stats,
            "degradation": degradation,
            "timestamp": datetime.now().isoformat(),
        }

        with open("/workspaces/agent-kanban/tests/phase2_load_test_results.json", "w") as f:
            json.dump(report, f, indent=2)

        print("\n📄 Detailed report saved to phase2_load_test_results.json")

        return report


async def main():
    print("🔥 Phase 2 Load Testing Suite")
    print("Target: 50 concurrent agents, 1000 tasks")
    print("\n⚠️ This will create significant load on the system")

    response = input("\nProceed with load test? (y/n): ")
    if response.lower() != "y":
        print("Load test cancelled")
        return

    tester = Phase2LoadTester(num_agents=50, num_tasks=1000)
    await tester.run_load_test()


if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""Load Testing Script for Agent Kanban Board"""

import asyncio
import json
import random
import statistics
import time
from datetime import datetime

import aiohttp

BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/api"


class LoadTester:
    def __init__(self, num_agents: int = 20, num_tasks: int = 500):
        self.num_agents = num_agents
        self.num_tasks = num_tasks
        self.board_id = None
        self.column_ids = []
        self.ticket_ids = []
        self.response_times = {"create": [], "read": [], "update": [], "delete": []}
        self.errors = []

    async def setup(self):
        """Setup test board and columns"""
        async with aiohttp.ClientSession() as session:
            # Create test board
            board_data = {
                "name": f"Load Test Board {datetime.now().strftime('%H%M%S')}",
                "description": f"Testing with {self.num_agents} agents and {self.num_tasks} tasks",
            }

            async with session.post(f"{API_URL}/boards/", json=board_data) as response:
                if response.status in [200, 201]:
                    board = await response.json()
                    self.board_id = board["id"]
                    print(f"✅ Created load test board: {self.board_id}")
                else:
                    print(f"❌ Failed to create board: {response.status}")
                    return False

            # Get columns
            async with session.get(f"{API_URL}/boards/{self.board_id}/columns") as response:
                if response.status == 200:
                    columns = await response.json()
                    self.column_ids = [c["id"] for c in columns]
                    print(f"✅ Found {len(self.column_ids)} columns")

        return True

    async def create_ticket(self, session: aiohttp.ClientSession, agent_id: int, task_num: int):
        """Create a single ticket"""
        start_time = time.time()

        ticket_data = {
            "title": f"Task {task_num:04d} - Agent {agent_id}",
            "description": f"Load test task created by Agent {agent_id}",
            "priority": random.choice(["Low", "Medium", "High", "Critical"]),
            "assigned_to": f"Agent_{agent_id}",
            "estimate_hours": random.choice([1, 2, 4, 8]),
        }

        try:
            async with session.post(
                f"{API_URL}/tickets/?board_id={self.board_id}", json=ticket_data
            ) as response:
                elapsed = (time.time() - start_time) * 1000  # Convert to ms

                if response.status in [200, 201]:
                    ticket = await response.json()
                    self.ticket_ids.append(ticket["id"])
                    self.response_times["create"].append(elapsed)
                    return True
                else:
                    self.errors.append(f"Create failed: {response.status}")
                    return False

        except Exception as e:
            self.errors.append(f"Create error: {str(e)}")
            return False

    async def read_tickets(self, session: aiohttp.ClientSession):
        """Read all tickets"""
        start_time = time.time()

        try:
            async with session.get(f"{API_URL}/tickets/") as response:
                elapsed = (time.time() - start_time) * 1000

                if response.status == 200:
                    tickets = await response.json()
                    self.response_times["read"].append(elapsed)
                    return len(tickets)
                else:
                    self.errors.append(f"Read failed: {response.status}")
                    return 0

        except Exception as e:
            self.errors.append(f"Read error: {str(e)}")
            return 0

    async def update_ticket(self, session: aiohttp.ClientSession, ticket_id: int):
        """Update a ticket"""
        start_time = time.time()

        update_data = {
            "priority": random.choice(["Low", "Medium", "High", "Critical"]),
            "status": random.choice(["To Do", "In Progress", "Done"]),
        }

        try:
            async with session.put(f"{API_URL}/tickets/{ticket_id}", json=update_data) as response:
                elapsed = (time.time() - start_time) * 1000

                if response.status == 200:
                    self.response_times["update"].append(elapsed)
                    return True
                else:
                    self.errors.append(f"Update failed: {response.status}")
                    return False

        except Exception as e:
            self.errors.append(f"Update error: {str(e)}")
            return False

    async def agent_worker(self, agent_id: int, tasks_per_agent: int):
        """Simulate a single agent creating and managing tasks"""
        async with aiohttp.ClientSession() as session:
            created = 0

            # Create tasks
            for i in range(tasks_per_agent):
                task_num = agent_id * tasks_per_agent + i
                success = await self.create_ticket(session, agent_id, task_num)
                if success:
                    created += 1

                # Occasional read operation
                if i % 5 == 0:
                    await self.read_tickets(session)

                # Occasional update operation
                if i % 3 == 0 and self.ticket_ids:
                    ticket_id = random.choice(self.ticket_ids)
                    await self.update_ticket(session, ticket_id)

                # Small delay to simulate realistic usage
                await asyncio.sleep(random.uniform(0.1, 0.5))

            print(f"Agent {agent_id}: Created {created}/{tasks_per_agent} tasks")
            return created

    async def run_load_test(self):
        """Run the load test with multiple agents"""
        print("\n" + "=" * 70)
        print(f"LOAD TEST: {self.num_agents} Agents, {self.num_tasks} Tasks")
        print("=" * 70 + "\n")

        # Setup
        if not await self.setup():
            print("❌ Setup failed, aborting load test")
            return

        # Calculate tasks per agent
        tasks_per_agent = self.num_tasks // self.num_agents
        remaining_tasks = self.num_tasks % self.num_agents

        print(f"📊 Each agent will create ~{tasks_per_agent} tasks")
        print(f"🚀 Starting load test at {datetime.now().strftime('%H:%M:%S')}\n")

        start_time = time.time()

        # Create agent tasks
        agent_tasks = []
        for agent_id in range(self.num_agents):
            # Give extra tasks to first few agents if there's a remainder
            tasks_for_this_agent = tasks_per_agent + (1 if agent_id < remaining_tasks else 0)
            agent_tasks.append(self.agent_worker(agent_id, tasks_for_this_agent))

        # Run all agents concurrently
        results = await asyncio.gather(*agent_tasks)

        elapsed_time = time.time() - start_time
        total_created = sum(results)

        # Calculate statistics
        print("\n" + "=" * 70)
        print("LOAD TEST RESULTS")
        print("=" * 70)

        print("\n📈 Performance Metrics:")
        print(f"  Total Time: {elapsed_time:.2f} seconds")
        print(f"  Tasks Created: {total_created}/{self.num_tasks}")
        print(f"  Success Rate: {(total_created / self.num_tasks * 100):.1f}%")
        print(f"  Tasks/Second: {total_created / elapsed_time:.2f}")

        print("\n⏱️  Response Times (ms):")
        for operation, times in self.response_times.items():
            if times:
                print(f"  {operation.capitalize()}:")
                print(f"    Min: {min(times):.2f}ms")
                print(f"    Max: {max(times):.2f}ms")
                print(f"    Avg: {statistics.mean(times):.2f}ms")
                print(f"    Median: {statistics.median(times):.2f}ms")

        print(f"\n❌ Errors: {len(self.errors)}")
        if self.errors:
            print("  Sample errors:")
            for error in self.errors[:5]:
                print(f"    - {error}")

        print("\n" + "=" * 70)

        # Cleanup summary
        print("\n🧹 Test Data Created:")
        print(f"  Board ID: {self.board_id}")
        print(f"  Tickets: {len(self.ticket_ids)}")

        return {
            "total_time": elapsed_time,
            "tasks_created": total_created,
            "success_rate": (total_created / self.num_tasks * 100),
            "tasks_per_second": total_created / elapsed_time,
            "errors": len(self.errors),
        }


async def main():
    # Run with default 20 agents and 500 tasks
    tester = LoadTester(num_agents=20, num_tasks=500)

    print("🔄 Starting Agent Kanban Board Load Test")
    print("  Target: 20 concurrent agents creating 500 tasks")
    print("  This will create significant load on the system\n")

    input("Press Enter to start the load test...")

    results = await tester.run_load_test()

    # Save results
    with open("/workspaces/agent-kanban/tests/load_test_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n✅ Load test complete! Results saved to load_test_results.json")


if __name__ == "__main__":
    asyncio.run(main())

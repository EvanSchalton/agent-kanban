#!/usr/bin/env python3
"""
Performance Test Data Setup for Agent Kanban Board
Creates 20 agents and 500 tasks for load testing
QA Engineer - Project 4
"""

import json
import random
import time
from datetime import datetime

import httpx

BASE_URL = "http://localhost:8000"

# Agent names for assignment
AGENTS = [f"agent_{i:02d}" for i in range(1, 21)]  # agent_01 through agent_20

# Task priorities
PRIORITIES = ["1.0", "2.0", "3.0", "4.0", "5.0"]

# Columns for task distribution
COLUMNS = ["todo", "in_progress", "review", "done"]


def create_test_board():
    """Create a test board for performance testing"""
    with httpx.Client(base_url=BASE_URL) as client:
        response = client.post(
            "/api/boards/",
            json={
                "name": "Performance Test Board",
                "description": "Board for testing with 20 agents and 500 tasks",
                "columns": COLUMNS,
            },
        )

        if response.status_code == 200:
            board = response.json()
            print(f"✅ Created board: {board['name']} (ID: {board['id']})")
            return board["id"]
        else:
            print(f"❌ Failed to create board: {response.status_code}")
            print(response.text)
            return None


def create_tasks(board_id, count=500):
    """Create specified number of tasks"""
    created_tasks = []
    failed_count = 0

    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        print(f"\n📝 Creating {count} tasks...")

        for i in range(1, count + 1):
            # Distribute tasks across columns
            column = random.choice(COLUMNS)

            # Assign ~80% of tasks to agents
            assignee = random.choice(AGENTS) if random.random() < 0.8 else None

            # Random priority
            priority = random.choice(PRIORITIES)

            task_data = {
                "title": f"Task {i:03d}: {random.choice(['Implement', 'Fix', 'Review', 'Test', 'Deploy'])} {random.choice(['feature', 'bug', 'API', 'UI', 'database'])}",
                "description": f"Performance test task #{i}. This task is part of the load testing suite.",
                "board_id": board_id,
                "current_column": column,
                "priority": priority,
                "assignee": assignee,
            }

            try:
                response = client.post("/api/tickets/", json=task_data)

                if response.status_code == 201:
                    task = response.json()
                    created_tasks.append(task["id"])

                    # Progress indicator every 50 tasks
                    if i % 50 == 0:
                        print(f"  Progress: {i}/{count} tasks created...")
                else:
                    failed_count += 1
                    if failed_count <= 5:  # Only show first 5 errors
                        print(f"  ⚠️ Failed to create task {i}: {response.status_code}")

                # Small delay to avoid overwhelming the server
                if i % 10 == 0:
                    time.sleep(0.1)

            except Exception as e:
                failed_count += 1
                print(f"  ❌ Error creating task {i}: {e}")

    print(f"\n✅ Successfully created {len(created_tasks)}/{count} tasks")
    if failed_count > 0:
        print(f"⚠️ Failed to create {failed_count} tasks")

    return created_tasks


def get_statistics(board_id):
    """Get board statistics after setup"""
    with httpx.Client(base_url=BASE_URL) as client:
        # Get board info
        response = client.get(f"/api/boards/{board_id}")
        if response.status_code == 200:
            board = response.json()

            print("\n📊 Board Statistics:")
            print(f"  Board: {board['name']}")
            print(f"  Columns: {', '.join(board['columns'])}")

        # Get tickets
        response = client.get(f"/api/tickets/?board_id={board_id}")
        if response.status_code == 200:
            tickets = response.json()

            # Calculate statistics
            total = len(tickets)
            by_column = {}
            by_assignee = {}

            for ticket in tickets:
                # Count by column
                col = ticket.get("current_column", "unknown")
                by_column[col] = by_column.get(col, 0) + 1

                # Count by assignee
                assignee = ticket.get("assignee", "unassigned")
                by_assignee[assignee] = by_assignee.get(assignee, 0) + 1

            print(f"\n  Total Tasks: {total}")
            print("\n  Distribution by Column:")
            for col, count in sorted(by_column.items()):
                print(f"    {col}: {count} ({count * 100 / total:.1f}%)")

            print(f"\n  Assigned Tasks: {total - by_assignee.get('unassigned', 0)}/{total}")
            print(f"  Active Agents: {len([a for a in by_assignee if a != 'unassigned'])}")


def run_performance_test(board_id, task_ids):
    """Run basic performance tests"""
    print("\n🚀 Running Performance Tests...")

    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        # Test 1: Get all tickets
        start = time.perf_counter()
        response = client.get(f"/api/tickets/?board_id={board_id}")
        elapsed = (time.perf_counter() - start) * 1000

        if response.status_code == 200:
            tickets = response.json()
            print(f"  ✅ GET all tickets: {elapsed:.2f}ms for {len(tickets)} tickets")
            if elapsed > 200:
                print("    ⚠️ PERFORMANCE WARNING: Exceeds 200ms requirement!")

        # Test 2: Bulk move operation (if available)
        if len(task_ids) >= 10:
            sample_ids = [str(id) for id in random.sample(task_ids, 10)]

            start = time.perf_counter()
            response = client.post(
                "/api/bulk/tickets/move",
                json={"ticket_ids": sample_ids, "target_column": "in_progress"},
            )
            elapsed = (time.perf_counter() - start) * 1000

            if response.status_code == 200:
                print(f"  ✅ Bulk move 10 tickets: {elapsed:.2f}ms")
            else:
                print(f"  ⚠️ Bulk move failed: {response.status_code}")

        # Test 3: Concurrent requests simulation
        print("\n  Testing concurrent requests (simulating 20 agents)...")
        start = time.perf_counter()

        # Simulate 20 agents making requests
        for i in range(20):
            response = client.get(f"/api/tickets/?assignee=agent_{i:02d}")
            if response.status_code != 200:
                print(f"    ⚠️ Agent {i} request failed: {response.status_code}")

        elapsed = (time.perf_counter() - start) * 1000
        print(f"  ✅ 20 agent requests completed in: {elapsed:.2f}ms")
        print(f"    Average per agent: {elapsed / 20:.2f}ms")


def main():
    """Main performance test setup"""
    print("=" * 60)
    print("AGENT KANBAN BOARD - PERFORMANCE TEST SETUP")
    print("Creating 20 agents and 500 tasks for load testing")
    print("=" * 60)

    # Step 1: Create board
    board_id = create_test_board()
    if not board_id:
        print("❌ Failed to create board. Exiting.")
        return

    # Step 2: Create tasks
    task_ids = create_tasks(board_id, count=500)

    # Step 3: Get statistics
    get_statistics(board_id)

    # Step 4: Run performance tests
    run_performance_test(board_id, task_ids)

    # Save results
    results = {
        "timestamp": datetime.now().isoformat(),
        "board_id": board_id,
        "total_tasks": len(task_ids),
        "agents": AGENTS,
        "task_ids": task_ids,
    }

    with open("performance_test_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n✅ Performance test setup complete!")
    print("📁 Results saved to performance_test_results.json")
    print(f"🔗 Board ID: {board_id}")


if __name__ == "__main__":
    main()

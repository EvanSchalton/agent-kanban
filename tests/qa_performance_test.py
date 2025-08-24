#!/usr/bin/env python3
"""
QA Performance Test - 20 Agents / 500 Tasks Simulation
"""

import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import requests

BASE_URL = "http://localhost:8000"


def create_test_ticket(session, agent_id, task_num):
    """Create a test ticket for performance testing"""
    ticket_data = {
        "title": f"Performance Test Task {task_num} - Agent {agent_id}",
        "description": f"Task created by Agent {agent_id} for performance testing",
        "priority": f"{(task_num % 5) + 1}.0",
        "board_id": 1,
        "column": "backlog",
    }

    start_time = time.time()
    try:
        response = session.post(f"{BASE_URL}/api/tickets/", json=ticket_data, timeout=10)
        elapsed = time.time() - start_time
        if response.status_code in [200, 201]:
            return {"success": True, "time": elapsed, "agent": agent_id, "task": task_num}
        else:
            return {
                "success": False,
                "time": elapsed,
                "agent": agent_id,
                "task": task_num,
                "error": response.status_code,
            }
    except Exception as e:
        elapsed = time.time() - start_time
        return {
            "success": False,
            "time": elapsed,
            "agent": agent_id,
            "task": task_num,
            "error": str(e),
        }


def agent_simulation(agent_id, tasks_per_agent):
    """Simulate one agent creating multiple tasks"""
    session = requests.Session()
    results = []

    for task_num in range(tasks_per_agent):
        result = create_test_ticket(session, agent_id, task_num)
        results.append(result)
        # Small delay to simulate realistic agent behavior
        time.sleep(0.1)

    return results


def main():
    """Main performance test runner"""
    print("=" * 80)
    print("QA PERFORMANCE TEST - 20 AGENTS / 500 TASKS SIMULATION")
    print("=" * 80)

    num_agents = 20
    total_tasks = 500
    tasks_per_agent = total_tasks // num_agents

    print("Configuration:")
    print(f"- Agents: {num_agents}")
    print(f"- Total Tasks: {total_tasks}")
    print(f"- Tasks per Agent: {tasks_per_agent}")
    print(f"- Backend URL: {BASE_URL}")

    # Test backend availability first
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            print(f"❌ Backend not healthy: {response.status_code}")
            return
        print("✅ Backend is healthy")
    except Exception as e:
        print(f"❌ Backend connection failed: {e}")
        return

    print("\n🚀 Starting performance test...")
    start_time = time.time()

    # Use ThreadPoolExecutor to simulate concurrent agents
    with ThreadPoolExecutor(max_workers=num_agents) as executor:
        # Submit all agent simulations
        futures = [
            executor.submit(agent_simulation, agent_id, tasks_per_agent)
            for agent_id in range(1, num_agents + 1)
        ]

        # Collect results as they complete
        all_results = []
        completed_agents = 0

        for future in futures:
            try:
                agent_results = future.result(timeout=120)  # 2 minute timeout per agent
                all_results.extend(agent_results)
                completed_agents += 1
                print(
                    f"✅ Agent {completed_agents}/{num_agents} completed ({len(agent_results)} tasks)"
                )
            except Exception as e:
                print(f"❌ Agent failed: {e}")

    total_time = time.time() - start_time

    # Analyze results
    successful_tasks = [r for r in all_results if r["success"]]
    failed_tasks = [r for r in all_results if not r["success"]]

    if successful_tasks:
        avg_time = sum(r["time"] for r in successful_tasks) / len(successful_tasks)
        min_time = min(r["time"] for r in successful_tasks)
        max_time = max(r["time"] for r in successful_tasks)
    else:
        avg_time = min_time = max_time = 0

    # Generate report
    print("\n" + "=" * 80)
    print("PERFORMANCE TEST RESULTS")
    print("=" * 80)
    print(f"Total Execution Time: {total_time:.2f} seconds")
    print(f"Tasks Attempted: {len(all_results)}")
    print(
        f"✅ Successful: {len(successful_tasks)} ({len(successful_tasks) / len(all_results) * 100:.1f}%)"
    )
    print(f"❌ Failed: {len(failed_tasks)} ({len(failed_tasks) / len(all_results) * 100:.1f}%)")
    print(f"Throughput: {len(successful_tasks) / total_time:.2f} tasks/second")
    print(f"Average Response Time: {avg_time * 1000:.0f}ms")
    print(f"Min Response Time: {min_time * 1000:.0f}ms")
    print(f"Max Response Time: {max_time * 1000:.0f}ms")

    # Performance assessment
    if len(successful_tasks) >= total_tasks * 0.95:  # 95% success rate
        if avg_time < 1.0:  # Under 1 second average
            print("\n🎯 PERFORMANCE: EXCELLENT")
        elif avg_time < 2.0:  # Under 2 seconds average
            print("\n⚠️ PERFORMANCE: GOOD")
        else:
            print("\n❌ PERFORMANCE: POOR - High latency")
    else:
        print("\n❌ PERFORMANCE: POOR - Low success rate")

    # Save detailed results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"qa_performance_results_{timestamp}.json"

    detailed_results = {
        "config": {
            "agents": num_agents,
            "total_tasks": total_tasks,
            "tasks_per_agent": tasks_per_agent,
        },
        "metrics": {
            "total_time": total_time,
            "successful_tasks": len(successful_tasks),
            "failed_tasks": len(failed_tasks),
            "success_rate": len(successful_tasks) / len(all_results) * 100,
            "throughput": len(successful_tasks) / total_time,
            "avg_response_time": avg_time,
            "min_response_time": min_time,
            "max_response_time": max_time,
        },
        "failures": failed_tasks[:10],  # First 10 failures for analysis
        "timestamp": datetime.now().isoformat(),
    }

    with open(results_file, "w") as f:
        json.dump(detailed_results, f, indent=2)

    print(f"📄 Detailed results saved to: {results_file}")

    return len(successful_tasks) >= total_tasks * 0.95


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)

#!/usr/bin/env python3
"""API Performance Test - Verify <200ms response times"""

import asyncio
import statistics
import time
from typing import Any, Dict

import httpx

BASE_URL = "http://localhost:8000"


async def measure_endpoint(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    json_data: Dict[str, Any] = None,
    iterations: int = 10,
) -> Dict[str, float]:
    """Measure response time for an endpoint"""
    times = []

    for _ in range(iterations):
        start = time.perf_counter()

        if method == "GET":
            await client.get(url)
        elif method == "POST":
            await client.post(url, json=json_data)
        elif method == "PUT":
            await client.put(url, json=json_data)
        elif method == "DELETE":
            await client.delete(url)

        end = time.perf_counter()
        response_time = (end - start) * 1000  # Convert to ms
        times.append(response_time)

        # Small delay between requests
        await asyncio.sleep(0.1)

    return {
        "min": min(times),
        "max": max(times),
        "mean": statistics.mean(times),
        "median": statistics.median(times),
        "stdev": statistics.stdev(times) if len(times) > 1 else 0,
        "p95": sorted(times)[int(len(times) * 0.95) - 1] if len(times) > 1 else times[0],
        "all_times": times,
    }


async def test_api_performance():
    """Test API performance across critical endpoints"""
    print("=== API Performance Test ===")
    print("Target: All endpoints < 200ms response time\n")

    async with httpx.AsyncClient(timeout=30.0) as client:
        results = {}

        # Get board ID for testing
        boards_response = await client.get(f"{BASE_URL}/api/boards/")
        boards = boards_response.json()
        if not boards:
            print("❌ No boards found for testing")
            return False
        board_id = boards[0]["id"]

        # Test 1: GET /api/boards/
        print("1. Testing GET /api/boards/ ...")
        results["GET /api/boards/"] = await measure_endpoint(
            client, "GET", f"{BASE_URL}/api/boards/"
        )

        # Test 2: GET /api/boards/{id}
        print("2. Testing GET /api/boards/{id} ...")
        results[f"GET /api/boards/{board_id}"] = await measure_endpoint(
            client, "GET", f"{BASE_URL}/api/boards/{board_id}"
        )

        # Test 3: GET /api/tickets/
        print("3. Testing GET /api/tickets/ ...")
        results["GET /api/tickets/"] = await measure_endpoint(
            client, "GET", f"{BASE_URL}/api/tickets/?board_id={board_id}"
        )

        # Test 4: POST /api/tickets/ (Create)
        print("4. Testing POST /api/tickets/ ...")
        ticket_data = {
            "title": "Performance Test Ticket",
            "description": "Testing API performance",
            "board_id": board_id,
            "priority": "1.0",
        }
        create_results = []
        ticket_ids = []

        for i in range(5):
            start = time.perf_counter()
            response = await client.post(
                f"{BASE_URL}/api/tickets/",
                json={**ticket_data, "title": f"Performance Test Ticket {i + 1}"},
            )
            end = time.perf_counter()

            if response.status_code == 201:
                ticket = response.json()
                ticket_ids.append(ticket["id"])

            create_results.append((end - start) * 1000)
            await asyncio.sleep(0.1)

        results["POST /api/tickets/"] = {
            "min": min(create_results),
            "max": max(create_results),
            "mean": statistics.mean(create_results),
            "median": statistics.median(create_results),
            "stdev": statistics.stdev(create_results) if len(create_results) > 1 else 0,
            "p95": (
                sorted(create_results)[int(len(create_results) * 0.95) - 1]
                if len(create_results) > 1
                else create_results[0]
            ),
        }

        # Test 5: GET /api/tickets/{id}
        if ticket_ids:
            print("5. Testing GET /api/tickets/{id} ...")
            results["GET /api/tickets/{id}"] = await measure_endpoint(
                client, "GET", f"{BASE_URL}/api/tickets/{ticket_ids[0]}"
            )

        # Test 6: PUT /api/tickets/{id} (Update)
        if ticket_ids:
            print("6. Testing PUT /api/tickets/{id} ...")
            update_data = {
                "title": "Updated Performance Test Ticket",
                "description": "Updated description",
            }
            results["PUT /api/tickets/{id}"] = await measure_endpoint(
                client,
                "PUT",
                f"{BASE_URL}/api/tickets/{ticket_ids[0]}",
                json_data=update_data,
                iterations=5,
            )

        # Test 7: POST /api/tickets/{id}/move
        if ticket_ids:
            print("7. Testing POST /api/tickets/{id}/move ...")
            move_times = []
            columns = ["In Progress", "Blocked", "Ready for QC", "Done"]

            for column in columns:
                start = time.perf_counter()
                response = await client.post(
                    f"{BASE_URL}/api/tickets/{ticket_ids[0]}/move", json={"column": column}
                )
                end = time.perf_counter()
                move_times.append((end - start) * 1000)
                await asyncio.sleep(0.1)

            results["POST /api/tickets/{{id}}/move"] = {
                "min": min(move_times),
                "max": max(move_times),
                "mean": statistics.mean(move_times),
                "median": statistics.median(move_times),
                "stdev": statistics.stdev(move_times) if len(move_times) > 1 else 0,
            }

        # Test 8: Pagination performance
        print("8. Testing pagination performance ...")
        pagination_times = []
        for page in range(1, 4):
            start = time.perf_counter()
            response = await client.get(
                f"{BASE_URL}/api/tickets/?board_id={board_id}&page={page}&page_size=20"
            )
            end = time.perf_counter()
            pagination_times.append((end - start) * 1000)
            await asyncio.sleep(0.1)

        results["GET /api/tickets/ (pagination)"] = {
            "min": min(pagination_times),
            "max": max(pagination_times),
            "mean": statistics.mean(pagination_times),
            "median": statistics.median(pagination_times),
        }

        # Clean up test tickets
        print("\n9. Cleaning up test data...")
        for ticket_id in ticket_ids[:3]:  # Keep some for testing
            try:
                await client.delete(f"{BASE_URL}/api/tickets/{ticket_id}")
            except Exception:
                pass

        # Results Summary
        print("\n" + "=" * 60)
        print("Performance Test Results Summary")
        print("=" * 60)
        print(f"{'Endpoint':<40} {'Mean':>8} {'P95':>8} {'Max':>8}")
        print("-" * 60)

        all_passed = True
        for endpoint, metrics in results.items():
            mean = metrics.get("mean", 0)
            p95 = metrics.get("p95", metrics.get("mean", 0))
            max_time = metrics.get("max", 0)

            status = "✅" if max_time < 200 else "⚠️" if mean < 200 else "❌"
            print(f"{status} {endpoint:<37} {mean:>7.1f}ms {p95:>7.1f}ms {max_time:>7.1f}ms")

            if mean >= 200:
                all_passed = False

        print("\n" + "=" * 60)
        print("Performance Analysis:")
        print("=" * 60)

        # Calculate overall statistics
        all_means = [m.get("mean", 0) for m in results.values()]
        all_maxes = [m.get("max", 0) for m in results.values()]

        print(f"Overall mean response time: {statistics.mean(all_means):.1f}ms")
        print(f"Overall max response time: {max(all_maxes):.1f}ms")
        print("Target: < 200ms")

        if all_passed:
            print("\n✅ All endpoints meet the <200ms performance target!")
            return True
        else:
            failing = sum(1 for m in results.values() if m.get("mean", 0) >= 200)
            print(f"\n⚠️ {failing} endpoints exceed the 200ms target")
            return False


if __name__ == "__main__":
    success = asyncio.run(test_api_performance())
    exit(0 if success else 1)

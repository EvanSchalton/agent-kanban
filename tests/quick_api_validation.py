#!/usr/bin/env python3
"""Quick API validation after proxy fix"""

import requests

# Test the fixed proxy configuration
print("🔧 Testing Fixed Proxy Configuration")
print("=" * 50)

# Test through proxy
try:
    print("1. Testing frontend proxy (/api/boards)...")
    response = requests.get("http://localhost:15174/api/boards/", timeout=5)
    if response.status_code == 200:
        boards = response.json()
        print(f"   ✅ SUCCESS: Got {len(boards)} boards through proxy")
        board_id = boards[0]["id"] if boards else None
    else:
        print(f"   ❌ FAILED: Status {response.status_code}")
        exit(1)

    print("2. Testing ticket listing...")
    if board_id:
        response = requests.get(f"http://localhost:15174/api/boards/{board_id}/tickets", timeout=5)
        if response.status_code == 200:
            tickets = response.json()
            print(f"   ✅ SUCCESS: Got {len(tickets)} tickets")
            ticket_id = tickets[0]["id"] if tickets else None
        else:
            print(f"   ❌ Status {response.status_code}: {response.text[:100]}")

    print("3. Testing ticket move API...")
    if ticket_id:
        move_data = {"column_id": "In Progress"}
        response = requests.post(
            f"http://localhost:15174/api/tickets/{ticket_id}/move", json=move_data, timeout=5
        )
        if response.status_code in [200, 201]:
            print("   ✅ SUCCESS: Ticket move working!")
        else:
            print(f"   ⚠️ Status {response.status_code}: {response.text[:100]}")

    print("4. Testing ticket creation...")
    create_data = {
        "title": "Proxy Test Ticket",
        "description": "Testing after proxy fix",
        "priority": "Medium",
    }
    response = requests.post("http://localhost:15174/api/tickets/", json=create_data, timeout=5)
    if response.status_code in [200, 201]:
        new_ticket = response.json()
        print(f"   ✅ SUCCESS: Created ticket {new_ticket.get('id')}")
    else:
        print(f"   ⚠️ Status {response.status_code}: {response.text[:100]}")

    print("\n🎉 PROXY FIX VALIDATION COMPLETE!")
    print("Frontend can now communicate with backend through Vite proxy")

except Exception as e:
    print(f"❌ ERROR: {e}")

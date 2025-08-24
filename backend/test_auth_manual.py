#!/usr/bin/env python3
"""Manual test script for authentication endpoints"""

from fastapi.testclient import TestClient

from app.main import app


def test_authentication():
    """Test the authentication system"""
    client = TestClient(app)

    print("🔐 Testing Authentication System")
    print("=" * 50)

    # Test 1: User Registration
    print("\n1. Testing User Registration")
    register_data = {
        "username": "testuser2",
        "email": "test2@example.com",
        "password": "TestPassword123",
        "role": "pm",
    }

    response = client.post("/api/auth/register", json=register_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        user_data = response.json()
        print(f"✅ User created: {user_data['username']} ({user_data['role']})")
        user_data["id"]
    else:
        print(f"❌ Registration failed: {response.text}")
        return

    # Test 2: User Login
    print("\n2. Testing User Login")
    login_data = {"username": "testuser2", "password": "TestPassword123"}

    response = client.post("/api/auth/login", json=login_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        token_data = response.json()
        print("✅ Login successful")
        print(f"Token expires in: {token_data['expires_in']} seconds")
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token")
    else:
        print(f"❌ Login failed: {response.text}")
        return

    # Test 3: Get Current User
    print("\n3. Testing Get Current User")
    headers = {"Authorization": f"Bearer {access_token}"}

    response = client.get("/api/auth/me", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        user_data = response.json()
        print(f"✅ Current user: {user_data['username']} (Role: {user_data['role']})")
        print(f"Last login: {user_data.get('last_login', 'N/A')}")
    else:
        print(f"❌ Get user failed: {response.text}")

    # Test 4: Test Refresh Token
    if refresh_token:
        print("\n4. Testing Refresh Token")
        refresh_data = {"refresh_token": refresh_token}

        response = client.post("/api/auth/refresh", json=refresh_data)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            new_token_data = response.json()
            print("✅ Token refreshed successfully")
            new_access_token = new_token_data["access_token"]
        else:
            print(f"❌ Refresh failed: {response.text}")
            new_access_token = access_token
    else:
        new_access_token = access_token

    # Test 5: Test Board Access with Permissions
    print("\n5. Testing Board Access (PM Role)")
    headers = {"Authorization": f"Bearer {new_access_token}"}

    response = client.get("/api/boards/", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        boards_data = response.json()
        print(f"✅ Board access granted (found {len(boards_data)} boards)")
    else:
        print(f"❌ Board access failed: {response.text}")

    # Test 6: Test Logout
    print("\n6. Testing Logout")
    response = client.post("/api/auth/logout", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("✅ Logout successful")
    else:
        print(f"❌ Logout failed: {response.text}")

    # Test 7: Test Access After Logout (should fail)
    print("\n7. Testing Access After Logout")
    response = client.get("/api/auth/me", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 401:
        print("✅ Access properly blocked after logout")
    else:
        print(f"❌ Access still allowed after logout: {response.text}")

    print("\n" + "=" * 50)
    print("🎉 Authentication tests completed!")


if __name__ == "__main__":
    test_authentication()

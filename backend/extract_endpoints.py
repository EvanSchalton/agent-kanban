#!/usr/bin/env python3
import requests


def extract_api_endpoints():
    """Extract and categorize API endpoints for frontend integration."""

    try:
        response = requests.get("http://localhost:18000/openapi.json")
        data = response.json()
        paths = data.get("paths", {})

        print("=== FRONTEND INTEGRATION - API ENDPOINTS ===\n")

        # Group endpoints by category
        categories = {
            "Authentication": [],
            "Boards": [],
            "Tickets": [],
            "Comments": [],
            "Bulk Operations": [],
            "Statistics": [],
            "History": [],
            "WebSocket": [],
            "Health": [],
        }

        for path, methods in paths.items():
            for method, details in methods.items():
                endpoint_info = {
                    "method": method.upper(),
                    "path": path,
                    "summary": details.get("summary", "No description"),
                    "operationId": details.get("operationId", ""),
                    "responses": list(details.get("responses", {}).keys()),
                }

                if "auth" in path:
                    categories["Authentication"].append(endpoint_info)
                elif "board" in path:
                    categories["Boards"].append(endpoint_info)
                elif "ticket" in path and "bulk" not in path:
                    categories["Tickets"].append(endpoint_info)
                elif "comment" in path:
                    categories["Comments"].append(endpoint_info)
                elif "bulk" in path:
                    categories["Bulk Operations"].append(endpoint_info)
                elif "statistics" in path:
                    categories["Statistics"].append(endpoint_info)
                elif "history" in path:
                    categories["History"].append(endpoint_info)
                elif "ws" in path or "websocket" in path:
                    categories["WebSocket"].append(endpoint_info)
                elif "health" in path:
                    categories["Health"].append(endpoint_info)

        # Print organized endpoints
        total_endpoints = 0
        for category, endpoints in categories.items():
            if endpoints:
                print(f"## {category} ({len(endpoints)} endpoints)")
                for ep in sorted(endpoints, key=lambda x: x["path"]):
                    print(f"  {ep['method']:6} {ep['path']}")
                    if ep["summary"] != "No description":
                        print(f"         → {ep['summary']}")
                    print(f"         → Responses: {', '.join(ep['responses'])}")
                total_endpoints += len(endpoints)
                print()

        print(f"**Total API Endpoints: {total_endpoints}**")

    except Exception as e:
        print(f"Error extracting endpoints: {e}")


if __name__ == "__main__":
    extract_api_endpoints()

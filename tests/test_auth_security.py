#!/usr/bin/env python3
"""Authentication and Security Testing Suite for Agent Kanban Board - Phase 2"""

import json
import time
from datetime import datetime

import requests

BASE_URL = "http://localhost:18000"
API_URL = f"{BASE_URL}/api"


class AuthSecurityTester:
    def __init__(self):
        self.test_results = []
        self.vulnerabilities = []
        self.token = None
        self.refresh_token = None
        self.user_id = None

    def log_result(self, test_name: str, status: str, details: str = "", severity: str = None):
        result = {
            "test": test_name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details,
        }
        if severity:
            result["severity"] = severity
        self.test_results.append(result)

        status_symbol = (
            "✓"
            if status == "PASS"
            else "✗"
            if status == "FAIL"
            else "⚠️"
            if status == "WARNING"
            else "!"
        )
        print(f"[{status_symbol}] {test_name}: {details[:100]}")

        if status in ["FAIL", "WARNING"] and severity:
            self.vulnerabilities.append(
                {"test": test_name, "severity": severity, "details": details}
            )

    def test_auth_endpoints_exist(self):
        """Test if authentication endpoints exist"""
        auth_endpoints = [
            "/api/auth/login",
            "/api/auth/signup",
            "/api/auth/logout",
            "/api/auth/refresh",
            "/api/users/me",
        ]

        existing = 0
        for endpoint in auth_endpoints:
            try:
                response = requests.options(f"{BASE_URL}{endpoint}")
                if response.status_code != 404:
                    existing += 1
                    self.log_result(f"Auth Endpoint {endpoint}", "PASS", "Endpoint exists")
                else:
                    self.log_result(
                        f"Auth Endpoint {endpoint}", "FAIL", "Endpoint not found", "HIGH"
                    )
            except:
                self.log_result(f"Auth Endpoint {endpoint}", "ERROR", "Connection failed")

        if existing == 0:
            self.log_result(
                "Authentication System",
                "FAIL",
                "No authentication endpoints found - system is unprotected!",
                "CRITICAL",
            )

    def test_unprotected_endpoints(self):
        """Test which endpoints are accessible without authentication"""
        endpoints = [
            "/api/boards/",
            "/api/tickets/",
            "/api/boards/1",
            "/api/tickets/1",
            "/api/tickets/move",
            "/api/users/",
            "/api/admin/",
        ]

        unprotected = []
        for endpoint in endpoints:
            try:
                response = requests.get(f"{BASE_URL}{endpoint}")
                if response.status_code in [200, 201]:
                    unprotected.append(endpoint)
                    self.log_result(
                        f"Endpoint Protection {endpoint}",
                        "FAIL",
                        "Endpoint accessible without auth",
                        "HIGH",
                    )
                elif response.status_code == 401:
                    self.log_result(
                        f"Endpoint Protection {endpoint}",
                        "PASS",
                        "Endpoint requires authentication",
                    )
                else:
                    self.log_result(
                        f"Endpoint Protection {endpoint}",
                        "INFO",
                        f"Status code: {response.status_code}",
                    )
            except:
                pass

        if unprotected:
            self.log_result(
                "API Protection",
                "FAIL",
                f"{len(unprotected)} endpoints are unprotected: {', '.join(unprotected)}",
                "CRITICAL",
            )

    def test_jwt_implementation(self):
        """Test JWT token security"""
        # Try to decode without verification (should fail in production)
        test_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

        try:
            # Try to use a test token
            headers = {"Authorization": f"Bearer {test_token}"}
            response = requests.get(f"{API_URL}/users/me", headers=headers)

            if response.status_code == 200:
                self.log_result(
                    "JWT Validation", "FAIL", "Accepts invalid/test JWT tokens!", "CRITICAL"
                )
            elif response.status_code == 401:
                self.log_result("JWT Validation", "PASS", "Properly rejects invalid tokens")
            else:
                self.log_result(
                    "JWT Validation",
                    "WARNING",
                    f"Unexpected response: {response.status_code}",
                    "MEDIUM",
                )
        except:
            self.log_result("JWT Validation", "SKIP", "Could not test JWT validation")

    def test_password_requirements(self):
        """Test password security requirements"""
        weak_passwords = ["123456", "password", "admin", "12345678", "qwerty", "abc123", ""]

        # Try to create users with weak passwords
        for pwd in weak_passwords:
            try:
                payload = {
                    "username": f"testuser_{int(time.time())}",
                    "password": pwd,
                    "email": f"test_{int(time.time())}@test.com",
                }
                response = requests.post(f"{API_URL}/auth/signup", json=payload)

                if response.status_code in [200, 201]:
                    self.log_result(
                        f"Password Strength '{pwd}'", "FAIL", "Accepts weak password", "HIGH"
                    )
                else:
                    self.log_result(f"Password Strength '{pwd}'", "PASS", "Rejects weak password")
            except:
                pass

    def test_session_management(self):
        """Test session security"""
        # Check for secure session cookies
        try:
            response = requests.get(f"{BASE_URL}/api/boards/")
            cookies = response.cookies

            security_issues = []

            for cookie in cookies:
                if not cookie.secure and "localhost" not in BASE_URL:
                    security_issues.append(f"Cookie '{cookie.name}' not using Secure flag")
                if not cookie.has_nonstandard_attr("HttpOnly"):
                    security_issues.append(f"Cookie '{cookie.name}' not using HttpOnly flag")
                if not cookie.has_nonstandard_attr("SameSite"):
                    security_issues.append(f"Cookie '{cookie.name}' not using SameSite flag")

            if security_issues:
                self.log_result(
                    "Session Cookies",
                    "FAIL",
                    f"Security issues: {'; '.join(security_issues)}",
                    "HIGH",
                )
            elif cookies:
                self.log_result("Session Cookies", "PASS", "Cookies properly secured")
            else:
                self.log_result("Session Cookies", "INFO", "No cookies used")
        except:
            self.log_result("Session Cookies", "SKIP", "Could not test session cookies")

    def test_sql_injection(self):
        """Test for SQL injection vulnerabilities"""
        sql_payloads = [
            "' OR '1'='1",
            "'; DROP TABLE tickets; --",
            "1' UNION SELECT * FROM users--",
            "admin'--",
            "' OR 1=1--",
        ]

        vulnerable = False
        for payload in sql_payloads:
            try:
                # Test in search/filter parameters
                response = requests.get(f"{API_URL}/tickets/", params={"search": payload})
                if "error" in response.text.lower() or "sql" in response.text.lower():
                    self.log_result(
                        "SQL Injection Test",
                        "WARNING",
                        f"Potential SQL error exposed with payload: {payload}",
                        "HIGH",
                    )
                    vulnerable = True

                # Test in path parameters
                response = requests.get(f"{API_URL}/boards/{payload}")
                if response.status_code == 500:
                    self.log_result(
                        "SQL Injection Test",
                        "WARNING",
                        f"Server error with payload: {payload}",
                        "MEDIUM",
                    )
            except:
                pass

        if not vulnerable:
            self.log_result("SQL Injection", "PASS", "No SQL injection vulnerabilities detected")

    def test_xss_protection(self):
        """Test for XSS vulnerabilities"""
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>",
            "<svg onload=alert('XSS')>",
        ]

        for payload in xss_payloads:
            try:
                # Try to create a ticket with XSS payload
                ticket_data = {"title": payload, "description": payload}
                response = requests.post(f"{API_URL}/tickets/?board_id=1", json=ticket_data)

                if response.status_code in [200, 201]:
                    # Check if payload is returned unescaped
                    ticket_id = response.json().get("id")
                    if ticket_id:
                        get_response = requests.get(f"{API_URL}/tickets/{ticket_id}")
                        if payload in get_response.text:
                            self.log_result(
                                "XSS Protection",
                                "FAIL",
                                f"XSS payload not sanitized: {payload[:30]}",
                                "HIGH",
                            )
                            return
            except:
                pass

        self.log_result("XSS Protection", "PASS", "XSS payloads are sanitized")

    def test_rate_limiting(self):
        """Test for rate limiting on sensitive endpoints"""
        # Try rapid login attempts
        attempt_count = 20
        start_time = time.time()
        blocked = False

        for i in range(attempt_count):
            try:
                payload = {"username": "test", "password": "wrong"}
                response = requests.post(f"{API_URL}/auth/login", json=payload)

                if response.status_code == 429:  # Too Many Requests
                    blocked = True
                    self.log_result(
                        "Rate Limiting", "PASS", f"Rate limiting active after {i + 1} attempts"
                    )
                    break
            except:
                pass

        elapsed = time.time() - start_time

        if not blocked:
            self.log_result(
                "Rate Limiting",
                "FAIL",
                f"No rate limiting after {attempt_count} attempts in {elapsed:.1f}s",
                "HIGH",
            )

    def test_cors_configuration(self):
        """Test CORS security configuration"""
        # Test from different origins
        test_origins = ["http://evil.com", "http://localhost:9999", "null"]

        for origin in test_origins:
            try:
                headers = {"Origin": origin}
                response = requests.get(f"{API_URL}/boards/", headers=headers)

                allow_origin = response.headers.get("Access-Control-Allow-Origin")
                if allow_origin == "*":
                    self.log_result(
                        "CORS Configuration", "FAIL", "CORS allows all origins (*)", "HIGH"
                    )
                    break
                elif allow_origin == origin:
                    self.log_result(
                        f"CORS Test {origin}",
                        "WARNING",
                        f"Accepts requests from {origin}",
                        "MEDIUM",
                    )
            except:
                pass
        else:
            self.log_result("CORS Configuration", "PASS", "CORS properly configured")

    def test_information_disclosure(self):
        """Test for information disclosure vulnerabilities"""
        # Check for detailed error messages
        try:
            response = requests.get(f"{API_URL}/boards/99999999")
            if "traceback" in response.text.lower() or "stack" in response.text.lower():
                self.log_result(
                    "Error Messages", "FAIL", "Stack traces exposed in errors", "MEDIUM"
                )
            else:
                self.log_result(
                    "Error Messages", "PASS", "Error messages don't expose sensitive info"
                )
        except:
            pass

        # Check response headers
        try:
            response = requests.get(BASE_URL)
            headers_to_check = {
                "X-Powered-By": "HIGH",
                "Server": "LOW",
                "X-AspNet-Version": "MEDIUM",
            }

            for header, severity in headers_to_check.items():
                if header in response.headers:
                    self.log_result(
                        "Header Disclosure",
                        "WARNING",
                        f"{header} header exposed: {response.headers[header]}",
                        severity,
                    )
        except:
            pass

    def test_rbac_implementation(self):
        """Test Role-Based Access Control"""
        roles = ["admin", "agent", "viewer", "pm"]

        # Check if role-based endpoints exist
        for role in roles:
            try:
                response = requests.get(f"{API_URL}/roles/{role}/permissions")
                if response.status_code != 404:
                    self.log_result(f"RBAC Role {role}", "INFO", "Role endpoint exists")
            except:
                pass

        # Test privilege escalation
        try:
            # Try to access admin endpoints as regular user
            response = requests.get(f"{API_URL}/admin/users")
            if response.status_code == 200:
                self.log_result(
                    "Privilege Escalation",
                    "FAIL",
                    "Admin endpoints accessible to all users",
                    "CRITICAL",
                )
            elif response.status_code == 401:
                self.log_result(
                    "Privilege Escalation", "PASS", "Admin endpoints properly protected"
                )
        except:
            pass

    def generate_security_report(self):
        """Generate comprehensive security report"""
        passed = sum(1 for r in self.test_results if r["status"] == "PASS")
        failed = sum(1 for r in self.test_results if r["status"] == "FAIL")
        warnings = sum(1 for r in self.test_results if r["status"] == "WARNING")

        critical = sum(1 for v in self.vulnerabilities if v["severity"] == "CRITICAL")
        high = sum(1 for v in self.vulnerabilities if v["severity"] == "HIGH")
        medium = sum(1 for v in self.vulnerabilities if v["severity"] == "MEDIUM")
        low = sum(1 for v in self.vulnerabilities if v["severity"] == "LOW")

        return {
            "summary": {
                "total_tests": len(self.test_results),
                "passed": passed,
                "failed": failed,
                "warnings": warnings,
            },
            "vulnerabilities": {
                "critical": critical,
                "high": high,
                "medium": medium,
                "low": low,
                "total": len(self.vulnerabilities),
            },
            "details": self.vulnerabilities,
        }

    def run_all_tests(self):
        """Run complete security test suite"""
        print("\n" + "=" * 70)
        print("PHASE 2 - AUTHENTICATION & SECURITY TESTING")
        print("=" * 70 + "\n")

        print("🔐 Testing Authentication System...")
        self.test_auth_endpoints_exist()
        self.test_unprotected_endpoints()
        self.test_jwt_implementation()
        self.test_password_requirements()

        print("\n🛡️ Testing Security Controls...")
        self.test_session_management()
        self.test_rate_limiting()
        self.test_cors_configuration()
        self.test_rbac_implementation()

        print("\n⚠️ Testing Vulnerabilities...")
        self.test_sql_injection()
        self.test_xss_protection()
        self.test_information_disclosure()

        # Generate report
        report = self.generate_security_report()

        print("\n" + "=" * 70)
        print("SECURITY TEST SUMMARY")
        print("=" * 70)
        print(f"Total Tests: {report['summary']['total_tests']}")
        print(f"✓ Passed: {report['summary']['passed']}")
        print(f"✗ Failed: {report['summary']['failed']}")
        print(f"⚠️ Warnings: {report['summary']['warnings']}")

        print("\n🚨 VULNERABILITIES FOUND:")
        print(f"CRITICAL: {report['vulnerabilities']['critical']}")
        print(f"HIGH: {report['vulnerabilities']['high']}")
        print(f"MEDIUM: {report['vulnerabilities']['medium']}")
        print(f"LOW: {report['vulnerabilities']['low']}")
        print("=" * 70 + "\n")

        return report


if __name__ == "__main__":
    tester = AuthSecurityTester()
    report = tester.run_all_tests()

    # Save report to file
    with open("/workspaces/agent-kanban/tests/phase2_security_report.json", "w") as f:
        json.dump(report, f, indent=2)

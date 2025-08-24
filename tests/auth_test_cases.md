# Authentication System Test Cases - Sprint Week Aug 10-17

## Test Suite Overview

**Target Coverage:** 90%
**Priority:** CRITICAL
**Test Environment:** localhost:18000

---

## 1. JWT Token Validation Tests (24hr expiry)

### TC-AUTH-001: Successful Token Generation

**Priority:** P0
**Precondition:** User exists in database
**Test Steps:**

1. POST `/api/auth/login` with valid credentials
2. Verify response contains `access_token` and `refresh_token`
3. Decode JWT token and verify claims
4. Verify token expiry is 24 hours from creation

**Expected Results:**

- Status: 200 OK
- Token contains: `user_id`, `email`, `role`, `exp`, `iat`
- Expiry: current_time + 86400 seconds (24hrs)

### TC-AUTH-002: Token Expiry Validation

**Priority:** P0
**Test Steps:**

1. Generate valid JWT token
2. Manually set token expiry to past time
3. Make API request with expired token
4. Verify rejection

**Expected Results:**

- Status: 401 Unauthorized
- Error: "Token has expired"

### TC-AUTH-003: Invalid Token Signature

**Priority:** P0
**Test Steps:**

1. Generate valid JWT token
2. Modify payload without re-signing
3. Make API request with tampered token
4. Verify rejection

**Expected Results:**

- Status: 401 Unauthorized
- Error: "Invalid token signature"

### TC-AUTH-004: Token Blacklist on Logout

**Priority:** P1
**Test Steps:**

1. Login and obtain token
2. POST `/api/auth/logout` with token
3. Attempt to use same token for API request
4. Verify token is rejected

**Expected Results:**

- Logout: 200 OK
- Subsequent request: 401 Unauthorized
- Error: "Token has been revoked"

### TC-AUTH-005: Token Without Required Claims

**Priority:** P1
**Test Steps:**

1. Create JWT with missing `role` claim
2. Attempt API request
3. Verify rejection

**Expected Results:**

- Status: 401 Unauthorized
- Error: "Invalid token claims"

---

## 2. Refresh Token Flow Tests (7-day expiry)

### TC-REFRESH-001: Successful Token Refresh

**Priority:** P0
**Test Steps:**

1. Login and obtain refresh token
2. Wait for access token to expire (or simulate)
3. POST `/api/auth/refresh` with refresh token
4. Verify new access token generated

**Expected Results:**

- Status: 200 OK
- New access_token with 24hr expiry
- Same refresh_token (or rotated)

### TC-REFRESH-002: Refresh Token Expiry

**Priority:** P0
**Test Steps:**

1. Create refresh token with 7-day expiry
2. Simulate 8 days passage
3. Attempt to refresh
4. Verify rejection

**Expected Results:**

- Status: 401 Unauthorized
- Error: "Refresh token expired"
- User must re-authenticate

### TC-REFRESH-003: Refresh Token Rotation

**Priority:** P1
**Test Steps:**

1. Use refresh token to get new access token
2. Verify if refresh token is rotated
3. Attempt to use old refresh token
4. Verify old token is invalid

**Expected Results:**

- New refresh token issued
- Old refresh token rejected
- Status: 401 on old token use

### TC-REFRESH-004: Revoked Refresh Token

**Priority:** P1
**Test Steps:**

1. Obtain refresh token
2. Logout user (revoke tokens)
3. Attempt to use refresh token
4. Verify rejection

**Expected Results:**

- Status: 401 Unauthorized
- Error: "Refresh token revoked"

### TC-REFRESH-005: Multiple Device Sessions

**Priority:** P2
**Test Steps:**

1. Login from Device A
2. Login from Device B
3. Refresh token on Device A
4. Verify Device B token still valid

**Expected Results:**

- Both sessions remain valid
- Independent token refresh
- Logout affects only single session

---

## 3. Permission Matrix Tests (4 Roles)

### TC-PERM-001: Admin Role - Full Access

**Priority:** P0
**Test Matrix:**

| Action | Expected Result |
|--------|----------------|
| Create Board | ✅ 201 Created |
| Delete Board | ✅ 200 OK |
| Create Ticket | ✅ 201 Created |
| Update Any Ticket | ✅ 200 OK |
| Delete Any Ticket | ✅ 200 OK |
| View All Boards | ✅ 200 OK |
| Manage Users | ✅ 200 OK |

### TC-PERM-002: PM Role - Project Management

**Priority:** P0
**Test Matrix:**

| Action | Expected Result |
|--------|----------------|
| Create Board | ✅ 201 Created |
| Delete Board | ✅ 200 OK |
| Create Ticket | ✅ 201 Created |
| Update Any Ticket | ✅ 200 OK |
| Delete Any Ticket | ✅ 200 OK |
| View All Boards | ✅ 200 OK |
| Manage Users | ❌ 403 Forbidden |

### TC-PERM-003: Agent Role - Limited Write

**Priority:** P0
**Test Matrix:**

| Action | Expected Result |
|--------|----------------|
| Create Board | ❌ 403 Forbidden |
| Delete Board | ❌ 403 Forbidden |
| Create Ticket | ✅ 201 Created |
| Update Own Ticket | ✅ 200 OK |
| Update Others' Ticket | ❌ 403 Forbidden |
| Delete Ticket | ❌ 403 Forbidden |
| View All Boards | ✅ 200 OK |

### TC-PERM-004: Viewer Role - Read Only

**Priority:** P0
**Test Matrix:**

| Action | Expected Result |
|--------|----------------|
| Create Board | ❌ 403 Forbidden |
| Delete Board | ❌ 403 Forbidden |
| Create Ticket | ❌ 403 Forbidden |
| Update Ticket | ❌ 403 Forbidden |
| Delete Ticket | ❌ 403 Forbidden |
| View All Boards | ✅ 200 OK |
| View Ticket Details | ✅ 200 OK |

### TC-PERM-005: Cross-Role Escalation Attempt

**Priority:** P0
**Test Steps:**

1. Login as Agent role
2. Manually modify JWT role claim to "Admin"
3. Attempt admin-only action
4. Verify rejection (signature invalid)

**Expected Results:**

- Status: 401 Unauthorized
- Error: "Invalid token signature"

---

## 4. Registration & Login Flow Tests

### TC-REG-001: Successful User Registration

**Priority:** P0
**Test Steps:**

1. POST `/api/auth/register` with valid data
2. Verify user created in database
3. Verify password is hashed (bcrypt)
4. Verify welcome email sent (if applicable)

**Input:**

```json
{
  "email": "test@example.com",
  "username": "testuser",
  "password": "SecureP@ss123",
  "role": "agent"
}
```

**Expected Results:**

- Status: 201 Created
- User ID returned
- Password stored as bcrypt hash

### TC-REG-002: Duplicate Email Registration

**Priority:** P1
**Test Steps:**

1. Register user with email
2. Attempt registration with same email
3. Verify rejection

**Expected Results:**

- Status: 409 Conflict
- Error: "Email already registered"

### TC-REG-003: Password Strength Validation

**Priority:** P1
**Test Cases:**

| Password | Expected Result |
|----------|----------------|
| "123456" | ❌ 400 Bad Request |
| "password" | ❌ 400 Bad Request |
| "Pass123" | ❌ 400 Bad Request (no special char) |
| "P@ssw0rd" | ✅ Accepted (8+ chars, mixed case, number, special) |

### TC-LOGIN-001: Successful Login

**Priority:** P0
**Test Steps:**

1. POST `/api/auth/login` with valid credentials
2. Verify tokens returned
3. Verify last_login timestamp updated
4. Verify audit log entry created

**Expected Results:**

- Status: 200 OK
- Access & refresh tokens returned
- User last_login updated

### TC-LOGIN-002: Failed Login - Wrong Password

**Priority:** P0
**Test Steps:**

1. Attempt login with wrong password
2. Verify appropriate error
3. Verify no tokens generated
4. Verify failed attempt logged

**Expected Results:**

- Status: 401 Unauthorized
- Error: "Invalid credentials"
- No sensitive info leaked

### TC-LOGIN-003: Account Lockout After Failed Attempts

**Priority:** P1
**Test Steps:**

1. Attempt 5 failed logins
2. Verify account locked
3. Attempt with correct password
4. Verify still locked
5. Wait/unlock and verify access restored

**Expected Results:**

- After 5 failures: Account locked
- Status: 423 Locked
- Lockout duration: 15 minutes

---

## 5. Security Vulnerability Tests

### TC-SEC-001: SQL Injection in Login

**Priority:** P0
**Test Payloads:**

```sql
' OR '1'='1
admin'--
' UNION SELECT * FROM users--
```

**Expected Results:**

- All attempts: 401 Unauthorized
- No SQL errors exposed

### TC-SEC-002: XSS in Registration

**Priority:** P0
**Test Payloads:**

```javascript
<script>alert('XSS')</script>
javascript:alert(1)
<img src=x onerror=alert('XSS')>
```

**Expected Results:**

- Input sanitized/escaped
- No script execution

### TC-SEC-003: CSRF Token Validation

**Priority:** P0
**Test Steps:**

1. Obtain CSRF token
2. Make request without token
3. Make request with invalid token
4. Make request with valid token

**Expected Results:**

- Without token: 403 Forbidden
- Invalid token: 403 Forbidden
- Valid token: Request succeeds

### TC-SEC-004: Rate Limiting

**Priority:** P0
**Test Steps:**

1. Attempt 10 login requests in 1 second
2. Verify rate limiting kicks in
3. Verify appropriate error message

**Expected Results:**

- After threshold: 429 Too Many Requests
- Retry-After header present

### TC-SEC-005: Timing Attack Prevention

**Priority:** P1
**Test Steps:**

1. Measure response time for valid username
2. Measure response time for invalid username
3. Compare timing differences

**Expected Results:**

- Timing difference < 50ms
- Consistent response times

---

## 6. Session Management Tests

### TC-SESS-001: Concurrent Session Limit

**Priority:** P2
**Test Steps:**

1. Login from 3 different clients
2. Attempt 4th login
3. Verify oldest session invalidated

**Expected Results:**

- Max 3 concurrent sessions
- FIFO session management

### TC-SESS-002: Session Timeout

**Priority:** P1
**Test Steps:**

1. Login and obtain token
2. Remain idle for 30 minutes
3. Attempt API request
4. Verify session timeout

**Expected Results:**

- After 30min idle: Session expired
- Status: 401 Unauthorized

### TC-SESS-003: Remember Me Functionality

**Priority:** P2
**Test Steps:**

1. Login with "remember me" checked
2. Verify extended refresh token expiry
3. Verify cookie persistence

**Expected Results:**

- Refresh token: 30 days (vs 7 days)
- Persistent cookie set

---

## 7. Integration Test Scenarios

### TC-INT-001: Complete Auth Flow

**Priority:** P0
**End-to-End Scenario:**

1. Register new user
2. Verify email (if enabled)
3. Login
4. Access protected resource
5. Refresh token
6. Update profile
7. Logout

**Success Criteria:**

- All steps complete without error
- Proper status codes at each step
- Tokens valid throughout flow

### TC-INT-002: Role Change Workflow

**Priority:** P1
**Scenario:**

1. Admin creates user as Agent
2. Agent attempts admin action (fails)
3. Admin promotes Agent to PM
4. Agent logs out and back in
5. New PM can now create boards

**Success Criteria:**

- Role changes take effect
- Requires re-authentication
- Audit trail maintained

---

## 8. Performance & Load Tests

### TC-PERF-001: Auth Endpoint Performance

**Priority:** P1
**Requirements:**

- Login endpoint: < 200ms response
- Token validation: < 50ms
- Refresh token: < 100ms

### TC-LOAD-001: Concurrent Authentication

**Priority:** P1
**Test Scenario:**

- 100 concurrent login attempts
- 500 concurrent token validations
- System remains responsive

---

## Test Execution Schedule

### Day 1-2: Core Authentication

- JWT token tests
- Refresh token tests
- Basic login/registration

### Day 3: Integration Checkpoint

- End-to-end auth flow
- Permission matrix testing
- Role-based access validation

### Day 4: Security Testing

- Vulnerability scanning
- Penetration testing
- Rate limiting verification

### Day 5: Full Security Audit

- Complete security assessment
- Performance testing
- Load testing
- Coverage report

---

## Success Metrics

- ✅ 90% code coverage on auth modules
- ✅ Zero critical security vulnerabilities
- ✅ All P0 test cases passing
- ✅ Performance targets met
- ✅ Permission matrix fully validated

---

**Document Version:** 1.0
**Created:** Aug 10, 2025
**Last Updated:** Aug 10, 2025
**Next Review:** Day 3 Integration Checkpoint

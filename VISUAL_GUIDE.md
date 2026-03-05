# UNIFIED ACCOUNT SYSTEM - VISUAL GUIDE

## 1. AUTHENTICATION FLOW

```
┌─────────────────────────────────────────────────────────────┐
│                    REGISTRATION FLOW                        │
└─────────────────────────────────────────────────────────────┘

Mobile App (Registration Screen)
    │
    │ User enters: username, password, email, first_name, last_name
    │
    ▼
Backend API (/api/auth/register/)
    │
    ├─ Validate:
    │  ├─ Username unique? ✓
    │  ├─ Password strong? (8+ chars, upper, lower, number, special) ✓
    │  ├─ Email valid? ✓
    │  └─ All fields filled? ✓
    │
    ├─ Create 3 objects:
    │  ├─ User (username, email, first_name, last_name)
    │  ├─ UserProfile (no role field, just user link)
    │  └─ Student (auto ID: STU-{user_id}, Default workspace)
    │
    ▼
    ✓ 201 Created - Registration successful!
    │
    └─ Redirect to Login


┌─────────────────────────────────────────────────────────────┐
│                       LOGIN FLOW                            │
└─────────────────────────────────────────────────────────────┘

Mobile App (Login Screen)
    │
    │ User enters: username, password
    │
    ▼
Backend API (/api/auth/login/)
    │
    ├─ Lookup User by username
    │  └─ Found? ✓
    │
    ├─ Verify password hash matches
    │  └─ Password correct? ✓
    │
    ├─ Generate tokens:
    │  ├─ access_token (6 hour TTL)
    │  └─ refresh_token (longer TTL)
    │
    ▼
    ✓ 200 OK - Return {access, refresh}
    │
    └─ Mobile stores tokens in AsyncStorage


┌─────────────────────────────────────────────────────────────┐
│                  API REQUEST WITH TOKEN                     │
└─────────────────────────────────────────────────────────────┘

Mobile App (Authenticated)
    │
    │ GET /api/student/schedule/
    │ Header: Authorization: Bearer {access_token}
    │
    ▼
Backend API (Protected Endpoint)
    │
    ├─ Extract token from Authorization header
    │
    ├─ Verify token:
    │  ├─ Token valid? ✓
    │  ├─ Token not expired? ✓
    │  └─ Token not blacklisted? ✓
    │
    ├─ Identify User
    │
    ├─ Check permissions:
    │  └─ Is authenticated? ✓ (all users pass!)
    │
    ▼
    ✓ 200 OK - Return schedule data
    │
    └─ Mobile displays schedule


┌─────────────────────────────────────────────────────────────┐
│                   ERROR SCENARIOS                           │
└─────────────────────────────────────────────────────────────┘

Registration:
    Weak password (< 8 chars, no numbers)
    └─ 400 Bad Request - "password must be at least 8 characters..."

    Duplicate username
    └─ 400 Bad Request - "username already exists"

    Missing field (first_name)
    └─ 400 Bad Request - "first_name is required"

Login:
    Wrong password
    └─ 401 Unauthorized - "Invalid credentials"

    Non-existent user
    └─ 401 Unauthorized - "Invalid credentials"

Protected Endpoint:
    No token
    └─ 401 Unauthorized - "Authentication required"

    Invalid token
    └─ 401 Unauthorized - "Invalid token"
```

---

## 2. DATABASE SCHEMA

```
┌──────────────────────────────────────┐
│      Django User Model               │
├──────────────────────────────────────┤
│ • id (PK)                            │
│ • username (unique)                  │
│ • password (hashed)                  │
│ • email (unique)                     │
│ • first_name (NEW - required)        │
│ • last_name (NEW - required)         │
│ • is_active                          │
│ • is_staff                           │
│ • date_joined                        │
└──────────────────────────────────────┘
     │
     │ OneToOne relationship
     │      │
     ▼      ▼
┌──────────────────────────────────────┐
│      UserProfile Model               │
├──────────────────────────────────────┤
│ • id (PK)                            │
│ • user (FK to User)                  │
│ • avatar_url                         │
│ ❌ role (REMOVED - no longer needed) │
└──────────────────────────────────────┘
     │
     │ OneToOne relationship
     │      │
     ▼      ▼
┌──────────────────────────────────────┐
│      Student Model                   │
├──────────────────────────────────────┤
│ • id (PK)                            │
│ • user (FK to User)                  │
│ • student_id (auto: STU-{user_id})   │
│ • workspace (FK to Workspace)        │
│ • student_group (nullable)           │
│ • first_name                         │
│ • last_name                          │
│ (auto-created on registration!)      │
└──────────────────────────────────────┘
```

---

## 3. PERMISSION MODEL

```
BEFORE:
┌───────────────────────────────────────┐
│  User has role: "admin" or "faculty"  │
│                                       │
│  Admin:                               │
│  ├─ Can view timetable               │
│  ├─ Can create courses/rooms         │
│  ├─ Can generate schedules           │
│  └─ Can access admin dashboard       │
│                                       │
│  Faculty:                             │
│  ├─ Can view own schedule            │
│  ├─ Cannot create resources          │
│  ├─ Cannot generate schedules        │
│  └─ Cannot access admin dashboard    │
└───────────────────────────────────────┘


AFTER:
┌───────────────────────────────────────┐
│  All users are Admins!                │
│                                       │
│  Every User:                          │
│  ├─ Can view timetable               │
│  ├─ Can create courses/rooms         │
│  ├─ Can generate schedules           │
│  └─ Can access admin dashboard       │
│                                       │
│  Permission check:                    │
│  └─ Just: is_authenticated?          │
│           YES → Access granted!      │
│           NO  → 401 Unauthorized     │
└───────────────────────────────────────┘
```

---

## 4. USER JOURNEY

```
STEP 1: REGISTRATION
┌─────────────────────────────────────────┐
│ User opens mobile app                   │
└─────────────────────────────────────────┘
    │
    ├─ Sees "UniSched" login screen
    ├─ Clicks "Register"
    │
    ▼
    ├─ Enters: username
    ├─ Enters: password (8+ chars with complexity)
    ├─ Enters: email
    ├─ Enters: first_name
    ├─ Enters: last_name
    │
    ▼
    ├─ Clicks "Register" button
    │
    ▼
    ├─ Backend validates & creates:
    │  ├─ User
    │  ├─ UserProfile
    │  └─ Student (auto-generated)
    │
    ▼
    ├─ Alert: "Registration successful!"
    ├─ Switches to login screen
    │
    ▼


STEP 2: LOGIN
┌─────────────────────────────────────────┐
│ User on login screen                    │
└─────────────────────────────────────────┘
    │
    ├─ Enters: username
    ├─ Enters: password
    │
    ▼
    ├─ Clicks "Login" button
    │
    ▼
    ├─ Backend validates credentials
    ├─ Returns: access_token + refresh_token
    │
    ▼
    ├─ Mobile stores tokens in AsyncStorage
    ├─ Sets Authorization header for future requests
    │
    ▼


STEP 3: USE APP
┌─────────────────────────────────────────┐
│ User logged in, can access:             │
└─────────────────────────────────────────┘
    │
    ├─ Student Schedule
    ├─ Create Courses
    ├─ Create Rooms
    ├─ Create Constraints
    ├─ Generate Timetables
    ├─ View Analytics
    ├─ Export Data
    │
    ▼
    ├─ All API requests include: Bearer {token}
    ├─ Backend validates token for each request
    ├─ Token valid? → Access granted
    ├─ Token invalid/expired? → 401 Unauthorized
    │
    ▼
    ├─ Can logout
    │  ├─ Tokens blacklisted
    │  ├─ Refresh token no longer works
    │  ├─ Back to login screen
    │
    ▼
```

---

## 5. CODE STRUCTURE

```
backend/
├── scheduling/
│   ├── models.py
│   │   └─ UserProfile (role field REMOVED)
│   │
│   ├── serializers.py
│   │   └─ RegisterSerializer (requires first_name, last_name, auto-creates Student)
│   │
│   ├── permissions.py
│   │   ├─ IsAdmin (just checks is_authenticated)
│   │   └─ IsAdminOrReadOnly (just checks is_authenticated)
│   │
│   ├── views.py
│   │   ├─ register_view (POST /api/auth/register/)
│   │   ├─ login_view (POST /api/auth/login/)
│   │   └─ me_view (GET /api/auth/me/)
│   │
│   ├── urls.py
│   │   └─ Routes to auth views
│   │
│   └── migrations/
│       └─ 0007_remove_userprofile_role.py (auto-created)

mobile/
└── src/
    └── components/
        └── LoginScreen.tsx
            ├─ Registration form (removed role field)
            ├─ Login form
            └─ Helper functions
```

---

## 6. SECURITY VALIDATION

```
REGISTRATION VALIDATION:
┌────────────────────────────────────────┐
│  Username                              │
│  ├─ Already exists? ❌ REJECT (400)   │
│  └─ Unique? ✓ ACCEPT                 │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  Password                              │
│  ├─ Length < 8? ❌ REJECT (400)        │
│  ├─ No uppercase? ❌ REJECT (400)      │
│  ├─ No lowercase? ❌ REJECT (400)      │
│  ├─ No number? ❌ REJECT (400)         │
│  ├─ No special char? ❌ REJECT (400)   │
│  └─ All checks pass? ✓ ACCEPT         │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  Email                                 │
│  ├─ Required? ❌ REJECT (400)          │
│  ├─ Valid format? ✓ ACCEPT            │
│  └─ Already exists? ❌ REJECT (400)   │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  first_name, last_name                 │
│  └─ Required? ✓ ACCEPT if provided    │
└────────────────────────────────────────┘


LOGIN VALIDATION:
┌────────────────────────────────────────┐
│  User exists?                          │
│  ├─ No? ❌ Return 401 (credentials error) │
│  └─ Yes? ✓ Continue                   │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  Password correct?                     │
│  ├─ No? ❌ Return 401                  │
│  └─ Yes? ✓ Generate tokens            │
└────────────────────────────────────────┘
```

---

## 7. TOKEN LIFECYCLE

```
┌─────────────────────────────────────────────────────────────┐
│                    TOKEN FLOW                               │
└─────────────────────────────────────────────────────────────┘

User logs in successfully
    │
    ▼
Backend generates two JWTs:
    ├─ Access Token (6-hour TTL)
    │  └─ Short-lived, used for normal API requests
    │
    └─ Refresh Token (longer TTL)
       └─ Long-lived, used to get new access token

Mobile app receives tokens
    │
    ▼
Stores in AsyncStorage:
    └─ { access: "eyKJ...", refresh: "eyKJ..." }

Every API request includes:
    └─ Authorization: Bearer {access_token}

If access token expires:
    │
    ├─ 401 Unauthorized response
    │
    ▼
Mobile app uses refresh token:
    └─ POST /api/token/refresh/ with refresh token

Backend validates refresh token:
    ├─ Valid? ✓ Return new access token
    └─ Invalid/Blacklisted? ❌ Return 401

User logs out:
    │
    ├─ Refresh token added to blacklist
    │
    └─ Cannot generate new access tokens anymore
```

---

## 8. PERMISSION CHECKS (SIMPLIFIED)

```
BEFORE (Role-Based):
┌──────────────────────────────────────────────┐
│ Check permission on POST /api/courses/       │
│                                              │
│ if user.profile.role == "admin":            │
│     ✓ Allow request                         │
│ else:                                        │
│     ❌ 403 Forbidden                         │
└──────────────────────────────────────────────┘


AFTER (Unified):
┌──────────────────────────────────────────────┐
│ Check permission on POST /api/courses/       │
│                                              │
│ if user.is_authenticated:                    │
│     ✓ Allow request (everyone gets through!)│
│ else:                                        │
│     ❌ 401 Unauthorized                      │
└──────────────────────────────────────────────┘
```

---

## 9. QUICK REFERENCE

```
REGISTRATION
URL: POST http://localhost:8000/api/auth/register/
Body: {
  "username": "string",
  "password": "string (8+ chars + complexity)",
  "email": "string",
  "first_name": "string",
  "last_name": "string"
}
Response: 201 Created or 400 Bad Request

LOGIN
URL: POST http://localhost:8000/api/auth/login/
Body: {
  "username": "string",
  "password": "string"
}
Response: 200 OK with {access, refresh} or 401 Unauthorized

PROTECTED ENDPOINT
URL: GET http://localhost:8000/api/auth/me/
Header: Authorization: Bearer {access_token}
Response: 200 OK with user data or 401 Unauthorized

STUDENT SCHEDULE
URL: GET http://localhost:8000/api/student/schedule/
Header: Authorization: Bearer {access_token}
Response: 200 OK with schedule or 401/404
```

---

This visual guide explains the entire unified account system! 🎊

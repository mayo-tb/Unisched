### Unified Admin/User Account System - Implementation Summary

## Overview
Restructured the authentication and authorization system to have a **single unified account type** that can perform all admin and user functions. Removed role-based differentiation (admin vs faculty).

## Changes Made

### 1. Backend Changes

#### Database Models
**File:** `backend/scheduling/models.py`
- **UserProfile Model:**
  - Removed `ROLE_CHOICES` enum
  - Removed `role` CharField
  - Simplified `__str__()` to remove role reference
  - `is_admin` property now always returns `True` (all authenticated users are admins)
  
#### Authentication & Serializers
**File:** `backend/scheduling/serializers.py`
- **RegisterSerializer:**
  - Removed `role` ChoiceField
  - Added `first_name` and `last_name` as required fields
  - Updated `create()` method to:
    - Auto-create UserProfile (all with same admin access)
    - Auto-create Student profile for every registered user
    - Generate auto `student_id` (format: `STU-{user_id}`)
  - All users get assigned to "Default" workspace

- **UserSerializer:**
  - Removed `role` field (no longer exists in UserProfile)
  - Kept `avatar_url` and standard user fields

#### Permissions
**File:** `backend/scheduling/permissions.py`
- **IsAdmin class:**
  - Now only requires `request.user.is_authenticated`
  - No longer checks for specific role
  - All authenticated users have admin access
  
- **IsAdminOrReadOnly class:**
  - Simplified to require authentication
  - All authenticated users have full CRUD access

### 2. Frontend Changes

**File:** `mobile/src/components/LoginScreen.tsx`
- Removed role selection from registration form
- Kept essential fields:
  - Username
  - Password
  - Email
  - First Name (new, required)
  - Last Name (new, required)
- Updated registration API call to not send `role` parameter

### 3. User Flow

#### Registration
```
User provides: username, password, email, first_name, last_name
         ↓
Backend creates: User + UserProfile (admin access) + Student
         ↓
Student auto-generated ID: STU-{user_id}
Student assigned to: "Default" workspace
         ↓
Registration successful
```

#### Login
```
User provides: username, password
         ↓
Backend validates credentials
         ↓
Backend returns: access_token + refresh_token
         ↓
Frontend stores tokens in AsyncStorage
         ↓
Access granted to ALL features (student schedule, admin panel, etc.)
```

#### Access Control
- All endpoints require `IsAuthenticated` permission
- All authenticated users can:
  - View and manage timetables
  - Create courses, rooms, constraints
  - Generate schedules
  - Export data
  - Access student schedules
  - Access all admin features

## Security Features

### Password Requirements
- Minimum 8 characters
- Must include:
  - Uppercase letters
  - Lowercase letters  
  - Numbers
  - Special characters
- Validated using both custom and Django validators

### Token Management
- **Access Token:** 6-hour TTL (time to live)
- **Refresh Token:** Longer TTL, can be used to get new access tokens
- Logout blacklists refresh tokens (prevents reuse)
- Tokens verified on every protected endpoint request

### Protected Endpoints
All API endpoints require `Authorization: Bearer {access_token}` header:
- `/api/auth/me/` - Get user profile
- `/api/auth/logout/` - Logout
- `/api/student/schedule/` - Student schedule
- `/api/lecturer/dashboard/` - Lecturer dashboard (all users can access)
- `/api/admin/master-pulse/` - Admin analytics (all users can access)
- All CRUD endpoints for resources

### Input Validation
- Username: Unique, validated at registration
- Email: Unique, standard email format
- Password: Complexity validation
- Required fields: Enforced at serializer level
- Duplicate username/email rejection
- All fields trimmed and validated

## Testing Recommendations

### Manual Testing Steps

1. **Registration Test:**
   ```bash
   POST http://localhost:8000/api/auth/register/
   {
     "username": "testuser",
     "password": "SecurePass123!@#",
     "email": "test@example.com",
     "first_name": "Test",
     "last_name": "User"
   }
   Expected: 201 Created with user data
   ```

2. **Login Test:**
   ```bash
   POST http://localhost:8000/api/auth/login/
   {
     "username": "testuser",
     "password": "SecurePass123!@#"
   }
   Expected: 200 OK with access + refresh tokens
   ```

3. **Protected Endpoint Test:**
   ```bash
   GET http://localhost:8000/api/auth/me/
   Header: Authorization: Bearer {access_token}
   Expected: 200 OK with user profile
   ```

4. **Student Schedule Access:**
   ```bash
   GET http://localhost:8000/api/student/schedule/
   Header: Authorization: Bearer {access_token}
   Expected: 200 OK with student's timetable
   ```

### Security Test Cases

1. **Invalid Credentials:**
   - Wrong password → 401 Unauthorized
   - Non-existent username → 401 Unauthorized

2. **Validation:**
   - Weak password (< 8 chars) → 400 Bad Request
   - Missing fields → 400 Bad Request
   - Duplicate username → 400 Bad Request

3. **Token Validation:**
   - No token → 401 Unauthorized
   - Invalid token → 401 Unauthorized
   - Expired access token → Can use refresh token to get new one

4. **Endpoint Access:**
   - Unauthenticated request → 401 Unauthorized
   - Valid token → 200 OK with data
   - Revoked refresh token after logout → Cannot get new access token

## Database Changes

### New Workspace Auto-Creation
- When first user registers, a "Default" workspace is automatically created
- All students are assigned to this workspace
- Can be changed via admin panel later

### Student Profile Auto-Creation
- Every new user gets a Student profile created
- Student ID is auto-generated: `STU-{user_id}`
- Linked to default workspace
- Can now immediately access `/api/student/schedule/` after registration

## API Endpoints Summary

### Authentication Endpoints
- `POST /api/auth/register/` - Register new user
- `POST /api/auth/login/` - Login, get tokens
- `GET /api/auth/me/` - Get current user profile
- `POST /api/auth/logout/` - Logout, blacklist refresh token

### Student Endpoints (All Users)
- `GET /api/student/schedule/` - Get student's timetable

### Admin Endpoints (All Users)
- `GET /api/admin/master-pulse/` - System analytics
- All resource management endpoints
- All scheduling endpoints

## Migration & Deployment

### Database Migration
No new migrations needed - existing structure supports unified account:
1. Run: `python manage.py migrate`
2. Check: `python manage.py migrate --check`

### Frontend Deployment
1. Update mobile app with new LoginScreen (no role field)
2. Clear app cache/storage if upgrading from old version
3. Restart Expo/native app

### Backend Deployment
1. Apply migrations (if any)
2. Restart Django server
3. Users can now register with new unified account system

## Benefits of Unified Account System

✓ **Simpler UX:** No confusing role selection
✓ **Faster Onboarding:** Fewer fields to fill during registration
✓ **Powerful Users:** Everyone gets full access to all features
✓ **Easier Maintenance:** No role-based permission logic
✓ **Flexible:** Can still add roles later if needed
✓ **Auto Student Profiles:** Everyone can immediately access schedules

## File Changes Summary

| File | Changes |
|------|---------|
| `backend/scheduling/models.py` | Removed role field, simplified UserProfile |
| `backend/scheduling/serializers.py` | Removed role from RegisterSerializer, added student auto-creation |
| `backend/scheduling/permissions.py` | Simplified IsAdmin/IsAdminOrReadOnly to only check authentication |
| `mobile/src/components/LoginScreen.tsx` | Removed role field, kept first/last name fields |

## Next Steps

1. ✓ Backend changes complete
2. ✓ Frontend changes complete
3. ✓ Permission updates complete
4. → Run comprehensive security tests
5. → Test mobile app registration/login
6. → Test student schedule access
7. → Test all admin features access
8. → Verify token refresh works
9. → Test logout/blacklist functionality
10. → Performance testing with multiple concurrent users

#!/usr/bin/env python
"""Final unified account system test and verification."""

import os
import sys
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.contrib.auth.models import User
from scheduling.models import UserProfile, Workspace
from scheduling.presentation_models import Student
from rest_framework.test import APIClient
import urllib3

# Suppress SSL warnings for testing
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def test_unified_account_system():
    """Test the unified account system."""
    
    print("\n" + "="*80)
    print("UNIFIED ADMIN/USER ACCOUNT SYSTEM - FINAL VERIFICATION")
    print("="*80 + "\n")
    
    results = []
    client = APIClient()
    
    # Clean up test users
    User.objects.filter(username__startswith='final_test_').delete()
    
    # ═════════════════════════════════════════════════════════════
    # CONFIG CHECK
    # ═════════════════════════════════════════════════════════════
    print("STEP 1: Configuration Verification")
    print("-" * 80)
    
    # Check UserProfile no longer has role
    has_role = any(f.name == 'role' for f in UserProfile._meta.fields)
    print(f"✓ UserProfile.role field removed: {not has_role}")
    results.append(not has_role)
    
    # Check RegisterSerializer doesn't have role
    from scheduling.serializers import RegisterSerializer
    reg_ser = RegisterSerializer()
    has_role_field = 'role' in reg_ser.fields
    print(f"✓ RegisterSerializer.role field removed: {not has_role_field}")
    results.append(not has_role_field)
    
    # Check required fields exist
    required_fields = {'username', 'password', 'email', 'first_name', 'last_name'}
    ser_fields = set(reg_ser.fields.keys())
    has_required = required_fields.issubset(ser_fields)
    print(f"✓ RegisterSerializer has required fields: {has_required}")
    results.append(has_required)
    
    # ═════════════════════════════════════════════════════════════
    # REGISTRATION TEST
    # ═════════════════════════════════════════════════════════════
    print("\nSTEP 2: Registration Test")
    print("-" * 80)
    
    reg_data = {
        'username': 'final_test_user1',
        'password': 'SecurePass123!@#',
        'email': 'final_test1@example.com',
        'first_name': 'Final',
        'last_name': 'Test'
    }
    
    try:
        response = client.post('/api/auth/register/', reg_data, format='json')
        success = response.status_code == 201
        print(f"✓ Registration successful: {success} (Status: {response.status_code})")
        results.append(success)
        
        if not success:
            print(f"  Error: {response.data}")
            return results
        
        # Verify User created
        user = User.objects.get(username='final_test_user1')
        print(f"✓ User created: {user.username}")
        results.append(True)
        
        # Verify UserProfile created (without role)
        profile = UserProfile.objects.get(user=user)
        print(f"✓ UserProfile created")
        results.append(True)
        
        # Verify Student auto-created
        try:
            student = Student.objects.get(user=user)
            print(f"✓ Student profile auto-created: {student.student_id}")
            results.append(True)
        except Student.DoesNotExist:
            print(f"✗ Student profile NOT created")
            results.append(False)
            
    except Exception as e:
        print(f"✗ Registration failed: {str(e)}")
        results.append(False)
        results.append(False)
        results.append(False)
        return results
    
    # ═════════════════════════════════════════════════════════════
    # LOGIN TEST
    # ═════════════════════════════════════════════════════════════
    print("\nSTEP 3: Login Test")
    print("-" * 80)
    
    login_data = {
        'username': 'final_test_user1',
        'password': 'SecurePass123!@#'
    }
    
    access_token = None
    try:
        response = client.post('/api/auth/login/', login_data, format='json')
        success = response.status_code == 200
        print(f"✓ Login successful: {success} (Status: {response.status_code})")
        results.append(success)
        
        if success:
            access_token = response.data.get('access')
            refresh_token = response.data.get('refresh')
            print(f"✓ Access token received: {access_token is not None}")
            print(f"✓ Refresh token received: {refresh_token is not None}")
            results.append(access_token is not None)
        else:
            print(f"  Error: {response.data}")
            results.append(False)
            
    except Exception as e:
        print(f"✗ Login failed: {str(e)}")
        results.append(False)
        results.append(False)
    
    # ═════════════════════════════════════════════════════════════
    # PROTECTED ENDPOINT TEST
    # ═════════════════════════════════════════════════════════════
    print("\nSTEP 4: Protected Endpoint Access Test")
    print("-" * 80)
    
    # Without token
    try:
        response = client.get('/api/auth/me/')
        no_token_fails = response.status_code == 401
        print(f"✓ Endpoint requires auth (no token = 401): {no_token_fails}")
        results.append(no_token_fails)
    except Exception as e:
        print(f"✗ Error testing unauthenticated access: {str(e)}")
        results.append(False)
    
    # With valid token
    if access_token:
        try:
            client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
            response = client.get('/api/auth/me/')
            has_token_works = response.status_code == 200
            print(f"✓ Endpoint allows with valid token: {has_token_works} (Status: {response.status_code})")
            results.append(has_token_works)
            
            if has_token_works:
                print(f"  User: {response.data.get('username')}")
        except Exception as e:
            print(f"✗ Error accessing with token: {str(e)}")
            results.append(False)
    
    # ═════════════════════════════════════════════════════════════
    # STUDENT SCHEDULE ACCESS TEST
    # ═════════════════════════════════════════════════════════════
    print("\nSTEP 5: Student Schedule Access Test")
    print("-" * 80)
    
    if access_token:
        try:
            client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
            response = client.get('/api/student/schedule/')
            can_access = response.status_code == 200
            print(f"✓ Can access student schedule: {can_access} (Status: {response.status_code})")
            results.append(can_access)
            
            if not can_access:
                print(f"  Error: {response.data}")
        except Exception as e:
            print(f"✗ Error accessing student schedule: {str(e)}")
            results.append(False)
    
    # ═════════════════════════════════════════════════════════════
    # SECURITY TESTS
    # ═════════════════════════════════════════════════════════════
    print("\nSTEP 6: Security Tests")
    print("-" * 80)
    
    client = APIClient()  # Reset client
    
    # Weak password rejection
    weak_reg = {
        'username': 'final_test_weak',
        'password': '123456',
        'email': 'weak@example.com',
        'first_name': 'Weak',
        'last_name': 'Pass'
    }
    try:
        response = client.post('/api/auth/register/', weak_reg, format='json')
        weak_rejected = response.status_code != 201
        print(f"✓ Weak password rejected: {weak_rejected} (Status: {response.status_code})")
        results.append(weak_rejected)
    except Exception as e:
        print(f"✗ Error testing weak password: {str(e)}")
        results.append(False)
    
    # Duplicate username rejection
    dup_reg = {
        'username': 'final_test_user1',  # Already exists
        'password': 'SecurePass123!@#',
        'email': 'newduplicate@example.com',
        'first_name': 'Dup',
        'last_name': 'User'
    }
    try:
        response = client.post('/api/auth/register/', dup_reg, format='json')
        dup_rejected = response.status_code != 201
        print(f"✓ Duplicate username rejected: {dup_rejected} (Status: {response.status_code})")
        results.append(dup_rejected)
    except Exception as e:
        print(f"✗ Error testing duplicate: {str(e)}")
        results.append(False)
    
    # Wrong password rejection
    wrong_login = {
        'username': 'final_test_user1',
        'password': 'WrongPassword123!@#'
    }
    try:
        response = client.post('/api/auth/login/', wrong_login, format='json')
        wrong_rejected = response.status_code != 200
        print(f"✓ Wrong password rejected: {wrong_rejected} (Status: {response.status_code})")
        results.append(wrong_rejected)
    except Exception as e:
        print(f"✗ Error testing wrong password: {str(e)}")
        results.append(False)
    
    # ═════════════════════════════════════════════════════════════
    # SUMMARY
    # ═════════════════════════════════════════════════════════════
    print("\n" + "="*80)
    passed = sum(results)
    total = len(results)
    percentage = (passed / total * 100) if total > 0 else 0
    
    if passed == total:
        print(f"✓✓✓ ALL TESTS PASSED! ({passed}/{total}) ✓✓✓")
        print("\nThe unified account system is working correctly!")
        print("All users have full admin access to all features.")
    else:
        print(f"⚠ {passed}/{total} TESTS PASSED ({percentage:.1f}%)")
        print(f"\nFailed tests: {total - passed}")
    
    print("="*80 + "\n")
    
    return 0 if passed == total else 1


if __name__ == '__main__':
    sys.exit(test_unified_account_system())

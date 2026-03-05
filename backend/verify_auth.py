"""
Quick Authentication Verification Script
=========================================
Tests registration, login, and token management quickly.
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from rest_framework.test import APIClient
from django.contrib.auth.models import User
import time
import json

def print_test(name, passed, details=""):
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"{status} | {name}")
    if details:
        print(f"     {details}")

def main():
    print("\n" + "="*70)
    print("AUTHENTICATION SYSTEM VERIFICATION")
    print("="*70 + "\n")
    
    client = APIClient()
    test_results = []
    
    # Clean up test users
    User.objects.filter(username__startswith='verify_').delete()
    
    # ═════════════════════════════════════════════════════════════
    # TEST 1: REGISTRATION
    # ═════════════════════════════════════════════════════════════
    print("1. REGISTRATION TESTS")
    print("-" * 70)
    
    # Valid registration
    reg_data = {
        'username': 'verify_user1',
        'password': 'SecurePass123!@#',
        'email': 'verify1@test.com',
        'first_name': 'Test',
        'last_name': 'User'
    }
    try:
        response = client.post('/api/auth/register/', reg_data, format='json')
        passed = response.status_code == 201
        test_results.append(passed)
        print_test("Valid Registration", passed, f"Status: {response.status_code}")
        if response.status_code != 201:
            print(f"     Error: {response.data}")
    except Exception as e:
        test_results.append(False)
        print_test("Valid Registration", False, f"Exception: {str(e)}")
    
    # Duplicate username
    reg_data2 = {
        'username': 'verify_user1',
        'password': 'SecurePass123!@#',
        'email': 'verify2@test.com',
        'first_name': 'Duplicate',
        'last_name': 'User'
    }
    try:
        response = client.post('/api/auth/register/', reg_data2, format='json')
        passed = response.status_code != 201  # Should fail
        test_results.append(passed)
        print_test("Reject Duplicate Username", passed, f"Status: {response.status_code}")
    except Exception as e:
        test_results.append(False)
        print_test("Reject Duplicate Username", False, f"Exception: {str(e)}")
    
    # Weak password
    reg_data3 = {
        'username': 'verify_user3',
        'password': '123456',  # Too weak
        'email': 'verify3@test.com',
        'first_name': 'Weak',
        'last_name': 'Pass'
    }
    try:
        response = client.post('/api/auth/register/', reg_data3, format='json')
        passed = response.status_code != 201  # Should fail
        test_results.append(passed)
        print_test("Reject Weak Password", passed, f"Status: {response.status_code}")
    except Exception as e:
        test_results.append(False)
        print_test("Reject Weak Password", False, f"Exception: {str(e)}")
    
    # Missing fields
    reg_data4 = {
        'username': 'verify_user4',
        'password': 'SecurePass123!@#',
        # Missing email, first_name, last_name
    }
    try:
        response = client.post('/api/auth/register/', reg_data4, format='json')
        passed = response.status_code != 201  # Should fail
        test_results.append(passed)
        print_test("Reject Missing Fields", passed, f"Status: {response.status_code}")
    except Exception as e:
        test_results.append(False)
        print_test("Reject Missing Fields", False, f"Exception: {str(e)}")
    
    # ═════════════════════════════════════════════════════════════
    # TEST 2: LOGIN
    # ═════════════════════════════════════════════════════════════
    print("\n2. LOGIN TESTS")
    print("-" * 70)
    
    # Valid login
    login_data = {
        'username': 'verify_user1',
        'password': 'SecurePass123!@#'
    }
    try:
        response = client.post('/api/auth/login/', login_data, format='json')
        passed = response.status_code == 200 and 'access' in response.data
        test_results.append(passed)
        print_test("Valid Login", passed, f"Status: {response.status_code}")
        if passed:
            access_token = response.data['access']
            refresh_token = response.data['refresh']
            print(f"     Access Token: {access_token[:20]}...")
            print(f"     Refresh Token: {refresh_token[:20]}...")
        else:
            print(f"     Error: {response.data}")
    except Exception as e:
        test_results.append(False)
        access_token = None
        print_test("Valid Login", False, f"Exception: {str(e)}")
    
    # Invalid password
    login_data2 = {
        'username': 'verify_user1',
        'password': 'WrongPassword123!@#'
    }
    try:
        response = client.post('/api/auth/login/', login_data2, format='json')
        passed = response.status_code != 200  # Should fail
        test_results.append(passed)
        print_test("Reject Invalid Password", passed, f"Status: {response.status_code}")
    except Exception as e:
        test_results.append(False)
        print_test("Reject Invalid Password", False, f"Exception: {str(e)}")
    
    # Non-existent user
    login_data3 = {
        'username': 'nonexistent_user',
        'password': 'SomePassword123!@#'
    }
    try:
        response = client.post('/api/auth/login/', login_data3, format='json')
        passed = response.status_code != 200  # Should fail
        test_results.append(passed)
        print_test("Reject Nonexistent User", passed, f"Status: {response.status_code}")
    except Exception as e:
        test_results.append(False)
        print_test("Reject Nonexistent User", False, f"Exception: {str(e)}")
    
    # ═════════════════════════════════════════════════════════════
    # TEST 3: PROTECTED ENDPOINTS
    # ═════════════════════════════════════════════════════════════
    print("\n3. TOKEN & PROTECTED ENDPOINT TESTS")
    print("-" * 70)
    
    # Access without token
    try:
        response = client.get('/api/auth/me/')
        passed = response.status_code == 401
        test_results.append(passed)
        print_test("Require Auth for /me/", passed, f"Status: {response.status_code}")
    except Exception as e:
        test_results.append(False)
        print_test("Require Auth for /me/", False, f"Exception: {str(e)}")
    
    # Access with valid token
    if access_token:
        try:
            client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
            response = client.get('/api/auth/me/')
            passed = response.status_code == 200
            test_results.append(passed)
            print_test("Access with Valid Token", passed, f"Status: {response.status_code}")
            if passed:
                print(f"     User: {response.data.get('username')}")
            else:
                print(f"     Error: {response.data}")
        except Exception as e:
            test_results.append(False)
            print_test("Access with Valid Token", False, f"Exception: {str(e)}")
    
    # Access with invalid token
    try:
        client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token_12345')
        response = client.get('/api/auth/me/')
        passed = response.status_code == 401
        test_results.append(passed)
        print_test("Reject Invalid Token", passed, f"Status: {response.status_code}")
    except Exception as e:
        test_results.append(False)
        print_test("Reject Invalid Token", False, f"Exception: {str(e)}")
    
    # Reset client
    client = APIClient()
    
    # ═════════════════════════════════════════════════════════════
    # TEST 4: STUDENT PROFILE AUTO-CREATION
    # ═════════════════════════════════════════════════════════════
    print("\n4. STUDENT PROFILE AUTO-CREATION TESTS")
    print("-" * 70)
    
    # Register new user with all required fields
    reg_data5 = {
        'username': 'verify_student1',
        'password': 'StudentPass123!@#',
        'email': 'student@test.com',
        'first_name': 'Student',
        'last_name': 'Tester'
    }
    try:
        response = client.post('/api/auth/register/', reg_data5, format='json')
        passed = response.status_code == 201
        test_results.append(passed)
        print_test("Register Student User", passed, f"Status: {response.status_code}")
    except Exception as e:
        test_results.append(False)
        print_test("Register Student User", False, f"Exception: {str(e)}")
    
    # Login as student
    login_data5 = {
        'username': 'verify_student1',
        'password': 'StudentPass123!@#'
    }
    try:
        response = client.post('/api/auth/login/', login_data5, format='json')
        passed = response.status_code == 200
        test_results.append(passed)
        print_test("Student Login", passed, f"Status: {response.status_code}")
        if passed:
            student_token = response.data['access']
        else:
            student_token = None
            print(f"     Error: {response.data}")
    except Exception as e:
        test_results.append(False)
        student_token = None
        print_test("Student Login", False, f"Exception: {str(e)}")
    
    # Access student schedule
    if student_token:
        try:
            client.credentials(HTTP_AUTHORIZATION=f'Bearer {student_token}')
            response = client.get('/api/student/schedule/')
            passed = response.status_code == 200
            test_results.append(passed)
            print_test("Access Student Schedule", passed, f"Status: {response.status_code}")
            if not passed:
                print(f"     Error: {response.data}")
        except Exception as e:
            test_results.append(False)
            print_test("Access Student Schedule", False, f"Exception: {str(e)}")
    
    # ═════════════════════════════════════════════════════════════
    # SUMMARY
    # ═════════════════════════════════════════════════════════════
    print("\n" + "="*70)
    passed_count = sum(test_results)
    total_count = len(test_results)
    percentage = (passed_count / total_count * 100) if total_count > 0 else 0
    
    if passed_count == total_count:
        print(f"✓ ALL TESTS PASSED! ({passed_count}/{total_count})")
    else:
        print(f"⚠ {passed_count}/{total_count} TESTS PASSED ({percentage:.1f}%)")
    
    print("="*70 + "\n")
    
    return 0 if passed_count == total_count else 1


if __name__ == '__main__':
    sys.exit(main())

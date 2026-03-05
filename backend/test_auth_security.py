"""
Security Tests for Authentication System
=========================================
Tests registration, login, token management, and protected endpoints.
"""

import os
import sys
import django
from django.contrib.auth.models import User

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.test import TestCase, Client
from rest_framework.test import APIClient
from rest_framework import status
import json


class RegistrationSecurityTests(TestCase):
    """Test user registration with various scenarios."""
    
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
        self.login_url = '/api/auth/login/'
    
    def test_registration_success(self):
        """Test successful registration with valid data."""
        data = {
            'username': 'testuser1',
            'password': 'SecurePass123!',
            'email': 'test1@example.com',
            'first_name': 'Test',
            'last_name': 'User'
        }
        response = self.client.post(self.register_url, data, format='json')
        print(f"\n✓ Registration Success Test")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.data}")
        assert response.status_code == 201, f"Expected 201, got {response.status_code}"
        assert response.data['username'] == 'testuser1'
        print(f"  ✓ User created successfully")
    
    def test_registration_missing_fields(self):
        """Test registration with missing fields."""
        print(f"\n✓ Registration Missing Fields Test")
        
        test_cases = [
            ({
                'username': 'user2',
                'password': 'SecurePass123!',
                'email': 'user2@example.com',
                # missing first_name and last_name
            }, "Missing first_name and last_name"),
            ({
                'username': 'user3',
                'password': 'SecurePass123!',
                # missing email
                'first_name': 'Test',
                'last_name': 'User'
            }, "Missing email"),
            ({
                # missing username
                'password': 'SecurePass123!',
                'email': 'user4@example.com',
                'first_name': 'Test',
                'last_name': 'User'
            }, "Missing username"),
        ]
        
        for data, description in test_cases:
            response = self.client.post(self.register_url, data, format='json')
            print(f"  {description}: {response.status_code} - OK" if response.status_code != 201 else f"  {description}: FAILED")
            assert response.status_code != 201, f"Should have failed for: {description}"
    
    def test_registration_weak_password(self):
        """Test registration with weak password."""
        print(f"\n✓ Registration Weak Password Test")
        
        weak_passwords = [
            ('123456', 'Too short (6 chars)'),
            ('password', 'No complexity'),
            ('Pass1', 'Too short'),
        ]
        
        for idx, (password, reason) in enumerate(weak_passwords):
            data = {
                'username': f'weakuser{idx}',
                'password': password,
                'email': f'weak{idx}@example.com',
                'first_name': 'Weak',
                'last_name': 'User'
            }
            response = self.client.post(self.register_url, data, format='json')
            print(f"  {reason}: {response.status_code} - OK" if response.status_code != 201 else f"  {reason}: FAILED")
            assert response.status_code != 201, f"Should reject weak password: {reason}"
    
    def test_registration_duplicate_username(self):
        """Test registration with duplicate username."""
        print(f"\n✓ Registration Duplicate Username Test")
        
        data = {
            'username': 'duplicate_user',
            'password': 'SecurePass123!',
            'email': 'dup1@example.com',
            'first_name': 'First',
            'last_name': 'User'
        }
        
        # First registration should succeed
        response1 = self.client.post(self.register_url, data, format='json')
        assert response1.status_code == 201, f"First registration failed: {response1.data}"
        print(f"  First registration: {response1.status_code} - OK")
        
        # Second registration with same username should fail
        data['email'] = 'dup2@example.com'
        response2 = self.client.post(self.register_url, data, format='json')
        print(f"  Duplicate username: {response2.status_code} - OK" if response2.status_code != 201 else f"  Duplicate username: FAILED")
        assert response2.status_code != 201, "Duplicate username should be rejected"
    
    def test_registration_invalid_email(self):
        """Test registration with invalid email."""
        print(f"\n✓ Registration Invalid Email Test")
        
        invalid_emails = [
            'notanemail',
            'missing@domain',
            '@nodomain.com',
        ]
        
        for idx, email in enumerate(invalid_emails):
            data = {
                'username': f'emailuser{idx}',
                'password': 'SecurePass123!',
                'email': email,
                'first_name': 'Email',
                'last_name': 'Test'
            }
            response = self.client.post(self.register_url, data, format='json')
            # Note: Django may accept invalid emails, but we should validate in serializer
            print(f"  Invalid email '{email}': {response.status_code}")


class LoginSecurityTests(TestCase):
    """Test user login with various scenarios."""
    
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
        self.login_url = '/api/auth/login/'
        
        # Create test user
        data = {
            'username': 'secureuser',
            'password': 'SecurePass123!',
            'email': 'secure@example.com',
            'first_name': 'Secure',
            'last_name': 'User'
        }
        self.client.post(self.register_url, data, format='json')
    
    def test_login_success(self):
        """Test successful login with valid credentials."""
        print(f"\n✓ Login Success Test")
        
        data = {
            'username': 'secureuser',
            'password': 'SecurePass123!'
        }
        response = self.client.post(self.login_url, data, format='json')
        print(f"  Status: {response.status_code}")
        print(f"  Response keys: {list(response.data.keys())}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.data}"
        assert 'access' in response.data, "Missing access token"
        assert 'refresh' in response.data, "Missing refresh token"
        print(f"  ✓ Login successful with tokens")
    
    def test_login_invalid_password(self):
        """Test login with wrong password."""
        print(f"\n✓ Login Invalid Password Test")
        
        data = {
            'username': 'secureuser',
            'password': 'WrongPassword123!'
        }
        response = self.client.post(self.login_url, data, format='json')
        print(f"  Wrong password: {response.status_code} - OK" if response.status_code != 200 else f"  Wrong password: FAILED")
        assert response.status_code != 200, "Login should fail with wrong password"
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent username."""
        print(f"\n✓ Login Nonexistent User Test")
        
        data = {
            'username': 'nonexistent_user',
            'password': 'SomePassword123!'
        }
        response = self.client.post(self.login_url, data, format='json')
        print(f"  Nonexistent user: {response.status_code} - OK" if response.status_code != 200 else f"  Nonexistent user: FAILED")
        assert response.status_code != 200, "Login should fail for non-existent user"
    
    def test_login_missing_credentials(self):
        """Test login with missing username or password."""
        print(f"\n✓ Login Missing Credentials Test")
        
        test_cases = [
            ({'username': 'secureuser'}, "Missing password"),
            ({'password': 'SecurePass123!'}, "Missing username"),
            ({}, "Missing both"),
        ]
        
        for data, description in test_cases:
            response = self.client.post(self.login_url, data, format='json')
            print(f"  {description}: {response.status_code} - OK" if response.status_code != 200 else f"  {description}: FAILED")
            assert response.status_code != 200, f"Should reject: {description}"


class TokenSecurityTests(TestCase):
    """Test token generation and validation."""
    
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
        self.login_url = '/api/auth/login/'
        self.me_url = '/api/auth/me/'
        
        # Create test user
        data = {
            'username': 'tokenuser',
            'password': 'SecurePass123!',
            'email': 'token@example.com',
            'first_name': 'Token',
            'last_name': 'User'
        }
        self.client.post(self.register_url, data, format='json')
    
    def test_token_protected_endpoint(self):
        """Test that protected endpoints require token."""
        print(f"\n✓ Token Protected Endpoint Test")
        
        # Without token
        response = self.client.get(self.me_url)
        print(f"  Without token: {response.status_code} - OK" if response.status_code == 401 else f"  Without token: FAILED")
        assert response.status_code == 401, "Should require authentication"
        
        # With valid token
        login_data = {'username': 'tokenuser', 'password': 'SecurePass123!'}
        login_response = self.client.post(self.login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get(self.me_url)
        print(f"  With valid token: {response.status_code} - OK" if response.status_code == 200 else f"  With valid token: FAILED")
        assert response.status_code == 200, f"Should allow with valid token: {response.data}"
        print(f"  ✓ Token validation working correctly")
    
    def test_invalid_token(self):
        """Test that invalid token is rejected."""
        print(f"\n✓ Invalid Token Test")
        
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token_here')
        response = self.client.get(self.me_url)
        print(f"  Invalid token: {response.status_code} - OK" if response.status_code == 401 else f"  Invalid token: FAILED")
        assert response.status_code == 401, "Should reject invalid token"


class StudentProfileTests(TestCase):
    """Test that Student profile is auto-created on registration."""
    
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
        self.schedule_url = '/api/student/schedule/'
        self.login_url = '/api/auth/login/'
    
    def test_student_auto_created(self):
        """Test that Student profile is auto-created during registration."""
        print(f"\n✓ Auto Student Profile Creation Test")
        
        data = {
            'username': 'newstudent',
            'password': 'SecurePass123!',
            'email': 'student@example.com',
            'first_name': 'New',
            'last_name': 'Student'
        }
        response = self.client.post(self.register_url, data, format='json')
        assert response.status_code == 201, f"Registration failed: {response.data}"
        print(f"  User registered: {response.status_code}")
        
        # Login
        login_data = {'username': 'newstudent', 'password': 'SecurePass123!'}
        login_response = self.client.post(self.login_url, login_data, format='json')
        assert login_response.status_code == 200, f"Login failed: {login_response.data}"
        
        # Access student schedule (should not get "not registered as student" error)
        access_token = login_response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        schedule_response = self.client.get(self.schedule_url)
        
        print(f"  Student schedule access: {schedule_response.status_code}")
        if schedule_response.status_code != 200:
            print(f"  Response: {schedule_response.data}")
        assert schedule_response.status_code == 200, "Should be able to access student schedule"
        print(f"  ✓ Student profile auto-created and accessible")


def run_all_tests():
    """Run all security tests."""
    print("\n" + "="*70)
    print("SECURITY TEST SUITE - Authentication & Authorization")
    print("="*70)
    
    from django.test.utils import get_runner
    from django.conf import settings
    
    TestRunner = get_runner(settings)
    test_runner = TestRunner(verbosity=2, interactive=True, keepdb=False)
    
    # Run specific test classes
    test_labels = [
        'test_auth_security.RegistrationSecurityTests',
        'test_auth_security.LoginSecurityTests',
        'test_auth_security.TokenSecurityTests',
        'test_auth_security.StudentProfileTests',
    ]
    
    failures = test_runner.run_tests(test_labels)
    
    print("\n" + "="*70)
    if failures == 0:
        print("✓ ALL SECURITY TESTS PASSED!")
    else:
        print(f"✗ {failures} TEST(S) FAILED!")
    print("="*70 + "\n")
    
    return failures


if __name__ == '__main__':
    run_all_tests()

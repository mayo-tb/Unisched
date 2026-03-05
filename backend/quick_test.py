#!/usr/bin/env python
"""
Quick Manual Test - Try one registration and login
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from rest_framework.test import APIClient
from django.contrib.auth.models import User

print("\n" + "="*70)
print("QUICK MANUAL TEST - Registration & Login")
print("="*70 + "\n")

client = APIClient()
User.objects.filter(username='quicktest').delete()

# TEST 1: Registration
print("1. REGISTRATION TEST")
print("-" * 70)

reg_data = {
    'username': 'quicktest',
    'password': 'QuickTest123!@#',
    'email': 'quicktest@example.com',
    'first_name': 'Quick',
    'last_name': 'Test'
}

print(f"Registering: {reg_data['username']}")
try:
    response = client.post('/api/auth/register/', reg_data, format='json')
    print(f"Status: {response.status_code}")
    
    if response.status_code == 201:
        print("✓ Registration successful!")
        print(f"  User: {response.data.get('username')}")
        print(f"  Email: {response.data.get('email')}")
    else:
        print(f"✗ Registration failed!")
        print(f"  Error: {response.data}")
except Exception as e:
    print(f"✗ Exception: {str(e)}")

# TEST 2: Login
print("\n2. LOGIN TEST")
print("-" * 70)

login_data = {
    'username': 'quicktest',
    'password': 'QuickTest123!@#'
}

print(f"Logging in: {login_data['username']}")
try:
    response = client.post('/api/auth/login/', login_data, format='json')
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        print("✓ Login successful!")
        access_token = response.data.get('access')
        if access_token:
            print(f"  Access token: {access_token[:40]}...")
            
            # TEST 3: Access protected endpoint
            print("\n3. PROTECTED ENDPOINT TEST")
            print("-" * 70)
            
            client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
            response = client.get('/api/auth/me/')
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                print("✓ Protected endpoint accessible!")
                print(f"  User: {response.data.get('username')}")
            else:
                print(f"✗ Protected endpoint failed!")
                print(f"  Error: {response.data}")
    else:
        print(f"✗ Login failed!")
        print(f"  Error: {response.data}")
except Exception as e:
    print(f"✗ Exception: {str(e)}")

print("\n" + "="*70)
print("✓ Quick test complete!")
print("="*70 + "\n")

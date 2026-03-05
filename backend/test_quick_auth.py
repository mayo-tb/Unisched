#!/usr/bin/env python
"""Quick test of auth endpoints"""
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
import json

client = Client()

print("="*70)
print("TEST 1: Register a new user")
print("="*70)
register_data = {
    "username": "alice99",
    "email": "alice99@test.com",
    "password": "SecurePass123!@#",
    "first_name": "Alice",
    "last_name": "Smith"
}
response = client.post('/api/auth/register/', json.dumps(register_data), content_type='application/json')
print(f"Status Code: {response.status_code}")
print(f"Response: {response.json()}")

print("\n" + "="*70)
print("TEST 2: Login with registered user")
print("="*70)
login_data = {
    "username": "alice99",
    "password": "SecurePass123!@#"
}
response = client.post('/api/auth/login/', json.dumps(login_data), content_type='application/json')
print(f"Status Code: {response.status_code}")
print(f"Response: {response.json()}")

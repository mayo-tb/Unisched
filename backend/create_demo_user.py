#!/usr/bin/env python
"""Create a demo user for testing"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from scheduling.models import UserProfile

# Delete if exists
User.objects.filter(username='demo').delete()

# Create demo user
user = User.objects.create_user(
    username='demo',
    email='demo@example.com',
    password='demo123',
    first_name='Demo',
    last_name='User'
)

# Create profile
UserProfile.objects.create(user=user)

print("✅ Demo user created!")
print(f"Username: demo")
print(f"Password: demo123")

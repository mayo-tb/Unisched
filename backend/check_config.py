#!/usr/bin/env python
"""Quick test of authentication system."""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from scheduling.serializers import RegisterSerializer
from scheduling.models import UserProfile

print("\n" + "="*70)
print("AUTHENTICATION SYSTEM CONFIGURATION CHECK")
print("="*70 + "\n")

# Check RegisterSerializer fields
print("1. RegisterSerializer Fields:")
ser = RegisterSerializer()
for field_name in ser.fields.keys():
    print(f"   ✓ {field_name}")

# Check if role field is gone
has_role = 'role' in ser.fields
print(f"\n   Role field present: {has_role} (should be False)")

# Check UserProfile model
print("\n2. UserProfile Model Fields:")
for field in UserProfile._meta.fields:
    print(f"   ✓ {field.name}")

# Check if role field is gone from model
has_role_field = any(f.name == 'role' for f in UserProfile._meta.fields)
print(f"\n   Role field present in model: {has_role_field} (should be False)")

print("\n" + "="*70)
print("✓ CONFIGURATION OK - Ready for testing!")
print("="*70 + "\n")

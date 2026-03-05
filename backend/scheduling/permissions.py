"""
Genetics Cloud — Custom Permissions
=====================================
"""

from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """
    Allow access only to authenticated users (all have admin access).
    """
    message = "Authentication required."

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class IsAdminOrReadOnly(BasePermission):
    """
    All authenticated users have full access.
    """
    message = "Authentication required."

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

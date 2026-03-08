"""
UniSched — Custom Authentication Backend
==========================================
Allows login with either staff_id (for Lecturers) or username (for Admins).
"""

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import User


class StaffIdOrUsernameBackend(ModelBackend):
    """
    Authenticate using either a staff_id or a username.

    The ``credential`` parameter is checked in order:
      1. Staff ID → look up UserProfile with matching staff_id
      2. Username → standard Django User lookup

    This backend extends ModelBackend so it inherits permission checks.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        """
        ``username`` here is actually a generic credential — could be
        a staff_id or a real username. We try staff_id first.
        """
        if username is None or password is None:
            return None

        user = None

        # 1. Try matching as staff_id
        from scheduling.models import UserProfile
        try:
            profile = UserProfile.objects.select_related("user").get(staff_id=username)
            user = profile.user
        except UserProfile.DoesNotExist:
            pass

        # 2. Fall back to username lookup
        if user is None:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return None

        # Validate password and active status
        if user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None

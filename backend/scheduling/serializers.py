"""
UniSched — DRF Serializers
==================================
"""

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import (
    UserProfile, Workspace, Lecturer, StudentGroup,
    Room, Course, ConstraintConfig, TimetableVersion,
    Complaint,
)



# ── Auth ─────────────────────────────────────────────────────

class RegisterSerializer(serializers.Serializer):
    """
    Register a new user. Accepts full_name, staff_id, password, and role.
    For LECTURER role, auto-creates a linked Lecturer profile.
    """
    full_name = serializers.CharField(max_length=200)
    staff_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(
        choices=["ADMIN", "LECTURER"],
        default="ADMIN",
    )

    def validate_staff_id(self, value):
        """Ensure staff_id is unique if provided."""
        if value and UserProfile.objects.filter(staff_id=value).exists():
            raise serializers.ValidationError("This Staff ID is already registered.")
        return value

    def validate(self, data):
        """LECTURER role requires a staff_id."""
        if data.get("role") == "LECTURER" and not data.get("staff_id"):
            raise serializers.ValidationError({
                "staff_id": "Staff ID is required for lecturer registration.",
            })
        return data

    def create(self, validated_data):
        full_name = validated_data["full_name"]
        staff_id = validated_data.get("staff_id", "").strip()
        email = validated_data.get("email", "")
        password = validated_data["password"]
        role = validated_data.get("role", "ADMIN")

        # Split full_name into first/last
        name_parts = full_name.strip().split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Use staff_id as username for lecturers, email or full_name for admins
        if role == "LECTURER" and staff_id:
            username = staff_id
        else:
            username = email if email else full_name.lower().replace(" ", "_")

        # Ensure username uniqueness
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        # Create UserProfile with role and staff_id
        profile = UserProfile.objects.create(
            user=user,
            role=role,
            staff_id=staff_id if staff_id else None,
        )

        if role == "LECTURER":
            # Auto-create Lecturer records for this new user in all existing workspaces
            # so they appear immediately in the admin's Lecturer list.
            for workspace in Workspace.objects.all():
                Lecturer.objects.get_or_create(
                    user_profile=profile,
                    workspace=workspace,
                    defaults={
                        "name": full_name,
                        "email": email,
                        "department": "Faculty",
                    }
                )

        return user


class LoginSerializer(serializers.Serializer):
    """
    Login with either staff_id or username (``credential``) + password.
    Returns JWT tokens and the user's role.
    """
    credential = serializers.CharField(help_text="Staff ID or username")
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        credential = data["credential"]
        password = data["password"]

        # authenticate() calls our custom StaffIdOrUsernameBackend
        user = authenticate(
            request=self.context.get("request"),
            username=credential,  # backend handles staff_id vs username
            password=password,
        )

        if user is None:
            raise serializers.ValidationError(
                "Invalid credentials. Please check your staff ID/username and password."
            )

        if not user.is_active:
            raise serializers.ValidationError("This account has been deactivated.")

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        # Get role from profile
        profile = getattr(user, "profile", None)
        role = profile.role if profile else "ADMIN"
        staff_id = profile.staff_id if profile else None

        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "role": role,
            "staff_id": staff_id,
            "user_id": user.id,
            "username": user.username,
            "full_name": f"{user.first_name} {user.last_name}".strip(),
        }


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.CharField(
        source="profile.avatar_url", read_only=True, default="",
    )
    role = serializers.CharField(
        source="profile.role", read_only=True, default="ADMIN",
    )
    staff_id = serializers.CharField(
        source="profile.staff_id", read_only=True, default=None,
    )
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "full_name", "avatar_url", "role", "staff_id")

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


# ── Workspace ────────────────────────────────────────────────

class WorkspaceSerializer(serializers.ModelSerializer):
    courses_count = serializers.IntegerField(read_only=True, default=0)
    rooms_count = serializers.IntegerField(read_only=True, default=0)
    lecturers_count = serializers.IntegerField(read_only=True, default=0)
    groups_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Workspace
        fields = (
            "id", "name", "created_at", "last_modified",
            "courses_count", "rooms_count", "lecturers_count", "groups_count",
        )
        read_only_fields = ("id", "created_at", "last_modified")


# ── Resources ────────────────────────────────────────────────

class LecturerSerializer(serializers.ModelSerializer):
    staff_id = serializers.CharField(
        source="user_profile.staff_id", read_only=True, default=None,
    )

    class Meta:
        model = Lecturer
        fields = ("id", "name", "email", "department", "preferences", "workspace", "user_profile", "staff_id")
        extra_kwargs = {
            "user_profile": {"required": False, "allow_null": True},
        }


class StudentGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentGroup
        fields = ("id", "name", "size", "workspace")


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ("id", "name", "capacity", "building", "workspace")


class CourseSerializer(serializers.ModelSerializer):
    lecturer_name = serializers.CharField(
        source="lecturer.name", read_only=True, default="",
    )
    student_group_name = serializers.CharField(
        source="student_group.name", read_only=True, default="",
    )

    class Meta:
        model = Course
        fields = (
            "id", "name", "code", "description", "duration_hours",
            "lecturer", "lecturer_name",
            "student_group", "student_group_name",
            "workspace",
        )


# ── Constraints ──────────────────────────────────────────────

class ConstraintConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConstraintConfig
        fields = (
            "id", "name", "type", "logic_type",
            "enabled", "weight", "workspace",
        )


# ── Timetable Version ───────────────────────────────────────

class TimetableVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimetableVersion
        fields = (
            "id", "workspace", "fitness", "execution_time",
            "hard_violations", "soft_violations", "is_active",
            "created_at", "history_data",
        )
        read_only_fields = (
            "id", "fitness", "execution_time",
            "hard_violations", "soft_violations", "created_at",
        )


class TimetableEntryPatchSerializer(serializers.Serializer):
    """For PATCH /timetable/entries/<id>/ — manual override."""
    room_id = serializers.IntegerField(required=False)
    timeslot_id = serializers.IntegerField(required=False)

    def validate(self, data):
        if not data.get("room_id") and not data.get("timeslot_id"):
            raise serializers.ValidationError(
                "At least one of room_id or timeslot_id must be provided."
            )
        return data


# ── GA Trigger ───────────────────────────────────────────────

class GenerateSerializer(serializers.Serializer):
    """Input for POST /workspaces/<id>/generate/."""
    population_size = serializers.IntegerField(
        default=50, min_value=10, max_value=500,
    )
    generations = serializers.IntegerField(
        default=200, min_value=10, max_value=2000,
    )


# ── Complaints ──────────────────────────────────────────────

class ComplaintSerializer(serializers.ModelSerializer):
    lecturer_name = serializers.CharField(
        source="lecturer.name", read_only=True, default="",
    )

    class Meta:
        model = Complaint
        fields = (
            "id", "lecturer", "lecturer_name",
            "subject", "description", "status", "created_at",
        )
        read_only_fields = ("id", "lecturer", "created_at")

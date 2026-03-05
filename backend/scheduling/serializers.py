"""
Genetics Cloud — DRF Serializers
==================================
"""

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password as django_validate_password
from rest_framework import serializers
from .models import (
    UserProfile, Workspace, Lecturer, StudentGroup,
    Room, Course, ConstraintConfig, TimetableVersion,
)



# ── Auth ─────────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(required=True, write_only=True)
    last_name = serializers.CharField(required=True, write_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "first_name", "last_name")

    def validate_username(self, value):
        """Check username is not taken."""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate_email(self, value):
        """Check email is not registered."""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def create(self, validated_data):
        first_name = validated_data.pop("first_name", "")
        last_name = validated_data.pop("last_name", "")
        
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            first_name=first_name,
            last_name=last_name,
        )
        # Create UserProfile
        UserProfile.objects.create(user=user)
        
        return user


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.CharField(
        source="profile.avatar_url", read_only=True,
    )

    class Meta:
        model = User
        fields = ("id", "username", "email", "avatar_url")


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
    class Meta:
        model = Lecturer
        fields = ("id", "name", "department", "preferences", "workspace")


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

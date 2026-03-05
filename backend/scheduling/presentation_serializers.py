"""
Genetics Cloud — Presentation Layer Serializers
===============================================
Serializers for Student, Lecturer, and Admin views.
"""

from rest_framework import serializers
from scheduling.models import (
    Lecturer, StudentGroup, Room, Course, TimetableVersion,
)
from scheduling.presentation_models import (
    Department, Student, StudentEnrollment, RoomUtilization,
    ReportedConflict, LecturerScheduleSnapshot,
)


# ═════════════════════════════════════════════════════════════
# STUDENT VIEWS
# ═════════════════════════════════════════════════════════════

class StudentBasicSerializer(serializers.ModelSerializer):
    """Basic student info."""
    group_name = serializers.CharField(source="student_group.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = Student
        fields = (
            "id", "student_id", "first_name", "last_name", "email",
            "group_name", "department_name", "created_at",
        )
        read_only_fields = ("id", "created_at")


class TimeslotInfoSerializer(serializers.Serializer):
    """Represents a timeslot for timetable display."""
    id = serializers.IntegerField()
    day = serializers.IntegerField()  # 0-4 (Mon-Fri)
    period = serializers.IntegerField()  # 1-8 (hour of day)
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()


class StudentScheduleEntrySerializer(serializers.Serializer):
    """
    Single scheduled class in student's weekly view.
    Extracted from TimetableVersion.history_data for display.
    """
    id = serializers.IntegerField()
    course_code = serializers.CharField()
    course_name = serializers.CharField()
    lecturer_name = serializers.CharField()
    room_name = serializers.CharField()
    room_capacity = serializers.IntegerField()
    timeslot_id = serializers.IntegerField()
    day = serializers.IntegerField()
    period = serializers.IntegerField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    duration_hours = serializers.IntegerField()


class StudentWeeklyScheduleSerializer(serializers.Serializer):
    """
    Complete weekly schedule for a student.
    Generated from TimetableVersion by filtering to student's group.
    """
    student_id = serializers.UUIDField()
    student_name = serializers.CharField()
    group_name = serializers.CharField()
    timetable_version_id = serializers.UUIDField()
    generated_at = serializers.DateTimeField()
    fitness_score = serializers.FloatField()
    entries = StudentScheduleEntrySerializer(many=True)
    total_hours = serializers.IntegerField()
    class_count = serializers.IntegerField()

    # Heatmap data: timeslot_id → utilization (0-1)
    heatmap = serializers.DictField(
        child=serializers.FloatField(min_value=0, max_value=1),
        help_text="Heatmap showing busy (1.0) vs free (0.0) periods",
    )


# ═════════════════════════════════════════════════════════════
# LECTURER VIEWS
# ═════════════════════════════════════════════════════════════

class LecturerBasicSerializer(serializers.ModelSerializer):
    """Lecturer info."""
    preferences = serializers.JSONField()

    class Meta:
        model = Lecturer
        fields = ("id", "name", "email", "department", "preferences")


class SessionDetailSerializer(serializers.Serializer):
    """One teaching session in lecturer schedule."""
    course_code = serializers.CharField()
    course_name = serializers.CharField()
    group_name = serializers.CharField()
    student_count = serializers.IntegerField()
    room_name = serializers.CharField()
    room_capacity = serializers.IntegerField()
    timeslot_id = serializers.IntegerField()
    day = serializers.IntegerField()
    period = serializers.IntegerField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    duration_hours = serializers.IntegerField()


class LecturerDashboardSerializer(serializers.Serializer):
    """
    Lecturer dashboard showing teaching load and sessions.
    Generated from LecturerScheduleSnapshot + TimetableVersion.
    """
    lecturer_id = serializers.UUIDField()
    lecturer_name = serializers.CharField()
    total_hours = serializers.IntegerField()
    course_count = serializers.IntegerField()
    session_count = serializers.IntegerField()
    total_student_capacity = serializers.IntegerField()
    timetable_version_id = serializers.UUIDField()
    generated_at = serializers.DateTimeField()
    sessions = SessionDetailSerializer(many=True)
    venues = serializers.DictField(
        help_text="Room assignments: room_id → [timeslot_ids]",
    )


class ReportedConflictSerializer(serializers.ModelSerializer):
    """Conflict report."""
    reported_by_name = serializers.CharField(
        source="reported_by.get_full_name",
        read_only=True,
    )
    course_code = serializers.CharField(
        source="course.code",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = ReportedConflict
        fields = (
            "id", "conflict_type", "course_code", "description",
            "suggested_resolution", "status", "reported_by_name",
            "created_at", "resolved_at",
        )
        read_only_fields = ("id", "created_at", "resolved_at")


# ═════════════════════════════════════════════════════════════
# ADMIN VIEWS
# ═════════════════════════════════════════════════════════════

class RoomUtilizationSerializer(serializers.ModelSerializer):
    """Room analytics snapshot."""
    room_name = serializers.CharField(source="room.name", read_only=True)
    building = serializers.CharField(source="room.building", read_only=True)
    capacity = serializers.IntegerField(source="room.capacity", read_only=True)

    class Meta:
        model = RoomUtilization
        fields = (
            "id", "room_name", "building", "capacity", "slots_used",
            "total_slots", "avg_capacity_used", "peak_hours",
            "utilization_percentage", "is_underutilized", "created_at",
        )
        read_only_fields = (
            "id", "utilization_percentage", "is_underutilized", "created_at",
        )


class DepartmentSerializer(serializers.ModelSerializer):
    """Department info."""
    course_count = serializers.SerializerMethodField()
    lecturer_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = (
            "id", "name", "head", "description", "course_count",
            "lecturer_count", "created_at",
        )
        read_only_fields = ("id", "created_at")

    def get_course_count(self, obj):
        """Count courses in this department."""
        # Would need to join through Lecturer
        return 0

    def get_lecturer_count(self, obj):
        """Count lecturers in this department."""
        return 0


class MasterPulseRoomRowSerializer(serializers.Serializer):
    """One row in Master Pulse grid (room + all its sessions)."""
    room_id = serializers.UUIDField()
    room_name = serializers.CharField()
    building = serializers.CharField()
    capacity = serializers.IntegerField()
    department = serializers.CharField()
    utilization_percent = serializers.FloatField()
    is_underutilized = serializers.BooleanField()
    sessions = serializers.ListField(
        child=serializers.DictField(),
        help_text="Each session: {course, lecturer, group, students, timeslot}",
    )


class MasterPulseSerializer(serializers.Serializer):
    """
    Admin "Master Pulse" view: all rooms, departments, and aggregate analytics.
    """
    timetable_version_id = serializers.UUIDField()
    generated_at = serializers.DateTimeField()
    total_rooms = serializers.IntegerField()
    total_departments = serializers.IntegerField()
    peak_hours = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="Most congested timeslots (by total sessions)",
    )
    underutilized_rooms = serializers.ListField(
        child=serializers.UUIDField(),
        help_text="Room IDs with < 30% utilization",
    )
    avg_room_utilization = serializers.FloatField()
    rooms_breakdown = MasterPulseRoomRowSerializer(many=True)


# ═════════════════════════════════════════════════════════════
# EXPORT DATA SERIALIZERS
# ═════════════════════════════════════════════════════════════

class ExportRequestSerializer(serializers.Serializer):
    """Request parameters for exporting views."""
    FORMAT_CHOICES = [
        ("pdf", "PDF"),
        ("excel", "Excel"),
    ]

    timetable_version_id = serializers.UUIDField()
    format = serializers.ChoiceField(choices=FORMAT_CHOICES)
    view_type = serializers.ChoiceField(
        choices=[
            ("student", "Student Schedule"),
            ("lecturer", "Lecturer Dashboard"),
            ("admin_pulse", "Master Pulse"),
        ],
    )
    filters = serializers.JSONField(
        required=False,
        default=dict,
        help_text="Optional filters: {room_ids, department_ids, etc.}",
    )

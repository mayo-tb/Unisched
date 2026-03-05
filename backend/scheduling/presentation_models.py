"""
Genetics Cloud — Presentation Layer Models
==========================================
Extended models for Student, Lecturer, and Admin views.
Supports personalized schedules, analytics, and reporting.
"""

import uuid
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator


# ─────────────────────────────────────────────────────────────
# Department (Organizational Structure)
# ─────────────────────────────────────────────────────────────

class Department(models.Model):
    """
    University department (e.g., Computer Science, Mathematics).
    Used for admin analytics and filtering.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    workspace = models.ForeignKey(
        "scheduling.Workspace",
        on_delete=models.CASCADE,
        related_name="departments",
    )
    name = models.CharField(max_length=200)
    head = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("workspace", "name")
        indexes = [
            models.Index(fields=["workspace"]),
        ]

    def __str__(self):
        return f"{self.name}"


# ─────────────────────────────────────────────────────────────
# Student (Learner)
# ─────────────────────────────────────────────────────────────

class Student(models.Model):
    """
    Individual student record. Multiple students can belong to a StudentGroup.
    Links User to Student cohort.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="student_profile",
        null=True,
        blank=True,
    )
    student_id = models.CharField(
        max_length=50,
        unique=True,
        help_text="University student ID number",
    )
    workspace = models.ForeignKey(
        "scheduling.Workspace",
        on_delete=models.CASCADE,
        related_name="students",
    )
    student_group = models.ForeignKey(
        "scheduling.StudentGroup",
        on_delete=models.SET_NULL,
        related_name="students",
        null=True,
        blank=True,
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        related_name="students",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        unique_together = ("workspace", "student_id")
        indexes = [
            models.Index(fields=["workspace", "student_group"]),
            models.Index(fields=["student_id"]),
        ]

    def __str__(self):
        return f"{self.last_name}, {self.first_name} ({self.student_id})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


# ─────────────────────────────────────────────────────────────
# StudentEnrollment (Verify attendance in courses)
# ─────────────────────────────────────────────────────────────

class StudentEnrollment(models.Model):
    """
    Records which students are enrolled in which courses.
    Enables filtering student schedules and tracking attendance capacity.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    course = models.ForeignKey(
        "scheduling.Course",
        on_delete=models.CASCADE,
        related_name="student_enrollments",
    )
    enrolled_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("active", "Active"),
            ("withdrawn", "Withdrawn"),
            ("completed", "Completed"),
        ],
        default="active",
    )

    class Meta:
        ordering = ["-enrolled_date"]
        unique_together = ("student", "course")
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["course"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} → {self.course.code}"


# ─────────────────────────────────────────────────────────────
# RoomUtilization (Track usage)
# ─────────────────────────────────────────────────────────────

class RoomUtilization(models.Model):
    """
    Analytics snapshot: tracks room usage per timetable version.
    Used for admin "Master Pulse" view to show underutilized rooms.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    timetable_version = models.ForeignKey(
        "scheduling.TimetableVersion",
        on_delete=models.CASCADE,
        related_name="room_utilizations",
    )
    room = models.ForeignKey(
        "scheduling.Room",
        on_delete=models.CASCADE,
        related_name="utilization_records",
    )
    slots_used = models.IntegerField(
        default=0,
        help_text="Number of 1-hour slots room is scheduled",
    )
    total_slots = models.IntegerField(
        default=40,
        help_text="Total available slots per week (5 days × 8 hours)",
    )
    avg_capacity_used = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)],
        help_text="Average % of room capacity utilized",
    )
    peak_hours = models.JSONField(
        default=list,
        help_text="List of timeslot IDs with highest usage",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("timetable_version", "room")
        indexes = [
            models.Index(fields=["timetable_version"]),
            models.Index(fields=["room"]),
        ]

    def __str__(self):
        return f"{self.room.name} - {self.slots_used}/{self.total_slots} slots"

    @property
    def utilization_percentage(self):
        """Calculate room utilization %."""
        return (self.slots_used / self.total_slots * 100) if self.total_slots > 0 else 0.0

    @property
    def is_underutilized(self):
        """Room < 30% utilized."""
        return self.utilization_percentage < 30.0


# ─────────────────────────────────────────────────────────────
# ReportedConflict (Manual overrides/issues)
# ─────────────────────────────────────────────────────────────

class ReportedConflict(models.Model):
    """
    Lecturer/admin reports scheduling conflicts for manual review.
    Enables feedback loop for GA optimization refinement.
    """

    CONFLICT_TYPES = [
        ("room_change", "Room Change Request"),
        ("time_conflict", "Time Conflict"),
        ("capacity_issue", "Capacity Issue"),
        ("venue_unsuitable", "Venue Unsuitable"),
        ("other", "Other"),
    ]

    STATUS_CHOICES = [
        ("reported", "Reported"),
        ("acknowledged", "Acknowledged"),
        ("resolved", "Resolved"),
        ("dismissed", "Dismissed"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    timetable_version = models.ForeignKey(
        "scheduling.TimetableVersion",
        on_delete=models.CASCADE,
        related_name="reported_conflicts",
    )
    reported_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="reported_conflicts",
        null=True,
    )
    conflict_type = models.CharField(
        max_length=20,
        choices=CONFLICT_TYPES,
        default="other",
    )
    course = models.ForeignKey(
        "scheduling.Course",
        on_delete=models.CASCADE,
        related_name="conflicts_reported",
        null=True,
        blank=True,
    )
    description = models.TextField()
    suggested_resolution = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="reported",
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["reported_by"]),
        ]

    def __str__(self):
        return f"{self.get_conflict_type_display()} - {self.status}"


# ─────────────────────────────────────────────────────────────
# LecturerScheduleSnapshot (Performance tracking)
# ─────────────────────────────────────────────────────────────

class LecturerScheduleSnapshot(models.Model):
    """
    Snapshot of a lecturer's schedule for a specific timetable version.
    Enables quick queries for lecturer dashboard without aggregating EntryEntries.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    timetable_version = models.ForeignKey(
        "scheduling.TimetableVersion",
        on_delete=models.CASCADE,
        related_name="lecturer_snapshots",
    )
    lecturer = models.ForeignKey(
        "scheduling.Lecturer",
        on_delete=models.CASCADE,
        related_name="schedule_snapshots",
    )
    total_hours = models.IntegerField(
        default=0,
        help_text="Total teaching hours assigned",
    )
    course_count = models.IntegerField(
        default=0,
        help_text="Number of distinct courses",
    )
    session_count = models.IntegerField(
        default=0,
        help_text="Total teaching sessions",
    )
    total_student_capacity = models.IntegerField(
        default=0,
        help_text="Sum of all student groups across sessions",
    )
    assigned_venues = models.JSONField(
        default=dict,
        help_text="Dict mapping room_id → [timeslot_ids] for quick lookup",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("timetable_version", "lecturer")
        indexes = [
            models.Index(fields=["lecturer"]),
            models.Index(fields=["timetable_version"]),
        ]

    def __str__(self):
        return f"{self.lecturer.name} - {self.total_hours}h ({self.session_count} sessions)"

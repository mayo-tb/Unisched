"""
Genetics Cloud — Data Models
=============================
Complete schema for the university timetabling platform.

Architecture
------------
- **Identity layer**: UserProfile extends Django's User with RBAC roles and avatar.
- **Workspace layer**: Multi-tenant project isolation — each Workspace is an
  independent scheduling environment.
- **Resource layer**: Lecturer, StudentGroup, Room, Course — the core data
  entities consumed by the Genetic Algorithm.
- **Constraint layer**: ConstraintConfig defines hard/soft scheduling rules
  with configurable weights.
- **Async Task layer**: TaskTracker monitors long-running GA jobs (Django-Q2).
- **Output layer**: TimetableVersion stores each GA optimization run's results,
  fitness metrics, and historical data for version control.

PostgreSQL-Specific Features
----------------------------
- ``JSONField`` for flexible preferences and history data.
- ``ArrayField`` for lecturer day-of-week preferences.
- All models use ``BigAutoField`` (project default).
"""

import uuid
from django.db import models
from django.contrib.auth.models import User

from django.core.validators import MinValueValidator, MaxValueValidator
from .validators_schemas import validate_lecturer_preferences


# ─────────────────────────────────────────────────────────────
# User Profile (extends built-in User with role + avatar)
# ─────────────────────────────────────────────────────────────

class UserProfile(models.Model):
    """
    Extends Django's User with RBAC role and optional staff ID.

    Roles:
        - ADMIN: Full access to all features (workspaces, GA, resources).
        - LECTURER: Can view schedule, submit complaints, limited access.
    """

    ROLE_CHOICES = [
        ("ADMIN", "Admin"),
        ("LECTURER", "Lecturer"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="ADMIN",
        help_text="ADMIN = full access, LECTURER = limited access.",
    )
    staff_id = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
        help_text="Unique staff identifier for lecturer login.",
    )
    avatar_url = models.URLField(
        blank=True,
        default="",
        help_text="URL to the user's avatar image.",
    )

    class Meta:
        ordering = ["user__username"]

    def __str__(self):
        return f"{self.user.username} ({self.role})"

    @property
    def is_admin(self):
        return self.role == "ADMIN"


# ─────────────────────────────────────────────────────────────
# Workspace (multi-tenant project isolation)
# ─────────────────────────────────────────────────────────────

class Workspace(models.Model):
    """
    An isolated scheduling environment (e.g., 'Spring 2026', 'Autumn 2026').

    Each workspace contains its own set of resources (lecturers, rooms,
    courses, student groups) and timetable versions. Deleting a workspace
    cascades to all dependent objects.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    name = models.CharField(max_length=200)
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="workspaces",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_modified"]
        unique_together = ("owner", "name")
        indexes = [
            models.Index(fields=["owner", "-last_modified"]),
        ]

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────
# Task Tracker (for Django-Q2 progress polling)
# ─────────────────────────────────────────────────────────────

class TaskTracker(models.Model):
    """
    Tracks the progress of a long-running background task (e.g. GA optimization).
    Django-Q2 handles execution, but this model provides granular progress (%)
    and status updates for the frontend to poll.
    """
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("RUNNING", "Running"),
        ("COMPLETED", "Completed"),
        ("FAILED", "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="tasks")
    task_id = models.CharField(max_length=255, help_text="Django-Q2 task ID", blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    progress = models.IntegerField(default=0, help_text="0-100 percentage")
    current_generation = models.IntegerField(default=0)
    current_fitness = models.FloatField(default=0.0)
    result = models.JSONField(blank=True, null=True, help_text="Final result payload (if successful)")
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        return f"{self.workspace.name} - {self.status} ({self.progress}%)"


# ─────────────────────────────────────────────────────────────
# Lecturer
# ─────────────────────────────────────────────────────────────

class Lecturer(models.Model):
    """
    Teaching staff member.

    Optionally linked to a UserProfile via ``user_profile``, which allows
    the lecturer to log in with their staff_id and view their own schedule.

    The ``preferences`` JSONField stores flexible scheduling hints consumed
    by the GA engine as **soft constraints**. Structure::

        {
            "preferred_timeslots": [1, 5, 9],
            "max_daily_hours": 4,
            "avoid_days": [4],         // 0=Mon … 4=Fri
            "morning_only": true
        }
    """

    name = models.CharField(max_length=200)
    email = models.EmailField(blank=True, default="")
    department = models.CharField(max_length=100, blank=True, default="")
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="lecturers",
    )
    user_profile = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lecturer_profiles",
        help_text="Link to the user account (for staff login).",
    )
    preferences = models.JSONField(
        default=dict,
        blank=True,
        validators=[validate_lecturer_preferences],
        help_text="JSON object for scheduling preferences (soft constraints).",
    )

    class Meta:
        ordering = ["name"]
        unique_together = ("workspace", "name")

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────
# Student Group
# ─────────────────────────────────────────────────────────────

class StudentGroup(models.Model):
    """
    A cohort of students (e.g. 'CS Year 1', 'Math Group A') that attends
    classes together. Constraints prevent double-booking a group.
    """

    name = models.CharField(max_length=200)
    size = models.IntegerField(validators=[MinValueValidator(1)])
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="student_groups",
    )

    class Meta:
        ordering = ["name"]
        unique_together = ("workspace", "name")

    def __str__(self):
        return f"{self.name} ({self.size})"


# ─────────────────────────────────────────────────────────────
# Room
# ─────────────────────────────────────────────────────────────

class Room(models.Model):
    """
    Physical venue where a class takes place.
    """

    name = models.CharField(max_length=100)
    capacity = models.IntegerField(validators=[MinValueValidator(1)])
    building = models.CharField(max_length=100, blank=True, default="Main")
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="rooms",
    )

    class Meta:
        ordering = ["building", "name"]
        unique_together = ("workspace", "name")

    def __str__(self):
        return f"{self.name} ({self.capacity})"


# ─────────────────────────────────────────────────────────────
# Course
# ─────────────────────────────────────────────────────────────

class Course(models.Model):
    """
    The core schedulable unit. Connects a lecturer to a student group for
    a specific duration.
    """

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20)
    duration_hours = models.IntegerField(
        default=1,
        help_text="Length of the class in hours (e.g., 1, 2, or 3).",
    )
    requires_lab = models.BooleanField(default=False)
    lecturer = models.ForeignKey(
        Lecturer,
        on_delete=models.SET_NULL,
        related_name="courses",
        null=True,
        blank=True,
    )
    student_group = models.ForeignKey(
        StudentGroup,
        on_delete=models.SET_NULL,
        related_name="courses",
        null=True,
        blank=True,
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="courses",
    )
    description = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["code"]
        unique_together = ("workspace", "code")

    def __str__(self):
        return f"{self.code}: {self.name}"


# ─────────────────────────────────────────────────────────────
# Constraint Config (Hyperparameters & Weights)
# ─────────────────────────────────────────────────────────────

class ConstraintConfig(models.Model):
    """
    Defines the rules for the Genetic Algorithm's fitness function.

    - **Hard constraints** (enabled=True) penalize fitness heavily if violated.
    - **Soft constraints** penalize less, guiding the GA toward optimal schedules.
    """

    CONSTRAINT_TYPES = [
        ("hard", "Hard Constraint"),
        ("soft", "Soft Constraint"),
    ]

    CONSTRAINT_LOGIC = [
        ("room_conflict", "Room Double Booking"),
        ("lecturer_conflict", "Lecturer Double Booking"),
        ("group_conflict", "Group Double Booking"),
        ("capacity_overflow", "Room Capacity Exceeded"),
        ("lecturer_preference", "Lecturer Preference Ignored"),
    ]

    name = models.CharField(max_length=100)
    type = models.CharField(max_length=10, choices=CONSTRAINT_TYPES)
    logic_type = models.CharField(max_length=50, choices=CONSTRAINT_LOGIC)
    weight = models.IntegerField(default=10)
    enabled = models.BooleanField(default=True)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="constraints",
    )

    def __str__(self):
        return f"{self.name} ({self.type})"


# ─────────────────────────────────────────────────────────────
# Timetable Version (GA Output)
# ─────────────────────────────────────────────────────────────

class TimetableVersion(models.Model):
    """
    A snapshot of a generated schedule.

    Since a GA run produces a complex object graph, we serialize the entire
    timetable structure into ``history_data`` (JSON) rather than creating thousands
    of individual TimeSlot rows. This improves write performance and versioning.

    ``history_data`` structure::

        {
            "entries": [ ...list of scheduled classes... ],
            "fitness_trend": [ ...generation scores... ],
            "ga_config": { ...hyperparameters... },
            "constraint_violations": { "hard": [], "soft": [] }
        }
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="timetable_versions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    fitness = models.FloatField(default=0.0, help_text="Final fitness score of this solution.")
    generations_run = models.IntegerField(default=0)
    execution_time = models.FloatField(default=0.0, help_text="Time taken in milliseconds.")

    hard_violations = models.IntegerField(default=0)
    soft_violations = models.IntegerField(default=0)

    is_active = models.BooleanField(
        default=False,
        help_text="Only one version is active for the public view.",
    )

    history_data = models.JSONField(
        default=dict,
        help_text="Serialized timetable structure and analytics.",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workspace", "is_active"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        return f"v{self.id} (Fitness: {self.fitness:.2f})"


# ─────────────────────────────────────────────────────────────
# Complaint (Lecturer feedback / issue tracking)
# ─────────────────────────────────────────────────────────────

class Complaint(models.Model):
    """
    A complaint or feedback item submitted by a lecturer regarding
    their schedule, room assignment, or other concerns.
    """

    STATUS_CHOICES = [
        ("OPEN", "Open"),
        ("RESOLVED", "Resolved"),
    ]

    lecturer = models.ForeignKey(
        Lecturer,
        on_delete=models.CASCADE,
        related_name="complaints",
    )
    subject = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="OPEN",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.subject} ({self.status})"

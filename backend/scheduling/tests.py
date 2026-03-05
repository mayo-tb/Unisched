"""
Genetics Cloud — API Integration Tests
========================================
Tests for all REST endpoints using DRF's APIClient.

Run with:
    python manage.py test scheduling.tests -v2
"""

from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from scheduling.models import (
    UserProfile, Workspace, Lecturer, StudentGroup,
    Room, Course, ConstraintConfig, TimetableVersion,
)


# Run Celery tasks synchronously during tests
@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    CELERY_RESULT_BACKEND="cache+memory://",
)
class APITestBase(TestCase):
    """Base class with common setup — admin and faculty users."""

    def setUp(self):
        # Admin user
        self.admin_user = User.objects.create_user(
            username="admin", password="AdminPass@123", email="admin@test.com",
        )
        UserProfile.objects.create(user=self.admin_user, role="admin")

        # Faculty user
        self.faculty_user = User.objects.create_user(
            username="faculty", password="FacultyPass@123", email="fac@test.com",
        )
        UserProfile.objects.create(user=self.faculty_user, role="faculty")

        # API clients
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin_user)

        self.faculty_client = APIClient()
        self.faculty_client.force_authenticate(user=self.faculty_user)

        self.anon_client = APIClient()


# ─────────────────────────────────────────────────────────────
# Auth Tests
# ─────────────────────────────────────────────────────────────

class AuthTests(APITestBase):

    def test_register_success(self):
        resp = self.anon_client.post("/api/auth/register/", {
            "username": "newuser", "password": "NewUserPass@123", "role": "faculty",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["username"], "newuser")
        self.assertEqual(resp.data["role"], "faculty")

    def test_register_missing_password(self):
        resp = self.anon_client.post("/api/auth/register/", {
            "username": "nopass",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_success(self):
        resp = self.anon_client.post("/api/auth/login/", {
            "username": "admin", "password": "AdminPass@123",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_login_wrong_password(self):
        resp = self.anon_client.post("/api/auth/login/", {
            "username": "admin", "password": "wrongpass",
        })
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_authenticated(self):
        resp = self.admin_client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["username"], "admin")
        self.assertEqual(resp.data["role"], "admin")

    def test_me_unauthenticated(self):
        resp = self.anon_client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ─────────────────────────────────────────────────────────────
# Workspace Tests
# ─────────────────────────────────────────────────────────────

class WorkspaceAPITests(APITestBase):

    def test_list_workspaces_empty(self):
        resp = self.admin_client.get("/api/workspaces/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_create_workspace_admin(self):
        resp = self.admin_client.post("/api/workspaces/", {"name": "Spring 2026"})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["name"], "Spring 2026")

    def test_create_workspace_faculty_denied(self):
        resp = self.faculty_client.post("/api/workspaces/", {"name": "Nope"})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_workspaces_faculty_readonly(self):
        """Faculty can read (GET) but not write."""
        resp = self.faculty_client.get("/api/workspaces/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_workspace_detail(self):
        ws = Workspace.objects.create(name="Test", owner=self.admin_user)
        resp = self.admin_client.get(f"/api/workspaces/{ws.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["name"], "Test")

    def test_unauthenticated_denied(self):
        resp = self.anon_client.get("/api/workspaces/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ─────────────────────────────────────────────────────────────
# Resource (Course) Tests
# ─────────────────────────────────────────────────────────────

class CourseAPITests(APITestBase):

    def setUp(self):
        super().setUp()
        self.ws = Workspace.objects.create(name="Test WS", owner=self.admin_user)
        self.lecturer = Lecturer.objects.create(
            name="Dr. X", department="CS", workspace=self.ws,
        )
        self.group = StudentGroup.objects.create(
            name="CSC 300", size=60, workspace=self.ws,
        )

    def test_list_courses_empty(self):
        resp = self.admin_client.get("/api/resources/courses/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_create_course_admin(self):
        resp = self.admin_client.post("/api/resources/courses/", {
            "name": "Data Structures",
            "code": "CSC201",
            "duration_hours": 2,
            "lecturer": self.lecturer.id,
            "student_group": self.group.id,
            "workspace": str(self.ws.id),
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["code"], "CSC201")
        self.assertEqual(resp.data["lecturer_name"], "Dr. X")

    def test_create_course_faculty_denied(self):
        resp = self.faculty_client.post("/api/resources/courses/", {
            "name": "Nope", "code": "X", "workspace": str(self.ws.id),
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_search_courses(self):
        Course.objects.create(
            name="Data Structures", code="CSC201",
            workspace=self.ws, lecturer=self.lecturer,
        )
        Course.objects.create(
            name="Calculus", code="MAT101", workspace=self.ws,
        )
        resp = self.admin_client.get("/api/resources/courses/?search=Data")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        # Should find "Data Structures" but not "Calculus"
        names = [c["name"] for c in results]
        self.assertIn("Data Structures", names)


# ─────────────────────────────────────────────────────────────
# GA Generation Trigger Tests
# ─────────────────────────────────────────────────────────────

class GenerateAPITests(APITestBase):

    def setUp(self):
        super().setUp()
        self.ws = Workspace.objects.create(name="GA Test", owner=self.admin_user)
        # Seed minimum data for a valid GA run
        lec = Lecturer.objects.create(name="Dr. A", department="CS", workspace=self.ws)
        grp = StudentGroup.objects.create(name="G1", size=30, workspace=self.ws)
        Room.objects.create(name="R1", capacity=50, workspace=self.ws)
        Course.objects.create(
            name="C1", code="C1", duration_hours=1,
            lecturer=lec, student_group=grp, workspace=self.ws,
        )

    def test_generate_admin_accepted(self):
        resp = self.admin_client.post(
            f"/api/workspaces/{self.ws.id}/generate/",
            {"population_size": 10, "generations": 10},
            format="json",
        )
        self.assertIn(
            resp.status_code,
            [status.HTTP_202_ACCEPTED, status.HTTP_200_OK],
            f"Expected 202/200, got {resp.status_code}: {resp.data}",
        )

    def test_generate_faculty_denied(self):
        resp = self.faculty_client.post(
            f"/api/workspaces/{self.ws.id}/generate/",
            {"population_size": 10, "generations": 10},
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_generate_unauthenticated_denied(self):
        resp = self.anon_client.post(
            f"/api/workspaces/{self.ws.id}/generate/", {},
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ─────────────────────────────────────────────────────────────
# Timetable Entry Patch Tests
# ─────────────────────────────────────────────────────────────

class TimetableEntryPatchTests(APITestBase):

    def setUp(self):
        super().setUp()
        self.ws = Workspace.objects.create(name="Patch Test", owner=self.admin_user)
        self.version = TimetableVersion.objects.create(
            workspace=self.ws,
            fitness=0.9,
            history_data={
                "entries": [
                    {"course_id": 1, "room_id": 1, "timeslot_id": 1,
                     "lecturer_id": 1, "student_group_id": 1},
                    {"course_id": 2, "room_id": 2, "timeslot_id": 2,
                     "lecturer_id": 2, "student_group_id": 2},
                ],
            },
        )

    def test_patch_entry_admin(self):
        resp = self.admin_client.patch(
            f"/api/timetable/entries/{self.version.id}/0/",
            {"room_id": 99},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["entry"]["room_id"], 99)

    def test_patch_entry_faculty_denied(self):
        resp = self.faculty_client.patch(
            f"/api/timetable/entries/{self.version.id}/0/",
            {"room_id": 99},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_entry_invalid_index(self):
        resp = self.admin_client.patch(
            f"/api/timetable/entries/{self.version.id}/999/",
            {"room_id": 99},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_entry_no_data(self):
        resp = self.admin_client.patch(
            f"/api/timetable/entries/{self.version.id}/0/",
            {},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_entry_not_found(self):
        import uuid
        resp = self.admin_client.patch(
            f"/api/timetable/entries/{uuid.uuid4()}/0/",
            {"room_id": 1},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────────────────────────
# Permission Tests
# ─────────────────────────────────────────────────────────────

class PermissionTests(APITestBase):

    def test_constraint_admin_only(self):
        ws = Workspace.objects.create(name="Perm Test", owner=self.admin_user)
        resp = self.faculty_client.get("/api/resources/constraints/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_constraint_admin_can_create(self):
        ws = Workspace.objects.create(name="Perm Test", owner=self.admin_user)
        resp = self.admin_client.post("/api/resources/constraints/", {
            "name": "No Overlap",
            "type": "hard",
            "logic_type": "room_conflict",
            "weight": 1000,
            "workspace": str(ws.id),
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

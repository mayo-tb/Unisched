"""
Genetics Cloud — URL Configuration (scheduling app)
=====================================================
All API endpoints under /api/ prefix.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views
from . import presentation_views

router = DefaultRouter()
router.register(r"workspaces", views.WorkspaceViewSet, basename="workspace")
router.register(r"resources/lecturers", views.LecturerViewSet, basename="lecturer")
router.register(r"resources/groups", views.StudentGroupViewSet, basename="studentgroup")
router.register(r"resources/rooms", views.RoomViewSet, basename="room")
router.register(r"resources/courses", views.CourseViewSet, basename="course")
router.register(r"resources/constraints", views.ConstraintConfigViewSet, basename="constraint")
router.register(r"resources/departments", views.DepartmentViewSet, basename="department")
router.register(r"timetable/versions", views.TimetableVersionViewSet, basename="timetableversion")
router.register(r"complaints", views.ComplaintViewSet, basename="complaint")
router.register(r"audit-log", views.AuditLogViewSet, basename="auditlog")



urlpatterns = [
    # Auth
    path("auth/register/", views.register_view, name="register"),
    path("auth/login/",    views.login_view, name="token_obtain"),
    path("auth/refresh/",  TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/",       views.me_view, name="me"),
    path("auth/logout/",   views.LogoutView.as_view(), name="logout"),
    path("auth/register-officer/", views.register_officer_view, name="register-officer"),
    path("auth/officers/", views.list_officers_view, name="list-officers"),
    path("auth/officers/<int:user_id>/", views.update_officer_view, name="update-officer"),
    path("auth/officers/<int:user_id>/toggle-active/", views.toggle_officer_active_view, name="toggle-officer-active"),

    # Timetable manual override
    path(
        "timetable/entries/<str:version_id>/<int:entry_index>/",
        views.patch_timetable_entry,
        name="timetable-entry-patch",
    ),

    # Partial conflict check (drag-and-drop validation)
    path(
        "timetable/conflict-check/",
        views.conflict_check_view,
        name="timetable-conflict-check",
    ),

    # Presentation layer endpoint
    path("student/schedule/", presentation_views.student_schedule_view, name="student-schedule"),

    # Lecturer self-service endpoints
    path("lecturer/preferences/", views.lecturer_preferences_view, name="lecturer-preferences"),
    path("lecturer/schedule/", views.lecturer_schedule_view, name="lecturer-schedule"),

    # Router-generated viewset URLs
    path("", include(router.urls)),
]

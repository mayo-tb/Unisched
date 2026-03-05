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
router.register(r"timetable/versions", views.TimetableVersionViewSet, basename="timetableversion")



urlpatterns = [
    # Auth
    path("auth/register/", views.register_view, name="register"),
    path("auth/login/",    views.login_view, name="token_obtain"),
    path("auth/refresh/",  TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/",       views.me_view, name="me"),
    path("auth/logout/",   views.LogoutView.as_view(), name="logout"),

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

    # Router-generated viewset URLs
    path("", include(router.urls)),
]

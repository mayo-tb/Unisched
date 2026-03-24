"""
Genetics Cloud — DRF Views
============================
DRF ViewSets and API views for all endpoints.
"""

import logging
import csv
import openpyxl
from openpyxl.styles import Font
from django.core.cache import cache
from django.db.models import Count
from django.http import HttpResponse
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User

from django_q.tasks import async_task

logger = logging.getLogger(__name__)

from .models import (
    UserProfile, Workspace, Lecturer, StudentGroup,
    Room, Course, ConstraintConfig, TimetableVersion,
    TaskTracker, Complaint, AuditLog,
)
from .presentation_models import Department
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer,
    WorkspaceSerializer, LecturerSerializer, StudentGroupSerializer,
    RoomSerializer, CourseSerializer, ConstraintConfigSerializer,
    TimetableVersionSerializer, TimetableEntryPatchSerializer,
    GenerateSerializer, ComplaintSerializer,
    DepartmentSerializer, AuditLogSerializer, RegisterOfficerSerializer,
)



def get_or_create_demo_user():
    """Helper for Auth Bypass to assign workspaces to a default anonymous owner."""
    user, created = User.objects.get_or_create(
        username="demo_anonymous",
        defaults={"email": "demo@example.com"}
    )
    if created:
        user.set_password("demo123!")
        user.save()
    UserProfile.objects.get_or_create(user=user)
    return user


def ensure_default_constraints(workspace):
    """
    Ensure the workspace has the standard set of default constraint configurations.
    They match the frontend assumption.
    """
    defaults = [
        {
            "name": "Lecturer Overlap",
            "type": "hard",
            "logic_type": "lecturer_conflict",
            "weight": 1000,
            "enabled": True
        },
        {
            "name": "Room Overlap",
            "type": "hard",
            "logic_type": "room_conflict",
            "weight": 1000,
            "enabled": True
        },
        {
            "name": "Group Overlap",
            "type": "hard",
            "logic_type": "group_conflict",
            "weight": 1000,
            "enabled": True
        },
        {
            "name": "Room Capacity",
            "type": "hard",
            "logic_type": "capacity_overflow",
            "weight": 500,
            "enabled": True
        },
        {
            "name": "Lecturer Availability",
            "type": "soft",
            "logic_type": "lecturer_preference",
            "weight": 50,
            "enabled": True
        }
    ]

    for default in defaults:
        ConstraintConfig.objects.get_or_create(
            workspace=workspace,
            logic_type=default["logic_type"],
            defaults={
                "name": default["name"],
                "type": default["type"],
                "weight": default["weight"],
                "enabled": default["enabled"]
            }
        )


# ═════════════════════════════════════════════════════════════
# Auth Endpoints
# ═════════════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    """
    POST /api/auth/register/
    Body: { full_name, staff_id?, email?, password, role? }
    """
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(
        UserSerializer(user).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    """
    POST /api/auth/login/
    Body: { credential, password }
    credential = staff_id (for lecturers) OR username (for admins)
    Returns: { access, refresh, role, staff_id, user_id, username, full_name }
    """
    serializer = LoginSerializer(
        data=request.data,
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    return Response(serializer.validated_data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    """GET /api/auth/me/ — Return current user profile with role."""
    return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklist the submitted refresh token so it cannot be reused.
    The access token expires naturally (6 h TTL).

    Body: { "refresh": "<token>" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from rest_framework_simplejwt.tokens import RefreshToken
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        except Exception as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ═════════════════════════════════════════════════════════════
# Officer Registration & Management
# ═════════════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_officer_view(request):
    """
    POST /api/auth/register-officer/
    Admin-only: register a new Timetable Officer.
    Auto-generates password, sends email with credentials.
    Returns the generated password so admin can record it.
    """
    profile = getattr(request.user, "profile", None)
    if not profile or profile.role not in ("ADMIN", "OFFICER"):
        return Response({"error": "Only admins can register officers."}, status=status.HTTP_403_FORBIDDEN)

    serializer = RegisterOfficerSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    result = serializer.save()

    # Write audit log
    workspace_id = request.headers.get("X-Workspace-Id")
    workspace = None
    if workspace_id:
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            pass
    AuditLog.objects.create(
        actor=request.user,
        action=f"Registered Timetable Officer: {result['full_name']} ({result['email']})",
        workspace=workspace,
    )

    return Response(result, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_officers_view(request):
    """
    GET /api/auth/officers/
    Returns all users with OFFICER role (admin view).
    """
    profile = getattr(request.user, "profile", None)
    if not profile or profile.role not in ("ADMIN", "OFFICER"):
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

    officers = UserProfile.objects.filter(role="OFFICER").select_related("user")
    data = [
        {
            "id": op.user.id,
            "full_name": f"{op.user.first_name} {op.user.last_name}".strip() or op.user.username,
            "email": op.user.email,
            "username": op.user.username,
            "date_joined": op.user.date_joined,
        }
        for op in officers
    ]
    return Response(data)


# ═════════════════════════════════════════════════════════════
# Workspace Endpoints
# ═════════════════════════════════════════════════════════════

class WorkspaceViewSet(viewsets.ModelViewSet):
    serializer_class = WorkspaceSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = self.request.user
        if user.is_anonymous:
            user = get_or_create_demo_user()
            
        return Workspace.objects.filter(
            owner=user,
        ).annotate(
            courses_count=Count("courses", distinct=True),
            rooms_count=Count("rooms", distinct=True),
            lecturers_count=Count("lecturers", distinct=True),
            groups_count=Count("student_groups", distinct=True),
        )

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_anonymous:
            user = get_or_create_demo_user()
        serializer.save(owner=user)

    @action(
        detail=True, methods=["post"],
        permission_classes=[AllowAny],
        url_path="generate",
    )
    def generate(self, request, pk=None):
        """POST /api/workspaces/<id>/generate/ — Trigger GA."""
        workspace = self.get_object()

        gen_serializer = GenerateSerializer(data=request.data)
        gen_serializer.is_valid(raise_exception=True)
        config_override = gen_serializer.validated_data

        if not workspace.courses.exists():
            return Response(
                {"error": "Cannot run optimization: workspace has no courses."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not workspace.rooms.exists():
            return Response(
                {"error": "Cannot run optimization: workspace has no rooms."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create tracker record
        tracker = TaskTracker.objects.create(
            workspace=workspace,
            status="PENDING",
            progress=0,
        )

        # Seed the cache immediately so the first poll doesn't hit the DB
        cache.set(
            f"unisched:ga:progress:{tracker.id}",
            {"state": "PENDING", "task_id": str(tracker.id), "progress": 0, "generation": 0, "fitness": 0.0},
            timeout=120,
        )

        # Queue async task
        from .tasks import run_ga_task
        q_task_id = async_task(
            run_ga_task,
            tracker_id=str(tracker.id),
            workspace_id=str(workspace.id),
            config_override=dict(config_override),
            task_name=f"GA-{workspace.name}",
        )

        tracker.task_id = q_task_id
        tracker.save(update_fields=["task_id"])

        username = request.user.username if request.user.is_authenticated else "demo_anonymous"
        logger.info(
            "[API] GA task queued",
            extra={
                "tracker_id": str(tracker.id),
                "workspace_id": str(workspace.id),
                "q_task_id": q_task_id,
                "config": config_override,
                "user": username,
            },
        )

        return Response(
            {"task_id": str(tracker.id), "status": "PENDING"},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(
        detail=True, methods=["get"],
        permission_classes=[AllowAny],
        url_path="export_csv",
    )
    def export_csv(self, request, pk=None):
        """GET /api/workspaces/<id>/export_csv/ - Export active timetable as CSV."""
        workspace = self.get_object()
        user = request.user
        if user.is_anonymous:
            user = get_or_create_demo_user()

        if workspace.owner != user and not getattr(user.profile, 'is_admin', False):
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        timetable = TimetableVersion.objects.filter(workspace=workspace, is_active=True).first()
        if not timetable:
            return Response({"error": "No active timetable available to export."}, status=status.HTTP_404_NOT_FOUND)

        entries_data = timetable.history_data.get("entries", [])
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="timetable_{workspace.name}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Course Code', 'Course Name', 'Lecturer', 'Room', 'Student Group', 'Day', 'Start Time', 'End Time'])

        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

        for entry in entries_data:
            try:
                course = Course.objects.get(id=entry["course_id"])
                room = Room.objects.get(id=entry["room_id"])
                
                lecturer_id = entry.get("lecturer_id")
                lecturer = Lecturer.objects.filter(id=lecturer_id).first() if lecturer_id else None
                
                group_id = entry.get("student_group_id")
                group = StudentGroup.objects.filter(id=group_id).first() if group_id else None

                timeslot_id = entry["timeslot_id"]
                day_idx = (timeslot_id - 1) // 8
                period = (timeslot_id - 1) % 8 + 1
                start_hour = 7 + period
                end_hour = start_hour + course.duration_hours
                
                start_time_str = f"{min(start_hour, 23):02d}:00"
                end_time_str = "23:59" if end_hour >= 24 else f"{end_hour:02d}:00"

                writer.writerow([
                    course.code,
                    course.name,
                    lecturer.name if lecturer else "Unassigned",
                    room.name,
                    group.name if group else "All Groups",
                    days[day_idx] if day_idx < 5 else "N/A",
                    start_time_str,
                    end_time_str
                ])
            except (Course.DoesNotExist, Room.DoesNotExist):
                continue

        return response

    @action(
        detail=True, methods=["get"],
        permission_classes=[AllowAny],
        url_path="export_excel",
    )
    def export_excel(self, request, pk=None):
        """GET /api/workspaces/<id>/export_excel/ - Export active timetable as Excel."""
        workspace = self.get_object()
        user = request.user
        if user.is_anonymous:
            user = get_or_create_demo_user()

        if workspace.owner != user and not getattr(user.profile, 'is_admin', False):
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        timetable = TimetableVersion.objects.filter(workspace=workspace, is_active=True).first()
        if not timetable:
            return Response({"error": "No active timetable available to export."}, status=status.HTTP_404_NOT_FOUND)

        entries_data = timetable.history_data.get("entries", [])
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Schedule"

        headers = ['Course Code', 'Course Name', 'Lecturer', 'Room', 'Student Group', 'Day', 'Start Time', 'End Time']
        ws.append(headers)

        bold_font = Font(bold=True)
        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_num)
            cell.font = bold_font

        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        for entry in entries_data:
            try:
                course = Course.objects.get(id=entry["course_id"])
                room = Room.objects.get(id=entry["room_id"])
                
                lecturer_id = entry.get("lecturer_id")
                lecturer = Lecturer.objects.filter(id=lecturer_id).first() if lecturer_id else None
                
                group_id = entry.get("student_group_id")
                group = StudentGroup.objects.filter(id=group_id).first() if group_id else None

                timeslot_id = entry["timeslot_id"]
                day_idx = (timeslot_id - 1) // 8
                period = (timeslot_id - 1) % 8 + 1
                start_hour = 7 + period
                end_hour = start_hour + course.duration_hours
                
                start_time_str = f"{min(start_hour, 23):02d}:00"
                end_time_str = "23:59" if end_hour >= 24 else f"{end_hour:02d}:00"

                row_data = [
                    course.code,
                    course.name,
                    lecturer.name if lecturer else "Unassigned",
                    room.name,
                    group.name if group else "All Groups",
                    days[day_idx] if day_idx < 5 else "N/A",
                    start_time_str,
                    end_time_str
                ]
                ws.append(row_data)
            except (Course.DoesNotExist, Room.DoesNotExist):
                continue

        # Auto-size columns
        for col in ws.columns:
            max_length = 0
            column_letter = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(cell.value)
                except:
                    pass
            adjusted_width = (max_length + 2)
            ws.column_dimensions[column_letter].width = adjusted_width

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="timetable_{workspace.name}.xlsx"'
        wb.save(response)

        return response

    @action(
        detail=False, methods=["get"],
        url_path=r"status/(?P<tracker_id>[a-zA-Z0-9\-]+)",
        permission_classes=[AllowAny]
    )
    def task_status(self, request, tracker_id=None):
        """
        GET /api/workspaces/status/<tracker_id>/
        Poll GA progress. Reads from DatabaseCache first to avoid per-request
        DB hits during the evolution loop. Falls back to DB on cache miss.
        """
        user = request.user
        if user.is_anonymous:
            user = get_or_create_demo_user()

        # Cache-first read
        cached = cache.get(f"unisched:ga:progress:{tracker_id}")
        if cached is not None:
            # Still need ownership check — resolve workspace from DB once
            # (cheap: simple PK lookup, not a full tracker fetch)
            try:
                tracker = TaskTracker.objects.select_related("workspace__owner").get(id=tracker_id)
            except TaskTracker.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

            if tracker.workspace.owner != user:
                return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

            response_data = dict(cached)
            # Attach final result/error from DB once the task is done
            if tracker.status == "COMPLETED":
                response_data["result"] = tracker.result
            elif tracker.status == "FAILED":
                response_data["error"] = tracker.error_message
            return Response(response_data)

        # ── DB fallback (cache miss / expired) ────────────────
        try:
            tracker = TaskTracker.objects.select_related("workspace__owner").get(id=tracker_id)
        except TaskTracker.DoesNotExist:
            return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({"error": "Invalid tracker ID"}, status=status.HTTP_400_BAD_REQUEST)

        if tracker.workspace.owner != user:
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        response_data = {
            "task_id":   str(tracker.id),
            "state":     tracker.status,
            "progress":  tracker.progress,
            "generation": tracker.current_generation,
            "fitness":   tracker.current_fitness,
        }
        if tracker.status == "COMPLETED":
            response_data["result"] = tracker.result
        elif tracker.status == "FAILED":
            response_data["error"] = tracker.error_message

        return Response(response_data)


# ═════════════════════════════════════════════════════════════
# Resource Endpoints (Scoped to Workspace)
# ═════════════════════════════════════════════════════════════

class _WorkspaceScopedMixin:
    """Filter queryset to resources within the user's own workspaces."""

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_anonymous:
            user = get_or_create_demo_user()

        user_workspace_ids = Workspace.objects.filter(
            owner=user
        ).values_list("id", flat=True)
        qs = qs.filter(workspace_id__in=user_workspace_ids)

        # Narrow to a specific workspace when the frontend passes ?workspace=<id>
        ws_id = self.request.query_params.get("workspace")
        if ws_id:
            qs = qs.filter(workspace_id=ws_id)

        return qs


class LecturerViewSet(_WorkspaceScopedMixin, viewsets.ModelViewSet):
    queryset = Lecturer.objects.select_related("workspace").all()
    serializer_class = LecturerSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "department"]
    ordering_fields = ["name", "department"]
    ordering = ["name"]


class StudentGroupViewSet(_WorkspaceScopedMixin, viewsets.ModelViewSet):
    queryset = StudentGroup.objects.select_related("workspace").all()
    serializer_class = StudentGroupSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering = ["name"]


class RoomViewSet(_WorkspaceScopedMixin, viewsets.ModelViewSet):
    queryset = Room.objects.select_related("workspace").all()
    serializer_class = RoomSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "building"]
    ordering_fields = ["name", "capacity"]
    ordering = ["name"]


class CourseViewSet(_WorkspaceScopedMixin, viewsets.ModelViewSet):
    queryset = Course.objects.select_related("lecturer", "student_group", "workspace").all()
    serializer_class = CourseSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code", "description"]
    ordering_fields = ["code", "name", "duration_hours"]
    ordering = ["code"]


class ConstraintConfigViewSet(_WorkspaceScopedMixin, viewsets.ModelViewSet):
    queryset = ConstraintConfig.objects.select_related("workspace").all()
    serializer_class = ConstraintConfigSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_anonymous:
            user = get_or_create_demo_user()
            
        user_workspaces = Workspace.objects.filter(owner=user)
        for w in user_workspaces:
            ensure_default_constraints(w)
            
        return qs


# ═════════════════════════════════════════════════════════════
# Timetable Version Endpoints
# ═════════════════════════════════════════════════════════════

class TimetableVersionViewSet(_WorkspaceScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only access to timetable versions."""
    queryset = TimetableVersion.objects.select_related("workspace").all()
    serializer_class = TimetableVersionSerializer
    permission_classes = [AllowAny]


# ═════════════════════════════════════════════════════════════
# Department Endpoints
# ═════════════════════════════════════════════════════════════

class DepartmentViewSet(_WorkspaceScopedMixin, viewsets.ModelViewSet):
    """CRUD for departments, scoped to the user's workspaces."""
    queryset = Department.objects.select_related("workspace").all()
    serializer_class = DepartmentSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering = ["name"]


# ═════════════════════════════════════════════════════════════
# Audit Log Endpoints
# ═════════════════════════════════════════════════════════════

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only audit log. Admins and officers only, scoped to workspace."""
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, "profile", None)
        if not profile or profile.role not in ("ADMIN", "OFFICER"):
            return AuditLog.objects.none()

        qs = AuditLog.objects.select_related("actor", "workspace").order_by("-timestamp")
        ws_id = self.request.query_params.get("workspace") or self.request.headers.get("X-Workspace-Id")
        if ws_id:
            qs = qs.filter(workspace_id=ws_id)
        return qs[:100]  # Limit to last 100



# ═════════════════════════════════════════════════════════════
# Complaint Endpoints
# ═════════════════════════════════════════════════════════════

class ComplaintViewSet(viewsets.ModelViewSet):
    """
    CRUD for lecturer complaints.
    - Lecturers can view/create their own complaints.
    - Admins can view/update all complaints.
    """
    serializer_class = ComplaintSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = self.request.user
        if user.is_anonymous:
            return Complaint.objects.none()

        profile = getattr(user, "profile", None)
        if profile and profile.role == "LECTURER":
            # Lecturers see only their own complaints
            lecturer_ids = Lecturer.objects.filter(
                user_profile=profile
            ).values_list("id", flat=True)
            return Complaint.objects.filter(
                lecturer_id__in=lecturer_ids
            ).select_related("lecturer")

        # Admins see all complaints
        return Complaint.objects.all().select_related("lecturer")

    def perform_create(self, serializer):
        """Auto-assign the lecturer from the authenticated user's profile."""
        from rest_framework.exceptions import PermissionDenied, ValidationError
        profile = getattr(self.request.user, "profile", None)
        if not profile or profile.role != "LECTURER":
            raise PermissionDenied("Only lecturers can submit complaints.")
        lecturer = Lecturer.objects.filter(user_profile=profile).first()
        if not lecturer:
            raise ValidationError({"lecturer": "No lecturer profile found for this user."})
        serializer.save(lecturer=lecturer)


# ═════════════════════════════════════════════════════════════
# Lecturer Self-Service Endpoints
# ═════════════════════════════════════════════════════════════

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def lecturer_preferences_view(request):
    """
    GET/PATCH /api/lecturer/preferences/
    Uses X-Workspace-Id header to locate the correct Lecturer record
    linked to the request.user's UserProfile.

    PATCH body (all optional):
        {
            "max_hours_per_week": 20,
            "preferred_days": [0, 1, 2],
            "preferences": { ... GA scheduling hints ... }
        }
    """
    profile = getattr(request.user, "profile", None)
    if not profile:
        return Response({"error": "User profile not found."}, status=status.HTTP_404_NOT_FOUND)

    workspace_id = request.headers.get("X-Workspace-Id")
    if not workspace_id:
        return Response(
            {"error": "X-Workspace-Id header is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        lecturer = Lecturer.objects.get(
            user_profile=profile,
            workspace_id=workspace_id,
        )
    except Lecturer.DoesNotExist:
        return Response(
            {"error": "No lecturer profile found for this workspace."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        from .serializers import LecturerSerializer
        return Response(LecturerSerializer(lecturer).data)

    # PATCH — update preferences
    preferences = lecturer.preferences or {}

    if "max_hours_per_week" in request.data:
        preferences["max_hours_per_week"] = request.data["max_hours_per_week"]
    if "preferred_days" in request.data:
        preferences["preferred_days"] = request.data["preferred_days"]
    if "preferred_timeslots" in request.data:
        preferences["preferred_timeslots"] = request.data["preferred_timeslots"]
    if "max_daily_hours" in request.data:
        preferences["max_daily_hours"] = request.data["max_daily_hours"]
    if "avoid_days" in request.data:
        preferences["avoid_days"] = request.data["avoid_days"]
    if "morning_only" in request.data:
        preferences["morning_only"] = request.data["morning_only"]

    # Accept top-level "preferences" dict to replace entire object
    if "preferences" in request.data and isinstance(request.data["preferences"], dict):
        preferences.update(request.data["preferences"])

    lecturer.preferences = preferences
    lecturer.save(update_fields=["preferences"])

    from .serializers import LecturerSerializer
    return Response(LecturerSerializer(lecturer).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lecturer_schedule_view(request):
    """
    GET /api/lecturer/schedule/
    Returns timetable entries for the request.user's lecturer profile
    within the active workspace (X-Workspace-Id).
    """
    profile = getattr(request.user, "profile", None)
    if not profile:
        return Response({"error": "User profile not found."}, status=status.HTTP_404_NOT_FOUND)

    workspace_id = request.headers.get("X-Workspace-Id")
    if not workspace_id:
        return Response(
            {"error": "X-Workspace-Id header is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        lecturer = Lecturer.objects.get(
            user_profile=profile,
            workspace_id=workspace_id,
        )
    except Lecturer.DoesNotExist:
        return Response(
            {"error": "No lecturer profile found for this workspace."},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Get active timetable version for this workspace
    timetable = TimetableVersion.objects.filter(
        workspace_id=workspace_id,
        is_active=True,
    ).first()

    if not timetable:
        return Response({"entries": [], "message": "No active timetable."})

    # Filter entries where lecturer_id matches
    all_entries = timetable.history_data.get("entries", [])
    lecturer_entries = [
        entry for entry in all_entries
        if entry.get("lecturer_id") == lecturer.id
    ]

    # Enrich entries with course/room names for display
    course_map = {c.id: {"name": c.name, "code": c.code} for c in Course.objects.filter(workspace_id=workspace_id)}
    room_map = {r.id: {"name": r.name, "building": r.building} for r in Room.objects.filter(workspace_id=workspace_id)}
    group_map = {g.id: {"name": g.name, "size": g.size} for g in StudentGroup.objects.filter(workspace_id=workspace_id)}

    enriched = []
    for entry in lecturer_entries:
        c = course_map.get(entry.get("course_id"), {})
        r = room_map.get(entry.get("room_id"), {})
        g = group_map.get(entry.get("student_group_id"), {})
        enriched.append({
            **entry,
            "course_name": c.get("name", ""),
            "course_code": c.get("code", ""),
            "room_name": r.get("name", ""),
            "room_building": r.get("building", ""),
            "group_name": g.get("name", ""),
            "group_size": g.get("size", 0),
        })

    return Response({
        "entries": enriched,
        "version_id": str(timetable.id),
        "fitness": timetable.fitness,
    })


@api_view(["PATCH"])
@permission_classes([AllowAny])
def patch_timetable_entry(request, version_id, entry_index):
    """
    PATCH /api/timetable/entries/<version_id>/<entry_index>/
    Manual override: swap room_id or timeslot_id for a specific entry.
    """
    try:
        version = TimetableVersion.objects.select_related("workspace").get(id=version_id)
    except TimetableVersion.DoesNotExist:
        return Response(
            {"error": "Timetable version not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    user = request.user
    if user.is_anonymous:
        user = get_or_create_demo_user()

    if version.workspace.owner != user:
        return Response(
            {"error": "Permission denied."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = TimetableEntryPatchSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    entries = version.history_data.get("entries", [])
    try:
        idx = int(entry_index)
    except (TypeError, ValueError):
        return Response(
            {"error": "Invalid entry index."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if idx < 0 or idx >= len(entries):
        return Response(
            {"error": f"Entry index {idx} out of range (0-{len(entries) - 1})."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validate conflicts BEFORE allowing override
    # Build proposed entry with updated fields
    proposed_entry = dict(entries[idx])
    if "room_id" in serializer.validated_data:
        proposed_entry["room_id"] = serializer.validated_data["room_id"]
    if "timeslot_id" in serializer.validated_data:
        proposed_entry["timeslot_id"] = serializer.validated_data["timeslot_id"]

    # Get existing entries EXCLUDING the current one (since we're replacing it)
    other_entries = entries[:idx] + entries[idx+1:]

    # Build lookup maps for conflict checking
    rooms  = {r.id: {"capacity": r.capacity, "name": r.name}
               for r in version.workspace.rooms.all()}
    groups = {g.id: {"size": g.size, "name": g.name}
               for g in version.workspace.student_groups.all()}

    from .services.conflict_check import check_partial_conflicts
    conflicts = check_partial_conflicts(
        proposed=proposed_entry,
        existing_entries=other_entries,
        room_map=rooms,
        group_map=groups,
    )

    # If conflicts detected, reject the override
    if conflicts:
        return Response(
            {
                "error": "Cannot apply override due to scheduling conflicts.",
                "conflicts": conflicts,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Apply the override
    if "room_id" in serializer.validated_data:
        entries[idx]["room_id"] = serializer.validated_data["room_id"]
    if "timeslot_id" in serializer.validated_data:
        entries[idx]["timeslot_id"] = serializer.validated_data["timeslot_id"]

    version.history_data["entries"] = entries
    version.save(update_fields=["history_data"])

    return Response(
        {"message": "Entry updated.", "entry": entries[idx]},
        status=status.HTTP_200_OK,
    )


# ═════════════════════════════════════════════════════════════
# Partial Conflict Check Endpoint
# ═════════════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([AllowAny])
def conflict_check_view(request):
    """
    POST /api/timetable/conflict-check/

    Validates a single proposed timetable entry against an existing version
    for conflicts, WITHOUT re-running the full GA.

    Used by the frontend for drag-and-drop manual override validation.

    Request body:
        {
            "version_id": "<int>",
            "entry": {
                "room_id": 3,
                "timeslot_id": 12,
                "lecturer_id": 5,
                "student_group_id": 2,
                "course_id": 8
            }
        }

    Response:
        { "conflicts": ["Room conflict: ...", ...] }   # empty = no conflict
    """
    version_id = request.data.get("version_id")
    proposed   = request.data.get("entry")

    if not version_id or not proposed:
        return Response(
            {"error": "Both 'version_id' and 'entry' are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Cache-first read for frequently checked versions ──────────────
    import hashlib, json
    entry_hash = hashlib.md5(json.dumps(proposed, sort_keys=True).encode()).hexdigest()
    cache_key  = f"unisched:conflict:{version_id}:{entry_hash}"
    cached     = cache.get(cache_key)
    if cached is not None:
        return Response({"conflicts": cached, "cached": True})

    # ── Load version ──────────────────────────────────────────────────
    try:
        version = TimetableVersion.objects.select_related("workspace").get(id=version_id)
    except TimetableVersion.DoesNotExist:
        return Response({"error": "Timetable version not found."}, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    if user.is_anonymous:
        user = get_or_create_demo_user()

    if version.workspace.owner != user:
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

    existing_entries = version.history_data.get("entries", [])

    # Build room & group lookup maps from workspace DB for capacity check
    rooms  = {r.id: {"capacity": r.capacity, "name": r.name}
               for r in version.workspace.rooms.all()}
    groups = {g.id: {"size": g.size, "name": g.name}
               for g in version.workspace.student_groups.all()}

    from .services.conflict_check import check_partial_conflicts
    conflicts = check_partial_conflicts(
        proposed=proposed,
        existing_entries=existing_entries,
        room_map=rooms,
        group_map=groups,
    )

    # Cache result for 60 s — entry + version combination unlikely to change faster
    cache.set(cache_key, conflicts, timeout=60)

    return Response({"conflicts": conflicts})

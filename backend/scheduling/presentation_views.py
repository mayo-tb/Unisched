"""
Genetics Cloud — Presentation Layer Views
==========================================
API endpoints for Student, Lecturer, and Admin dashboards.
"""

import logging
from datetime import time

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from scheduling.models import (
    Workspace, Course, Room, TimetableVersion, Lecturer,
    StudentGroup,
)
from scheduling.presentation_models import (
    Student, StudentEnrollment, RoomUtilization, ReportedConflict,
    LecturerScheduleSnapshot, Department,
)
from scheduling.presentation_serializers import (
    StudentWeeklyScheduleSerializer, LecturerDashboardSerializer,
    MasterPulseSerializer, ReportedConflictSerializer,
)


logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════
# STUDENT VIEWS
# ═════════════════════════════════════════════════════════════

class StudentScheduleViewSet(viewsets.ViewSet):
    """
    Student weekly schedule view.
    Filters active timetable by student's group.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        GET /api/student/schedule/
        Return filtered schedule for authenticated student.
        """
        try:
            student = request.user.student_profile
        except Student.DoesNotExist:
            return Response(
                {"error": "User is not registered as a student."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get active timetable version for student's workspace
        workspace = student.workspace
        timetable = TimetableVersion.objects.filter(
            workspace=workspace,
            is_active=True,
        ).first()

        if not timetable:
            return Response(
                {"error": "No active timetable in workspace."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Extract entries for student's group
        student_group = student.student_group
        entries_data = timetable.history_data.get("entries", [])

        filtered_entries = []
        heatmap = {}  # timeslot_id → utilization
        total_hours = 0

        for i, entry in enumerate(entries_data):
            # Check if entry belongs to student's group
            if entry.get("student_group_id") == student_group.id:
                # Enrich entry with course/room/lecturer data
                try:
                    course = Course.objects.get(id=entry["course_id"])
                    room = Room.objects.get(id=entry["room_id"])
                    lecturer = Lecturer.objects.get(id=entry.get("lecturer_id"))

                    timeslot_id = entry["timeslot_id"]
                    # Simple heatmap: 1.0 if scheduled, 0.0 if free
                    heatmap[str(timeslot_id)] = 1.0

                    day = (timeslot_id - 1) // 8
                    period = (timeslot_id - 1) % 8 + 1
                    start_hour = 7 + period
                    end_hour = start_hour + course.duration_hours

                    filtered_entries.append({
                        "id": i,
                        "course_code": course.code,
                        "course_name": course.name,
                        "lecturer_name": lecturer.name,
                        "room_name": room.name,
                        "room_capacity": room.capacity,
                        "timeslot_id": timeslot_id,
                        "day": day,
                        "period": period,
                        "start_time": time(start_hour, 0),
                        "end_time": time(end_hour, 0),
                        "duration_hours": course.duration_hours,
                    })

                    total_hours += course.duration_hours

                except (Course.DoesNotExist, Room.DoesNotExist, Lecturer.DoesNotExist):
                    logger.warning(f"[Student Schedule] Missing resource for entry {entry}")
                    continue

        # Fill heatmap zeros for all free periods
        for timeslot_id in range(1, 41):  # 5 days × 8 hours
            if str(timeslot_id) not in heatmap:
                heatmap[str(timeslot_id)] = 0.0

        schedule_data = {
            "student_id": str(student.id),
            "student_name": student.full_name,
            "group_name": student_group.name if student_group else "N/A",
            "timetable_version_id": str(timetable.id),
            "generated_at": timetable.created_at,
            "fitness_score": timetable.fitness,
            "entries": filtered_entries,
            "total_hours": total_hours,
            "class_count": len(filtered_entries),
            "heatmap": heatmap,
        }

        serializer = StudentWeeklyScheduleSerializer(schedule_data)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def sync_to_calendar(self, request):
        """
        POST /api/student/schedule/sync_to_calendar/
        Export schedule to calendar (iCalendar format).
        """
        try:
            student = request.user.student_profile
            timetable = TimetableVersion.objects.filter(
                workspace=student.workspace,
                is_active=True,
            ).first()

            if not timetable:
                return Response(
                    {"error": "No active timetable."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Import here to avoid dependency issue
            try:
                from icalendar import Calendar, Event
                from datetime import datetime, timedelta

                cal = Calendar()
                cal.add("prodid", "-//Genetics//UniSched//EN")
                cal.add("version", "2.0")
                cal.add("calscale", "GREGORIAN")

                # Find schedule entries for student's group
                entries_data = timetable.history_data.get("entries", [])
                for entry in entries_data:
                    if entry.get("student_group_id") == student.student_group.id:
                        try:
                            course = Course.objects.get(id=entry["course_id"])
                            room = Room.objects.get(id=entry["room_id"])

                            event = Event()
                            event.add("summary", f"{course.code}: {course.name}")
                            event.add("location", room.name)
                            event.add(
                                "description",
                                f"Group: {student.student_group.name}\nRoom Capacity: {room.capacity}",
                            )

                            # Dummy datetime (should map to actual week)
                            start_dt = datetime(2026, 2, 22, 9, 0, 0)
                            end_dt = start_dt + timedelta(hours=course.duration_hours)

                            event.add("dtstart", start_dt)
                            event.add("dtend", end_dt)

                            cal.add_component(event)

                        except (Course.DoesNotExist, Room.DoesNotExist):
                            continue

                # Return iCal file
                return Response(
                    cal.to_ical().decode("utf-8"),
                    content_type="text/calendar",
                    status=status.HTTP_200_OK,
                )

            except ImportError:
                logger.warning("icalendar library not installed")
                return Response(
                    {"error": "Calendar sync not available. Install icalendar package."},
                    status=status.HTTP_501_NOT_IMPLEMENTED,
                )

        except Student.DoesNotExist:
            return Response(
                {"error": "User is not a student."},
                status=status.HTTP_404_NOT_FOUND,
            )


# ═════════════════════════════════════════════════════════════
# LECTURER VIEWS
# ═════════════════════════════════════════════════════════════

class LecturerDashboardViewSet(viewsets.ViewSet):
    """
    Lecturer dashboard: teaching load, venues, student counts.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        GET /api/lecturer/dashboard/
        Return dashboard for authenticated lecturer.
        """
        # Get lecturer profile (stored in Lecturer model)
        lecturer_id = request.query_params.get("lecturer_id")
        if not lecturer_id:
            return Response(
                {"error": "lecturer_id query param required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lecturer = Lecturer.objects.get(id=lecturer_id)
        except Lecturer.DoesNotExist:
            return Response(
                {"error": "Lecturer not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get active timetable
        workspace = lecturer.workspace
        timetable = TimetableVersion.objects.filter(
            workspace=workspace,
            is_active=True,
        ).first()

        if not timetable:
            return Response(
                {"error": "No active timetable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Try to load cached snapshot
        snapshot = LecturerScheduleSnapshot.objects.filter(
            timetable_version=timetable,
            lecturer=lecturer,
        ).first()

        if snapshot:
            sessions = _build_lecturer_sessions(lecturer, timetable)
            dashboard_data = {
                "lecturer_id": str(lecturer.id),
                "lecturer_name": lecturer.name,
                "total_hours": snapshot.total_hours,
                "course_count": snapshot.course_count,
                "session_count": snapshot.session_count,
                "total_student_capacity": snapshot.total_student_capacity,
                "timetable_version_id": str(timetable.id),
                "generated_at": timetable.created_at,
                "sessions": sessions,
                "venues": snapshot.assigned_venues,
            }
        else:
            # Compute on-the-fly
            sessions = _build_lecturer_sessions(lecturer, timetable)
            total_hours = sum(s.get("duration_hours", 0) for s in sessions)
            courses = set(s.get("course_code") for s in sessions)
            total_capacity = sum(s.get("student_count", 0) for s in sessions)

            dashboard_data = {
                "lecturer_id": str(lecturer.id),
                "lecturer_name": lecturer.name,
                "total_hours": total_hours,
                "course_count": len(courses),
                "session_count": len(sessions),
                "total_student_capacity": total_capacity,
                "timetable_version_id": str(timetable.id),
                "generated_at": timetable.created_at,
                "sessions": sessions,
                "venues": {},
            }

        serializer = LecturerDashboardSerializer(dashboard_data)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def report_conflict(self, request):
        """
        POST /api/lecturer/dashboard/report_conflict/
        Submit a conflict report.
        """
        serializer = ReportedConflictSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conflict = ReportedConflict.objects.create(
            reported_by=request.user,
            **serializer.validated_data,
        )

        logger.info(
            "[Lecturer] Conflict reported",
            extra={
                "conflict_id": str(conflict.id),
                "type": conflict.conflict_type,
                "reporter": request.user.username,
            },
        )

        return Response(
            ReportedConflictSerializer(conflict).data,
            status=status.HTTP_201_CREATED,
        )


def _build_lecturer_sessions(lecturer, timetable):
    """Helper: extract lecturer's sessions from timetable."""
    entries = timetable.history_data.get("entries", [])
    sessions = []

    for i, entry in enumerate(entries):
        if entry.get("lecturer_id") != lecturer.id:
            continue

        try:
            course = Course.objects.get(id=entry["course_id"])
            room = Room.objects.get(id=entry["room_id"])
            group = StudentGroup.objects.get(id=entry.get("student_group_id"))

            timeslot_id = entry["timeslot_id"]
            day = (timeslot_id - 1) // 8
            period = (timeslot_id - 1) % 8 + 1
            start_hour = 7 + period
            end_hour = start_hour + course.duration_hours

            sessions.append({
                "course_code": course.code,
                "course_name": course.name,
                "group_name": group.name,
                "student_count": group.size,
                "room_name": room.name,
                "room_capacity": room.capacity,
                "timeslot_id": timeslot_id,
                "day": day,
                "period": period,
                "start_time": time(start_hour, 0),
                "end_time": time(end_hour, 0),
                "duration_hours": course.duration_hours,
            })

        except (Course.DoesNotExist, Room.DoesNotExist, StudentGroup.DoesNotExist):
            continue

    return sessions


# ═════════════════════════════════════════════════════════════
# ADMIN VIEWS
# ═════════════════════════════════════════════════════════════

class MasterPulseViewSet(viewsets.ViewSet):
    """
    Admin "Master Pulse": high-level grid of all rooms/departments.
    Shows utilization, peak hours, underutilized rooms.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        GET /api/admin/master-pulse/
        High-level overview of all scheduling.
        """
        # Admin-only
        if not hasattr(request.user, "profile") or not request.user.profile.is_admin:
            return Response(
                {"error": "Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get workspace
        workspace_id = request.query_params.get("workspace_id")
        try:
            workspace = Workspace.objects.get(id=workspace_id, owner=request.user)
        except Workspace.DoesNotExist:
            return Response(
                {"error": "Workspace not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get active timetable
        timetable = TimetableVersion.objects.filter(
            workspace=workspace,
            is_active=True,
        ).first()

        if not timetable:
            return Response(
                {"error": "No active timetable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Compute master pulse
        rooms = Room.objects.filter(workspace=workspace)
        departments = Department.objects.filter(workspace=workspace).count()

        # Get utilization records
        utilizations = RoomUtilization.objects.filter(
            timetable_version=timetable
        ).select_related("room")

        util_by_room = {r.room_id: r for r in utilizations}
        underutilized = [
            r.room_id for r in utilizations if r.is_underutilized
        ]

        # Build room breakdown
        rooms_data = []
        for room in rooms:
            util = util_by_room.get(room.id)
            util_percent = util.utilization_percentage if util else 0.0

            sessions = _build_room_sessions(room, timetable)

            rooms_data.append({
                "room_id": str(room.id),
                "room_name": room.name,
                "building": room.building,
                "capacity": room.capacity,
                "department": "N/A",  # Extend Room model if needed
                "utilization_percent": util_percent,
                "is_underutilized": util_percent < 30.0,
                "sessions": sessions,
            })

        # Find peak hours
        peak_hours = _compute_peak_hours(timetable)

        pulse_data = {
            "timetable_version_id": str(timetable.id),
            "generated_at": timetable.created_at,
            "total_rooms": rooms.count(),
            "total_departments": departments,
            "peak_hours": peak_hours[:5],  # Top 5 busiest
            "underutilized_rooms": [str(r) for r in underutilized],
            "avg_room_utilization": sum(
                u.utilization_percentage for u in utilizations
            ) / len(utilizations) if utilizations else 0.0,
            "rooms_breakdown": rooms_data,
        }

        serializer = MasterPulseSerializer(pulse_data)
        return Response(serializer.data)


def _build_room_sessions(room, timetable):
    """Helper: extract all sessions in a room."""
    entries = timetable.history_data.get("entries", [])
    sessions = []

    for entry in entries:
        if entry.get("room_id") != room.id:
            continue

        try:
            course = Course.objects.get(id=entry["course_id"])
            lecturer = Lecturer.objects.get(id=entry.get("lecturer_id"))
            group = StudentGroup.objects.get(id=entry.get("student_group_id"))

            sessions.append({
                "course": course.code,
                "lecturer": lecturer.name,
                "group": group.name,
                "students": group.size,
                "timeslot": entry["timeslot_id"],
            })

        except (Course.DoesNotExist, Lecturer.DoesNotExist, StudentGroup.DoesNotExist):
            continue

    return sessions


def _compute_peak_hours(timetable):
    """Helper: find timeslots with most sessions."""
    entries = timetable.history_data.get("entries", [])
    timeslot_counts = {}

    for entry in entries:
        ts = entry.get("timeslot_id")
        timeslot_counts[ts] = timeslot_counts.get(ts, 0) + 1

    # Return sorted by count (descending)
    return sorted(timeslot_counts.keys(), key=lambda x: timeslot_counts[x], reverse=True)

# ═════════════════════════════════════════════════════════════
# SIMPLE API VIEW ENDPOINTS (Fixed routing)
# ═════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def student_schedule_view(request):
    """GET /api/student/schedule/ - Return authenticated student's weekly schedule (or Admin preview)."""
    user = request.user
    if user.is_anonymous:
        from scheduling.views import get_or_create_demo_user
        user = get_or_create_demo_user()

    student = None
    workspace = None
    student_group = None
    
    try:
        student = user.student_profile
        workspace = student.workspace
        student_group = student.student_group
    except Student.DoesNotExist:
        # Fallback for Admin preview
        if hasattr(user, "profile") and user.profile.is_admin:
            workspace_id = request.GET.get('workspace_id')
            if workspace_id:
                workspace = user.workspaces.filter(id=workspace_id).first()
            
            if not workspace:
                workspace = user.workspaces.first()
                
            if not workspace:
                return Response({"error": "Admin has no workspace."}, status=status.HTTP_404_NOT_FOUND)
            # Pick first group to preview
            from scheduling.models import StudentGroup
            student_group = StudentGroup.objects.filter(workspace=workspace).first()
        else:
            return Response(
                {"error": "User is not registered as a student and is not an admin."},
                status=status.HTTP_404_NOT_FOUND,
            )

    # Get active timetable version for the workspace
    timetable = TimetableVersion.objects.filter(
        workspace=workspace,
        is_active=True,
    ).first()

    if not timetable:
        return Response(
            {"error": "No active timetable in workspace."},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Extract entries for student's group
    entries_data = timetable.history_data.get("entries", [])

    filtered_entries = []
    heatmap = {}
    total_hours = 0

    for i, entry in enumerate(entries_data):
        # Admin Preview (student is None) shows all entries; Student view filters by group
        if student and entry.get("student_group_id") != (student_group.id if student_group else None):
            continue

        try:
            course = Course.objects.get(id=entry["course_id"])
            room = Room.objects.get(id=entry["room_id"])
            
            lecturer_id = entry.get("lecturer_id")
            lecturer = Lecturer.objects.filter(id=lecturer_id).first() if lecturer_id else None

            timeslot_id = entry["timeslot_id"]
            heatmap[str(timeslot_id)] = 1.0

            day = (timeslot_id - 1) // 8
            period = (timeslot_id - 1) % 8 + 1
            start_hour = 7 + period
            end_hour_raw = start_hour + course.duration_hours
            
            start_time_str = time(min(start_hour, 23), 0).isoformat()
            end_time_str = "23:59:00" if end_hour_raw >= 24 else time(end_hour_raw, 0).isoformat()

            filtered_entries.append({
                "id": i,
                "course_code": course.code,
                "course_name": course.name,
                "lecturer_name": lecturer.name if lecturer else "Unassigned",
                "room_name": room.name,
                "room_capacity": room.capacity,
                "timeslot_id": timeslot_id,
                "day": day,
                "period": period,
                "start_time": start_time_str,
                "end_time": end_time_str,
                "duration_hours": course.duration_hours,
            })

            total_hours += course.duration_hours

        except (Course.DoesNotExist, Room.DoesNotExist):
            logger.warning(f"Missing resource for entry {entry}")
            continue

    for timeslot_id in range(1, 41):
        if str(timeslot_id) not in heatmap:
            heatmap[str(timeslot_id)] = 0.0

    schedule_data = {
        "student_id": str(student.id) if student else "admin-preview",
        "student_name": getattr(student, 'full_name', f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip() if student else "Admin Preview Mode"),
        "group_name": student_group.name if student_group else "N/A",
        "timetable_version_id": str(timetable.id),
        "generated_at": timetable.created_at.isoformat() if hasattr(timetable.created_at, 'isoformat') else str(timetable.created_at),
        "fitness_score": timetable.fitness,
        "entries": filtered_entries,
        "total_hours": total_hours,
        "class_count": len(filtered_entries),
        "heatmap": heatmap,
    }

    serializer = StudentWeeklyScheduleSerializer(schedule_data)
    return Response(serializer.data)


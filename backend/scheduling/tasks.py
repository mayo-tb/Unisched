"""
Genetics Cloud — Django-Q2 Background Tasks
===========================================
Replaces Celery with Django-Q2 for running the GA optimization.
Updates the database-backed TaskTracker for frontend polling.
"""

import logging
import time

logger = logging.getLogger(__name__)


def run_ga_task(tracker_id: str, workspace_id: str, config_override: dict | None = None):
    """
    Django-Q2 task that runs the GA engine for a given workspace.

    Updates the passed `TaskTracker` ID with progress every few generations.
    Stores the final result as a TimetableVersion and marks the tracker as COMPLETED.

    Parameters
    ----------
    tracker_id : str (UUID)
        The TaskTracker ID to update.
    workspace_id : str (UUID)
        The workspace to schedule.
    config_override : dict, optional
        Override GA hyperparameters (population_size, generations, etc.)
    """
    # FIX: django.setup() should NOT be called here when using Django-Q2's
    # ORM broker — Django is already fully initialized when qcluster starts.
    # Calling it again causes AppRegistryNotReady errors in some Django versions.
    # It was only needed for Celery workers.

    from scheduling.models import (
        Workspace, Lecturer, StudentGroup, Room, Course,
        ConstraintConfig, TimetableVersion, TaskTracker,
    )
    from scheduling.services.ga_engine import (
        LecturerData, StudentGroupData, RoomData, CourseData,
        TimeslotData, ConstraintData, GAConfig, run_evolution,
    )

    # ── 0. Fetch Tracker & Mark Running ─────────────────────
    # FIX: Expanded error handling — if tracker is missing, log and exit cleanly
    logger.info(
        "[GA Task] Starting GA optimization",
        extra={
            "tracker_id": str(tracker_id),
            "workspace_id": str(workspace_id),
            "config_override": config_override,
        },
    )
    try:
        tracker = TaskTracker.objects.get(id=tracker_id)
        tracker.status = "RUNNING"
        tracker.progress = 0
        tracker.save(update_fields=["status", "progress", "updated_at"])
    except TaskTracker.DoesNotExist:
        logger.error(f"[GA Task] TaskTracker {tracker_id} not found. Aborting.")
        return
    except Exception as e:
        logger.error(f"[GA Task] Failed to mark tracker as RUNNING: {e}")
        return

    try:
        # ── 1. Load workspace ───────────────────────────────────
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            raise ValueError(f"Workspace {workspace_id} not found")

        # FIX: Use select_related to avoid N+1 queries when accessing
        # course.lecturer and course.student_group during serialization.
        lecturers = [
            LecturerData(
                id=l.id, name=l.name,
                department=l.department, preferences=l.preferences or {},
            )
            for l in Lecturer.objects.filter(workspace=workspace)
        ]

        groups = [
            StudentGroupData(id=g.id, name=g.name, size=g.size)
            for g in StudentGroup.objects.filter(workspace=workspace)
        ]

        rooms = [
            RoomData(
                id=r.id, name=r.name,
                capacity=r.capacity, building=r.building,
            )
            for r in Room.objects.filter(workspace=workspace)
        ]

        # FIX: Added select_related to avoid N+1 when accessing lecturer/group fields
        courses = [
            CourseData(
                id=c.id, name=c.name, code=c.code,
                duration_hours=c.duration_hours,
                lecturer_id=c.lecturer_id,
                student_group_id=c.student_group_id,
            )
            for c in Course.objects.select_related("lecturer", "student_group").filter(workspace=workspace)
        ]

        constraints = [
            ConstraintData(
                name=c.name, type=c.type,
                logic_type=c.logic_type,
                weight=c.weight, enabled=c.enabled,
            )
            for c in ConstraintConfig.objects.filter(workspace=workspace)
        ]

        # Generate timeslots (5 days × 8 periods)
        timeslots = []
        slot_id = 1
        for day in range(5):
            for period in range(1, 9):
                timeslots.append(TimeslotData(
                    id=slot_id, day=day, period=period,
                    start_time=f"{7 + period}:00",
                    end_time=f"{8 + period}:00",
                ))
                slot_id += 1

        # ── 3. Validate minimums ────────────────────────────────
        if not courses:
            raise ValueError("No courses in workspace — nothing to schedule.")
        if not rooms:
            raise ValueError("No rooms in workspace — cannot assign venues.")
        if not lecturers:
            raise ValueError("No lecturers in workspace — cannot assign teaching staff.")

        # ── 4. Build GA config ──────────────────────────────────
        ga_cfg = GAConfig()
        if config_override:
            for key, val in config_override.items():
                if hasattr(ga_cfg, key):
                    setattr(ga_cfg, key, val)

        # ── 5. Run evolution with cache-backed progress ─────────
        total_gens = ga_cfg.generations

        # Progress is written to Django's DatabaseCache on each step.
        # This avoids costly TaskTracker DB writes every 2 seconds.
        # The task_status view reads from cache first; DB is only hit on miss.
        _last_save_time = [time.monotonic()]
        MIN_SAVE_INTERVAL_SEC = 2.0

        def report_progress(gen: int, fitness: float):
            step = max(10, int(total_gens * 0.05))
            now  = time.monotonic()
            is_last      = gen == total_gens - 1
            time_elapsed = (now - _last_save_time[0]) >= MIN_SAVE_INTERVAL_SEC

            if (gen % step == 0 and time_elapsed) or is_last:
                from django.core.cache import cache
                pct = int((gen + 1) / total_gens * 100)
                cache.set(
                    f"unisched:ga:progress:{tracker_id}",
                    {
                        "state":      "RUNNING",
                        "task_id":    str(tracker_id),
                        "progress":   pct,
                        "generation": gen,
                        "fitness":    round(fitness, 4),
                    },
                    timeout=120,   # Expire after 2 min if qcluster dies
                )
                _last_save_time[0] = now

        result = run_evolution(
            courses=courses, rooms=rooms, timeslots=timeslots,
            lecturers=lecturers, groups=groups, constraints=constraints,
            config=ga_cfg, on_progress=report_progress,
        )

        # ── 6. Store result as TimetableVersion (ATOMIC) ─────────────────
        # Use atomic transaction to prevent race condition where
        # two GA runs could both create active versions simultaneously
        from django.db import transaction
        with transaction.atomic():
            # Deactivate previous active versions
            TimetableVersion.objects.filter(
                workspace=workspace, is_active=True,
            ).update(is_active=False)

            version = TimetableVersion.objects.create(
                workspace=workspace,
                fitness=result.fitness,
                execution_time=result.execution_time_ms,
                hard_violations=result.hard_violations,
                soft_violations=result.soft_violations,
                is_active=True,
                generations_run=result.generations_run,
                history_data={
                    "entries": [
                        {
                            "course_id": e.course_id,
                            "lecturer_id": e.lecturer_id,
                            "student_group_id": e.student_group_id,
                            "room_id": e.room_id,
                            "timeslot_id": e.timeslot_id,
                        }
                        for e in result.best_timetable
                    ],
                    "fitness_trend": result.fitness_trend,
                    "ga_config": {
                        "population_size": ga_cfg.population_size,
                        "generations": ga_cfg.generations,
                        "mutation_rate_min": ga_cfg.mutation_rate_min,
                        "mutation_rate_max": ga_cfg.mutation_rate_max,
                    },
                    "constraint_violations": {
                        "hard": result.hard_violations,
                        "soft": result.soft_violations,
                    },
                },
            )

            # ── 7. Mark Tracker as Completed ────────────────────────
            tracker.status = "COMPLETED"
            tracker.progress = 100
            tracker.result = {
                "version_id": str(version.id),
                "fitness": result.fitness,
                "hard_violations": result.hard_violations,
                "soft_violations": result.soft_violations,
                "execution_time_ms": result.execution_time_ms,
            }
            tracker.save(update_fields=["status", "progress", "result", "updated_at"])
            
            # Clear the cache so frontend immediately reads the COMPLETED status from DB
            from django.core.cache import cache
            cache.delete(f"unisched:ga:progress:{tracker_id}")
        
        logger.info(f"[GA Task] Completed. Version {version.id}, fitness={result.fitness:.4f}")

    except Exception as e:
        # Capture failure in tracker
        logger.error(f"[GA Task] Failed: {e}", exc_info=True)
        tracker.status = "FAILED"
        tracker.error_message = str(e)
        tracker.save(update_fields=["status", "error_message", "updated_at"])
        
        # Clear cache on failure too
        from django.core.cache import cache
        cache.delete(f"unisched:ga:progress:{tracker_id}")
        # Do NOT re-raise here. Re-raising causes Django-Q2 to retry the task,
        # which is harmful for a stateful GA run. The failure is already stored in
        # the TaskTracker for the frontend to display.

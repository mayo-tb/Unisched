"""
Genetics Cloud — Partial Conflict Check Utility
================================================
Pure function that validates a **single proposed timetable entry** against
an existing timetable without running the full GA. Used by the drag-and-drop
override endpoint so the frontend gets instant conflict feedback.

No Django ORM imports — operates entirely on plain dicts/lists so it
can be used in tests or called from non-ORM contexts.
"""

from __future__ import annotations
from typing import Any


def check_partial_conflicts(
    proposed: dict[str, Any],
    existing_entries: list[dict[str, Any]],
    room_map: dict[int, dict] | None = None,
    group_map: dict[int, dict] | None = None,
) -> list[str]:
    """
    Check a single proposed entry against an existing timetable.

    Parameters
    ----------
    proposed : dict
        The proposed entry with keys:
        ``room_id``, ``timeslot_id``, ``lecturer_id``,
        ``student_group_id``, ``course_id``.
        Any key may be None — conflicts for that resource are skipped.

    existing_entries : list[dict]
        Current timetable entries (same dict shape as ``proposed``).
        The proposed entry must NOT already be in this list — pass the
        *original* list before the proposed mutation is applied.

    room_map : dict[room_id -> {"capacity": int, "name": str}], optional
        Used for capacity overflow checks. Skipped if None or room not found.

    group_map : dict[group_id -> {"size": int, "name": str}], optional
        Used for capacity overflow checks. Skipped if None or group not found.

    Returns
    -------
    list[str]
        Human-readable conflict descriptions.
        Empty list means no conflicts detected.
    """
    conflicts: list[str] = []

    p_room      = proposed.get("room_id")
    p_slot      = proposed.get("timeslot_id")
    p_lecturer  = proposed.get("lecturer_id")
    p_group     = proposed.get("student_group_id")

    for entry in existing_entries:
        e_slot = entry.get("timeslot_id")

        # Skip entries at a different timeslot — no possibility of overlap
        if e_slot != p_slot:
            continue

        # ── Hard: Room double-booking ─────────────────────────
        if p_room is not None and entry.get("room_id") == p_room:
            conflicts.append(
                f"Room conflict: another class is already assigned to "
                f"room #{p_room} at timeslot #{p_slot}."
            )

        # ── Hard: Lecturer double-booking ─────────────────────
        if (
            p_lecturer is not None
            and entry.get("lecturer_id") == p_lecturer
        ):
            conflicts.append(
                f"Lecturer conflict: lecturer #{p_lecturer} is already "
                f"teaching at timeslot #{p_slot}."
            )

        # ── Hard: Student group double-booking ────────────────
        if (
            p_group is not None
            and entry.get("student_group_id") == p_group
        ):
            conflicts.append(
                f"Group conflict: student group #{p_group} already has "
                f"a class at timeslot #{p_slot}."
            )

    # ── Soft: Capacity overflow ────────────────────────────────
    if room_map and group_map and p_room is not None and p_group is not None:
        room_info  = room_map.get(p_room)
        group_info = group_map.get(p_group)
        if room_info and group_info:
            capacity   = room_info.get("capacity", 0)
            group_size = group_info.get("size", 0)
            if group_size > capacity:
                overflow = group_size - capacity
                conflicts.append(
                    f"Capacity overflow: group #{p_group} has {group_size} students "
                    f"but room #{p_room} only fits {capacity} "
                    f"(overflow: {overflow})."
                )

    return conflicts

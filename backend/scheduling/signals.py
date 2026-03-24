"""
Genetics Cloud — Django Signals
================================
1. UserProfile post_save  →  syncs role to Django Group (Admins / Faculty).
2. TimetableVersion post_save  →  sends FCM push when a version is published.
"""

import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth.models import Group

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# 1. Sync UserProfile.role → Django Groups
# ─────────────────────────────────────────────────────────────

@receiver(post_save, sender="scheduling.UserProfile")
def sync_role_to_group(sender, instance, created, **kwargs):
    """
    Keep the user's Django Groups membership in sync with their profile role.

    Mapping:
      - role='ADMIN'    → Group 'Admins'
      - role='LECTURER' → Group 'Faculty'

    Groups are created on first use (get_or_create) so no fixture is needed.
    """
    user = instance.user
    role = instance.role  # Now a real model field

    # Map role strings to group names
    role_to_group = {
        "ADMIN":    "Admins",
        "LECTURER": "Faculty",
        "OFFICER":  "Officers",
    }
    target_group_name = role_to_group.get(role)

    if target_group_name is None:
        logger.warning("[Signal] Unknown role '%s' for user %s — not syncing groups.", role, user.username)
        return

    # Ensure all known groups exist
    for group_name in role_to_group.values():
        Group.objects.get_or_create(name=group_name)

    # Remove from all managed groups, then add to the correct one
    managed_groups = Group.objects.filter(name__in=role_to_group.values())
    user.groups.remove(*managed_groups)

    target_group = Group.objects.get(name=target_group_name)
    user.groups.add(target_group)

    logger.debug(
        "[Signal] User '%s' synced to group '%s'.",
        user.username,
        target_group_name,
    )


# ─────────────────────────────────────────────────────────────
# 2. FCM Push on TimetableVersion published
# ─────────────────────────────────────────────────────────────

@receiver(post_save, sender="scheduling.TimetableVersion")
def notify_timetable_published(sender, instance, created, **kwargs):
    """
    When a TimetableVersion becomes active (is_active=True), enqueue an
    async FCM push notification via Django-Q2 so the web request is not
    blocked.

    The FCM task gracefully no-ops if FCM_SERVICE_ACCOUNT_FILE is unset.
    """
    if not instance.is_active:
        return

    try:
        from django_q.tasks import async_task
        from scheduling.services.fcm import send_timetable_published_notification

        async_task(
            send_timetable_published_notification,
            workspace_id=str(instance.workspace_id),
            workspace_name=instance.workspace.name,
            version_id=instance.id,
            task_name=f"FCM-publish-{instance.id}",
        )
        logger.info(
            "[Signal] FCM push queued for TimetableVersion %s (workspace: %s).",
            instance.id,
            instance.workspace_id,
        )
    except Exception as exc:
        # Never crash the save — FCM is best-effort
        logger.exception("[Signal] Could not queue FCM push: %s", exc)


# ─────────────────────────────────────────────────────────────
# 3. Audit Log — record resource changes
# ─────────────────────────────────────────────────────────────

def _write_audit(action: str, workspace=None):
    """Write a system-level audit log entry (no actor = system action)."""
    try:
        from .models import AuditLog
        AuditLog.objects.create(action=action, workspace=workspace)
    except Exception as exc:
        logger.warning("[Signal] Could not write audit log: %s", exc)


@receiver(post_save, sender="scheduling.Room")
def audit_room_save(sender, instance, created, **kwargs):
    verb = "Created" if created else "Updated"
    _write_audit(f"{verb} Room: {instance.name} ({instance.building})", workspace=instance.workspace)


@receiver(post_delete, sender="scheduling.Room")
def audit_room_delete(sender, instance, **kwargs):
    _write_audit(f"Deleted Room: {instance.name}", workspace=instance.workspace)


@receiver(post_save, sender="scheduling.Lecturer")
def audit_lecturer_save(sender, instance, created, **kwargs):
    verb = "Created" if created else "Updated"
    _write_audit(f"{verb} Lecturer: {instance.name}", workspace=instance.workspace)


@receiver(post_delete, sender="scheduling.Lecturer")
def audit_lecturer_delete(sender, instance, **kwargs):
    _write_audit(f"Deleted Lecturer: {instance.name}", workspace=instance.workspace)


@receiver(post_save, sender="scheduling.Course")
def audit_course_save(sender, instance, created, **kwargs):
    verb = "Created" if created else "Updated"
    _write_audit(f"{verb} Course: {instance.code} - {instance.name}", workspace=instance.workspace)


@receiver(post_delete, sender="scheduling.Course")
def audit_course_delete(sender, instance, **kwargs):
    _write_audit(f"Deleted Course: {instance.code} - {instance.name}", workspace=instance.workspace)


@receiver(post_save, sender="scheduling.TimetableVersion")
def audit_timetable_version(sender, instance, created, **kwargs):
    if created:
        _write_audit(
            f"Timetable version generated (fitness: {instance.fitness:.4f})",
            workspace=instance.workspace,
        )

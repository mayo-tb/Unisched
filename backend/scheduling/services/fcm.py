"""
Genetics Cloud — Firebase Cloud Messaging (FCM) Notification Service
=====================================================================
Sends a push notification when a timetable version is published.

Usage
-----
Set the env var ``FCM_SERVICE_ACCOUNT_FILE`` to the path of your Firebase
service account JSON. If the env var is not set the function no-ops gracefully
so the rest of the application works without a Firebase project.

The FCM topic per workspace is: ``workspace_<workspace_id>``.
Mobile clients should subscribe to their workspace topic on login.
"""

from __future__ import annotations

import logging
import os
import threading

logger = logging.getLogger(__name__)

# Thread-safe Firebase initialization
_firebase_lock = threading.Lock()
_firebase_initialized = False


def send_timetable_published_notification(
    workspace_id: str,
    workspace_name: str,
    version_id: str | int,
) -> None:
    """
    Send an FCM push to all devices subscribed to this workspace topic.

    Parameters
    ----------
    workspace_id : str
        UUID of the workspace — used to construct the FCM topic name.
    workspace_name : str
        Human-readable name for the notification body.
    version_id : str | int
        The new TimetableVersion ID to include in the notification data payload.
    """
    service_account_file = os.environ.get("FCM_SERVICE_ACCOUNT_FILE", "").strip()

    if not service_account_file:
        logger.debug(
            "[FCM] FCM_SERVICE_ACCOUNT_FILE not set — skipping push notification."
        )
        return

    if not os.path.isfile(service_account_file):
        logger.warning(
            "[FCM] Service account file '%s' not found — skipping push.",
            service_account_file,
        )
        return

    try:
        import firebase_admin
        from firebase_admin import credentials, messaging

        # Thread-safe: only one thread should initialize Firebase
        global _firebase_initialized
        
        with _firebase_lock:
            if not _firebase_initialized and not firebase_admin._apps:
                cred = credentials.Certificate(service_account_file)
                firebase_admin.initialize_app(cred)
                _firebase_initialized = True

        topic = f"workspace_{workspace_id}"

        message = messaging.Message(
            notification=messaging.Notification(
                title="Timetable Published",
                body=f"A new schedule for '{workspace_name}' is now available.",
            ),
            data={
                "version_id": str(version_id),
                "workspace_id": str(workspace_id),
                "type": "timetable_published",
            },
            topic=topic,
        )

        response = messaging.send(message)
        logger.info(
            "[FCM] Notification sent to topic '%s'. Message ID: %s",
            topic,
            response,
        )

    except ImportError:
        logger.error("[FCM] firebase-admin is not installed. Run: pip install firebase-admin")
    except Exception as exc:
        # Never let FCM failure crash the save pipeline
        logger.exception("[FCM] Failed to send notification: %s", exc)

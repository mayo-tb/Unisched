"""
Genetics Cloud — JSON Schema Validators
========================================
Validates complex JSON fields against defined schemas.
"""

from jsonschema import validate, ValidationError
from django.core.exceptions import ValidationError as DjangoValidationError


# ── Lecturer Preferences Schema ─────────────────────────
LECTURER_PREFERENCES_SCHEMA = {
    "type": "object",
    "properties": {
        "morning_only": {
            "type": "boolean",
            "description": "Prefer classes before 12:00",
        },
        "max_daily_hours": {
            "type": "integer",
            "minimum": 1,
            "maximum": 12,
            "description": "Maximum hours allowed per day",
        },
        "avoid_days": {
            "type": "array",
            "items": {
                "type": "integer",
                "minimum": 0,
                "maximum": 4,  # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
            },
            "description": "Days to avoid (0-4 for Mon-Fri)",
        },
        "preferred_timeslots": {
            "type": "array",
            "items": {
                "type": "integer",
                "minimum": 1,
            },
            "description": "Preferred timeslot IDs",
        },
    },
    "additionalProperties": False,  # Reject unknown keys
}


class LecturerPreferencesValidator:
    """
    Validates lecturer preference JSON against defined schema.
    Raises DjangoValidationError on invalid input.
    """

    def __call__(self, value):
        """Called by Django field validation."""
        if not value:
            return  # Allow empty dict

        try:
            validate(instance=value, schema=LECTURER_PREFERENCES_SCHEMA)
        except ValidationError as e:
            raise DjangoValidationError(
                f"Invalid lecturer preferences: {e.message}",
                code="invalid_preferences",
            )


def validate_lecturer_preferences(value):
    """Standalone function for preferences validation."""
    validator = LecturerPreferencesValidator()
    validator(value)

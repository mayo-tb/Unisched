"""
Genetics Cloud — Custom Password Validator
==========================================
Enforces complexity rules: min length, uppercase, digit, special character.
Plugs into Django's AUTH_PASSWORD_VALIDATORS system.
"""

import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class PasswordComplexityValidator:
    """
    Validates that a password meets all of the following:
      - At least 8 characters
      - At least one uppercase letter (A-Z)
      - At least one digit (0-9)
      - At least one special character (!@#$%^&*...)
    """

    SPECIAL_CHARS = r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>/?\\|`~]"

    def validate(self, password, user=None):
        errors = []

        if len(password) < 8:
            errors.append(
                ValidationError(
                    _("Password must be at least 8 characters long."),
                    code="password_too_short",
                )
            )

        if not re.search(r"[A-Z]", password):
            errors.append(
                ValidationError(
                    _("Password must contain at least one uppercase letter."),
                    code="password_no_upper",
                )
            )

        if not re.search(r"\d", password):
            errors.append(
                ValidationError(
                    _("Password must contain at least one digit (0–9)."),
                    code="password_no_digit",
                )
            )

        if not re.search(self.SPECIAL_CHARS, password):
            errors.append(
                ValidationError(
                    _("Password must contain at least one special character (e.g. !@#$%)."),
                    code="password_no_special",
                )
            )

        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        return _(
            "Your password must be at least 8 characters long and contain "
            "an uppercase letter, a digit, and a special character."
        )

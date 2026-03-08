"""
Django settings for UniSched project.
"""
import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-change-me-in-production-x7k!m3p@q9"
)

DEBUG = os.environ.get("DJANGO_DEBUG", "False").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

# Render sets this automatically — add it to ALLOWED_HOSTS
RENDER_EXTERNAL_HOSTNAME = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# ──────────────────────────────────────────────
# Application definition
# ──────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",  # JWT token blacklisting on logout
    "corsheaders",
    "django_q",
    # Local
    "scheduling",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ──────────────────────────────────────────────
# CORS — Web + Mobile dev origins
# ──────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",   # Vite web
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:8081",   # Expo dev
    "http://localhost:8082",   # Expo Metro
    "http://localhost:8083",   # Expo Metro (current)
    "http://localhost:19006",  # Expo web
]

# Add extra origins from environment (comma-separated)
# e.g. CORS_EXTRA_ORIGINS=https://unisched-frontend.onrender.com
_extra = os.environ.get("CORS_EXTRA_ORIGINS", "")
if _extra:
    CORS_ALLOWED_ORIGINS += [o.strip() for o in _extra.split(",") if o.strip()]

CORS_ALLOW_CREDENTIALS = True

# Explicitly whitelist all headers the frontend sends
from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-workspace-id",  # Custom header used for workspace scoping
]


# ──────────────────────────────────────────────
# Authentication Backends (Staff ID + Username)
# ──────────────────────────────────────────────
AUTHENTICATION_BACKENDS = [
    "scheduling.backends.StaffIdOrUsernameBackend",
    "django.contrib.auth.backends.ModelBackend",  # fallback for admin site
]

# ──────────────────────────────────────────────
# Database — SQLite (for development)
# ──────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.path.join(BASE_DIR, "db.sqlite3"),
    }
}

try:
    import dj_database_url
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        DATABASES["default"] = dj_database_url.parse(db_url, conn_max_age=600)
except ImportError:
    pass

# ──────────────────────────────────────────────
# Cache — Database Cache (Cross-process safe on Windows)
# ──────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "unisched_cache_table",
        "TIMEOUT": 300,          # 5 min default TTL
        "OPTIONS": {
            "MAX_ENTRIES": 2000,
        },
    }
}

# ──────────────────────────────────────────────
# Password Validation
# ──────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    # Custom complexity validator (uppercase + digit + special char)
    {"NAME": "scheduling.validators.PasswordComplexityValidator"},
]

# ──────────────────────────────────────────────
# Email
# ──────────────────────────────────────────────
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST          = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT          = int(os.environ.get("EMAIL_PORT", 587))
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL  = os.environ.get("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "noreply@unisched.app")

# ──────────────────────────────────────────────
# Internationalization
# ──────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Lagos"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS_ALLOW_ALL_ORIGINS intentionally not set here — using explicit allowlist above

# ──────────────────────────────────────────────
# Django REST Framework
# ──────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    # ── FIX: Add rate limiting to prevent abuse ──────────────────
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "5000/hour",      # Unauthenticated users (Demo mode)
        "user": "5000/hour",     # Authenticated users
    },
}

# ──────────────────────────────────────────────
# SimpleJWT — with token rotation + blacklist
# ──────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":  timedelta(hours=6),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES":      ("Bearer",),
    # Blacklist the old refresh token whenever a new one is issued
    "ROTATE_REFRESH_TOKENS":   True,
    "BLACKLIST_AFTER_ROTATION": True,
    # Also blacklist on explicit logout (handled in LogoutView)
    "UPDATE_LAST_LOGIN": True,
}

# ──────────────────────────────────────────────
# Django-Q2 — ORM broker (PostgreSQL)
# ──────────────────────────────────────────────
Q_CLUSTER = {
    "name": "GeneticsCloud",
    "workers": 1,                  # Single worker — GA is CPU-heavy
    "timeout": 900,                # 15 min max per task
    "retry": 960,                  # Retry after 16 min if no ack
    "queue_limit": 10,
    "bulk": 5,
    "orm": "default",              # Use PostgreSQL via ORM broker
    "save_limit": 50,              # Keep last 50 completed tasks
    "catch_up": False,             # Don't run missed schedules
    "sync": os.environ.get("DJANGO_Q_SYNC", "False").lower() in ("true", "1"),
}

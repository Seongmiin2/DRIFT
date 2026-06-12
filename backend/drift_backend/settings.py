import sys
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent  # DRIFT/

# ── contracts / engine / risk importable in local dev
# In Docker these are volume-mounted under /app/ which is already in sys.path.
for _p in (
    str(REPO_ROOT),            # → import contracts, import engine, import risk
    str(BASE_DIR),
    str(REPO_ROOT / "risk"),   # → import drift_risk  (engine_interface 호환)
):
    if _p not in sys.path:
        sys.path.insert(0, _p)

env = environ.Env(
    DEBUG=(bool, False),
    DRIFT_ENGINE=(str, "mock"),
    DATABASE_URL=(str, f"sqlite:///{BASE_DIR}/drift.db"),
    DATA_GO_KR_API_KEY=(str, ""),
)

import os as _os
# engine/data_fetcher가 os.environ에서 직접 읽으므로 여기서 전달
if (_key := env("DATA_GO_KR_API_KEY", default="")):
    _os.environ.setdefault("DATA_GO_KR_API_KEY", _key)

environ.Env.read_env(BASE_DIR.parent / ".env", overwrite=False)

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-only-insecure-key-change-before-production")
DEBUG = env("DEBUG")
ALLOWED_HOSTS: list[str] = env.list("DJANGO_ALLOWED_HOSTS", default=["*"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "apps.sar",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "drift_backend.urls"

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

WSGI_APPLICATION = "drift_backend.wsgi.application"
ASGI_APPLICATION = "drift_backend.asgi.application"

DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR}/drift.db")
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

# ── REST Framework
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "1000/hour",
    },
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "EXCEPTION_HANDLER": "apps.sar.views.custom_exception_handler",
}

# ── CORS
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS: list[str] = env.list(
        "CORS_ALLOWED_ORIGINS",
        default=["http://localhost:5173", "http://localhost:3000"],
    )

# ── DRIFT engine selector
DRIFT_ENGINE: str = env("DRIFT_ENGINE", default="mock")

# ── Localisation
LANGUAGE_CODE = "ko-kr"
TIME_ZONE = "Asia/Seoul"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

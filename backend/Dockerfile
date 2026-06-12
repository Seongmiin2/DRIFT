FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

RUN pip install uv

WORKDIR /app

# pyproject.toml references "../contracts", so copy to /contracts (one level above /app)
COPY contracts/ /contracts/
COPY backend/pyproject.toml backend/uv.lock* ./

# Install venv to /opt/.venv so volume mounts on /app don't overwrite it
ENV UV_PROJECT_ENVIRONMENT=/opt/.venv
RUN uv sync --no-dev

COPY backend/ .

ENV PATH="/opt/.venv/bin:$PATH"
EXPOSE 8000

CMD ["gunicorn", "drift_backend.wsgi:application", \
     "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60"]

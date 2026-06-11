FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

RUN pip install uv

WORKDIR /app

# Copy contracts first so uv can resolve the path dependency
COPY contracts/ contracts/
COPY backend/pyproject.toml backend/uv.lock* ./

RUN uv sync --no-dev

COPY backend/ .

EXPOSE 8000

CMD ["uv", "run", "gunicorn", "drift_backend.wsgi:application", \
     "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60"]

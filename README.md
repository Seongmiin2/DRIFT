# DRIFT

DRIFT is an AI-powered maritime search-and-rescue decision support system that predicts probable search areas for missing persons 
or vessels using ocean-current simulation, drift physics, and machine learning.
The system combines deterministic physics, OpenDrift particle simulation, 
and a LightGBM correction model to support faster and more efficient maritime rescue operations.

> The L3 model is trained on synthetic demo data. It demonstrates the model
> pipeline and must not be presented as validated real-world SAR accuracy.

## Features

- Physics-based maritime drift prediction
- OpenDrift particle simulation
- AI-based LightGBM residual correction
- Interactive search-area visualization
- Historical replay using bundled marine datasets
- Optional GMS OpenAI-compatible incident assistant

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Leaflet

### Backend
- Django
- Django REST Framework
- PostgreSQL
- Redis

### AI & Simulation
- OpenDrift
- LightGBM
- Scikit-learn

### Data
- CMEMS
- KHOA
- Git LFS

### Infrastructure
- Docker
- Docker Compose

## System Architecture

```text
Frontend (React)
        │
        ▼
Backend (Django REST API)
        │
        ▼
Historical / Live Data Provider
        │
        ▼
L1 Drift Physics
        │
        ▼
L2 OpenDrift Simulation
        │
        ▼
Land Mask Filtering
        │
        ▼
L3 LightGBM Correction
        │
        ▼
Search Area Visualization
```

## Repository Layout

```text
backend/    Django REST API and marine-data integrations
contracts/  Shared Pydantic models, JSON schemas, and OpenAPI document
data/       Git LFS historical CMEMS/KHOA demo bundle
engine/     L1 physics, L2 OpenDrift, and L3 correction model
frontend/   React, TypeScript, Vite, Leaflet, and nginx
docs/       Model and architecture documentation
scripts/    Utility scripts
```

## Data Sources

Historical and environmental datasets used for drift simulation, search-area prediction, and AI-based correction.

| Dataset | Purpose |
|----------|---------|
| CMEMS | Ocean current data |
| KHOA | Marine environmental data |
| Leeway Catalog | Object-specific drift coefficients |
| Land Mask | Coastline filtering |
| Synthetic Dataset | Training the LightGBM residual correction model |

## Data Pipeline

```text
CMEMS / KHOA / Leeway / Land Mask
                │
                ▼
        Data Collection
                │
                ▼
       Data Preprocessing
                │
                ▼
 Historical Data Provider
                │
                ▼
        L1 Drift Physics
                │
                ▼
   L2 OpenDrift Simulation
                │
                ▼
    Land Mask Filtering
                │
                ▼
 L3 LightGBM Correction
                │
                ▼
 Search Area Prediction
                │
                ▼
 Frontend Visualization
```

## Quick Start

Requirements:

- Docker Desktop with Docker Compose
- Git LFS data downloaded with `git lfs pull`

Create the local runtime configuration:

```powershell
Copy-Item .env.example .env
```

For the bundled historical demo, keep these values:

```env
DRIFT_ENGINE=real
DRIFT_L2_ENGINE=opendrift
DRIFT_DATA_SOURCE=historical
DRIFT_DATA_ROOT=/data/modeling_inputs
DRIFT_DATA_HOST_PATH=./data/modeling_inputs
DRIFT_MODEL_PATH=/engine/artifacts/l3_correction.joblib
DRIFT_MODEL_METADATA_PATH=/engine/artifacts/model_metadata.json
```

Optional GMS assistant configuration:

```env
OPENAI_API_KEY=<GMS_KEY>
GMS_OPENAI_BASE_URL=https://gms.ssafy.io/gmsapi/api.openai.com/v1
GMS_OPENAI_MODEL=gpt-4.1
```

Start the application:

```powershell
docker compose up -d --build postgres redis backend frontend
```

- Frontend: http://localhost:5173
- API health: http://localhost:8000/api/v1/health/

The known historical demo input is longitude `126.2`, latitude `34.5`, and
`2023-09-23 12:00 KST`. Historical requests must remain within the bundled
data coverage (`2022-03-24` through `2024-03-24`).

## Verification

```powershell
docker compose -f docker-compose.test.yml run --rm test
docker compose -f docker-compose.test.yml run --rm demo-smoke
docker compose build frontend
```

Expected demo-smoke output includes:

```text
"l3_correction_applied": true
"similar_incidents_count": 2000
```

## Deployment

Production deployment uses the base Compose file plus the production override:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Replace all demo credentials before deployment. Keep `.env`, PEM files, and
other secrets out of Git. See [AGENTS.md](AGENTS.md) for the operational handoff
and [docs/model-engine-implementation-spec.md](docs/model-engine-implementation-spec.md)
for model details.

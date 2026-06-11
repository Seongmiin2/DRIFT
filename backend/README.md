# DRIFT · backend/

Django + Django REST Framework (DRF) 기반 API 서버.

## 역할

- `contracts.PredictionRequest` 를 수신하고 `engine` 패키지 태스크를 큐에 넣음
- `engine` 결과(`EnginePredictionResult`)를 DB에 저장하고 폴링 엔드포인트로 노출
- `report` 패키지를 호출해 `BriefingResult` 생성
- `risk` 패키지 호출로 `RiskForecastResult` 생성

## 브랜치

`feature/backend`

## 스택

| 레이어 | 기술 |
|--------|------|
| Framework | Django 5.x + DRF |
| DB | PostgreSQL 15 |
| 비동기 큐 | Celery + Redis |
| Lint | ruff |
| Test | pytest + pytest-django |

## 로컬 실행

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## 주의

`engine` 패키지를 직접 import **하지 않는다**.  
backend ↔ engine 간 유일한 인터페이스는 `contracts.EnginePredictionResult`.  
engine 태스크는 Celery 워커가 별도 프로세스로 실행한다.

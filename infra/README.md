# DRIFT · infra/

Docker Compose + 배포 스크립트.

## 로컬 개발 스택

```
docker-compose up
```

| 서비스 | 포트 | 설명 |
|--------|------|------|
| postgres | 5432 | PostgreSQL 15 |
| redis | 6379 | Celery 브로커 + 결과 캐시 |
| backend | 8000 | Django API |
| worker | - | Celery 워커 (engine/risk/report 실행) |
| frontend | 5173 | Vite dev server |

## 환경 변수

`.env.example` 을 `.env` 로 복사해 사용.

## 프로덕션 (placeholder)

AWS ECS Fargate 배포 스크립트 예정. `infra/aws/` 디렉토리에 추가.

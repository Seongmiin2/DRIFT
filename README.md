# DRIFT — Maritime SAR Decision Support System

> **"신호가 끊긴 그 순간부터 AI가 바다를 계산한다"**
>
> 조류·기상·과거 사고 데이터를 결합해 조난자 수색 우선구역을 10초 만에 계산,
> 1분 안에 AI 작전 브리핑을 제공하는 해양 수색 의사결정 지원 시스템 (DSS)

---

## 모노레포 구조

```
DRIFT/
  contracts/      # 데이터 계약 — 모든 모듈의 단일 진실 공급원
  backend/        # Django + DRF API 서버
  frontend/       # React + TypeScript + Vite SPA
  engine/         # 표류 엔진 패키지 (L1 물리 + L2 Monte Carlo + L3 ML)
  risk/           # P1 선제 위험 예측 패키지
  report/         # L4 LLM 작전 브리핑 + PDF
  infra/          # docker-compose, 배포 스크립트
  docs/           # 아키텍처 문서
```

## 브랜치 전략

```
main          ← 배포 가능한 상태만 merge
  └─ develop  ← 팀 통합 브랜치
       ├─ feature/backend
       ├─ feature/frontend
       ├─ feature/model      (engine)
       ├─ feature/risk
       └─ feature/report
```

- 모든 작업은 `develop` 에서 feature 브랜치를 따서 진행
- feature → develop: PR + 1인 이상 리뷰
- develop → main: 통합 테스트 통과 후 merge

## 로컬 실행 (전체 스택)

```bash
# 1. 환경 변수 설정
cp .env.example .env
# .env 편집: OPENAI_API_KEY, KHOA_API_KEY, KMA_API_KEY 등

# 2. 계약 스키마 생성
pip install pydantic jsonschema
python contracts/gen_schemas.py --check

# 3. 전체 스택 실행
docker-compose up --build
```

서비스 접속:
- API: http://localhost:8000/api/v1/
- API 문서: http://localhost:8000/api/docs/
- 프론트엔드: http://localhost:5173

## 아키텍처 (데이터 흐름)

```
operator
  │  PredictionRequest (JSON)
  ▼
backend ──── Celery queue ────▶ engine (L1+L2+L3)
  │                                    │
  │                    EnginePredictionResult
  │◀───────────────────────────────────┘
  │
  ├──── report (L4 GPT-4o) ──▶ BriefingResult
  │
  └──── risk (P1 DRI) ──────▶ RiskForecastResult
  │
  ▼
frontend (Mapbox 폴리곤 + 브리핑 4섹션)
```

**핵심 원칙**: backend 는 engine 코드를 직접 import 하지 않는다.  
`contracts.EnginePredictionResult` 가 유일한 인터페이스다.

## AI 엔진 레이어

| 레이어 | 역할 | 가중치 |
|--------|------|--------|
| L1 | IAMSAR 물리 표류 벡터 | 0.30 |
| L2 | Monte Carlo 1,000입자 | 0.50 |
| L3 | LightGBM 오차 보정 (데이터 < 30건 시 비활성) | 0.20 |
| L4 | GPT-4o 한국어 작전 브리핑 | 설명 전용 |

## 출처

본 시스템은 다음 표준·데이터를 기반으로 합니다:
- IMO IAMSAR Manual (SAR 국제 표준)
- USCG SAROPS (Monte Carlo 방법론 검증)
- 국립해양조사원 조류예보 API
- 기상청 해양기상관측 API
- 해양수산부 해양사고 통계 (5,000+ 레코드)
- Lim et al. 2023 — OpenDrift Korea Strait 검증 논문

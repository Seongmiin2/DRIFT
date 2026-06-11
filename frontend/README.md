# DRIFT · frontend/

React + TypeScript + Vite 기반 단일 페이지 애플리케이션.

## 역할

- 3개 탭: **실시간 조난 대응** / **선제 위험 예측** / **AI 작전 브리핑**
- 조난 정보 입력 폼 → `POST /api/v1/predictions`
- Mapbox GL JS (또는 Leaflet) 로 수색 폴리곤 렌더링
- 시간 슬라이더: +1h/+2h/+3h 표류 진행 미리보기
- AI 브리핑 4섹션 + PDF 다운로드

## 브랜치

`feature/frontend`

## 스택

| 레이어 | 기술 |
|--------|------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Map | Mapbox GL JS |
| State | Zustand |
| Styling | Tailwind CSS |
| Type gen | openapi-typescript (contracts/openapi.yaml → types) |

## 로컬 실행

```bash
cd frontend
npm install
npm run dev
```

## 타입 자동 생성

```bash
npx openapi-typescript ../contracts/openapi.yaml -o src/types/api.d.ts
```

API 타입을 손으로 쓰지 않는다. openapi.yaml 이 변경되면 위 명령을 재실행한다.

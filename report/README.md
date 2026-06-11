# DRIFT · report/

L4 AI 작전 브리핑 + PDF 생성 패키지.

## 역할

`contracts.EnginePredictionResult` 를 받아 GPT-4o 로 4섹션 한국어 작전 브리핑을 생성하고 `contracts.BriefingResult` 를 반환한다.

```python
from drift_report import generate_briefing

result: BriefingResult = generate_briefing(engine_result)
```

## 브랜치

`feature/report`

## 설계 원칙

1. **LLM은 계산하지 않는다** — 숫자는 모두 `EnginePredictionResult` JSON에서 가져온다
2. **없는 사실 금지** — 시스템 프롬프트에 "입력 JSON 수치만 사용" 제약 명시
3. **disclaimer 필수** — `BriefingResult.disclaimer` 에 '최종 판단은 현장 지휘관' 포함 검증
4. **few-shot 3건** — L3 유사 사고 케이스를 few-shot 예시로 제공

## 4섹션 구조

| section_id | 제목 | 출처 |
|------------|------|------|
| 1 | 현재 표류 예측 요약 | L1 + L2 |
| 2 | 과거 유사 사고 비교 | L3 |
| 3 | 1순위 수색 구역 권고 근거 | L1 + L2 + L3 종합 |
| 4 | 기상 악화 시 대체 수색 구역 | L2 + L4 분기 |

## PDF

ReportLab 또는 WeasyPrint 로 PDF 생성 후 S3 업로드.  
`BriefingResult.pdf_url` 에 서명 URL 반환.

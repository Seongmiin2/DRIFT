# DRIFT · risk/

P1 선제 위험 예측 패키지.

## 역할

`contracts.RiskForecastResult` 를 반환한다.  
`engine` 의 L3 LightGBM 모델을 격자(grid) 단위로 재활용해 **표류 위험 지수(DRI)** Heatmap을 생성한다.

```python
from drift_risk import forecast_risk

result: RiskForecastResult = forecast_risk(
    area_name="연평도 인근 서해",
    bbox=[124.1, 37.6, 124.9, 38.3],
    time_range_start=...,
    time_range_end=...,
    vessel_types=[VesselType.SMALL_FISHING],
)
```

## 브랜치

`feature/risk`

## 로직 개요

1. bbox 를 0.1° 격자로 분할
2. 각 셀에 대해 L3 모델로 DRI 스코어 계산
3. `고위험(DRI ≥ 0.65)` / `주의(0.35 ≤ DRI < 0.65)` / `관찰(DRI < 0.35)` 분류
4. GeoJSON FeatureCollection 으로 출력

## 의존

- `engine.l3_correction` 의 학습된 모델 객체만 가져옴
- `contracts` 패키지만 외부 계약으로 사용

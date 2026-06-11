# DRIFT · engine/

표류 예측 엔진 패키지 (L1 + L2 + L3).

## 역할

`contracts.PredictionRequest` 를 받아 `contracts.EnginePredictionResult` 를 반환하는 단일 함수를 공개한다.

```python
# 유일한 공개 인터페이스
from drift_engine import predict

result: EnginePredictionResult = predict(request)
```

## 브랜치

`feature/model`

## 레이어 구조

| 레이어 | 역할 | 구현 |
|--------|------|------|
| L1 | 물리 표류 벡터 (IAMSAR) | `drift_engine/l1_physics.py` |
| L2 | Monte Carlo 1,000입자 시뮬레이션 | `drift_engine/l2_monte_carlo.py` |
| L3 | LightGBM 오차 보정 | `drift_engine/l3_correction.py` |
| fusion | 가중 합산 (0.30·L1 + 0.50·L2 + 0.20·L3) | `drift_engine/fusion.py` |

## 외부 의존

- 조류 데이터: KHOA 조류예보 API (또는 CSV fallback)
- 기상 데이터: KMA 해양기상 API (또는 CSV fallback)

## 입출력

```
Input : contracts.PredictionRequest
Output: contracts.EnginePredictionResult
```

backend 코드를 import 하지 않는다. `contracts` 만 의존한다.

## Fallback 규칙

학습 데이터 < 30건이면 L3 가중치를 자동으로 0으로 설정하고 L1+L2만 사용한다.

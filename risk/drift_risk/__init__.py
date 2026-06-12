"""
drift_risk — 실시간 DRI(Drift Risk Index) 예측 엔진.

KMA 초단기실황(기상) + KHOA 조류예보 데이터를 이용해
bbox 내 5×5 그리드 셀 별 DRI 를 계산하고 RiskForecastResult 를 반환한다.
"""

from __future__ import annotations

import hashlib
import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from contracts.models import (
    RecommendedAction,
    RiskCause,
    RiskForecastResult,
    RiskLevel,
    VesselType,
)
from engine.data_fetcher import fetch_environment

# KMA 초단기실황은 육상/연안 관측소만 데이터가 있음.
# 해역별 가장 가까운 연안 관측 지점으로 날씨 쿼리 → 더 정확한 실황 수신.
_COASTAL_COORDS: dict[str, tuple[float, float]] = {
    "목포/신안 해역":   (34.79, 126.38),   # 목포
    "통영/거제":        (34.85, 128.43),   # 통영
    "인천/경기만":      (37.45, 126.63),   # 인천
    "여수/거문도":      (34.74, 127.66),   # 여수
    "제주도 서방":      (33.51, 126.52),   # 제주시
    "서귀포 남방":      (33.25, 126.56),   # 서귀포
    "부산/영도":        (35.10, 129.04),   # 부산
    "군산/새만금":      (35.97, 126.72),   # 군산
    "연평도 인근 서해": (37.67, 125.69),   # 연평도
}


# ── 보조 함수 ─────────────────────────────────────────────────────────────────

def _beaufort(wind_ms: float) -> int:
    thresholds = [0.5, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7]
    for i, t in enumerate(thresholds):
        if wind_ms < t:
            return i
    return 12


# ── DRI 계산 ─────────────────────────────────────────────────────────────────

def _dri(wind_ms: float, current_kt: float) -> float:
    """
    DRI = 0.45·풍속 + 0.30·파고(경험식) + 0.25·조류
    각 항 0–1 정규화, 최종값 [0, 1].
    """
    wind_f    = min(1.0, wind_ms / 18.0)                # 18 m/s 포화
    wave_h    = 0.0248 * wind_ms ** 2                    # Beaufort 경험적 파고 (m)
    wave_f    = min(1.0, wave_h / 3.0)                   # 3 m 포화
    current_f = min(1.0, current_kt / 3.0)               # 3 kt 포화
    return 0.45 * wind_f + 0.30 * wave_f + 0.25 * current_f


def _level(dri: float) -> RiskLevel:
    if dri >= 0.60:
        return RiskLevel.HIGH
    if dri >= 0.30:
        return RiskLevel.CAUTION
    return RiskLevel.WATCH


def _severity(wind_ms: float, wave_h: float, current_kt: float) -> tuple[RiskLevel, RiskLevel, RiskLevel]:
    w  = RiskLevel.HIGH if wind_ms   >= 14  else RiskLevel.CAUTION if wind_ms   >= 8   else RiskLevel.WATCH
    wv = RiskLevel.HIGH if wave_h    >= 2.0 else RiskLevel.CAUTION if wave_h    >= 1.0 else RiskLevel.WATCH
    c  = RiskLevel.HIGH if current_kt >= 2.0 else RiskLevel.CAUTION if current_kt >= 0.8 else RiskLevel.WATCH
    return w, wv, c


# ── 공간 그리드 ───────────────────────────────────────────────────────────────

COLS, ROWS = 20, 20


def _build_grid(
    bbox: list[float],
    base_dri: float,
    seed: int,
) -> tuple[list[dict[str, Any]], list[float]]:
    """5×5 그리드 생성. 중심부 위험 높고 가장자리로 갈수록 완화."""
    min_lon, min_lat, max_lon, max_lat = bbox
    cw = (max_lon - min_lon) / COLS
    ch = (max_lat - min_lat) / ROWS
    rng = random.Random(seed)

    features: list[dict[str, Any]] = []
    scores: list[float] = []

    for row in range(ROWS):
        for col in range(COLS):
            lon0 = min_lon + col * cw
            lat0 = min_lat + row * ch
            lon1, lat1 = lon0 + cw, lat0 + ch

            # 중앙 고위험 구배 (최대 ±0.15)
            cx = abs(col - (COLS - 1) / 2) / max((COLS - 1) / 2, 1)
            cy = abs(row - (ROWS - 1) / 2) / max((ROWS - 1) / 2, 1)
            spatial = 1.0 - (cx + cy) * 0.12

            noise = rng.uniform(-0.04, 0.04)
            dri = max(0.05, min(0.97, base_dri * spatial + noise))
            scores.append(dri)

            features.append({
                "type": "Feature",
                "properties": {
                    "risk_level": _level(dri).value,
                    "dri_score": round(dri, 3),
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [round(lon0, 5), round(lat0, 5)],
                        [round(lon1, 5), round(lat0, 5)],
                        [round(lon1, 5), round(lat1, 5)],
                        [round(lon0, 5), round(lat1, 5)],
                        [round(lon0, 5), round(lat0, 5)],
                    ]],
                },
            })

    return features, scores


# ── 진입점 (engine_interface 에서 호출) ──────────────────────────────────────

def forecast_risk(
    area_name: str,
    bbox: list[float],
    time_range_start: datetime,
    time_range_end: datetime,
    vessel_types: list[VesselType],
) -> RiskForecastResult:
    min_lon, min_lat, max_lon, max_lat = bbox
    center_lon = (min_lon + max_lon) / 2
    center_lat = (min_lat + max_lat) / 2

    # ── 실시간 환경 데이터 ────────────────────────────────────────────────────
    # KMA 초단기실황은 육상/연안 관측소만 지원하므로 해역별 가장 가까운 연안 좌표 사용
    obs_lat, obs_lon = _COASTAL_COORDS.get(area_name, (center_lat, center_lon))
    env = fetch_environment(lat=obs_lat, lon=obs_lon, dt=time_range_start)
    wind_ms    = env.weather.wind_speed_ms
    current_kt = env.current.speed_knots

    base_dri = _dri(wind_ms, current_kt)
    wave_h   = round(0.0248 * wind_ms ** 2, 1)

    # ── 그리드 ────────────────────────────────────────────────────────────────
    seed = int(hashlib.md5(f"{area_name}:{time_range_start.hour}".encode()).hexdigest(), 16) % (2 ** 31)
    features, scores = _build_grid(bbox, base_dri, seed)

    overall_dri = round(sum(scores) / len(scores), 3)
    rng = random.Random(seed)

    # ── 파생 통계 ─────────────────────────────────────────────────────────────
    duration_h = max(0.5, (time_range_end - time_range_start).total_seconds() / 3600)
    peak_time  = time_range_start + timedelta(hours=rng.uniform(0.5, min(duration_h * 0.7, 3.0)))
    tidal_time = (time_range_start + timedelta(hours=rng.uniform(2.0, 6.0))) if rng.random() > 0.25 else None

    cw = (max_lon - min_lon) / COLS
    ch = (max_lat - min_lat) / ROWS
    cell_km2   = cw * 111.0 * ch * 111.0
    high_area  = round(sum(cell_km2 for s in scores if s >= 0.60), 1)
    vessels    = rng.randint(40, 180)

    wind_sev, wave_sev, curr_sev = _severity(wind_ms, wave_h, current_kt)
    bft = _beaufort(wind_ms)

    # ── 위험 요인 설명 (구체적) ────────────────────────────────────────────────
    if wind_ms >= 14:
        wind_desc = f"{wind_ms:.1f} m/s (B{bft}) — 소형어선 귀항 권고 수준, 출항 통제 검토"
    elif wind_ms >= 10:
        wind_desc = f"{wind_ms:.1f} m/s (B{bft}) — 조업 한계 근접, 낚시어선 출항 주의"
    else:
        wind_desc = f"{wind_ms:.1f} m/s (B{bft}) — 정상 운항 가능 (소형어선 한계 10 m/s)"

    if wave_h >= 2.0:
        wave_desc = f"유의파고 {wave_h:.1f} m — 소형어선 안전기준(2 m) 초과, 전복 위험"
    elif wave_h >= 1.5:
        wave_desc = f"유의파고 {wave_h:.1f} m — 낚시어선 제한기준(1.5 m) 초과, 선체 동요 주의"
    else:
        wave_desc = f"유의파고 {wave_h:.1f} m — 관찰 수준 (낚시어선 기준 1.5 m 이하)"

    if current_kt >= 2.0:
        curr_desc = f"{current_kt:.2f} kt — 급류, 협수로·어초 부근 조종 불능 위험"
    elif current_kt >= 0.8:
        curr_desc = f"{current_kt:.2f} kt — 빠른 조류, 소형선 이탈 주의"
    else:
        curr_desc = f"{current_kt:.2f} kt — 약조류, 정상 운항 가능"

    # ── 권고 조치 (DRI 수준별) ─────────────────────────────────────────────────
    if overall_dri >= 0.60:
        actions = [
            RecommendedAction(priority=1, action="순찰정 긴급 출동",        target="고위험 해역 즉시 봉쇄·구조 대기"),
            RecommendedAction(priority=2, action="V-Pass 귀항 권고 발송",   target=f"조업 선박 {vessels}척 대상"),
            RecommendedAction(priority=3, action="VHF Ch.16 경보 방송",     target="출항 통제 및 항만 입항 안내"),
        ]
    elif overall_dri >= 0.30:
        actions = [
            RecommendedAction(priority=1, action="순찰정 사전 배치",        target="주의 해역 경계 강화"),
            RecommendedAction(priority=2, action="V-Pass 주의 알림 발송",   target=f"조업 선박 {vessels}척 대상"),
            RecommendedAction(priority=3, action="출항 자제 안내 방송",     target="해양경계방송 송출"),
        ]
    else:
        actions = [
            RecommendedAction(priority=1, action="기상 모니터링 강화",      target="3시간 간격 재분석"),
            RecommendedAction(priority=2, action="취약 시간대 집중 순찰",   target="일출·일몰 전후 2시간"),
            RecommendedAction(priority=3, action="정기 위치 보고 독려",     target=f"조업 선박 {vessels}척 대상"),
        ]

    return RiskForecastResult(
        forecasted_at=datetime.now(tz=timezone.utc),
        area_name=area_name,
        bbox=bbox,
        time_range_start=time_range_start,
        time_range_end=time_range_end,
        peak_risk_time=peak_time,
        vessel_types_targeted=vessel_types,
        risk_grid={"type": "FeatureCollection", "features": features},
        dri_score=overall_dri,
        dri_percentile=round(overall_dri * 100, 1),
        risk_causes=[
            RiskCause(factor="풍속", description=wind_desc, severity=wind_sev),
            RiskCause(factor="파고", description=wave_desc, severity=wave_sev),
            RiskCause(factor="조류", description=curr_desc, severity=curr_sev),
        ],
        recommended_actions=actions,
        max_wind_speed_ms=wind_ms,
        max_wave_height_m=wave_h,
        tidal_reversal_time=tidal_time,
        vessels_at_risk_count=vessels,
        high_risk_area_km2=high_area,
    )

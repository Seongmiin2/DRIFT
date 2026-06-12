"""
engine/data_fetcher.py

실시간 조류·기상 데이터 fetcher.

서비스 URL (공공데이터포털 — 동일한 API 키 사용):
  조류: https://apis.data.go.kr/1192136/crntFcstTime/
  기상: https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/

환경변수:
  DATA_GO_KR_API_KEY  — 공공데이터포털 인증키 (URL-encode 전 원본)
"""

from __future__ import annotations

import json
import logging
import math
import os
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_API_KEY = os.environ.get("DATA_GO_KR_API_KEY", "")


# ---------------------------------------------------------------------------
# 결과 데이터 클래스
# ---------------------------------------------------------------------------

@dataclass
class WeatherData:
    wind_speed_ms: float       # 풍속 m/s
    wind_direction_deg: float  # 풍향 deg (기상청 16방위 → 도)
    source: str = "KMA"
    is_fallback: bool = False


@dataclass
class CurrentData:
    speed_knots: float         # 조류 속도 (knots)
    direction_deg: float       # 조류 방향 (deg, 0=N)
    source: str = "KHOA"
    is_fallback: bool = False


@dataclass
class EnvironmentData:
    weather: WeatherData
    current: CurrentData

    @property
    def data_freshness_ok(self) -> bool:
        return not (self.weather.is_fallback or self.current.is_fallback)


# ---------------------------------------------------------------------------
# 공통 HTTP 헬퍼
# ---------------------------------------------------------------------------

def _get_json(base_url: str, params: dict) -> dict:
    """GET 요청 → JSON dict. timeout=6s."""
    url = base_url + "?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    logger.debug("GET %s", url)
    with urllib.request.urlopen(url, timeout=6) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _get_xml_items(base_url: str, params: dict) -> list[dict]:
    """GET 요청 → XML 파싱 → item 리스트 반환. timeout=6s."""
    url = base_url + "?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    logger.debug("GET %s", url)
    with urllib.request.urlopen(url, timeout=6) as resp:
        raw = resp.read()
    root = ET.fromstring(raw)
    # resultCode 확인
    rc_el = root.find(".//resultCode")
    if rc_el is not None and rc_el.text != "00":
        raise ValueError(f"KHOA error code {rc_el.text}: {root.find('.//resultMsg').text if root.find('.//resultMsg') is not None else ''}")
    items = []
    for item_el in root.findall(".//item"):
        row = {child.tag: (child.text or "").strip() for child in item_el}
        items.append(row)
    return items


# ---------------------------------------------------------------------------
# KMA 좌표 변환  (위경도 → 동네예보 격자 nx/ny)
# ---------------------------------------------------------------------------

def _latlon_to_kma_grid(lat: float, lon: float) -> tuple[int, int]:
    """Lambert Conformal Conic 변환 (기상청 공식 알고리즘)."""
    DEGRAD = math.pi / 180.0
    RE, GRID = 6371.00877, 5.0
    SLAT1, SLAT2 = 30.0 * DEGRAD, 60.0 * DEGRAD
    OLON, OLAT = 126.0 * DEGRAD, 38.0 * DEGRAD
    XO, YO = 43, 136

    re = RE / GRID
    sn = math.log(math.cos(SLAT1) / math.cos(SLAT2)) / math.log(
        math.tan(math.pi * 0.25 + SLAT2 * 0.5) / math.tan(math.pi * 0.25 + SLAT1 * 0.5)
    )
    sf = (math.tan(math.pi * 0.25 + SLAT1 * 0.5) ** sn) * math.cos(SLAT1) / sn
    ro = re * sf / (math.tan(math.pi * 0.25 + OLAT * 0.5) ** sn)

    ra = re * sf / (math.tan(math.pi * 0.25 + lat * DEGRAD * 0.5) ** sn)
    theta = lon * DEGRAD - OLON
    theta = max(-math.pi, min(math.pi, theta)) * sn

    return (
        int(ra * math.sin(theta) + XO + 0.5),
        int(ro - ra * math.cos(theta) + YO + 0.5),
    )


# ---------------------------------------------------------------------------
# KMA 기상청 초단기실황 (getUltraSrtNcst)
# ---------------------------------------------------------------------------

_KMA_BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"

# 기상청 16방위 코드 → 각도 변환
_VEC_MAP = {
    "N": 0, "NNE": 22.5, "NE": 45, "ENE": 67.5,
    "E": 90, "ESE": 112.5, "SE": 135, "SSE": 157.5,
    "S": 180, "SSW": 202.5, "SW": 225, "WSW": 247.5,
    "W": 270, "WNW": 292.5, "NW": 315, "NNW": 337.5,
}


def fetch_weather(lat: float, lon: float, dt: datetime | None = None) -> WeatherData:
    """
    기상청 초단기실황 API → 풍속(m/s), 풍향(deg).

    카테고리:
      WSD — 풍속 (m/s)
      VEC — 풍향 (16방위 숫자코드 0~360 또는 방위문자)
    """
    if not _API_KEY:
        logger.warning("DATA_GO_KR_API_KEY 미설정 — 기상 fallback 사용")
        return _fallback_weather()

    # KMA API 는 KST(UTC+9) 기준으로 base_date/base_time 을 받음
    from datetime import timezone as _tz
    import zoneinfo as _zi
    kst = _zi.ZoneInfo("Asia/Seoul")
    dt_kst = (dt or datetime.now(tz=_tz.utc)).astimezone(kst)
    # 초단기실황은 매 정시 발표 — 현재 분이 10분 미만이면 직전 정시로 후퇴
    if dt_kst.minute < 10:
        dt_kst = dt_kst.replace(hour=(dt_kst.hour - 1) % 24, minute=0, second=0, microsecond=0)
    base_date = dt_kst.strftime("%Y%m%d")
    base_time = f"{dt_kst.hour:02d}00"
    nx, ny = _latlon_to_kma_grid(lat, lon)

    try:
        data = _get_json(_KMA_BASE, {
            "serviceKey": _API_KEY,
            "pageNo": 1,
            "numOfRows": 20,
            "dataType": "JSON",
            "base_date": base_date,
            "base_time": base_time,
            "nx": nx,
            "ny": ny,
        })

        items = data["response"]["body"]["items"]["item"]
        wsd, vec = None, None
        for item in items:
            cat = item.get("category", "")
            val = item.get("obsrValue", "")
            if cat == "WSD":
                v = float(val)
                if v >= 0:   # -999 = KMA 결측 플래그, 무시
                    wsd = v
            elif cat == "VEC":
                # 숫자(0–360) 또는 문자("NW" 등)
                vec = float(_VEC_MAP.get(str(val), val)) if not _is_float(val) else float(val)

        if wsd is None or vec is None:
            raise ValueError(f"WSD/VEC 미수신 또는 결측: wsd={wsd}, vec={vec}")

        logger.info("KMA 실황: 풍속=%.1f m/s, 풍향=%.0f°", wsd, vec)
        return WeatherData(wind_speed_ms=wsd, wind_direction_deg=vec % 360, source="KMA")

    except Exception as exc:
        logger.warning("KMA API 오류 (%s) — fallback 사용", exc)
        return _fallback_weather()


# ---------------------------------------------------------------------------
# KHOA 조류예보 (crntFcstTime)
# ---------------------------------------------------------------------------

_KHOA_BASE = "https://apis.data.go.kr/1192136/crntFcstTime/GetCrntFcstTimeApiService"

# 조류예보 지점 코드 (KHOA LTC 형식, 실측 확인)
_STATIONS = [
    {"code": "16LTC01", "lon": 126.5486, "lat": 37.3979, "name": "인천대교"},
    {"code": "16LTC02", "lon": 126.3821, "lat": 37.1737, "name": "인천서방"},
    {"code": "17LTC02", "lon": 126.2155, "lat": 37.3394, "name": "연평도동방"},
    {"code": "16LTC03", "lon": 126.4665, "lat": 36.3779, "name": "태안서방"},
    {"code": "18LTC02", "lon": 125.8697, "lat": 36.6197, "name": "군산서방"},
    {"code": "16LTC04", "lon": 126.2047, "lat": 34.8504, "name": "목포서방"},
    {"code": "23LTC06", "lon": 125.9856, "lat": 34.6211, "name": "진도서방"},
    {"code": "16LTC08", "lon": 127.7875, "lat": 34.8439, "name": "여수남방"},
    {"code": "16LTC09", "lon": 128.4461, "lat": 34.7937, "name": "거제서방"},
    {"code": "16LTC12", "lon": 128.9124, "lat": 34.9822, "name": "부산남방"},
    {"code": "23LTC01", "lon": 126.9339, "lat": 33.5217, "name": "제주북서방"},
    {"code": "23LTC02", "lon": 126.1758, "lat": 33.3680, "name": "서귀포남방"},
]


def _nearest_station(lat: float, lon: float) -> dict:
    return min(_STATIONS, key=lambda s: math.hypot(s["lon"] - lon, s["lat"] - lat))


def fetch_current(lat: float, lon: float, dt: datetime | None = None) -> CurrentData:
    """
    공공데이터포털 조류예보시간자료 API → 속도(knots), 방향(deg).

    응답 필드 (서비스 명세 기준):
      currntSpd / speed  — 조류속도 (cm/s)
      currntDir / drctn  — 조류방향 (deg)
      tmFc               — 예보 시각 (YYYYMMDDHHmm)
    """
    if not _API_KEY:
        logger.warning("DATA_GO_KR_API_KEY 미설정 — 조류 fallback 사용")
        return _fallback_current()

    dt = (dt or datetime.now()).astimezone(timezone.utc)
    station = _nearest_station(lat, lon)

    try:
        items = _get_xml_items(_KHOA_BASE, {
            "serviceKey": _API_KEY,
            "pageNo": 1,
            "numOfRows": 24,
            "obsCode": station["code"],
            "year": dt.strftime("%Y"),
            "month": dt.strftime("%m"),
            "day": dt.strftime("%d"),
        })

        if not items:
            raise ValueError("빈 응답")

        # 현재 시각에 가장 가까운 예보 선택
        best = _pick_nearest_hour(items, dt.hour)

        # 필드명 후보 (GetCrntFcstTimeApiService: crsp/crdir)
        speed_cms = float(
            best.get("crsp") or best.get("currntSpd") or best.get("speed") or best.get("spd") or 41.2
        )
        raw_dir = best.get("crdir") or best.get("currntDir") or best.get("drctn") or best.get("dir") or "45"
        direction = _parse_crdir(raw_dir)

        speed_knots = speed_cms / 51.444  # cm/s → knots

        logger.info(
            "KHOA 조류 (%s): %.2f kt @ %.0f°", station["name"], speed_knots, direction
        )
        return CurrentData(
            speed_knots=round(speed_knots, 3),
            direction_deg=round(direction % 360, 1),
            source=f"KHOA:{station['name']}",
        )

    except Exception as exc:
        logger.warning("KHOA API 오류 (%s) — fallback 사용", exc)
        return _fallback_current()


# ---------------------------------------------------------------------------
# 응답 파싱 헬퍼
# ---------------------------------------------------------------------------


def _pick_nearest_hour(items: list[dict], target_hour: int) -> dict:
    """예보 리스트에서 target_hour에 가장 가까운 항목 반환."""
    def hour_of(item: dict) -> int:
        for key in ("tmFc", "tm", "fcstTime", "time", "predcDt"):
            val = item.get(key, "")
            if val:
                s = str(val).replace("-", "").replace(" ", "").replace(":", "")
                if len(s) >= 10:
                    try:
                        return int(s[8:10])  # YYYYMMDDHH[mm]
                    except ValueError:
                        pass
        return 0

    return min(items, key=lambda r: abs(hour_of(r) - target_hour))


# KHOA crdir 필드: 한국어 방위명 또는 숫자 각도
_CRDIR_MAP = {
    "북": 0.0, "북북동": 22.5, "북동": 45.0, "동북동": 67.5,
    "동": 90.0, "동남동": 112.5, "남동": 135.0, "남남동": 157.5,
    "남": 180.0, "남남서": 202.5, "남서": 225.0, "서남서": 247.5,
    "서": 270.0, "서북서": 292.5, "북서": 315.0, "북북서": 337.5,
    "N": 0.0, "NNE": 22.5, "NE": 45.0, "ENE": 67.5,
    "E": 90.0, "ESE": 112.5, "SE": 135.0, "SSE": 157.5,
    "S": 180.0, "SSW": 202.5, "SW": 225.0, "WSW": 247.5,
    "W": 270.0, "WNW": 292.5, "NW": 315.0, "NNW": 337.5,
}


def _parse_crdir(val: str | float) -> float:
    s = str(val).strip()
    if s in _CRDIR_MAP:
        return _CRDIR_MAP[s]
    try:
        return float(s)
    except (ValueError, TypeError):
        return 45.0


def _is_float(s: str) -> bool:
    try:
        float(s)
        return True
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Fallback  (API 불통 시 서해 연평균값)
# ---------------------------------------------------------------------------

def _fallback_weather() -> WeatherData:
    return WeatherData(
        wind_speed_ms=7.5,
        wind_direction_deg=315.0,
        source="KMA-FALLBACK",
        is_fallback=True,
    )


def _fallback_current() -> CurrentData:
    return CurrentData(
        speed_knots=0.8,
        direction_deg=45.0,
        source="KHOA-FALLBACK",
        is_fallback=True,
    )


# ---------------------------------------------------------------------------
# 통합 진입점
# ---------------------------------------------------------------------------

def fetch_environment(
    lat: float,
    lon: float,
    dt: datetime | None = None,
) -> EnvironmentData:
    """
    실시간 조류·기상 데이터 조회.

    >>> from engine.data_fetcher import fetch_environment
    >>> env = fetch_environment(lat=37.959, lon=124.372)
    >>> env.weather.wind_speed_ms, env.current.speed_knots
    >>> env.data_freshness_ok   # False = fallback 사용됨
    """
    return EnvironmentData(
        weather=fetch_weather(lat, lon, dt),
        current=fetch_current(lat, lon, dt),
    )

"""
과거 해상 사고 데이터(2011-2023)를 읽어 사고다발구역 GeoJSON을 생성한다.
출력: frontend/src/api/risk/accidentHotspots.json
"""
import csv, json, math, re
from collections import defaultdict
from pathlib import Path

CSV_PATH = Path("frontend/src/api/risk/통합_해상조난사고_데이터_2011_2023.csv")
OUT_PATH  = Path("frontend/public/accidentHotspots.json")

CELL_SIZE = 0.05   # 약 5.5 km

# 9개 정의 해역 bbox만 사용 — 일본 해역 유입 방지
# [min_lon, min_lat, max_lon, max_lat]
SEA_AREA_BBOXES = [
    [125.2, 33.8, 126.2, 34.8],   # 목포/신안 해역
    [127.8, 33.2, 129.5, 34.4],   # 통영/거제
    [124.5, 37.0, 126.0, 37.8],   # 인천/경기만
    [126.8, 33.5, 127.8, 34.5],   # 여수/거문도
    [125.5, 32.5, 126.5, 33.5],   # 제주도 서방
    [125.8, 31.8, 127.2, 33.0],   # 서귀포 남방
    [128.5, 33.5, 130.5, 34.7],   # 부산/영도
    [125.0, 35.4, 126.3, 36.2],   # 군산/새만금
    [124.1, 37.6, 124.9, 38.3],   # 연평도 인근 서해
]
BUFFER = 0.1  # bbox 주변 0.1° 여유

# 9개 해역의 합집합 범위 (그리드 기준용)
LON_MIN = min(b[0] for b in SEA_AREA_BBOXES) - BUFFER
LAT_MIN = min(b[1] for b in SEA_AREA_BBOXES) - BUFFER
LON_MAX = max(b[2] for b in SEA_AREA_BBOXES) + BUFFER
LAT_MAX = max(b[3] for b in SEA_AREA_BBOXES) + BUFFER


def in_any_sea_area(lat: float, lon: float) -> bool:
    """주어진 좌표가 9개 해역 bbox(버퍼 포함) 중 하나에 속하는지 확인."""
    for b in SEA_AREA_BBOXES:
        if (b[0] - BUFFER <= lon <= b[2] + BUFFER and
                b[1] - BUFFER <= lat <= b[3] + BUFFER):
            return True
    return False


# 사고다발구역 기준 (건수)
HOTSPOT_THRESHOLD  = 10   # ≥10건: 사고다발구역
CAUTION_THRESHOLD  =  3   # ≥3건:  주의구역


def parse_dms(s: str) -> float | None:
    s = s.strip()
    if not s:
        return None
    parts = re.split(r"[|/: ]", s)
    try:
        d, m, sec = float(parts[0]), float(parts[1]), float(parts[2]) if len(parts) > 2 else 0.0
        val = d + m / 60.0 + sec / 3600.0
        return val if 0 < val < 200 else None
    except Exception:
        return None


def cell_key(lat: float, lon: float) -> tuple[int, int]:
    col = int((lon - LON_MIN) / CELL_SIZE)
    row = int((lat - LAT_MIN) / CELL_SIZE)
    return (row, col)


def cell_bbox(row: int, col: int) -> tuple[float, float, float, float]:
    lon0 = LON_MIN + col * CELL_SIZE
    lat0 = LAT_MIN + row * CELL_SIZE
    return lon0, lat0, lon0 + CELL_SIZE, lat0 + CELL_SIZE


# ── 데이터 집계 ──────────────────────────────────────────────────────────────
counts:    dict[tuple, int]   = defaultdict(int)
fatals:    dict[tuple, int]   = defaultdict(int)   # 사망+실종
causes:    dict[tuple, dict]  = defaultdict(lambda: defaultdict(int))
types_map: dict[tuple, dict]  = defaultdict(lambda: defaultdict(int))

skipped = 0
total = 0

with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        total += 1
        lat = parse_dms(row.get("위도", ""))
        lon = parse_dms(row.get("경도", ""))
        if lat is None or lon is None:
            skipped += 1
            continue
        if not in_any_sea_area(lat, lon):
            skipped += 1
            continue

        key = cell_key(lat, lon)
        counts[key] += 1

        dead = 0
        try:
            dead = int(float(row.get("사망인원", 0) or 0)) + int(float(row.get("실종인원", 0) or 0))
        except ValueError:
            pass
        fatals[key] += dead

        cause = row.get("발생원인", "").strip()
        if cause:
            causes[key][cause] += 1

        acc_type = row.get("발생유형", "").strip()
        if acc_type:
            types_map[key][acc_type] += 1

print(f"Total rows: {total}, skipped: {skipped}, valid cells: {len(counts)}")

# ── GeoJSON 생성 ─────────────────────────────────────────────────────────────
features = []

for key, cnt in counts.items():
    if cnt < CAUTION_THRESHOLD:
        continue

    row_i, col_i = key
    lon0, lat0, lon1, lat1 = cell_bbox(row_i, col_i)

    dom_cause = max(causes[key], key=causes[key].get) if causes[key] else "기타"
    dom_type  = max(types_map[key], key=types_map[key].get) if types_map[key] else "기타"
    zone      = "사고다발구역" if cnt >= HOTSPOT_THRESHOLD else "주의구역"

    features.append({
        "type": "Feature",
        "properties": {
            "accident_count": cnt,
            "fatal_count":    fatals[key],
            "zone":           zone,
            "dominant_cause": dom_cause,
            "dominant_type":  dom_type,
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

features.sort(key=lambda f: f["properties"]["accident_count"], reverse=True)
geojson = {"type": "FeatureCollection", "features": features}

OUT_PATH.write_text(json.dumps(geojson, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

hotspot_cnt = sum(1 for f in features if f["properties"]["zone"] == "사고다발구역")
caution_cnt = sum(1 for f in features if f["properties"]["zone"] == "주의구역")
print(f"Generated {len(features)} zones: {hotspot_cnt} 사고다발구역, {caution_cnt} 주의구역")
print(f"Saved to {OUT_PATH}")

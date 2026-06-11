"""
API 연결 테스트 스크립트.

사용법:
  cd DRIFT
  python scripts/test_api.py
"""

import os, sys, json, logging

# .env 파일 로드
from pathlib import Path
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, str(Path(__file__).parent.parent))
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

from engine.data_fetcher import fetch_environment

print("=" * 55)
print("DRIFT API 연결 테스트")
print("=" * 55)
print(f"API 키: {'설정됨 (' + os.environ.get('DATA_GO_KR_API_KEY','')[:8] + '...)' if os.environ.get('DATA_GO_KR_API_KEY') else '❌ 미설정'}")
print()

# 테스트 좌표: 연평도 근해
TEST_LAT, TEST_LON = 37.959, 124.372
print(f"테스트 위치: {TEST_LAT}°N {TEST_LON}°E (연평도 근해)")
print()

env = fetch_environment(lat=TEST_LAT, lon=TEST_LON)

print("── 기상 (KMA) ──────────────────────────")
print(f"  풍속:  {env.weather.wind_speed_ms:.1f} m/s")
print(f"  풍향:  {env.weather.wind_direction_deg:.0f}°")
print(f"  출처:  {env.weather.source}")
print(f"  실시간: {'✅' if not env.weather.is_fallback else '⚠️  fallback'}")
print()
print("── 조류 (KHOA) ─────────────────────────")
print(f"  속도:  {env.current.speed_knots:.3f} kt")
print(f"  방향:  {env.current.direction_deg:.0f}°")
print(f"  출처:  {env.current.source}")
print(f"  실시간: {'✅' if not env.current.is_fallback else '⚠️  fallback'}")
print()
print(f"data_freshness_ok = {env.data_freshness_ok}")

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import { api } from "@/api";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import type { RiskLevel, RiskGridCellProperties, RiskForecastResult } from "@/types/contracts";
import { SEA_AREAS } from "@/api/risk/seaAreas";
import { loadKoreaGeoJSON, isOnLand } from "@/map/landMask";
import "leaflet/dist/leaflet.css";

// ── 위험 등급 색상 ──────────────────────────────────────────────────────────
const RISK_COLOR: Record<RiskLevel, string> = {
  고위험: "#ef4444",
  주의:   "#f59e0b",
  관찰:   "#22c55e",
};

const HEATMAP_STYLE: Record<RiskLevel, L.PathOptions> = {
  고위험: { color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.55, weight: 0.5, opacity: 0.7 },
  주의:   { color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.45, weight: 0.5, opacity: 0.6 },
  관찰:   { color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.30, weight: 0.5, opacity: 0.4 },
};

// ── 사고다발구역 스타일 ────────────────────────────────────────────────────
type HotspotZone = "사고다발구역" | "주의구역";
interface HotspotProperties {
  accident_count: number;
  fatal_count:    number;
  zone:           HotspotZone;
  dominant_cause: string;
  dominant_type:  string;
}


import type { PathOptions } from "leaflet";

const AREA_NAMES = Object.keys(SEA_AREAS);

// ── 지도 중심 이동 ──────────────────────────────────────────────────────────
function RecenterView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center[0], center[1], zoom]);
  return null;
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────────────────
export function Tab3Risk() {
  const [selectedArea, setSelectedArea] = useState(AREA_NAMES[0]);
  const [riskForecast, setRiskForecast] = useState<RiskForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [landReady, setLandReady] = useState(false);
  const [showHotspots, setShowHotspots] = useState(true);
  const [allHotspots, setAllHotspots] = useState<GeoJSON.FeatureCollection | null>(null);
  const [forecastHours, setForecastHours] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 육지 GeoJSON 로드
  useEffect(() => {
    loadKoreaGeoJSON().then(() => setLandReady(true)).catch(console.error);
  }, []);

  // 과거 사고다발구역 데이터 로드 (최초 1회)
  useEffect(() => {
    fetch("/accidentHotspots.json")
      .then((r) => r.json())
      .then((data: GeoJSON.FeatureCollection) => setAllHotspots(data))
      .catch(console.error);
  }, []);

  // 해역 변경 시 슬라이더 초기화 + API 호출
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setForecastHours(0);
    setRiskForecast(null);
    setError(null);
    setLoading(true);
    api.getRiskForecast({ area_name: selectedArea })
      .then(setRiskForecast)
      .catch((e) => setError(e?.message ?? "서버 연결 실패"))
      .finally(() => setLoading(false));
  }, [selectedArea]);

  // 슬라이더 변경 → 400ms 디바운스 후 API 재호출
  const handleSliderChange = useCallback((hours: number) => {
    setForecastHours(hours);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRiskForecast(null);
      setError(null);
      setLoading(true);
      const timeStr = hours > 0
        ? new Date(Date.now() + hours * 3600_000).toISOString()
        : undefined;
      api.getRiskForecast({ area_name: selectedArea, time_range_start: timeStr })
        .then(setRiskForecast)
        .catch((e) => setError(e?.message ?? "서버 연결 실패"))
        .finally(() => setLoading(false));
    }, 400);
  }, [selectedArea]);

  // 슬라이더 기준 예측 대상 시각 (KST 표시용)
  const targetTime = useMemo(
    () => new Date(Date.now() + forecastHours * 3600_000),
    [forecastHours],
  );

  // 육지 셀 필터링
  const filteredForecast = useMemo<RiskForecastResult | null>(() => {
    if (!riskForecast) return null;
    if (!landReady) return riskForecast;
    const seaFeatures = riskForecast.risk_grid.features.filter((f) => {
      const coords = (f.geometry as GeoJSON.Polygon).coordinates[0];
      const cx = (coords[0][0] + coords[2][0]) / 2;
      const cy = (coords[0][1] + coords[2][1]) / 2;
      return !isOnLand(cx, cy);
    });
    return { ...riskForecast, risk_grid: { ...riskForecast.risk_grid, features: seaFeatures } };
  }, [riskForecast, landReady]);

  const bbox = SEA_AREAS[selectedArea]?.bbox ?? [126.0, 34.0, 127.0, 35.0];
  const mapCenter: [number, number] = [(bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2];

  // 선택 해역 bbox 내 사고다발구역 필터링 (항상 계산 — DRI 히트맵 기반으로 사용)
  const areaHotspots = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!allHotspots) return null;
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const features = allHotspots.features.filter((f) => {
      const coords = (f.geometry as GeoJSON.Polygon).coordinates[0];
      const cx = (coords[0][0] + coords[2][0]) / 2;
      const cy = (coords[0][1] + coords[2][1]) / 2;
      return cx >= minLon && cx <= maxLon && cy >= minLat && cy <= maxLat;
    });
    return { type: "FeatureCollection", features };
  }, [allHotspots, selectedArea]);

  // fill opacity 정규화를 위한 해역 내 최대 사고 건수
  const maxAccidentCount = useMemo(() => {
    if (!areaHotspots || areaHotspots.features.length === 0) return 1;
    return Math.max(...areaHotspots.features.map((f) => (f.properties as HotspotProperties).accident_count));
  }, [areaHotspots]);

  // 전국 사고다발구역 식별에 사용된 총 사고 건수
  const totalAccidentCount = useMemo(() => {
    if (!allHotspots) return null;
    return allHotspots.features.reduce(
      (sum, f) => sum + ((f.properties as HotspotProperties).accident_count ?? 0), 0,
    );
  }, [allHotspots]);

  // 사고 셀 주변 1칸 버퍼 셀 (hotspot에 포함되지 않은 이웃 셀만)
  const areaBufferCells = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!areaHotspots || areaHotspots.features.length === 0) return null;
    const CS = 0.05; // CELL_SIZE (accidentHotspots.json 생성 기준)
    const round5 = (v: number) => Math.round(v * 100000) / 100000;

    // 기존 hotspot 셀 키 (lon0,lat0 기준)
    const hotspotKeys = new Set<string>();
    for (const f of areaHotspots.features) {
      const c = (f.geometry as GeoJSON.Polygon).coordinates[0];
      hotspotKeys.add(`${c[0][0]},${c[0][1]}`);
    }

    const bufferKeys = new Set<string>();
    const features: GeoJSON.Feature[] = [];

    for (const f of areaHotspots.features) {
      const c = (f.geometry as GeoJSON.Polygon).coordinates[0];
      const lon0 = c[0][0];
      const lat0 = c[0][1];

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nLon0 = round5(lon0 + dc * CS);
          const nLat0 = round5(lat0 + dr * CS);
          const key = `${nLon0},${nLat0}`;
          if (hotspotKeys.has(key) || bufferKeys.has(key)) continue;
          bufferKeys.add(key);
          const nLon1 = round5(nLon0 + CS);
          const nLat1 = round5(nLat0 + CS);
          features.push({
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [[
                [nLon0, nLat0], [nLon1, nLat0],
                [nLon1, nLat1], [nLon0, nLat1],
                [nLon0, nLat0],
              ]],
            },
          });
        }
      }
    }
    return { type: "FeatureCollection", features };
  }, [areaHotspots]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">

        {/* ── 좌측 패널 ──────────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 bg-gradient-to-b from-navy-900 to-navy-950 border-r border-navy-700/70 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-navy-700/60">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1 h-4 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,212,255,0.7)]" />
              <h2 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                해역 선택
              </h2>
            </div>
            <div className="flex flex-col gap-1">
              {AREA_NAMES.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedArea(name)}
                  className={[
                    "text-left text-xs px-3 py-2 rounded transition-all",
                    selectedArea === name
                      ? "bg-cyan-400/15 text-cyan-300 border border-cyan-400/30"
                      : "text-slate-400 hover:bg-navy-800 hover:text-slate-300 border border-transparent",
                  ].join(" ")}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* DRI 게이지 + 통계 */}
          {riskForecast && !loading && (
            <div className="p-4 flex flex-col gap-4">
              <div className="bg-navy-800/60 border border-navy-600/50 rounded-xl p-4 text-center shadow-inner">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Drift Risk Index</p>
                <DriGauge score={riskForecast.dri_score} peakTime={riskForecast.peak_risk_time} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "최대 풍속", value: `${riskForecast.max_wind_speed_ms} m/s` },
                  { label: "최대 파고", value: `${riskForecast.max_wave_height_m} m` },
                  { label: "조류 속도", value: `${riskForecast.max_current_speed_kt} kt` },
                  { label: "고위험 면적", value: `${riskForecast.high_risk_area_km2} km²` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-navy-800/50 border border-navy-700/60 rounded-lg p-2.5 transition-colors hover:bg-navy-700/40">
                    <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-cyan-300 font-mono font-semibold">{value}</p>
                  </div>
                ))}
              </div>

            </div>
          )}

          {loading && (
            <div className="flex-1 flex items-center justify-center py-8">
              <svg className="animate-spin h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </aside>

        {/* ── 지도 영역 ────────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">
          {/* Leaflet 히트맵 — 항상 렌더, 데이터만 바뀜 */}
          <MapContainer
            center={mapCenter}
            zoom={9}
            style={{ height: "100%", width: "100%" }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <RecenterView center={mapCenter} zoom={9} />

            {/* 사고 셀 주변 1칸 버퍼 — 낮은 불투명도로 위험 영역 확장 표현 */}
            {areaBufferCells && areaBufferCells.features.length > 0 && riskForecast && (
              <GeoJSON
                key={`dri-buffer-${selectedArea}-${riskForecast.forecasted_at}`}
                data={areaBufferCells as unknown as GeoJSON.FeatureCollection}
                style={() => {
                  const dri = riskForecast.dri_score;
                  const color = dri >= 0.60 ? "#ef4444" : dri >= 0.30 ? "#f59e0b" : "#22c55e";
                  return { fillColor: color, fillOpacity: 0.14, color, weight: 0.3, opacity: 0.35 } as PathOptions;
                }}
              />
            )}

            {/* DRI 히트맵 — 사고다발/주의구역 셀 기반, 채도=사고 빈도, 색=DRI 수준 */}
            {areaHotspots && areaHotspots.features.length > 0 && riskForecast && (
              <GeoJSON
                key={`dri-hotspot-${selectedArea}-${riskForecast.forecasted_at}-${showHotspots}`}
                data={areaHotspots as unknown as GeoJSON.FeatureCollection}
                style={(feature) => {
                  const p = (feature?.properties ?? {}) as HotspotProperties;
                  const dri = riskForecast.dri_score;
                  const color = dri >= 0.60 ? "#ef4444" : dri >= 0.30 ? "#f59e0b" : "#22c55e";
                  const intensity = Math.min(1, p.accident_count / maxAccidentCount);
                  const fillOpacity = p.zone === "사고다발구역"
                    ? 0.18 + intensity * 0.17   // 0.18–0.35
                    : 0.15 + intensity * 0.08;  // 0.15–0.23
                  // showHotspots ON: 보라색 구분 테두리 / OFF: DRI 색 얇은 테두리
                  const outlineColor = showHotspots
                    ? (p.zone === "사고다발구역" ? "#a855f7" : "#c084fc")
                    : color;
                  const outlineWeight = showHotspots
                    ? (p.zone === "사고다발구역" ? 2.5 : 1.5)
                    : 0.5;
                  const dashArray = showHotspots && p.zone === "주의구역" ? "6,4" : undefined;
                  return { fillColor: color, fillOpacity, color: outlineColor, weight: outlineWeight, opacity: 0.85, dashArray } as PathOptions;
                }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties as HotspotProperties;
                  const dri = riskForecast.dri_score;
                  const driPct = Math.round(dri * 100);
                  const lvl = dri >= 0.60 ? "고위험" : dri >= 0.30 ? "주의" : "관찰";
                  const fatalInfo = p.fatal_count > 0 ? ` · 사망·실종 ${p.fatal_count}명` : "";
                  layer.bindTooltip(
                    `<b>${p.zone}</b> — DRI ${driPct} (${lvl})<br/>2011–2023년 ${p.accident_count}건${fatalInfo}<br/>주요 원인: ${p.dominant_cause}<br/>주요 유형: ${p.dominant_type}`,
                    { className: "risk-tooltip", sticky: true },
                  );
                }}
              />
            )}

            {/* 사고 이력 없는 해역: 기존 격자 폴백 */}
            {filteredForecast && (!areaHotspots || areaHotspots.features.length === 0) && (
              <GeoJSON
                key={filteredForecast.area_name + filteredForecast.forecasted_at}
                data={filteredForecast.risk_grid as unknown as GeoJSON.FeatureCollection}
                style={(feature) => {
                  const lvl = (feature?.properties as RiskGridCellProperties).risk_level as RiskLevel;
                  return (HEATMAP_STYLE[lvl] ?? HEATMAP_STYLE["관찰"]) as PathOptions;
                }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties as RiskGridCellProperties;
                  layer.bindTooltip(
                    `<b>${p.risk_level}</b><br/>DRI ${(p.dri_score * 100).toFixed(0)}`,
                    { className: "risk-tooltip", sticky: true },
                  );
                }}
              />
            )}
          </MapContainer>

          {/* 타임라인 슬라이더 + 데이터 출처 (좌하단) */}
          <div className="absolute bottom-6 left-3 z-[1000] flex flex-col gap-2 w-72">
            <div className="bg-navy-900/90 border border-navy-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-cyan-400">예측 시점</p>
                <span className="text-xs text-slate-300">
                  {forecastHours === 0 ? "현재" : `+${forecastHours}h`}
                  {" · "}
                  {targetTime.toLocaleString("ko-KR", {
                    month: "numeric", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
              <input
                type="range"
                min={0} max={72} step={6}
                value={forecastHours}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400"
                style={{ background: `linear-gradient(to right, #22d3ee ${(forecastHours / 72) * 100}%, #1e293b ${(forecastHours / 72) * 100}%)` }}
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1.5 select-none">
                <span>지금</span>
                <span>+1일</span>
                <span>+2일</span>
                <span>+3일</span>
              </div>
            </div>
            {totalAccidentCount !== null && (
              <p className="text-[10px] text-slate-500 leading-relaxed pl-1 pointer-events-none">
                <span className="font-semibold text-slate-400">{totalAccidentCount.toLocaleString()}건</span>
                {" "}해상사고 데이터 기반 (2011–2023, 사고다발·주의구역 한정)
              </p>
            )}
          </div>

          {/* 로딩 오버레이 */}
          {loading && (
            <div className="absolute inset-0 bg-navy-900/60 flex items-center justify-center z-[1000]">
              <div className="flex items-center gap-3 bg-navy-900 border border-navy-700 rounded-lg px-5 py-3">
                <svg className="animate-spin h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-slate-300">해역 데이터 로딩 중…</span>
              </div>
            </div>
          )}

          {/* 오류 오버레이 */}
          {error && !loading && (
            <div className="absolute inset-0 bg-navy-900/70 flex items-center justify-center z-[1000]">
              <div className="bg-navy-900 border border-red-500/40 rounded-lg px-6 py-4 text-center max-w-xs">
                <p className="text-red-400 font-semibold mb-1">서버 연결 오류</p>
                <p className="text-slate-400 text-xs">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    api.getRiskForecast({ area_name: selectedArea })
                      .then(setRiskForecast)
                      .catch((e) => setError(e?.message ?? "서버 연결 실패"))
                      .finally(() => setLoading(false));
                  }}
                  className="mt-3 text-xs px-3 py-1.5 bg-cyan-400/15 text-cyan-300 border border-cyan-400/30 rounded hover:bg-cyan-400/25 transition"
                >
                  재시도
                </button>
              </div>
            </div>
          )}

          {/* 우하단 패널 묶음: 범례 + 위험 요인·권고 조치 */}
          <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-2 w-64">

            {/* 범례 — 2열 가로 배치 */}
            <div className="bg-navy-900/90 border border-navy-700 rounded-lg p-3 text-xs flex gap-0">

              {/* 왼쪽: 과거 사고 이력 */}
              <div className="flex flex-col gap-1.5 pr-3 flex-1">
                <button
                  onClick={() => setShowHotspots((v) => !v)}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  <span className="text-slate-400 font-medium whitespace-nowrap">과거 사고 이력</span>
                  <span className={[
                    "ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold",
                    showHotspots
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "bg-navy-600 text-slate-500 border border-navy-500",
                  ].join(" ")}>
                    {showHotspots ? "ON" : "OFF"}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-3 rounded-sm shrink-0"
                    style={{ border: "2.5px solid #a855f7", background: "transparent" }} />
                  <span className={showHotspots ? "text-slate-400" : "text-slate-600"}>사고다발구역</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-3 rounded-sm shrink-0"
                    style={{ border: "2px dashed #c084fc", background: "transparent" }} />
                  <span className={showHotspots ? "text-slate-400" : "text-slate-600"}>주의구역</span>
                </div>
                {areaHotspots && showHotspots && (
                  <p className="text-[10px] text-slate-600">
                    {areaHotspots.features.filter(f => (f.properties as HotspotProperties).zone === "사고다발구역").length}개 다발 ·{" "}
                    {areaHotspots.features.filter(f => (f.properties as HotspotProperties).zone === "주의구역").length}개 주의
                  </p>
                )}
              </div>

              {/* 세로 구분선 */}
              <div className="w-px bg-navy-700 self-stretch mx-0.5" />

              {/* 오른쪽: 해양경보 등급 */}
              <div className="flex flex-col gap-1.5 pl-3">
                <p className="text-slate-400 font-medium">해양경보 등급</p>
                {(["고위험", "주의", "관찰"] as RiskLevel[]).map((lvl) => (
                  <div key={lvl} className="flex items-center gap-2">
                    <span className="w-4 h-3 rounded-sm border shrink-0"
                      style={{
                        background: HEATMAP_STYLE[lvl].fillColor as string,
                        borderColor: HEATMAP_STYLE[lvl].color as string,
                      }} />
                    <span className="text-slate-300">{lvl}</span>
                  </div>
                ))}
                {areaHotspots && areaHotspots.features.length > 0 ? (
                  <p className="text-[10px] text-slate-500">채도 = 사고 빈도</p>
                ) : filteredForecast ? (
                  <div className="mt-1 space-y-0.5">
                    <GridCounts forecast={filteredForecast} />
                  </div>
                ) : null}
              </div>
            </div>

            {/* 위험 요인 · 권고 조치 */}
            {riskForecast && !loading && (
              <div className="bg-navy-900/90 border border-navy-700 rounded-lg p-3 text-xs">
                <p className="text-white font-medium mb-2">위험 요인</p>
                {riskForecast.risk_causes.map((cause, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1.5">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: RISK_COLOR[cause.severity] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-white font-medium">{cause.factor}</span>
                        <span className="ml-auto shrink-0 text-[10px] px-1 py-px rounded"
                          style={{ color: RISK_COLOR[cause.severity], background: `${RISK_COLOR[cause.severity]}20` }}>
                          {cause.severity}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-snug mt-px">{cause.description}</p>
                    </div>
                  </div>
                ))}
                {riskForecast.tidal_reversal_time && (
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0 bg-amber-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-white font-medium">조류 반전</span>
                        <span className="ml-auto shrink-0 text-[10px] px-1 py-px rounded text-amber-400 bg-amber-400/15">주의</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-snug mt-px">
                        예상 {new Date(riskForecast.tidal_reversal_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} — 협수로 통항 주의
                      </p>
                    </div>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-navy-700">
                  <p className="text-white font-medium mb-2">권고 조치</p>
                  {riskForecast.recommended_actions.map((action) => (
                    <div key={action.priority} className="flex items-start gap-2 mb-1.5">
                      <span className={[
                        "shrink-0 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center mt-0.5",
                        action.priority === 1 ? "bg-red-500 text-white"
                          : action.priority === 2 ? "bg-amber-500 text-white"
                          : "bg-navy-600 text-slate-200",
                      ].join(" ")}>{action.priority}</span>
                      <div>
                        <p className="text-white">{action.action}</p>
                        <p className="text-[10px] text-slate-300 mt-px">{action.target}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <DisclaimerBanner />
    </div>
  );
}

// ── 서브 컴포넌트 ───────────────────────────────────────────────────────────

function DriGauge({ score, peakTime }: { score: number; peakTime: string }) {
  const pct   = Math.round(score * 100);
  const color = pct >= 60 ? "#ef4444" : pct >= 30 ? "#f59e0b" : "#22c55e";
  const label = pct >= 60 ? "고위험" : pct >= 30 ? "주의" : "관찰";
  const peakLabel = new Date(peakTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-lg font-bold px-4 py-1 rounded-full"
        style={{ color, background: `${color}20`, border: `1px solid ${color}50` }}>
        {label}
      </span>
      <p className="text-[11px] text-slate-400">
        최고 위험 예상 <span className="font-semibold" style={{ color }}>{peakLabel}</span>
      </p>
    </div>
  );
}

function GridCounts({ forecast, inline }: { forecast: RiskForecastResult; inline?: boolean }) {
  const counts = forecast.risk_grid.features.reduce(
    (acc, f) => {
      const lvl = (f.properties as RiskGridCellProperties).risk_level as RiskLevel;
      acc[lvl] = (acc[lvl] ?? 0) + 1;
      return acc;
    },
    {} as Record<RiskLevel, number>,
  );
  if (inline) {
    return (
      <>
        {(["고위험", "주의", "관찰"] as RiskLevel[]).map((lvl) => (
          <span key={lvl} className="flex items-center gap-1 shrink-0">
            <span className="text-slate-500 whitespace-nowrap">{lvl}</span>
            <span className="font-mono font-semibold whitespace-nowrap" style={{ color: RISK_COLOR[lvl] }}>
              {counts[lvl] ?? 0}셀
            </span>
          </span>
        ))}
      </>
    );
  }
  return (
    <>
      {(["고위험", "주의", "관찰"] as RiskLevel[]).map((lvl) => (
        <div key={lvl} className="flex justify-between gap-4">
          <span className="text-slate-500">{lvl}</span>
          <span className="font-mono font-semibold" style={{ color: RISK_COLOR[lvl] }}>
            {counts[lvl] ?? 0}셀
          </span>
        </div>
      ))}
    </>
  );
}

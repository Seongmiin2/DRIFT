import { useEffect, useMemo, useState } from "react";
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

const HOTSPOT_STYLE: Record<HotspotZone, L.PathOptions> = {
  "사고다발구역": { color: "#6d28d9", fillColor: "#7c3aed", fillOpacity: 0.50, weight: 2, dashArray: "5,4", opacity: 0.85 },
  "주의구역":    { color: "#8b5cf6", fillColor: "#a78bfa", fillOpacity: 0.25, weight: 1.5, dashArray: "4,4", opacity: 0.70 },
};

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

  // 해역 변경 시 API 호출
  useEffect(() => {
    setRiskForecast(null);
    setError(null);
    setLoading(true);
    api.getRiskForecast({ area_name: selectedArea })
      .then(setRiskForecast)
      .catch((e) => setError(e?.message ?? "서버 연결 실패"))
      .finally(() => setLoading(false));
  }, [selectedArea]);

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

  // 선택 해역 bbox 내 사고다발구역 필터링
  const areaHotspots = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!showHotspots || !allHotspots) return null;
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const features = allHotspots.features.filter((f) => {
      const coords = (f.geometry as GeoJSON.Polygon).coordinates[0];
      const cx = (coords[0][0] + coords[2][0]) / 2;
      const cy = (coords[0][1] + coords[2][1]) / 2;
      return cx >= minLon && cx <= maxLon && cy >= minLat && cy <= maxLat;
    });
    return { type: "FeatureCollection", features };
  }, [allHotspots, showHotspots, selectedArea]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">

        {/* ── 좌측 패널 ──────────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 bg-navy-900 border-r border-navy-700 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-navy-700">
            <h2 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-3">
              해역 선택
            </h2>
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
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 text-center">
                <p className="text-xs text-slate-400 mb-2">Drift Risk Index</p>
                <DriGauge score={riskForecast.dri_score} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "최대 풍속", value: `${riskForecast.max_wind_speed_ms} m/s` },
                  { label: "최대 파고", value: `${riskForecast.max_wave_height_m} m` },
                  { label: "위험 선박", value: `${riskForecast.vessels_at_risk_count}척` },
                  { label: "고위험 면적", value: `${riskForecast.high_risk_area_km2} km²` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-navy-800 border border-navy-700 rounded p-2">
                    <p className="text-slate-500">{label}</p>
                    <p className="text-cyan-300 font-mono font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              {/* 위험 요인 */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">위험 요인</p>
                {riskForecast.risk_causes.map((cause, i) => (
                  <div key={i} className="bg-navy-800 border border-navy-700 rounded p-2.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: RISK_COLOR[cause.severity] }} />
                      <span className="text-xs font-semibold text-slate-300">{cause.factor}</span>
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          color: RISK_COLOR[cause.severity],
                          background: `${RISK_COLOR[cause.severity]}20`,
                        }}>
                        {cause.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{cause.description}</p>
                  </div>
                ))}
              </div>

              {/* 권고 조치 */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">권고 조치</p>
                {riskForecast.recommended_actions.map((action) => (
                  <div key={action.priority}
                    className="flex items-start gap-2 bg-navy-800 border border-navy-700 rounded p-2.5">
                    <span className={[
                      "shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center",
                      action.priority === 1 ? "bg-red-500 text-white"
                        : action.priority === 2 ? "bg-amber-500 text-white"
                        : "bg-navy-600 text-slate-300",
                    ].join(" ")}>{action.priority}</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-300">{action.action}</p>
                      <p className="text-[11px] text-slate-500">{action.target}</p>
                    </div>
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

            {filteredForecast && (
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

            {/* 사고다발구역 레이어 */}
            {areaHotspots && areaHotspots.features.length > 0 && (
              <GeoJSON
                key={`hotspots-${selectedArea}-${showHotspots}`}
                data={areaHotspots as unknown as GeoJSON.FeatureCollection}
                style={(feature) => {
                  const zone = (feature?.properties as HotspotProperties).zone;
                  return (HOTSPOT_STYLE[zone] ?? HOTSPOT_STYLE["주의구역"]) as PathOptions;
                }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties as HotspotProperties;
                  const fatalInfo = p.fatal_count > 0 ? ` · 사망·실종 ${p.fatal_count}명` : "";
                  layer.bindTooltip(
                    `<b>${p.zone}</b><br/>2011–2023년 ${p.accident_count}건${fatalInfo}<br/>주요 원인: ${p.dominant_cause}<br/>주요 유형: ${p.dominant_type}`,
                    { className: "risk-tooltip", sticky: true },
                  );
                }}
              />
            )}
          </MapContainer>

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

          {/* 위험 등급 범례 */}
          <div className="absolute top-3 right-3 bg-navy-900/90 border border-navy-700 rounded-lg p-3 text-xs z-[1000] min-w-[148px]">
            <p className="text-slate-400 font-medium mb-2">해양경보 등급</p>
            {(["고위험", "주의", "관찰"] as RiskLevel[]).map((lvl) => (
              <div key={lvl} className="flex items-center gap-2 mb-1.5">
                <span className="w-4 h-3 rounded-sm border"
                  style={{
                    background: HEATMAP_STYLE[lvl].fillColor as string,
                    borderColor: HEATMAP_STYLE[lvl].color as string,
                    opacity: 1,
                  }} />
                <span className="text-slate-300">{lvl}</span>
              </div>
            ))}
            {filteredForecast && (
              <div className="mt-2 pt-2 border-t border-navy-700 space-y-0.5">
                <GridCounts forecast={filteredForecast} />
              </div>
            )}

            {/* 사고 이력 레이어 토글 */}
            <div className="mt-2 pt-2 border-t border-navy-700">
              <button
                onClick={() => setShowHotspots((v) => !v)}
                className="flex items-center gap-1.5 w-full text-left mb-1.5 hover:opacity-80 transition-opacity"
              >
                <span className="text-slate-400 font-medium">과거 사고 이력</span>
                <span className={[
                  "ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold",
                  showHotspots
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "bg-navy-600 text-slate-500 border border-navy-500",
                ].join(" ")}>
                  {showHotspots ? "ON" : "OFF"}
                </span>
              </button>
              {showHotspots && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-4 h-3 rounded-sm border border-violet-700 shrink-0"
                      style={{ background: "#7c3aed", opacity: 0.85 }} />
                    <span className="text-slate-400">사고다발구역</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-3 rounded-sm border border-violet-400 shrink-0"
                      style={{ background: "#a78bfa", opacity: 0.60 }} />
                    <span className="text-slate-400">주의구역</span>
                  </div>
                  {areaHotspots && (
                    <p className="text-slate-600 mt-1.5 text-[10px]">
                      {areaHotspots.features.filter(f => (f.properties as HotspotProperties).zone === "사고다발구역").length}개 다발 ·{" "}
                      {areaHotspots.features.filter(f => (f.properties as HotspotProperties).zone === "주의구역").length}개 주의
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <DisclaimerBanner />
    </div>
  );
}

// ── 서브 컴포넌트 ───────────────────────────────────────────────────────────

function DriGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 60 ? "#ef4444" : pct >= 30 ? "#f59e0b" : "#22c55e";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="60" viewBox="0 0 100 60">
        <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#1e3a6e" strokeWidth="10" strokeLinecap="round" />
        <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={`${(pct / 100) * 125.7} 125.7`} />
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center">
        <span className="text-2xl font-bold font-mono" style={{ color }}>{pct}</span>
        <span className="text-[10px] text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

function GridCounts({ forecast }: { forecast: RiskForecastResult }) {
  const counts = forecast.risk_grid.features.reduce(
    (acc, f) => {
      const lvl = (f.properties as RiskGridCellProperties).risk_level as RiskLevel;
      acc[lvl] = (acc[lvl] ?? 0) + 1;
      return acc;
    },
    {} as Record<RiskLevel, number>,
  );
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

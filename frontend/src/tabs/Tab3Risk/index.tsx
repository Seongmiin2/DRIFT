import { useEffect, useMemo, useState } from "react";
import { api } from "@/api";
import { DriftMap } from "@/map/MapProvider";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { RiskLevel, RiskGridCellProperties, RiskForecastResult } from "@/types/contracts";
import { SEA_AREAS } from "@/api/risk/seaAreas";
import { loadKoreaGeoJSON, isOnLand } from "@/map/landMask";

const RISK_COLORS: Record<RiskLevel, string> = {
  고위험: "#ef4444",
  주의: "#f59e0b",
  관찰: "#22c55e",
};

const AREA_NAMES = Object.keys(SEA_AREAS);

export function Tab3Risk() {
  const [selectedArea, setSelectedArea] = useState(AREA_NAMES[0]);
  const [riskForecast, setRiskForecast] = useState<RiskForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [landReady, setLandReady] = useState(false);

  useEffect(() => {
    setRiskForecast(null);
    setLoading(true);
    api.getRiskForecast({ area_name: selectedArea })
      .then(setRiskForecast)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedArea]);

  useEffect(() => {
    loadKoreaGeoJSON().then(() => setLandReady(true)).catch(console.error);
  }, []);

  // Filter out grid cells whose center falls on land
  const filteredForecast = useMemo<RiskForecastResult | null>(() => {
    if (!riskForecast) return null;
    if (!landReady) return riskForecast;
    const seaFeatures = riskForecast.risk_grid.features.filter((f) => {
      const coords = (f.geometry as GeoJSON.Polygon).coordinates[0];
      const centerLon = (coords[0][0] + coords[2][0]) / 2;
      const centerLat = (coords[0][1] + coords[2][1]) / 2;
      return !isOnLand(centerLon, centerLat);
    });
    return { ...riskForecast, risk_grid: { ...riskForecast.risk_grid, features: seaFeatures } };
  }, [riskForecast, landReady]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ──────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 bg-navy-900 border-r border-navy-700 flex flex-col overflow-y-auto">

          {/* Area selector */}
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

          {/* DRI gauge + stats */}
          {riskForecast && !loading && (
            <div className="p-4 flex flex-col gap-4">
              {/* DRI gauge */}
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 text-center">
                <p className="text-xs text-slate-400 mb-2">Drift Risk Index (DRI)</p>
                <DriGauge score={riskForecast.dri_score} />
                <p className="text-xs text-slate-500 mt-1">
                  상위 {riskForecast.dri_percentile.toFixed(0)}% 위험도
                </p>
              </div>

              {/* Key stats */}
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

              {/* Time window */}
              <div className="text-xs border border-navy-700 rounded-lg p-3 bg-navy-800 space-y-1.5">
                <p className="font-semibold text-slate-300 mb-1">예측 시간대</p>
                <TimeRow label="시작"
                  time={riskForecast.time_range_start}
                  color="text-slate-300" />
                <TimeRow label="종료"
                  time={riskForecast.time_range_end}
                  color="text-slate-300" />
                <TimeRow label="최고 위험"
                  time={riskForecast.peak_risk_time}
                  color="text-red-400" />
                {riskForecast.tidal_reversal_time && (
                  <TimeRow label="조류 반전"
                    time={riskForecast.tidal_reversal_time}
                    color="text-amber-400" />
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </aside>

        {/* ── Map + right panel ────────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">

            {/* Map */}
            <div className="flex-1 relative">
              {loading ? (
                <div className="h-full bg-navy-900 flex items-center justify-center text-slate-500 text-sm">
                  <svg className="animate-spin h-8 w-8 text-cyan-400 mr-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  해역 데이터 로딩 중…
                </div>
              ) : filteredForecast ? (
                <>
                  <RiskMap forecast={filteredForecast} />

                  {/* Risk legend overlay */}
                  <div className="absolute top-3 right-3 bg-navy-900/90 border border-navy-700 rounded-lg p-3 text-xs z-[1000]">
                    <p className="text-slate-400 font-medium mb-2">위험 등급</p>
                    {(["고위험", "주의", "관찰"] as RiskLevel[]).map((level) => (
                      <div key={level} className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-sm border"
                          style={{ borderColor: RISK_COLORS[level], backgroundColor: `${RISK_COLORS[level]}30` }} />
                        <span className="text-slate-400">{level}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {/* Right panel: risk causes + recommended actions */}
            {riskForecast && !loading && (
              <aside className="w-72 shrink-0 border-l border-navy-700 bg-navy-900 flex flex-col overflow-y-auto p-4 gap-5">

                {/* Risk cause chart */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    위험 요인
                  </h3>
                  <RiskCauseChart causes={riskForecast.risk_causes} />
                </div>

                {/* Recommended actions */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    권고 조치
                  </h3>
                  <div className="space-y-2">
                    {riskForecast.recommended_actions.map((action) => (
                      <div key={action.priority}
                        className="flex items-start gap-3 bg-navy-800 border border-navy-700 rounded p-3">
                        <span className={[
                          "shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center",
                          action.priority === 1 ? "bg-red-500 text-white"
                            : action.priority === 2 ? "bg-amber-500 text-white"
                            : "bg-navy-600 text-slate-300",
                        ].join(" ")}>{action.priority}</span>
                        <div>
                          <p className="text-xs font-semibold text-slate-300">{action.action}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{action.target}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grid cell counts (sea cells only after land filter) */}
                {filteredForecast && <RiskSummaryBadges forecast={filteredForecast} />}
              </aside>
            )}
          </div>
        </div>
      </div>
      <DisclaimerBanner />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DriGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? "#ef4444" : pct >= 40 ? "#f59e0b" : "#22c55e";
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

function TimeRow({ label, time, color }: { label: string; time: string; color: string }) {
  const d = new Date(time);
  const t = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono font-semibold ${color}`}>{t}</span>
    </div>
  );
}

function RiskMap({ forecast }: { forecast: RiskForecastResult }) {
  const bbox = forecast.bbox;
  const centerLon = (bbox[0] + bbox[2]) / 2;
  const centerLat = (bbox[1] + bbox[3]) / 2;

  const riskMapZones = {
    type: "FeatureCollection" as const,
    features: forecast.risk_grid.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        priority: ((p: RiskGridCellProperties) =>
          p.risk_level === "고위험" ? 1 : p.risk_level === "주의" ? 2 : 3
        )(f.properties as RiskGridCellProperties) as 1 | 2 | 3,
        cumulative_probability: (f.properties as RiskGridCellProperties).dri_score,
        area_km2: 0,
        center_lon: centerLon,
        center_lat: centerLat,
        radius_km: 0,
      },
    })),
  };

  return (
    <DriftMap
      center={[centerLon, centerLat]}
      zoom={9}
      searchZones={riskMapZones}
      className="h-full w-full"
    />
  );
}

function RiskCauseChart({ causes }: { causes: RiskForecastResult["risk_causes"] }) {
  const data = causes.map((c) => ({
    name: c.factor,
    value: c.severity === "고위험" ? 3 : c.severity === "주의" ? 2 : 1,
    color: RISK_COLORS[c.severity],
    severity: c.severity,
    description: c.description,
  }));

  return (
    <>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" domain={[0, 3]} tick={false} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={65} tick={{ fill: "#94a3b8", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: "#0f2040", border: "1px solid #1e3a6e", borderRadius: 4 }}
            formatter={(_: unknown, __: string, props: { payload?: { severity?: string; description?: string } }) =>
              [props.payload?.severity ?? "", props.payload?.description ?? ""]}
          />
          <Bar dataKey="value" radius={2}>
            {data.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-2">
        {causes.map((cause, i) => (
          <div key={i} className="bg-navy-800 border border-navy-700 rounded p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: RISK_COLORS[cause.severity] }} />
              <span className="text-xs font-semibold text-slate-300">{cause.factor}</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded border"
                style={{
                  color: RISK_COLORS[cause.severity],
                  borderColor: `${RISK_COLORS[cause.severity]}40`,
                  background: `${RISK_COLORS[cause.severity]}10`,
                }}>
                {cause.severity}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{cause.description}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function RiskSummaryBadges({ forecast }: { forecast: RiskForecastResult }) {
  const counts = forecast.risk_grid.features.reduce(
    (acc, f) => {
      const lvl = (f.properties as RiskGridCellProperties).risk_level;
      acc[lvl] = (acc[lvl] ?? 0) + 1;
      return acc;
    },
    {} as Record<RiskLevel, number>,
  );

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-lg p-3">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">그리드 셀 분포</p>
      <div className="flex gap-3">
        {(["고위험", "주의", "관찰"] as RiskLevel[]).map((lvl) => (
          <div key={lvl} className="text-center">
            <span className="text-xl font-bold font-mono" style={{ color: RISK_COLORS[lvl] }}>
              {counts[lvl] ?? 0}
            </span>
            <p className="text-[10px] text-slate-500">{lvl}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

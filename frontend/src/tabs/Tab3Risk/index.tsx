import { useEffect } from "react";
import { useSarStore } from "@/store/sarStore";
import { api } from "@/api";
import { DriftMap } from "@/map/MapProvider";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { RiskLevel, RiskGridCellProperties } from "@/types/contracts";

const RISK_COLORS: Record<RiskLevel, string> = {
  고위험: "#ef4444",
  주의: "#f59e0b",
  관찰: "#22c55e",
};

export function Tab3Risk() {
  const { riskForecast, setRiskForecast } = useSarStore();

  useEffect(() => {
    if (riskForecast) return;
    api.getRiskForecast().then(setRiskForecast).catch(console.error);
  }, [riskForecast, setRiskForecast]);

  if (!riskForecast) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-slate-500">
        <svg className="animate-spin h-8 w-8 text-cyan-400 mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm">위험 예측 로딩 중...</p>
      </div>
    );
  }

  const bbox = riskForecast.bbox;
  const centerLon = (bbox[0] + bbox[2]) / 2;
  const centerLat = (bbox[1] + bbox[3]) / 2;

  const driGaugePercent = Math.round(riskForecast.dri_score * 100);
  const driColor =
    driGaugePercent >= 70 ? "#ef4444" : driGaugePercent >= 40 ? "#f59e0b" : "#22c55e";

  const causeData = riskForecast.risk_causes.map((c) => ({
    name: c.factor,
    value: c.severity === "고위험" ? 3 : c.severity === "주의" ? 2 : 1,
    color: RISK_COLORS[c.severity],
    severity: c.severity,
    description: c.description,
  }));

  // Build risk map with colored zones
  const riskMapZones = {
    type: "FeatureCollection" as const,
    features: riskForecast.risk_grid.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        // Map to SearchZoneProperties-compatible shape for the map
        priority: ((props: RiskGridCellProperties) =>
          props.risk_level === "고위험" ? 1 : props.risk_level === "주의" ? 2 : 3
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
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <aside className="w-72 shrink-0 bg-navy-900 border-r border-navy-700 flex flex-col overflow-y-auto p-4 gap-5">
          <div>
            <h2 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-1">
              선제 위험 예측
            </h2>
            <p className="text-xs text-slate-500">{riskForecast.area_name}</p>
          </div>

          {/* DRI Gauge */}
          <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 text-center">
            <p className="text-xs text-slate-400 mb-2">Drift Risk Index (DRI)</p>
            <div className="relative inline-flex items-center justify-center">
              <svg width="100" height="60" viewBox="0 0 100 60">
                <path
                  d="M 10 55 A 40 40 0 0 1 90 55"
                  fill="none"
                  stroke="#1e3a6e"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <path
                  d="M 10 55 A 40 40 0 0 1 90 55"
                  fill="none"
                  stroke={driColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(driGaugePercent / 100) * 125.7} 125.7`}
                />
              </svg>
              <div className="absolute bottom-0 flex flex-col items-center">
                <span className="text-2xl font-bold font-mono" style={{ color: driColor }}>
                  {driGaugePercent}
                </span>
                <span className="text-[10px] text-slate-500">/ 100</span>
              </div>
            </div>
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
              <div
                key={label}
                className="bg-navy-800 border border-navy-700 rounded p-2"
              >
                <p className="text-slate-500">{label}</p>
                <p className="text-cyan-300 font-mono font-semibold">{value}</p>
              </div>
            ))}
          </div>

          {/* Time window */}
          <div className="text-xs space-y-1 border border-navy-700 rounded-lg p-3 bg-navy-800">
            <p className="font-semibold text-slate-300 mb-2">예측 시간대</p>
            <div className="flex justify-between">
              <span className="text-slate-500">시작</span>
              <span className="text-slate-300 font-mono">
                {new Date(riskForecast.time_range_start).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">종료</span>
              <span className="text-slate-300 font-mono">
                {new Date(riskForecast.time_range_end).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 text-red-400">최고 위험</span>
              <span className="text-red-400 font-mono font-semibold">
                {new Date(riskForecast.peak_risk_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {riskForecast.tidal_reversal_time && (
              <div className="flex justify-between">
                <span className="text-slate-500">조류 반전</span>
                <span className="text-amber-400 font-mono">
                  {new Date(riskForecast.tidal_reversal_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* Map + right panel */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {/* Map */}
            <div className="flex-1 relative">
              <DriftMap
                center={[centerLon, centerLat]}
                zoom={9}
                searchZones={riskMapZones}
                className="h-full w-full"
              />

              {/* Risk legend overlay */}
              <div className="absolute top-3 right-3 bg-navy-900/90 border border-navy-700 rounded-lg p-3 text-xs z-[1000]">
                <p className="text-slate-400 font-medium mb-2">위험 등급</p>
                {(["고위험", "주의", "관찰"] as RiskLevel[]).map((level) => (
                  <div key={level} className="flex items-center gap-2 mb-1">
                    <span
                      className="w-3 h-3 rounded-sm border"
                      style={{
                        borderColor: RISK_COLORS[level],
                        backgroundColor: `${RISK_COLORS[level]}30`,
                      }}
                    />
                    <span className="text-slate-400">{level}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel: causes + actions */}
            <aside className="w-72 shrink-0 border-l border-navy-700 bg-navy-900 flex flex-col overflow-y-auto p-4 gap-5">
              {/* Risk causes chart */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  위험 요인
                </h3>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={causeData} layout="vertical">
                    <XAxis type="number" domain={[0, 3]} tick={false} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "#0f2040", border: "1px solid #1e3a6e", borderRadius: 4 }}
                      labelStyle={{ color: "#cbd5e1" }}
                      formatter={(_: unknown, __: string, props: { payload?: { severity?: string; description?: string } }) => [
                        props.payload?.severity ?? "",
                        props.payload?.description ?? "",
                      ]}
                    />
                    <Bar dataKey="value" radius={2}>
                      {causeData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-3 space-y-2">
                  {riskForecast.risk_causes.map((cause, i) => (
                    <div key={i} className="bg-navy-800 border border-navy-700 rounded p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: RISK_COLORS[cause.severity] }}
                        />
                        <span className="text-xs font-semibold text-slate-300">
                          {cause.factor}
                        </span>
                        <span
                          className="ml-auto text-[10px] px-1.5 py-0.5 rounded border"
                          style={{
                            color: RISK_COLORS[cause.severity],
                            borderColor: `${RISK_COLORS[cause.severity]}40`,
                            background: `${RISK_COLORS[cause.severity]}10`,
                          }}
                        >
                          {cause.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {cause.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended actions */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  권고 조치
                </h3>
                <div className="space-y-2">
                  {riskForecast.recommended_actions.map((action) => (
                    <div
                      key={action.priority}
                      className="flex items-start gap-3 bg-navy-800 border border-navy-700 rounded p-3"
                    >
                      <span
                        className={[
                          "shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center",
                          action.priority === 1
                            ? "bg-red-500 text-white"
                            : action.priority === 2
                            ? "bg-amber-500 text-white"
                            : "bg-navy-600 text-slate-300",
                        ].join(" ")}
                      >
                        {action.priority}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-slate-300">
                          {action.action}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {action.target}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <DisclaimerBanner />
    </div>
  );
}

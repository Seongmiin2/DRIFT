import { useSarStore } from "@/store/sarStore";
import { api } from "@/api";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { DriftMap } from "@/map/MapProvider";
import type { EnginePredictionResult, BriefingResult } from "@/types/contracts";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Tooltip, ResponsiveContainer,
} from "recharts";

const SECTION_ICONS = ["📍", "📊", "🗺️", "⛅"];

const DIRS16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function deg2compass(deg: number) {
  return DIRS16[Math.round(((deg % 360) + 360) / 22.5) % 16];
}
function windLabel(ms: number) {
  if (ms >= 20) return { t: "폭풍", c: "#ef4444" };
  if (ms >= 13) return { t: "강풍", c: "#f97316" };
  if (ms >= 8)  return { t: "중풍", c: "#eab308" };
  return { t: "약풍", c: "#22c55e" };
}

// ── Environment card ───────────────────────────────────────────────────────

function EnvCard({ label, value, sub, color = "#22d3ee" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-lg p-3 flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-base font-bold font-mono" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px] text-slate-500">{sub}</span>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function Tab2Briefing() {
  const {
    prediction, predictionRequest,
    briefing, setBriefing,
    isBriefingLoading, setIsBriefingLoading,
    setActiveTab,
  } = useSarStore();

  const handleGenerate = async () => {
    if (!prediction) return;
    setIsBriefingLoading(true);
    try {
      const result = await api.createBriefing(prediction.request_id);
      setBriefing(result);
    } finally {
      setIsBriefingLoading(false);
    }
  };

  // ── No prediction yet ──────────────────────────────────────────────────
  if (!prediction) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4 text-slate-500">
        <span className="text-5xl opacity-20">📋</span>
        <div className="text-center">
          <p className="font-medium text-slate-400 mb-1">표류 예측이 없습니다</p>
          <p className="text-sm text-slate-600">
            먼저{" "}
            <button onClick={() => setActiveTab("incident")} className="text-cyan-400 underline">
              실시간 조난 대응
            </button>{" "}
            탭에서 예측을 실행하세요
          </p>
        </div>
      </div>
    );
  }

  // ── Prediction exists, no briefing yet ────────────────────────────────
  if (!briefing) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <BriefingLayout
          prediction={prediction}
          predictionRequest={predictionRequest}
          briefing={null}
          onGenerate={handleGenerate}
          isLoading={isBriefingLoading}
        />
      </div>
    );
  }

  // ── Full briefing ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <BriefingLayout
        prediction={prediction}
        predictionRequest={predictionRequest}
        briefing={briefing}
        onGenerate={handleGenerate}
        isLoading={isBriefingLoading}
      />
      <DisclaimerBanner text={briefing.disclaimer} />
    </div>
  );
}

// ── Layout (shared between no-briefing and briefing states) ───────────────

function BriefingLayout({
  prediction, predictionRequest, briefing, onGenerate, isLoading,
}: {
  prediction: EnginePredictionResult;
  predictionRequest: ReturnType<typeof useSarStore>["predictionRequest"];
  briefing: BriefingResult | null;
  onGenerate: () => void;
  isLoading: boolean;
}) {
  const dv = prediction.drift_vector;
  const { t: wLabel, c: wColor } = windLabel(dv.wind_speed_ms);

  // Radar data — 6 normalized axes
  const zone1 = prediction.search_zones.features.find((f) => f.properties.priority === 1);
  const radarData = [
    { subject: "위험도",   value: briefing?.risk_score ?? 0 },
    { subject: "풍속",     value: Math.min(Math.round((dv.wind_speed_ms / 20) * 100), 100) },
    { subject: "조류속도", value: Math.min(Math.round((dv.current_speed_knots / 3) * 100), 100) },
    { subject: "표류속도", value: Math.min(Math.round((dv.speed_knots / 5) * 100), 100) },
    { subject: "수색반경", value: Math.min(Math.round(((zone1?.properties.radius_km ?? 5) / 15) * 100), 100) },
    { subject: "L3신뢰",  value: Math.min(Math.round(((prediction.similar_incidents_count ?? 0) / 50) * 100), 100) },
  ];

  const riskColor = briefing
    ? briefing.risk_score >= 70 ? "#ef4444" : briefing.risk_score >= 40 ? "#f59e0b" : "#22c55e"
    : "#94a3b8";

  // Last known → map center
  const origin = predictionRequest.last_coordinate;
  const mapCenter: [number, number] = [
    prediction.predicted_center.lon,
    prediction.predicted_center.lat,
  ];

  // Incident time label
  const incidentTime = predictionRequest.last_seen_at
    ? new Date(predictionRequest.last_seen_at).toLocaleString("ko-KR", {
        month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Main scrollable area ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-y-auto">

        {/* ── Operational map ──────────────────────────────────────── */}
        <div className="shrink-0" style={{ height: 220 }}>
          <DriftMap
            center={mapCenter}
            zoom={10}
            searchZones={prediction.search_zones}
            predictedCenter={prediction.predicted_center}
            lastKnownPosition={origin}
            className="h-full w-full"
          />
        </div>

        <div className="p-5 flex flex-col gap-5">

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-100 mb-0.5">AI 작전 브리핑</h2>
              {briefing && (
                <p className="text-xs text-slate-500">
                  생성: {new Date(briefing.generated_at).toLocaleString("ko-KR")}
                </p>
              )}
            </div>
            {briefing && (
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 mb-0.5">위험도</p>
                  <div className="text-3xl font-bold font-mono" style={{ color: riskColor }}>
                    {briefing.risk_score}
                    <span className="text-sm text-slate-400">/100</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 mb-0.5">신뢰도</p>
                  <span className={[
                    "text-sm font-semibold px-2 py-1 rounded border",
                    briefing.confidence_label === "높음"
                      ? "text-green-400 border-green-400/30 bg-green-400/10"
                      : briefing.confidence_label === "보통"
                      ? "text-amber-400 border-amber-400/30 bg-amber-400/10"
                      : "text-red-400 border-red-400/30 bg-red-400/10",
                  ].join(" ")}>{briefing.confidence_label}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── 사건 및 환경 요약 cards ──────────────────────────────── */}
          <div>
            <h3 className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">사건 및 환경 요약</h3>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <EnvCard
                label="선종"
                value={predictionRequest.vessel_type ?? "—"}
                sub={predictionRequest.vessel_id ?? undefined}
              />
              <EnvCard
                label="최종 신호 시각"
                value={incidentTime}
                sub={origin
                  ? `${origin.lat.toFixed(4)}°N  ${origin.lon.toFixed(4)}°E`
                  : undefined}
                color="#f59e0b"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <EnvCard
                label="풍속"
                value={`${dv.wind_speed_ms.toFixed(1)} m/s`}
                sub={`${wLabel} · ${deg2compass(dv.wind_direction_deg)}`}
                color={wColor}
              />
              <EnvCard
                label="조류속도"
                value={`${dv.current_speed_knots.toFixed(2)} kt`}
                sub={deg2compass(dv.current_direction_deg)}
                color="#a78bfa"
              />
              <EnvCard
                label="표류 방향"
                value={`${dv.direction_deg.toFixed(0)}°`}
                sub={deg2compass(dv.direction_deg)}
              />
              <EnvCard
                label="표류 속도"
                value={`${dv.speed_knots.toFixed(2)} kt`}
                sub="합성 벡터"
              />
            </div>
          </div>

          {/* ── 예측 결과 카드 ───────────────────────────────────────── */}
          <div>
            <h3 className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">표류 예측 결과</h3>
            <div className="grid grid-cols-4 gap-2">
              <EnvCard
                label="예측 중심"
                value={`${prediction.predicted_center.lat.toFixed(4)}°N`}
                sub={`${prediction.predicted_center.lon.toFixed(4)}°E`}
              />
              <EnvCard
                label="1순위 구역"
                value={`${((zone1?.properties.cumulative_probability ?? 0.6) * 100).toFixed(0)}%`}
                sub={`${zone1?.properties.area_km2.toFixed(1)} km²`}
                color="#ef4444"
              />
              <EnvCard
                label="L3 보정"
                value={prediction.l3_correction_applied ? "적용" : "미적용"}
                sub={prediction.l3_correction_applied
                  ? `유사 ${prediction.similar_incidents_count ?? 0}건`
                  : undefined}
                color={prediction.l3_correction_applied ? "#22c55e" : "#64748b"}
              />
              <EnvCard
                label="데이터"
                value={prediction.data_freshness_ok ? "실시간" : "백업"}
                sub={`${prediction.current_data_source} · ${prediction.weather_data_source}`}
                color={prediction.data_freshness_ok ? "#22c55e" : "#f59e0b"}
              />
            </div>
          </div>

          {/* ── Generate button (no briefing yet) ───────────────────── */}
          {!briefing && (
            <div className="flex flex-col items-center py-6 gap-4">
              <p className="text-xs text-slate-500">
                AI가 위 데이터를 분석하여 작전 브리핑을 생성합니다
              </p>
              <button
                onClick={onGenerate}
                disabled={isLoading}
                className="px-6 py-2.5 rounded bg-cyan-400 text-navy-950 font-semibold text-sm hover:bg-cyan-300 shadow-glow disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    브리핑 생성 중 (~1분)
                  </span>
                ) : "브리핑 생성하기"}
              </button>
            </div>
          )}

          {/* ── AI narrative sections ────────────────────────────────── */}
          {briefing && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {briefing.sections.map((section, i) => (
                <div key={section.section_id} className="bg-navy-800 border border-navy-700 rounded-lg p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">{SECTION_ICONS[i]}</span>
                    <p className="text-sm font-semibold text-slate-200 leading-tight">
                      {section.title}
                    </p>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{section.body}</p>
                  {section.sources && section.sources.length > 0 && (
                    <div className="flex gap-1 mt-3">
                      {section.sources.map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {briefing?.pdf_url && (
            <a href={briefing.pdf_url} target="_blank" rel="noopener noreferrer"
              className="self-start px-4 py-2 rounded border border-cyan-400/40 text-cyan-400 text-sm hover:bg-cyan-400/10 transition-colors">
              PDF 보고서 다운로드 ↗
            </a>
          )}
        </div>
      </div>

      {/* ── Right sidebar ───────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-l border-navy-700 flex flex-col overflow-y-auto bg-navy-900 p-4 gap-5">
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            환경 분석 지표
          </h3>
          <ResponsiveContainer width="100%" height={230}>
            <RadarChart data={radarData} outerRadius={68}>
              <PolarGrid stroke="#1e3a6e" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="지표" dataKey="value"
                stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.25}
                dot={{ fill: "#00d4ff", strokeWidth: 0, r: 3 }} />
              <Tooltip
                contentStyle={{ background: "#0f2040", border: "1px solid #1e3a6e", borderRadius: 4 }}
                formatter={(v: number) => [`${v}`, "상대지수"]} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-navy-800 border border-navy-700 rounded-lg p-3 text-xs space-y-2">
          <p className="font-semibold text-slate-300">엔진 정보</p>
          <div className="flex justify-between">
            <span className="text-slate-500">데이터 소스</span>
            <span className="text-slate-300 text-[10px]">
              {prediction.current_data_source} · {prediction.weather_data_source}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">유사 사건</span>
            <span className="text-slate-300">{prediction.similar_incidents_count ?? 0}건</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">파티클 수</span>
            <span className="text-slate-300">{(prediction.particle_count ?? 1000).toLocaleString()}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

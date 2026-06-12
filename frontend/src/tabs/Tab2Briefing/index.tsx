import { useIncidentStore } from "@/store/incidentStore";
import { api } from "@/api";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { DriftMap } from "@/map/MapProvider";
import type { EnginePredictionResult, BriefingResult, PredictionRequest } from "@/types/contracts";

const DIRS16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function deg2compass(deg: number) {
  return DIRS16[Math.round(((deg % 360) + 360) / 22.5) % 16];
}
function windMeta(ms: number): { label: string; color: string } {
  if (ms >= 20) return { label: "폭풍", color: "#ef4444" };
  if (ms >= 13) return { label: "강풍", color: "#f97316" };
  if (ms >= 8)  return { label: "중풍", color: "#eab308" };
  return { label: "약풍", color: "#22c55e" };
}

const SECTION_META = [
  { num: "01", color: "#ef4444", bg: "#ef444415", border: "#ef444430" },
  { num: "02", color: "#3b82f6", bg: "#3b82f615", border: "#3b82f630" },
  { num: "03", color: "#22d3ee", bg: "#22d3ee12", border: "#22d3ee30" },
  { num: "04", color: "#f59e0b", bg: "#f59e0b12", border: "#f59e0b30" },
];

// ── Small data row ─────────────────────────────────────────────────────────

function DataRow({ label, value, sub, color = "#e2e8f0" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-navy-700/50 last:border-0">
      <span className="text-[11px] text-slate-500 shrink-0">{label}</span>
      <div className="text-right">
        <span className="text-xs font-mono font-semibold" style={{ color }}>{value}</span>
        {sub && <span className="block text-[10px] text-slate-600">{sub}</span>}
      </div>
    </div>
  );
}

// ── Section card (AI briefing) ─────────────────────────────────────────────

function SectionCard({
  section, meta,
}: {
  section: BriefingResult["sections"][number];
  meta: typeof SECTION_META[number];
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{ background: meta.bg, borderColor: meta.border }}
    >
      <div className="flex items-start gap-4 mb-3">
        <span
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: meta.color, color: "#0a1628" }}
        >
          {meta.num}
        </span>
        <p className="text-sm font-semibold text-slate-100 leading-snug pt-1">
          {section.title}
        </p>
      </div>
      <p className="text-[13px] text-slate-400 leading-relaxed">{section.body}</p>
      {section.sources && section.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {section.sources.map((s) => (
            <span
              key={s}
              className="text-[10px] px-2 py-0.5 rounded border font-mono"
              style={{ color: meta.color, borderColor: meta.border }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner({ small }: { small?: boolean }) {
  return (
    <svg
      className={`animate-spin text-cyan-400 ${small ? "h-4 w-4" : "h-5 w-5"}`}
      fill="none" viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function Tab2Briefing() {
  const {
    prediction, predictionRequest,
    briefing, setBriefing,
    isBriefingLoading, setIsBriefingLoading,
    setActiveTab,
  } = useIncidentStore();

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

  if (!prediction) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4 text-slate-500">
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <BriefingLayout
        prediction={prediction}
        predictionRequest={predictionRequest}
        briefing={briefing}
        onGenerate={handleGenerate}
        isLoading={isBriefingLoading}
      />
      {briefing && <DisclaimerBanner text={briefing.disclaimer} />}
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────

function BriefingLayout({
  prediction, predictionRequest, briefing, onGenerate, isLoading,
}: {
  prediction: EnginePredictionResult;
  predictionRequest: Partial<PredictionRequest>;
  briefing: BriefingResult | null;
  onGenerate: () => void;
  isLoading: boolean;
}) {
  const dv = prediction.drift_vector;
  const { label: wLabel, color: wColor } = windMeta(dv.wind_speed_ms);
  const origin = predictionRequest.last_coordinate;

  const mapCenter: [number, number] = [
    prediction.predicted_center.lon,
    prediction.predicted_center.lat,
  ];

  const incidentTime = predictionRequest.last_seen_at
    ? new Date(predictionRequest.last_seen_at).toLocaleString("ko-KR", {
        month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

  const zone1 = prediction.search_zones.features.find((f) => f.properties.priority === 1);
  const zone2 = prediction.search_zones.features.find((f) => f.properties.priority === 2);
  const zone3 = prediction.search_zones.features.find((f) => f.properties.priority === 3);

  const riskScore = briefing?.risk_score ?? null;
  const riskColor = riskScore !== null
    ? riskScore >= 70 ? "#ef4444" : riskScore >= 40 ? "#f59e0b" : "#22c55e"
    : "#64748b";

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Left sidebar ─────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-navy-700 bg-navy-900 flex flex-col overflow-y-auto">

        {/* Operational map */}
        <div className="shrink-0 border-b border-navy-700" style={{ height: 200 }}>
          <DriftMap
            center={mapCenter}
            zoom={10}
            searchZones={prediction.search_zones}
            predictedCenter={prediction.predicted_center}
            lastKnownPosition={origin}
            className="h-full w-full"
          />
        </div>

        <div className="flex flex-col gap-4 p-4 overflow-y-auto">

          {/* Incident overview */}
          <section>
            <h3 className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              사건 개요
            </h3>
            <DataRow label="선종" value={predictionRequest.vessel_type ?? "—"} />
            {predictionRequest.vessel_id && (
              <DataRow label="선박 ID" value={predictionRequest.vessel_id} color="#94a3b8" />
            )}
            <DataRow
              label="최종 신호"
              value={incidentTime}
              color="#f59e0b"
            />
            {origin && (
              <DataRow
                label="실종 좌표"
                value={`${origin.lat.toFixed(4)}°N`}
                sub={`${origin.lon.toFixed(4)}°E`}
                color="#f59e0b"
              />
            )}
            <DataRow
              label="예측 위치"
              value={`${prediction.predicted_center.lat.toFixed(4)}°N`}
              sub={`${prediction.predicted_center.lon.toFixed(4)}°E`}
            />
          </section>

          {/* Environmental conditions */}
          <section>
            <h3 className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              환경 조건
            </h3>
            <DataRow
              label="풍속"
              value={`${dv.wind_speed_ms.toFixed(1)} m/s`}
              sub={`${wLabel} · ${deg2compass(dv.wind_direction_deg)}`}
              color={wColor}
            />
            <DataRow
              label="조류"
              value={`${dv.current_speed_knots.toFixed(2)} kt`}
              sub={deg2compass(dv.current_direction_deg)}
              color="#a78bfa"
            />
            <DataRow
              label="표류 방향"
              value={`${dv.direction_deg.toFixed(0)}° ${deg2compass(dv.direction_deg)}`}
            />
            <DataRow
              label="표류 속도"
              value={`${dv.speed_knots.toFixed(2)} kt`}
            />
            <DataRow
              label="L3 보정"
              value={prediction.l3_correction_applied ? "적용" : "미적용"}
              color={prediction.l3_correction_applied ? "#22c55e" : "#64748b"}
              sub={prediction.l3_correction_applied
                ? `유사 ${prediction.similar_incidents_count ?? 0}건`
                : undefined}
            />
          </section>

          {/* Search zone summary */}
          <section>
            <h3 className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              수색 구역
            </h3>
            {[
              { label: "1순위", zone: zone1, color: "#ef4444" },
              { label: "2순위", zone: zone2, color: "#f97316" },
              { label: "3순위", zone: zone3, color: "#eab308" },
            ].map(({ label, zone, color }) => {
              if (!zone) return null;
              const prob = Math.round(zone.properties.cumulative_probability * 100);
              return (
                <div key={label} className="flex items-center gap-2 py-1.5 border-b border-navy-700/50 last:border-0">
                  <span className="text-[10px] font-semibold w-10 shrink-0" style={{ color }}>
                    {label}
                  </span>
                  <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${prob}%`, background: color }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 w-8 text-right">
                    {prob}%
                  </span>
                </div>
              );
            })}
            {zone1 && (
              <p className="text-[10px] text-slate-600 mt-1.5">
                1순위 면적 {zone1.properties.area_km2.toFixed(1)} km²
              </p>
            )}
          </section>

          {/* Engine metadata */}
          <section>
            <h3 className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              데이터 소스
            </h3>
            <DataRow
              label="해류"
              value={prediction.current_data_source ?? "—"}
              color="#94a3b8"
            />
            <DataRow
              label="기상"
              value={prediction.weather_data_source ?? "—"}
              color="#94a3b8"
            />
            <DataRow
              label="데이터 상태"
              value={prediction.data_freshness_ok ? "실시간" : "백업"}
              color={prediction.data_freshness_ok ? "#22c55e" : "#f59e0b"}
            />
          </section>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Status header */}
        <div className="sticky top-0 z-10 bg-navy-950 border-b border-navy-700 px-6 py-3 flex items-center gap-4">
          <div className="flex-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              AI 작전 브리핑
            </span>
            {briefing && (
              <span className="ml-3 text-[11px] text-slate-600">
                생성: {new Date(briefing.generated_at).toLocaleString("ko-KR")}
              </span>
            )}
          </div>
          {briefing && (
            <div className="flex items-center gap-5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">위험도</span>
                <span className="text-2xl font-bold font-mono" style={{ color: riskColor }}>
                  {briefing.risk_score}
                </span>
                <span className="text-slate-600 text-xs">/100</span>
              </div>
              <span className={[
                "text-xs font-semibold px-2.5 py-1 rounded border",
                briefing.confidence_label === "높음"
                  ? "text-green-400 border-green-400/30 bg-green-400/10"
                  : briefing.confidence_label === "보통"
                  ? "text-amber-400 border-amber-400/30 bg-amber-400/10"
                  : "text-red-400 border-red-400/30 bg-red-400/10",
              ].join(" ")}>
                신뢰도 {briefing.confidence_label}
              </span>
            </div>
          )}
          <div className="text-[11px] font-mono text-slate-600 shrink-0">
            ID: {prediction.request_id.slice(0, 8)}
          </div>
        </div>

        <div className="p-6">

          {/* ── No briefing: generate prompt ───────────────────────── */}
          {!briefing && (
            <div className="flex flex-col gap-6">
              {/* Summary cards while waiting */}
              <div>
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  표류 예측 요약
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    {
                      label: "예측 중심",
                      value: `${prediction.predicted_center.lat.toFixed(4)}°N`,
                      sub: `${prediction.predicted_center.lon.toFixed(4)}°E`,
                      color: "#22d3ee",
                    },
                    {
                      label: "1순위 확률",
                      value: `${Math.round((zone1?.properties.cumulative_probability ?? 0.6) * 100)}%`,
                      sub: `${zone1?.properties.area_km2.toFixed(1) ?? "—"} km²`,
                      color: "#ef4444",
                    },
                    {
                      label: "표류 속도",
                      value: `${dv.speed_knots.toFixed(2)} kt`,
                      sub: `방향 ${dv.direction_deg.toFixed(0)}°`,
                      color: "#22d3ee",
                    },
                    {
                      label: "예측 시간",
                      value: `${prediction.time_horizon_hours}시간`,
                      sub: `파티클 ${(prediction.particle_count ?? 1000).toLocaleString()}개`,
                      color: "#22d3ee",
                    },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} className="bg-navy-800 border border-navy-700 rounded-lg p-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{label}</p>
                      <p className="text-lg font-bold font-mono" style={{ color }}>{value}</p>
                      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center py-10 gap-4 border border-dashed border-navy-600 rounded-xl">
                <div className="text-center mb-2">
                  <p className="text-sm font-semibold text-slate-300 mb-1">
                    AI 작전 브리핑 생성
                  </p>
                  <p className="text-xs text-slate-500">
                    표류 예측 데이터를 분석하여 수색 작전 브리핑을 작성합니다
                  </p>
                </div>
                <button
                  onClick={onGenerate}
                  disabled={isLoading}
                  className="px-8 py-3 rounded-lg bg-cyan-400 text-navy-950 font-bold text-sm hover:bg-cyan-300 shadow-glow disabled:opacity-50 transition-all"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2.5">
                      <Spinner small />
                      브리핑 생성 중…
                    </span>
                  ) : "브리핑 생성하기"}
                </button>
              </div>
            </div>
          )}

          {/* ── Briefing sections ───────────────────────────────────── */}
          {briefing && (
            <div className="flex flex-col gap-4">
              {briefing.sections.map((section, i) => (
                <SectionCard
                  key={section.section_id}
                  section={section}
                  meta={SECTION_META[i] ?? SECTION_META[0]}
                />
              ))}
              {briefing.pdf_url && (
                <a
                  href={briefing.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start px-4 py-2 rounded border border-cyan-400/40 text-cyan-400 text-xs hover:bg-cyan-400/10 transition-colors mt-2"
                >
                  PDF 보고서 다운로드 ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

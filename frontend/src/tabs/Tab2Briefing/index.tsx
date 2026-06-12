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

// ── Layer color palette (L1–L4) ────────────────────────────────────────────

const LAYER_PALETTE: Record<string, { color: string; bg: string; border: string; label: string; desc: string }> = {
  L1: { color: "#3b82f6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.28)",  label: "물리 모델",   desc: "Leeway Physics" },
  L2: { color: "#a855f7", bg: "rgba(168,85,247,0.08)",  border: "rgba(168,85,247,0.28)",  label: "몬테카를로", desc: "Monte Carlo" },
  L3: { color: "#22c55e", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.28)",   label: "ML 보정",    desc: "Historical ML" },
  L4: { color: "#22d3ee", bg: "rgba(34,211,238,0.08)",  border: "rgba(34,211,238,0.28)",  label: "AI 브리핑",  desc: "LLM Report" },
};

const SECTION_META = [
  { num: "01", color: "#ef4444", bg: "#ef444412", border: "#ef444428" },
  { num: "02", color: "#3b82f6", bg: "#3b82f612", border: "#3b82f628" },
  { num: "03", color: "#22d3ee", bg: "#22d3ee10", border: "#22d3ee28" },
  { num: "04", color: "#f59e0b", bg: "#f59e0b10", border: "#f59e0b28" },
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

// ── 4-Layer Pipeline ───────────────────────────────────────────────────────

function LayerPipeline({
  prediction, briefing,
}: {
  prediction: EnginePredictionResult;
  briefing: BriefingResult | null;
}) {
  const dv = prediction.drift_vector;
  const zone1 = (prediction.search_zones.features as any[]).find((f) => f.properties.priority === 1);
  const prob1 = Math.round((zone1?.properties.cumulative_probability ?? 0.6) * 100);

  const wL1 = prediction.weight_l1 ?? 0.30;
  const wL2 = prediction.weight_l2 ?? 0.50;
  const wL3 = prediction.weight_l3 ?? 0.20;
  const dLat = prediction.l3_delta_lat ?? 0;
  const dLon = prediction.l3_delta_lon ?? 0;

  const layers: {
    id: string;
    rows: { k: string; v: string; highlight?: boolean }[];
    weight: number | null;
    active: boolean;
  }[] = [
    {
      id: "L1",
      weight: wL1,
      active: true,
      rows: [
        { k: "표류 속도", v: `${dv.speed_knots.toFixed(2)} kt` },
        { k: "Leeway", v: `${(dv.leeway_coefficient * 100).toFixed(1)}%` },
        { k: "풍속", v: `${dv.wind_speed_ms.toFixed(1)} m/s`, highlight: dv.wind_speed_ms >= 13 },
        { k: "조류", v: `${dv.current_speed_knots.toFixed(2)} kt` },
      ],
    },
    {
      id: "L2",
      weight: wL2,
      active: true,
      rows: [
        { k: "파티클 수", v: `${(prediction.particle_count ?? 1000).toLocaleString()}개` },
        { k: "1순위 확률", v: `${prob1}%` },
        { k: "표류 방향", v: `${dv.direction_deg.toFixed(0)}° ${deg2compass(dv.direction_deg)}` },
      ],
    },
    {
      id: "L3",
      weight: wL3,
      active: prediction.l3_correction_applied,
      rows: [
        { k: "유사 사고", v: `${prediction.similar_incidents_count ?? 0}건` },
        { k: "보정 상태", v: prediction.l3_correction_applied ? "적용" : "미적용 (데이터 부족)", highlight: !prediction.l3_correction_applied },
        { k: "위치 보정", v: prediction.l3_correction_applied
            ? `Δ${dLat.toFixed(3)}° / ${dLon.toFixed(3)}°`
            : "—" },
      ],
    },
    {
      id: "L4",
      weight: null,
      active: !!briefing,
      rows: briefing
        ? [
            { k: "모델", v: briefing.model_used ?? "—" },
            { k: "위험도", v: `${briefing.risk_score} / 100` },
            { k: "신뢰도", v: briefing.confidence_label },
          ]
        : [{ k: "상태", v: "브리핑 미생성" }],
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          4-레이어 엔진 파이프라인
        </h3>
        <div className="flex-1 h-px bg-navy-700" />
        <span className="text-[9px] text-slate-600 font-mono">
          융합 가중치 L1 {Math.round(wL1*100)}% · L2 {Math.round(wL2*100)}% · L3 {Math.round(wL3*100)}%
        </span>
      </div>

      <div className="flex items-stretch gap-0">
        {layers.map((layer, idx) => {
          const pal = LAYER_PALETTE[layer.id];
          return (
            <div key={layer.id} className="flex items-stretch flex-1 min-w-0">
              {/* Card */}
              <div
                className="flex-1 rounded-lg border p-3 flex flex-col min-w-0 transition-all"
                style={{
                  background: layer.active ? pal.bg : "rgba(15,23,42,0.6)",
                  borderColor: layer.active ? pal.border : "rgba(51,65,85,0.4)",
                  opacity: layer.active ? 1 : 0.55,
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-2.5">
                  <span
                    className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
                    style={{
                      background: layer.active ? pal.color : "#334155",
                      color: layer.active ? "#0a1628" : "#64748b",
                    }}
                  >
                    {layer.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold truncate" style={{ color: layer.active ? pal.color : "#64748b" }}>
                      {pal.label}
                    </p>
                    <p className="text-[9px] text-slate-600 truncate">{pal.desc}</p>
                  </div>
                  {/* Status dot */}
                  <span
                    className="shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{ background: layer.active ? pal.color : "#334155" }}
                  />
                </div>

                {/* Stats */}
                <div className="flex flex-col gap-1 flex-1">
                  {layer.rows.map(({ k, v, highlight }) => (
                    <div key={k} className="flex items-baseline justify-between gap-1">
                      <span className="text-[9px] text-slate-600 shrink-0">{k}</span>
                      <span
                        className="text-[10px] font-mono font-semibold truncate text-right"
                        style={{ color: highlight ? "#f59e0b" : "#cbd5e1" }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Weight bar */}
                {layer.weight !== null && (
                  <div className="mt-2.5 pt-2 border-t" style={{ borderColor: pal.border }}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[9px] text-slate-600">융합 가중치</span>
                      <span className="text-[9px] font-mono font-bold" style={{ color: pal.color }}>
                        {Math.round(layer.weight * 100)}%
                      </span>
                    </div>
                    <div className="h-1 bg-navy-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.round(layer.weight * 100)}%`, background: pal.color }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Arrow connector */}
              {idx < layers.length - 1 && (
                <div className="flex items-center px-1.5 shrink-0 self-center">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2 7h10M8 3l4 4-4 4"
                      stroke={layers[idx].active ? "#475569" : "#1e293b"}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section card ───────────────────────────────────────────────────────────

function SectionCard({
  section, meta,
}: {
  section: BriefingResult["sections"][number];
  meta: typeof SECTION_META[number];
}) {
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ background: meta.bg, borderColor: meta.border }}
    >
      {/* Section header with layer badges */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 border-b"
        style={{ borderColor: meta.border, background: `${meta.color}08` }}
      >
        <span
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold font-mono"
          style={{ background: meta.color, color: "#0a1628" }}
        >
          {meta.num}
        </span>
        <p className="flex-1 text-sm font-semibold text-slate-100 leading-snug">{section.title}</p>

        {/* Layer source badges — prominent, color-coded */}
        {section.sources && section.sources.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[9px] text-slate-600 mr-0.5">기반</span>
            {section.sources.map((s) => {
              const pal = LAYER_PALETTE[s] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)" };
              return (
                <span
                  key={s}
                  className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border"
                  style={{ color: pal.color, background: pal.bg, borderColor: pal.border }}
                >
                  {s}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3.5">
        <p className="text-[13px] text-slate-400 leading-relaxed">{section.body}</p>
      </div>
    </div>
  );
}

// ── Engine status bar ─────────────────────────────────────────────────────

function StatusPill({
  label, value, dot, warn = false,
}: {
  label: string;
  value: string;
  dot?: "green" | "amber" | "red" | "dim";
  warn?: boolean;
}) {
  const dotColor = dot === "green" ? "#22c55e" : dot === "amber" ? "#f59e0b" : dot === "red" ? "#ef4444" : "#334155";
  return (
    <div
      className="flex items-center gap-1.5 shrink-0"
      style={warn ? { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 4, padding: "1px 6px" } : undefined}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />}
      <span className="text-slate-500">{label}</span>
      <span
        className="font-semibold"
        style={{ color: warn ? "#ef4444" : dot === "green" ? "#22c55e" : dot === "amber" ? "#f59e0b" : dot === "red" ? "#ef4444" : "#94a3b8" }}
      >
        {value}
      </span>
    </div>
  );
}

function Sep() {
  return <span className="text-navy-600 select-none shrink-0">·</span>;
}

function EngineStatusBar({
  prediction, briefing,
}: {
  prediction: EnginePredictionResult;
  briefing: BriefingResult | null;
}) {
  const khoa = prediction.current_data_source ?? "KHOA";
  const kma  = prediction.weather_data_source ?? "KMA";
  const fresh = prediction.data_freshness_ok;
  const l3Ok  = prediction.l3_correction_applied;
  const wL3   = prediction.weight_l3 ?? 0.20;
  const particles = prediction.particle_count ?? 1000;
  const ptok  = briefing?.prompt_tokens;
  const ctok  = briefing?.completion_tokens;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-navy-950 border-t border-navy-700 text-[10px] font-mono overflow-x-auto shrink-0">

      {/* API sources */}
      <StatusPill
        label={`${khoa} API`}
        value={fresh ? "정상" : "백업"}
        dot={fresh ? "green" : "amber"}
      />
      <Sep />
      <StatusPill
        label={`${kma} API`}
        value={fresh ? "정상" : "백업"}
        dot={fresh ? "green" : "amber"}
      />
      <Sep />

      {/* L2 particle count */}
      <StatusPill label="파티클" value={`${particles.toLocaleString()}개`} dot="dim" />
      <Sep />

      {/* L3 — highlight fallback prominently */}
      {l3Ok ? (
        <StatusPill
          label="L3 ML"
          value={`적용 · 가중치 ${Math.round(wL3 * 100)}%`}
          dot="green"
        />
      ) : (
        <StatusPill
          label="L3 FALLBACK"
          value={`가중치 0% — 유사 사례 부족`}
          dot="red"
          warn
        />
      )}

      {/* Token usage — only after briefing */}
      {briefing && ptok != null && ctok != null && (
        <>
          <Sep />
          <StatusPill
            label="토큰 사용"
            value={`입력 ${ptok.toLocaleString()} / 출력 ${ctok.toLocaleString()}`}
            dot="dim"
          />
        </>
      )}

      {/* Engine elapsed */}
      <Sep />
      <StatusPill label="엔진" value={`${prediction.elapsed_seconds.toFixed(1)}s`} dot="dim" />

      {/* Spacer + disclaimer condensed */}
      <div className="flex-1 min-w-4" />
      <span className="text-slate-700 shrink-0 hidden lg:block">
        최종 판단은 현장 지휘관 책임 하에 이루어져야 합니다
      </span>
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
      <EngineStatusBar prediction={prediction} briefing={briefing} />
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

  const zone1 = (prediction.search_zones.features as any[]).find((f) => f.properties.priority === 1);
  const zone2 = (prediction.search_zones.features as any[]).find((f) => f.properties.priority === 2);
  const zone3 = (prediction.search_zones.features as any[]).find((f) => f.properties.priority === 3);

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
            <DataRow label="최종 신호" value={incidentTime} color="#f59e0b" />
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

          {/* L1 환경 조건 */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono" style={{ background: LAYER_PALETTE.L1.color, color: "#0a1628" }}>L1</span>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">물리 입력</h3>
            </div>
            <DataRow label="풍속" value={`${dv.wind_speed_ms.toFixed(1)} m/s`} sub={`${wLabel} · ${deg2compass(dv.wind_direction_deg)}`} color={wColor} />
            <DataRow label="조류" value={`${dv.current_speed_knots.toFixed(2)} kt`} sub={deg2compass(dv.current_direction_deg)} color="#a78bfa" />
            <DataRow label="표류 방향" value={`${dv.direction_deg.toFixed(0)}° ${deg2compass(dv.direction_deg)}`} />
            <DataRow label="표류 속도" value={`${dv.speed_knots.toFixed(2)} kt`} />
            <DataRow label="Leeway 계수" value={`${(dv.leeway_coefficient * 100).toFixed(1)}%`} color={LAYER_PALETTE.L1.color} />
          </section>

          {/* L2/L3 수색 구역 */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono" style={{ background: LAYER_PALETTE.L2.color, color: "#0a1628" }}>L2</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono" style={{ background: LAYER_PALETTE.L3.color, color: "#0a1628" }}>L3</span>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">수색 구역</h3>
            </div>
            {[
              { label: "1순위", zone: zone1, color: "#ef4444" },
              { label: "2순위", zone: zone2, color: "#f97316" },
              { label: "3순위", zone: zone3, color: "#eab308" },
            ].map(({ label, zone, color }) => {
              if (!zone) return null;
              const prob = Math.round(zone.properties.cumulative_probability * 100);
              return (
                <div key={label} className="flex items-center gap-2 py-1.5 border-b border-navy-700/50 last:border-0">
                  <span className="text-[10px] font-semibold w-10 shrink-0" style={{ color }}>{label}</span>
                  <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${prob}%`, background: color }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 w-8 text-right">{prob}%</span>
                </div>
              );
            })}
            {zone1 && (
              <p className="text-[10px] text-slate-600 mt-1.5">1순위 면적 {zone1.properties.area_km2.toFixed(1)} km²</p>
            )}
            <div className="mt-2 pt-2 border-t border-navy-700/50">
              <DataRow
                label="L3 보정"
                value={prediction.l3_correction_applied ? "적용" : "미적용"}
                color={prediction.l3_correction_applied ? "#22c55e" : "#64748b"}
                sub={prediction.l3_correction_applied ? `유사 ${prediction.similar_incidents_count ?? 0}건` : undefined}
              />
            </div>
          </section>

          {/* Data sources */}
          <section>
            <h3 className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              데이터 소스
            </h3>
            <DataRow label="해류" value={prediction.current_data_source ?? "—"} color="#94a3b8" />
            <DataRow label="기상" value={prediction.weather_data_source ?? "—"} color="#94a3b8" />
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
                <span className="text-2xl font-bold font-mono" style={{ color: riskColor }}>{briefing.risk_score}</span>
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
              {briefing.pdf_url ? (
                <a
                  href={briefing.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-cyan-400/40 text-cyan-400 text-xs font-semibold hover:bg-cyan-400/10 transition-colors shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h8M8 3v7m-3-3 3 3 3-3" />
                    <path strokeLinecap="round" d="M2 13.5h12" />
                  </svg>
                  PDF 내보내기
                </a>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-navy-600 text-slate-600 text-xs font-semibold cursor-not-allowed shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h8M8 3v7m-3-3 3 3 3-3" />
                    <path strokeLinecap="round" d="M2 13.5h12" />
                  </svg>
                  PDF 내보내기
                </span>
              )}
            </div>
          )}
          <div className="text-[11px] font-mono text-slate-600 shrink-0">
            ID: {prediction.request_id.slice(0, 8)}
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6">

          {/* ── 4-Layer Pipeline ─────────────────────────────────────── */}
          <LayerPipeline prediction={prediction} briefing={briefing} />

          {/* ── Summary cards ────────────────────────────────────────── */}
          <div>
            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              표류 예측 요약
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "예측 중심", value: `${prediction.predicted_center.lat.toFixed(4)}°N`, sub: `${prediction.predicted_center.lon.toFixed(4)}°E`, color: "#22d3ee" },
                { label: "1순위 확률", value: `${Math.round((zone1?.properties.cumulative_probability ?? 0.6) * 100)}%`, sub: `${zone1?.properties.area_km2.toFixed(1) ?? "—"} km²`, color: "#ef4444" },
                { label: "표류 속도", value: `${dv.speed_knots.toFixed(2)} kt`, sub: `방향 ${dv.direction_deg.toFixed(0)}°`, color: "#22d3ee" },
                { label: "예측 시간", value: `${prediction.time_horizon_hours}시간`, sub: `파티클 ${(prediction.particle_count ?? 1000).toLocaleString()}개`, color: "#22d3ee" },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="bg-navy-800 border border-navy-700 rounded-lg p-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{label}</p>
                  <p className="text-lg font-bold font-mono" style={{ color }}>{value}</p>
                  {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Generate button ───────────────────────────────────────── */}
          {!briefing && (
            <div className="flex flex-col items-center py-10 gap-4 border border-dashed border-navy-600 rounded-xl">
              <div className="text-center mb-2">
                <p className="text-sm font-semibold text-slate-300 mb-1">L4 — AI 작전 브리핑 생성</p>
                <p className="text-xs text-slate-500">
                  L1·L2·L3 분석 결과를 LLM이 종합하여 수색 작전 브리핑을 작성합니다
                </p>
              </div>
              <button
                onClick={onGenerate}
                disabled={isLoading}
                className="px-8 py-3 rounded-lg bg-cyan-400 text-navy-950 font-bold text-sm hover:bg-cyan-300 shadow-glow disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2.5"><Spinner small />브리핑 생성 중…</span>
                ) : "브리핑 생성하기"}
              </button>
            </div>
          )}

          {/* ── Briefing sections ─────────────────────────────────────── */}
          {briefing && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono" style={{ background: LAYER_PALETTE.L4.color, color: "#0a1628" }}>L4</span>
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">AI 생성 브리핑 섹션</h3>
                <div className="flex-1 h-px bg-navy-700" />
                <span className="text-[9px] text-slate-600 font-mono">{briefing.model_used}</span>
              </div>
              {briefing.sections.map((section, i) => (
                <SectionCard
                  key={section.section_id}
                  section={section}
                  meta={SECTION_META[i] ?? SECTION_META[0]}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

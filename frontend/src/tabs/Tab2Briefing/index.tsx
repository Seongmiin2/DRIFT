import { useSarStore } from "@/store/sarStore";
import { api } from "@/api";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

const SECTION_ICONS = ["📍", "📊", "🗺️", "⛅"];
const SECTION_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];

export function Tab2Briefing() {
  const {
    prediction,
    briefing,
    setBriefing,
    isBriefingLoading,
    setIsBriefingLoading,
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

  if (!prediction) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4 text-slate-500">
        <span className="text-5xl opacity-20">📋</span>
        <div className="text-center">
          <p className="font-medium text-slate-400 mb-1">표류 예측이 없습니다</p>
          <p className="text-sm text-slate-600">
            먼저{" "}
            <button
              onClick={() => setActiveTab("incident")}
              className="text-cyan-400 underline"
            >
              실시간 조난 대응
            </button>{" "}
            탭에서 예측을 실행하세요
          </p>
        </div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-6">
        <div className="text-center">
          <p className="text-5xl mb-4 opacity-40">🤖</p>
          <p className="text-sm font-medium text-slate-300 mb-2">AI 작전 브리핑</p>
          <p className="text-xs text-slate-500 mb-6">
            GPT-4o가 예측 결과를 분석하여 운영 브리핑을 생성합니다
          </p>
          <button
            onClick={handleGenerate}
            disabled={isBriefingLoading}
            className="px-6 py-2.5 rounded bg-cyan-400 text-navy-950 font-semibold text-sm hover:bg-cyan-300 shadow-glow disabled:opacity-50 transition-all"
          >
            {isBriefingLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                브리핑 생성 중 (~1분)
              </span>
            ) : (
              "브리핑 생성하기"
            )}
          </button>
        </div>
      </div>
    );
  }

  const radarData = [
    { subject: "위험도", A: briefing.risk_score },
    { subject: "표류속도", A: prediction.drift_vector.speed_knots * 40 },
    { subject: "풍속", A: Math.min(prediction.drift_vector.wind_speed_ms * 5, 100) },
    { subject: "L3 신뢰", A: prediction.l3_correction_applied ? 80 : 20 },
    { subject: "데이터 신선도", A: prediction.data_freshness_ok ? 90 : 30 },
  ];

  const weightData = [
    { name: "L1 물리", value: Math.round((prediction.weight_l1 ?? 0.3) * 100) },
    { name: "L2 몬테카를로", value: Math.round((prediction.weight_l2 ?? 0.5) * 100) },
    { name: "L3 ML", value: Math.round((prediction.weight_l3 ?? 0.2) * 100) },
  ];

  const riskColor =
    briefing.risk_score >= 70
      ? "#ef4444"
      : briefing.risk_score >= 40
      ? "#f59e0b"
      : "#22c55e";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-y-auto p-6 gap-6">
          {/* Header row */}
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-100 mb-1">
                AI 작전 브리핑
              </h2>
              <p className="text-xs text-slate-500">
                요청 ID: {briefing.request_id} ·{" "}
                생성 시각:{" "}
                {new Date(briefing.generated_at).toLocaleString("ko-KR")} ·
                모델: {briefing.model_used ?? "gpt-4o"}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">위험도</p>
                <div
                  className="text-3xl font-bold font-mono"
                  style={{ color: riskColor }}
                >
                  {briefing.risk_score}
                  <span className="text-sm text-slate-400">/100</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">신뢰도</p>
                <span
                  className={[
                    "text-sm font-semibold px-2 py-1 rounded border",
                    briefing.confidence_label === "높음"
                      ? "text-green-400 border-green-400/30 bg-green-400/10"
                      : briefing.confidence_label === "보통"
                      ? "text-amber-400 border-amber-400/30 bg-amber-400/10"
                      : "text-red-400 border-red-400/30 bg-red-400/10",
                  ].join(" ")}
                >
                  {briefing.confidence_label}
                </span>
              </div>
            </div>
          </div>

          {/* 4 sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {briefing.sections.map((section, i) => (
              <div
                key={section.section_id}
                className="bg-navy-800 border border-navy-700 rounded-lg p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{SECTION_ICONS[i]}</span>
                  <div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: SECTION_COLORS[i] }}
                    >
                      SECTION {section.section_id}
                    </span>
                    <p className="text-sm font-semibold text-slate-200 leading-tight">
                      {section.title}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {section.body}
                </p>
                {section.sources && section.sources.length > 0 && (
                  <div className="flex gap-1 mt-3">
                    {section.sources.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {briefing.pdf_url && (
            <a
              href={briefing.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start px-4 py-2 rounded border border-cyan-400/40 text-cyan-400 text-sm hover:bg-cyan-400/10 transition-colors"
            >
              PDF 보고서 다운로드 ↗
            </a>
          )}
        </div>

        {/* Sidebar charts */}
        <aside className="w-72 shrink-0 border-l border-navy-700 flex flex-col overflow-y-auto bg-navy-900 p-4 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              분석 지표
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1e3a6e" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Radar
                  name="지표"
                  dataKey="A"
                  stroke="#00d4ff"
                  fill="#00d4ff"
                  fillOpacity={0.2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              모델 가중치
            </h3>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={weightData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#0f2040", border: "1px solid #1e3a6e", borderRadius: 4 }}
                  labelStyle={{ color: "#cbd5e1" }}
                  itemStyle={{ color: "#00d4ff" }}
                  formatter={(v: number) => [`${v}%`]}
                />
                <Bar dataKey="value" radius={2}>
                  {weightData.map((_, idx) => (
                    <Cell key={idx} fill={["#3b82f6", "#8b5cf6", "#22c55e"][idx]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-navy-800 border border-navy-700 rounded-lg p-3 text-xs space-y-2">
            <p className="font-semibold text-slate-300">엔진 정보</p>
            <div className="flex justify-between">
              <span className="text-slate-500">데이터 소스</span>
              <span className="text-slate-300">
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
            <div className="flex justify-between">
              <span className="text-slate-500">토큰 사용</span>
              <span className="text-slate-300">
                {briefing.prompt_tokens ?? "—"} / {briefing.completion_tokens ?? "—"}
              </span>
            </div>
          </div>
        </aside>
      </div>

      <DisclaimerBanner text={briefing.disclaimer} />
    </div>
  );
}

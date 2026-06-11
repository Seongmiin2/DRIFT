import { useSarStore } from "@/store/sarStore";
import { api } from "@/api";

const SECTION_ICONS = ["📍", "📊", "🗺️", "⛅"];

export function BriefingSidebar() {
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
      <div className="w-72 shrink-0 flex flex-col items-center justify-center bg-navy-900 border-l border-navy-700 p-6 text-center text-slate-500 text-sm gap-3">
        <span className="text-3xl opacity-30">📋</span>
        <p>표류 예측 실행 후<br />브리핑이 생성됩니다</p>
      </div>
    );
  }

  return (
    <aside className="w-72 shrink-0 flex flex-col bg-navy-900 border-l border-navy-700 overflow-y-auto">
      <div className="p-4 border-b border-navy-700">
        <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-1">
          AI 작전 브리핑
        </h3>
        {!briefing && (
          <button
            onClick={handleGenerate}
            disabled={isBriefingLoading}
            className="w-full mt-2 py-1.5 rounded text-xs font-medium bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 hover:bg-cyan-400/30 transition-colors disabled:opacity-50"
          >
            {isBriefingLoading ? "생성 중..." : "브리핑 생성"}
          </button>
        )}
      </div>

      {briefing ? (
        <div className="flex flex-col gap-0">
          <div className="flex items-center gap-3 px-4 py-3 bg-navy-800 border-b border-navy-700">
            <div className="flex flex-col flex-1">
              <span className="text-xs text-slate-400">위험도</span>
              <span
                className={[
                  "text-2xl font-bold font-mono",
                  briefing.risk_score >= 70
                    ? "text-red-400"
                    : briefing.risk_score >= 40
                    ? "text-amber-400"
                    : "text-green-400",
                ].join(" ")}
              >
                {briefing.risk_score}
                <span className="text-sm font-normal text-slate-400">/100</span>
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-slate-400">신뢰도</span>
              <span className="text-sm font-semibold text-cyan-300">
                {briefing.confidence_label}
              </span>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-navy-700">
            {briefing.sections.map((section, i) => (
              <div key={section.section_id} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span>{SECTION_ICONS[i]}</span>
                  <span className="text-xs font-semibold text-slate-300">
                    {section.title}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {section.body}
                </p>
                {section.sources && (
                  <div className="flex gap-1 mt-2">
                    {section.sources.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-500 border border-cyan-400/20"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-navy-700">
            <button
              onClick={() => setActiveTab("briefing")}
              className="w-full py-1.5 rounded text-xs font-medium bg-navy-700 text-slate-300 hover:bg-navy-600 transition-colors"
            >
              전체 브리핑 보기 →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-4 text-xs text-slate-500 space-y-3">
          <div className="space-y-1">
            <p className="text-slate-300 text-xs font-medium">예측 결과 요약</p>
            <p>요청 ID: <span className="font-mono text-cyan-400 text-[11px]">{prediction.request_id.substring(0, 8)}…</span></p>
            <p>표류 방향: <span className="text-slate-300">{prediction.drift_vector.direction_deg.toFixed(0)}°</span></p>
            <p>예측 중심: <span className="text-slate-300">{prediction.predicted_center.lat.toFixed(4)}°N, {prediction.predicted_center.lon.toFixed(4)}°E</span></p>
            <p>L3 보정: <span className="text-slate-300">{prediction.l3_correction_applied ? "적용됨" : "미적용"}</span></p>
          </div>
        </div>
      )}
    </aside>
  );
}

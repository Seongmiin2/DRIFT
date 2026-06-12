import { useSarStore } from "@/store/sarStore";

export function TimeSlider() {
  const { prediction, selectedTimeStepHour, setSelectedTimeStepHour } = useSarStore();

  if (!prediction) return null;

  const maxHours = prediction.time_horizon_hours;
  const currentStep = prediction.time_steps?.find(
    (s) => s.hours === selectedTimeStepHour
  );

  // Build hour labels: show every 4h
  const ticks = Array.from({ length: maxHours }, (_, i) => i + 1).filter(
    (h) => h === 1 || h % 4 === 0 || h === maxHours
  );

  const pct = ((selectedTimeStepHour - 1) / (maxHours - 1)) * 100;

  return (
    <div className="bg-navy-900 border-t border-navy-700 px-5 py-3">
      {/* Top row: label + time badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
          표류 예측 시간대
        </span>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {currentStep && (
            <>
              <span>
                표류거리&nbsp;
                <span className="font-mono text-cyan-400">
                  {currentStep.drift_distance_nm.toFixed(1)} NM
                </span>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                예측위치&nbsp;
                <span className="font-mono text-cyan-400">
                  {currentStep.predicted_center.lat.toFixed(4)}°N&nbsp;
                  {currentStep.predicted_center.lon.toFixed(4)}°E
                </span>
              </span>
            </>
          )}
        </div>
        <span className="text-sm font-mono font-bold text-cyan-400 bg-navy-800 border border-navy-600 rounded px-2 py-0.5">
          +{selectedTimeStepHour}h
        </span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min="1"
        max={maxHours}
        step="1"
        value={selectedTimeStepHour}
        onChange={(e) => setSelectedTimeStepHour(parseInt(e.target.value))}
        className="w-full accent-cyan-400 cursor-pointer"
      />

      {/* Tick labels */}
      <div className="relative h-4 mt-0.5">
        {ticks.map((h) => {
          const left = ((h - 1) / (maxHours - 1)) * 100;
          return (
            <span
              key={h}
              className="absolute text-[9px] text-slate-600 -translate-x-1/2"
              style={{ left: `${left}%` }}
            >
              {h}h
            </span>
          );
        })}
      </div>

      {/* Progress track (decorative) */}
      <div className="mt-1 h-0.5 bg-navy-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-cyan-400/40 rounded-full transition-all duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

import { useSarStore } from "@/store/sarStore";

export function TimeSlider() {
  const { prediction, selectedTimeStepHour, setSelectedTimeStepHour } = useSarStore();

  if (!prediction) return null;

  const maxHours = prediction.time_horizon_hours;
  const currentStep = prediction.time_steps?.find(
    (s) => s.hours === selectedTimeStepHour
  );

  return (
    <div className="bg-navy-900 border-t border-navy-700 px-4 py-3">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs text-slate-400 shrink-0">시간 슬라이더</span>
        <div className="flex-1">
          <input
            type="range"
            min="1"
            max={maxHours}
            step="1"
            value={selectedTimeStepHour}
            onChange={(e) => setSelectedTimeStepHour(parseInt(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </div>
        <span className="text-sm font-mono text-cyan-400 shrink-0 w-12 text-right">
          +{selectedTimeStepHour}h
        </span>
      </div>

      {currentStep && (
        <div className="flex gap-6 text-xs text-slate-400">
          <span>
            표류거리:{" "}
            <span className="text-cyan-300 font-mono">
              {currentStep.drift_distance_nm.toFixed(1)} NM
            </span>
          </span>
          <span>
            예측위치:{" "}
            <span className="text-cyan-300 font-mono">
              {currentStep.predicted_center.lat.toFixed(4)}°N{" "}
              {currentStep.predicted_center.lon.toFixed(4)}°E
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

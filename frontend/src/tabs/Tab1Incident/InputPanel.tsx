import { useState } from "react";
import { useIncidentStore } from "@/store/incidentStore";
import { api } from "@/api";
import type { VesselType } from "@/types/contracts";

const VESSEL_TYPES: VesselType[] = [
  "소형어선",
  "표준어선",
  "구명조끼착용자",
  "구명뗏목",
  "레저보트",
];

export function InputPanel() {
  const {
    predictionRequest,
    setPredictionRequest,
    setPrediction,
    setIsSubmitting,
    isSubmitting,
    setSelectedTimeStepHour,
  } = useIncidentStore();

  const [error, setError] = useState<string | null>(null);

  const initLon = predictionRequest.last_coordinate?.lon;
  const initLat = predictionRequest.last_coordinate?.lat;
  const [lonInput, setLonInput] = useState<string>(
    initLon != null && !isNaN(initLon) ? String(initLon) : ""
  );
  const [latInput, setLatInput] = useState<string>(
    initLat != null && !isNaN(initLat) ? String(initLat) : ""
  );

  const syncCoord = (lon: string, lat: string) => {
    const lonVal = parseFloat(lon);
    const latVal = parseFloat(lat);
    setPredictionRequest({
      last_coordinate:
        !isNaN(lonVal) && !isNaN(latVal)
          ? { lon: lonVal, lat: latVal }
          : undefined,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const defaultCoord = { lon: 124.372, lat: 37.959 };
      const actualCoord = predictionRequest.last_coordinate ?? defaultCoord;
      // Keep store in sync so Tab1 can render the marker/sector
      if (!predictionRequest.last_coordinate) {
        setPredictionRequest({ last_coordinate: actualCoord });
      }
      const req = {
        last_coordinate: actualCoord,
        last_seen_at:
          predictionRequest.last_seen_at ?? new Date().toISOString(),
        vessel_type: predictionRequest.vessel_type ?? "소형어선",
        vessel_id: predictionRequest.vessel_id ?? undefined,
        tonnage_tons: predictionRequest.tonnage_tons ?? undefined,
        simulation_hours: 24,
        notes: predictionRequest.notes ?? undefined,
      };
      const result = await api.createPrediction(req);
      setPrediction(result);
      setSelectedTimeStepHour(result.time_horizon_hours);
    } catch (err) {
      setError(err instanceof Error ? err.message : "예측 요청 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-4 bg-navy-900 border-r border-navy-700 w-72 shrink-0 overflow-y-auto"
    >
      <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
        조난 정보 입력
      </h2>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400">선박 ID (V-Pass)</label>
        <input
          type="text"
          placeholder="V-PASS-123456"
          value={predictionRequest.vessel_id ?? ""}
          onChange={(e) =>
            setPredictionRequest({ vessel_id: e.target.value || undefined })
          }
          className="input-field"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400">선종 *</label>
        <select
          value={predictionRequest.vessel_type ?? "소형어선"}
          onChange={(e) =>
            setPredictionRequest({ vessel_type: e.target.value as VesselType })
          }
          className="input-field"
          required
        >
          {VESSEL_TYPES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">경도 (°E) *</label>
          <input
            type="number"
            step="0.001"
            min="123"
            max="133"
            placeholder="124.372"
            value={lonInput}
            onChange={(e) => {
              setLonInput(e.target.value);
              syncCoord(e.target.value, latInput);
            }}
            className="input-field"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">위도 (°N) *</label>
          <input
            type="number"
            step="0.001"
            min="32"
            max="40"
            placeholder="37.959"
            value={latInput}
            onChange={(e) => {
              setLatInput(e.target.value);
              syncCoord(lonInput, e.target.value);
            }}
            className="input-field"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400">최종 확인 시각</label>
        <input
          type="datetime-local"
          value={
            predictionRequest.last_seen_at
              ? predictionRequest.last_seen_at.substring(0, 16)
              : ""
          }
          onChange={(e) =>
            setPredictionRequest({
              last_seen_at: e.target.value
                ? new Date(e.target.value).toISOString()
                : undefined,
            })
          }
          className="input-field"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400">총톤수 (GT)</label>
        <input
          type="number"
          step="0.1"
          min="0"
          placeholder="예: 29.0"
          value={predictionRequest.tonnage_tons ?? ""}
          onChange={(e) =>
            setPredictionRequest({
              tonnage_tons: e.target.value
                ? parseFloat(e.target.value)
                : undefined,
            })
          }
          className="input-field"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400">현장 메모</label>
        <textarea
          rows={2}
          placeholder="추가 상황 정보..."
          value={predictionRequest.notes ?? ""}
          onChange={(e) =>
            setPredictionRequest({ notes: e.target.value || undefined })
          }
          className="input-field resize-none"
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 rounded p-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={[
          "mt-auto w-full py-2.5 rounded text-sm font-semibold tracking-wide transition-all",
          isSubmitting
            ? "bg-navy-700 text-slate-500 cursor-not-allowed"
            : "bg-cyan-400 text-navy-950 hover:bg-cyan-300 shadow-glow",
        ].join(" ")}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            분석 중...
          </span>
        ) : (
          "표류 예측 실행"
        )}
      </button>
    </form>
  );
}

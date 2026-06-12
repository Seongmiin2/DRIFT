import { useIncidentStore } from "@/store/incidentStore";
import { DriftMap } from "@/map/MapProvider";
import { InputPanel } from "./InputPanel";
import { TimeSlider } from "./TimeSlider";
import { StatsBar } from "./StatsBar";
import { WeatherPanel } from "./WeatherPanel";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

const ZONE_LEGEND = [
  { color: "#ef4444", label: "1순위 (P≤60%)" },
  { color: "#f97316", label: "2순위 (P≤80%)" },
  { color: "#eab308", label: "3순위 (P≤95%)" },
];

export function Tab1Incident() {
  const { prediction, selectedTimeStepHour, predictionRequest } = useIncidentStore();

  const currentStep = prediction?.time_steps?.find(
    (s) => s.hours === selectedTimeStepHour
  );

  // Map center follows current time step prediction
  const mapCenter: [number, number] = prediction
    ? [
        currentStep?.predicted_center.lon ?? prediction.predicted_center.lon,
        currentStep?.predicted_center.lat ?? prediction.predicted_center.lat,
      ]
    : (() => {
        const lon = predictionRequest.last_coordinate?.lon;
        const lat = predictionRequest.last_coordinate?.lat;
        return [
          lon != null && !isNaN(lon) ? lon : 127.0,
          lat != null && !isNaN(lat) ? lat : 36.5,
        ] as [number, number];
      })();

  const searchZones = currentStep?.search_zones ?? prediction?.search_zones;
  const predictedCenter = currentStep?.predicted_center ?? prediction?.predicted_center;

  // Drift track: positions from t=1h up to selectedTimeStepHour
  const driftTrack = prediction?.time_steps
    ?.filter((s) => s.hours <= selectedTimeStepHour)
    .map((s) => s.predicted_center) ?? [];

  // Last known signal position — use store value or back-calculate from prediction
  const lastKnownPosition: { lat: number; lon: number } | undefined =
    predictionRequest.last_coordinate ??
    (prediction
      ? (() => {
          const dv = prediction.drift_vector;
          const h = prediction.time_horizon_hours;
          const nm = dv.speed_knots * h;
          const rad = (dv.direction_deg * Math.PI) / 180;
          const cosLat = Math.cos((prediction.predicted_center.lat * Math.PI) / 180);
          return {
            lat: prediction.predicted_center.lat - (nm * Math.cos(rad)) / 60,
            lon: prediction.predicted_center.lon - (nm * Math.sin(rad)) / (60 * cosLat),
          };
        })()
      : undefined);

  // Uncertainty sector: always show the full 24h cone regardless of slider position.
  // distanceNm = speed × 24h × 3.5 so the fan is visually prominent on the chart.
  const driftSector = prediction && lastKnownPosition
    ? {
        origin: lastKnownPosition,
        directionDeg: prediction.drift_vector.direction_deg,
        halfAngleDeg: 30,
        distanceNm: prediction.drift_vector.speed_knots * 24 * 3.5,
      }
    : undefined;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <InputPanel />

        {/* Map area */}
        <div className="flex flex-col flex-1 overflow-hidden relative">
          <div className="flex-1 relative">
            <DriftMap
              center={mapCenter}
              zoom={prediction ? 10 : 8}
              searchZones={searchZones}
              predictedCenter={predictedCenter}
              lastKnownPosition={lastKnownPosition}
              driftTrack={driftTrack}
              driftSector={driftSector}
              className="h-full w-full"
            />

            {/* Empty state overlay */}
            {!prediction && (
              <div className="absolute inset-0 flex items-center justify-center z-[999] pointer-events-none">
                <div className="text-center bg-navy-900/85 rounded-xl p-8 border border-navy-700 backdrop-blur-sm">
                  <p className="text-4xl mb-4 opacity-50">🌊</p>
                  <p className="text-sm font-medium text-slate-300 mb-1">표류 예측을 시작하세요</p>
                  <p className="text-xs text-slate-600">
                    좌측에서 조난 정보를 입력하고
                    <br />
                    [표류 예측 실행] 버튼을 클릭하세요
                  </p>
                </div>
              </div>
            )}

            {/* Zone legend */}
            {prediction && (
              <div className="absolute top-3 right-3 bg-navy-900/90 border border-navy-700 rounded-lg p-3 text-xs z-[1000]">
                <p className="text-slate-400 font-medium mb-2">수색 구역</p>
                {ZONE_LEGEND.map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-sm border"
                      style={{ borderColor: color, backgroundColor: `${color}30` }} />
                    <span className="text-slate-400">{label}</span>
                  </div>
                ))}
                <div className="border-t border-navy-700 mt-2 pt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 border-t-2 border-dashed border-cyan-400/50 inline-block" />
                    <span className="text-slate-500">표류 경로</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 border border-amber-400 inline-block" />
                    <span className="text-slate-500">최종 신호 위치</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {prediction && <TimeSlider />}
          {prediction && <StatsBar />}
        </div>

        <WeatherPanel />
      </div>
      <DisclaimerBanner />
    </div>
  );
}

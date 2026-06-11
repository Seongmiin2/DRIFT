import { useSarStore } from "@/store/sarStore";
import { DriftMap } from "@/map/MapProvider";
import { InputPanel } from "./InputPanel";
import { TimeSlider } from "./TimeSlider";
import { StatsBar } from "./StatsBar";
import { BriefingSidebar } from "./BriefingSidebar";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

const ZONE_LEGEND = [
  { color: "#ef4444", label: "1순위 (P≤60%)" },
  { color: "#f97316", label: "2순위 (P≤80%)" },
  { color: "#eab308", label: "3순위 (P≤95%)" },
];

export function Tab1Incident() {
  const { prediction, selectedTimeStepHour, predictionRequest } = useSarStore();

  const currentStep = prediction?.time_steps?.find(
    (s) => s.hours === selectedTimeStepHour
  );

  const mapCenter: [number, number] = prediction
    ? [
        currentStep?.predicted_center.lon ?? prediction.predicted_center.lon,
        currentStep?.predicted_center.lat ?? prediction.predicted_center.lat,
      ]
    : [
        predictionRequest.last_coordinate?.lon ?? 127.0,
        predictionRequest.last_coordinate?.lat ?? 36.5,
      ];

  const searchZones = currentStep?.search_zones ?? prediction?.search_zones;
  const predictedCenter =
    currentStep?.predicted_center ?? prediction?.predicted_center;

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
              className="h-full w-full"
            />

            {/* Empty state overlay */}
            {!prediction && (
              <div className="absolute inset-0 flex items-center justify-center z-[999] pointer-events-none">
                <div className="text-center bg-navy-900/85 rounded-xl p-8 border border-navy-700 backdrop-blur-sm">
                  <p className="text-4xl mb-4 opacity-50">🌊</p>
                  <p className="text-sm font-medium text-slate-300 mb-1">
                    표류 예측을 시작하세요
                  </p>
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
                    <span
                      className="w-3 h-3 rounded-sm border"
                      style={{
                        borderColor: color,
                        backgroundColor: `${color}30`,
                      }}
                    />
                    <span className="text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Model weights badge */}
            {prediction && (
              <div className="absolute bottom-3 left-3 bg-navy-900/90 border border-navy-700 rounded-lg p-2 text-[10px] z-[1000] font-mono text-slate-400">
                <span className="text-slate-500">가중치: </span>
                L1 {((prediction.weight_l1 ?? 0.3) * 100).toFixed(0)}% · L2{" "}
                {((prediction.weight_l2 ?? 0.5) * 100).toFixed(0)}% · L3{" "}
                {((prediction.weight_l3 ?? 0.2) * 100).toFixed(0)}%
              </div>
            )}
          </div>

          {prediction && <TimeSlider />}
          {prediction && <StatsBar />}
        </div>

        <BriefingSidebar />
      </div>
      <DisclaimerBanner />
    </div>
  );
}

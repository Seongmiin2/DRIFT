import { useSarStore } from "@/store/sarStore";

function StatItem({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2">
      <span className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</span>
      <span
        className={[
          "text-lg font-bold font-mono leading-tight",
          highlight ? "text-red-400" : "text-cyan-400",
        ].join(" ")}
      >
        {value}
      </span>
      {sub && <span className="text-[10px] text-slate-500">{sub}</span>}
    </div>
  );
}

export function StatsBar() {
  const { prediction, selectedTimeStepHour } = useSarStore();

  if (!prediction) return null;

  const { drift_vector } = prediction;
  const currentStep = prediction.time_steps?.find(
    (s) => s.hours === selectedTimeStepHour
  );
  const zone1 = prediction.search_zones.features.find(
    (f) => f.properties.priority === 1
  );

  const dirLabel = (deg: number) => {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(deg / 45) % 8];
  };

  return (
    <div className="flex items-stretch border-t border-navy-700 bg-navy-800 divide-x divide-navy-700">
      <StatItem
        label="표류 방향"
        value={`${drift_vector.direction_deg.toFixed(0)}°`}
        sub={dirLabel(drift_vector.direction_deg)}
      />
      <StatItem
        label="표류 속도"
        value={`${drift_vector.speed_knots.toFixed(2)} kt`}
        sub="합성 속도"
      />
      <StatItem
        label="풍속"
        value={`${drift_vector.wind_speed_ms.toFixed(1)} m/s`}
        sub={`${dirLabel(drift_vector.wind_direction_deg)} 방향`}
      />
      <StatItem
        label="조류"
        value={`${drift_vector.current_speed_knots.toFixed(2)} kt`}
        sub={`${dirLabel(drift_vector.current_direction_deg)} 방향`}
      />
      <StatItem
        label={`+${selectedTimeStepHour}h 표류거리`}
        value={`${(currentStep?.drift_distance_nm ?? prediction.drift_vector.speed_knots * selectedTimeStepHour).toFixed(1)} NM`}
      />
      <StatItem
        label="1순위 구역"
        value={`${((zone1?.properties.cumulative_probability ?? 0.6) * 100).toFixed(0)}%`}
        sub={`${zone1?.properties.area_km2.toFixed(1)} km²`}
        highlight={false}
      />
      <StatItem
        label="데이터 신선도"
        value={prediction.data_freshness_ok ? "정상" : "CSV"}
        sub={prediction.data_freshness_ok ? "실시간" : "백업 데이터"}
        highlight={!prediction.data_freshness_ok}
      />
    </div>
  );
}

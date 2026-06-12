import { useSarStore } from "@/store/sarStore";

// 8-point Unicode compass arrows
const DIR_ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
function dirArrow(deg: number) {
  return DIR_ARROWS[Math.round(((deg % 360) + 360) / 45) % 8];
}

const DIRS8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function dirLabel(deg: number) {
  return DIRS8[Math.round(((deg % 360) + 360) / 45) % 8];
}

function windBg(ms: number) {
  if (ms >= 20) return "rgba(239,68,68,0.08)";
  if (ms >= 13) return "rgba(249,115,22,0.08)";
  if (ms >= 8)  return "rgba(234,179,8,0.08)";
  return undefined;
}
function windTextColor(ms: number) {
  if (ms >= 20) return "#ef4444";
  if (ms >= 13) return "#f97316";
  if (ms >= 8)  return "#eab308";
  return "#22d3ee"; // cyan-400
}

interface StatItemProps {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  bg?: string;
}

function StatItem({ label, value, sub, valueColor, bg }: StatItemProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-4 py-2"
      style={bg ? { background: bg } : undefined}>
      <span className="text-[10px] text-slate-400 uppercase tracking-wider whitespace-nowrap">{label}</span>
      <span className="text-lg font-bold font-mono leading-tight"
        style={{ color: valueColor ?? "#22d3ee" }}>
        {value}
      </span>
      {sub && <span className="text-[10px] text-slate-500">{sub}</span>}
    </div>
  );
}

export function StatsBar() {
  const { prediction, selectedTimeStepHour } = useSarStore();

  if (!prediction) return null;

  const { drift_vector: dv } = prediction;
  const currentStep = prediction.time_steps?.find(
    (s) => s.hours === selectedTimeStepHour
  );
  const zone1 = prediction.search_zones.features.find(
    (f) => f.properties.priority === 1
  );

  return (
    <div className="flex items-stretch border-t border-navy-700 bg-navy-800 divide-x divide-navy-700">
      {/* Drift direction */}
      <StatItem
        label="표류 방향"
        value={`${dv.direction_deg.toFixed(0)}°`}
        sub={`${dirArrow(dv.direction_deg)} ${dirLabel(dv.direction_deg)}`}
      />

      {/* Drift speed */}
      <StatItem
        label="표류 속도"
        value={`${dv.speed_knots.toFixed(2)} kt`}
        sub="합성 벡터"
      />

      {/* Wind — severity-colored */}
      <StatItem
        label="풍속"
        value={`${dv.wind_speed_ms.toFixed(1)} m/s`}
        sub={`${dirArrow(dv.wind_direction_deg)} ${dirLabel(dv.wind_direction_deg)} ${dv.wind_direction_deg.toFixed(0)}°`}
        valueColor={windTextColor(dv.wind_speed_ms)}
        bg={windBg(dv.wind_speed_ms)}
      />

      {/* Current */}
      <StatItem
        label="조류"
        value={`${dv.current_speed_knots.toFixed(2)} kt`}
        sub={`${dirArrow(dv.current_direction_deg)} ${dirLabel(dv.current_direction_deg)} ${dv.current_direction_deg.toFixed(0)}°`}
        valueColor="#a78bfa"
      />

      {/* Drift distance at selected time */}
      <StatItem
        label={`+${selectedTimeStepHour}h 표류거리`}
        value={`${(currentStep?.drift_distance_nm ?? dv.speed_knots * selectedTimeStepHour).toFixed(1)} NM`}
      />

      {/* Zone 1 */}
      <StatItem
        label="1순위 구역"
        value={`${((zone1?.properties.cumulative_probability ?? 0.6) * 100).toFixed(0)}%`}
        sub={`${zone1?.properties.area_km2.toFixed(1)} km²`}
        valueColor="#ef4444"
      />

      {/* Data freshness */}
      <StatItem
        label="데이터"
        value={prediction.data_freshness_ok ? "실시간" : "백업"}
        sub={prediction.data_freshness_ok ? "✓ 정상" : "⚠ 오래된 데이터"}
        valueColor={prediction.data_freshness_ok ? "#22c55e" : "#f59e0b"}
      />
    </div>
  );
}

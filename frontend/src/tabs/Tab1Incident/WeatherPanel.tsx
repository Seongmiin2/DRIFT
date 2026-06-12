import { useIncidentStore } from "@/store/incidentStore";

// ── helpers ────────────────────────────────────────────────────────────────

const DIRS16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function deg2compass(deg: number) {
  return DIRS16[Math.round(((deg % 360) + 360) / 22.5) % 16];
}

function windMeta(ms: number): { color: string; label: string } {
  if (ms >= 20) return { color: "#ef4444", label: "폭풍" };
  if (ms >= 13) return { color: "#f97316", label: "강풍" };
  if (ms >= 8)  return { color: "#eab308", label: "중풍" };
  if (ms >= 3)  return { color: "#22c55e", label: "약풍" };
  return { color: "#94a3b8", label: "미풍" };
}

// ── SVG compass arrow (no defs/marker — draws arrowhead inline) ────────────

function CompassArrow({
  cx, cy, deg, length, color, dashed = false,
}: {
  cx: number; cy: number; deg: number; length: number; color: string; dashed?: boolean;
}) {
  const rad = ((deg - 90) * Math.PI) / 180;
  const tx = cx + length * Math.cos(rad);
  const ty = cy + length * Math.sin(rad);
  const HL = 8;
  const HW = 3.5;
  const bRad = rad + Math.PI;
  const bx = tx + HL * 0.65 * Math.cos(bRad);
  const by = ty + HL * 0.65 * Math.sin(bRad);
  const pRad = rad + Math.PI / 2;
  const pts = [
    `${tx.toFixed(2)},${ty.toFixed(2)}`,
    `${(bx + HW * Math.cos(pRad)).toFixed(2)},${(by + HW * Math.sin(pRad)).toFixed(2)}`,
    `${(bx - HW * Math.cos(pRad)).toFixed(2)},${(by - HW * Math.sin(pRad)).toFixed(2)}`,
  ].join(" ");
  return (
    <g>
      <line x1={cx} y1={cy} x2={bx.toFixed(2)} y2={by.toFixed(2)}
        stroke={color} strokeWidth="2.5"
        strokeDasharray={dashed ? "5 3" : undefined}
        strokeLinecap="round" />
      <polygon points={pts} fill={color} />
    </g>
  );
}

// ── Main compass widget ────────────────────────────────────────────────────

function WindCompass({
  windDeg, windMs, currentDeg,
}: {
  windDeg: number; windMs: number; currentDeg: number;
}) {
  const S = 168;
  const CX = S / 2;
  const CY = S / 2;
  const R = 63;
  const { color: wCol } = windMeta(windMs);

  const dxy = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  };

  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="mx-auto block">
      {/* Outer background */}
      <circle cx={CX} cy={CY} r={R + 19} fill="#06101f" stroke="#1e3a6e" strokeWidth="1.2" />

      {/* Concentric rings */}
      {[R * 0.28, R * 0.55, R].map((r, i) => (
        <circle key={i} cx={CX} cy={CY} r={r} fill="none"
          stroke="#1e3a5f"
          strokeWidth={r === R ? 0.8 : 0.4}
          strokeDasharray={r === R ? undefined : "2 4"} />
      ))}

      {/* Cardinal & diagonal crosshairs */}
      {[0, 45, 90, 135].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const L = R + 14;
        return (
          <line key={deg}
            x1={(CX - L * Math.cos(rad)).toFixed(2)} y1={(CY - L * Math.sin(rad)).toFixed(2)}
            x2={(CX + L * Math.cos(rad)).toFixed(2)} y2={(CY + L * Math.sin(rad)).toFixed(2)}
            stroke="#1e3a5f" strokeWidth="0.4" />
        );
      })}

      {/* Tick marks — major (every 45°) and minor (every 22.5°) */}
      {Array.from({ length: 16 }).map((_, i) => {
        const { x: x1, y: y1 } = dxy(i * 22.5, R);
        const isMajor = i % 2 === 0;
        const { x: x2, y: y2 } = dxy(i * 22.5, R + (isMajor ? 7 : 4));
        return <line key={i} x1={x1.toFixed(2)} y1={y1.toFixed(2)}
          x2={x2.toFixed(2)} y2={y2.toFixed(2)}
          stroke={isMajor ? "#334155" : "#1e3a5f"} strokeWidth={isMajor ? 1.2 : 0.8} />;
      })}

      {/* Cardinal & intercardinal labels */}
      {["N","NE","E","SE","S","SW","W","NW"].map((label, i) => {
        const { x, y } = dxy(i * 45, R + 14);
        const isCardinal = label.length === 1;
        return (
          <text key={label} x={x.toFixed(2)} y={y.toFixed(2)}
            textAnchor="middle" dominantBaseline="central"
            fill={isCardinal ? "#64748b" : "#2d3f56"}
            fontSize={isCardinal ? 10 : 7.5}
            fontWeight={label === "N" ? "700" : "500"}
            fontFamily="monospace">
            {label}
          </text>
        );
      })}

      {/* Current direction (violet, dashed) */}
      <CompassArrow cx={CX} cy={CY} deg={currentDeg} length={R * 0.65} color="#a78bfa" dashed />

      {/* Wind direction (solid, severity-coded) */}
      <CompassArrow cx={CX} cy={CY} deg={windDeg} length={R * 0.87} color={wCol} />

      {/* Center dot */}
      <circle cx={CX} cy={CY} r={3.5} fill="#94a3b8" />
    </svg>
  );
}

// ── Speed bar ──────────────────────────────────────────────────────────────

function SpeedBar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div className="mt-2 h-1.5 bg-navy-700 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(ratio * 100, 100)}%`, background: color }} />
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

const ZONE_COLORS = ["#ef4444", "#f97316", "#eab308"];

export function WeatherPanel() {
  const { prediction } = useIncidentStore();

  if (!prediction) {
    return (
      <aside className="w-72 shrink-0 flex flex-col items-center justify-center bg-gradient-to-b from-navy-900 to-navy-950 border-l border-navy-700/70 p-6 text-center text-slate-500 text-sm gap-3">
        <span className="text-3xl opacity-20">🌊</span>
        <p>예측 실행 후<br />환경 조건이 표시됩니다</p>
      </aside>
    );
  }

  const {
    drift_vector: dv,
    search_zones,
    data_freshness_ok,
    current_data_source,
    weather_data_source,
  } = prediction;

  const { color: wCol, label: wLabel } = windMeta(dv.wind_speed_ms);
  const windKt = (dv.wind_speed_ms * 1.94384).toFixed(1);

  const sortedZones = [...search_zones.features].sort(
    (a, b) => a.properties.priority - b.properties.priority
  );

  return (
    <aside className="w-72 shrink-0 flex flex-col bg-gradient-to-b from-navy-900 to-navy-950 border-l border-navy-700/70 overflow-y-auto">

      {/* Header */}
      <div className="px-4 py-3 border-b border-navy-700/60 bg-navy-800/20">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,212,255,0.7)]" />
          <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">환경 조건</h3>
        </div>
      </div>

      {/* Compass */}
      <div className="px-3 pt-4 pb-3 border-b border-navy-700">
        <WindCompass
          windDeg={dv.wind_direction_deg}
          windMs={dv.wind_speed_ms}
          currentDeg={dv.current_direction_deg}
        />
        <div className="flex justify-center gap-6 mt-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-[2px] rounded" style={{ background: wCol }} />
            풍향·풍속
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-px" style={{ borderTop: "2px dashed #a78bfa" }} />
            조류
          </span>
        </div>
      </div>

      {/* Wind card */}
      <div className="px-4 py-3 border-b border-navy-700">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">풍속 / 풍향</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium"
            style={{ color: wCol, borderColor: `${wCol}50`, background: `${wCol}18` }}>
            {wLabel}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono" style={{ color: wCol }}>
            {dv.wind_speed_ms.toFixed(1)}
          </span>
          <span className="text-xs text-slate-400">m/s</span>
          <span className="text-xs text-slate-500">({windKt} kt)</span>
          <span className="ml-auto text-sm font-mono text-slate-300">
            {deg2compass(dv.wind_direction_deg)}&nbsp;{dv.wind_direction_deg.toFixed(0)}°
          </span>
        </div>
        <SpeedBar ratio={dv.wind_speed_ms / 25} color={wCol} />
      </div>

      {/* Current card */}
      <div className="px-4 py-3 border-b border-navy-700">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">조류 / 방향</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono text-violet-400">
            {dv.current_speed_knots.toFixed(2)}
          </span>
          <span className="text-xs text-slate-400">kt</span>
          <span className="ml-auto text-sm font-mono text-slate-300">
            {deg2compass(dv.current_direction_deg)}&nbsp;{dv.current_direction_deg.toFixed(0)}°
          </span>
        </div>
        <SpeedBar ratio={dv.current_speed_knots / 3} color="#a78bfa" />
      </div>

      {/* Drift vector */}
      <div className="px-4 py-3 border-b border-navy-700">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">표류 벡터 (합성)</span>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-cyan-400">
              {dv.speed_knots.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">kt</span>
          </div>
          <span className="text-sm font-mono text-slate-300">
            {deg2compass(dv.direction_deg)}&nbsp;{dv.direction_deg.toFixed(0)}°
          </span>
        </div>
      </div>

      {/* Search zones */}
      <div className="px-4 py-3 border-b border-navy-700">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">수색 구역</span>
        <div className="space-y-1.5">
          {sortedZones.map((f) => {
            const p = f.properties;
            const col = ZONE_COLORS[p.priority - 1];
            const pct = p.cumulative_probability * 100;
            return (
              <div key={p.priority}
                className="flex items-center gap-2 rounded-md p-2 border"
                style={{ borderColor: `${col}35`, background: `${col}0a` }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col }} />
                <span className="text-xs text-slate-400 w-10">{p.priority}순위</span>
                <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: col }} />
                </div>
                <span className="text-xs font-mono font-semibold w-8 text-right" style={{ color: col }}>
                  {pct.toFixed(0)}%
                </span>
                <span className="text-[10px] text-slate-500 w-14 text-right">
                  {p.area_km2.toFixed(1)} km²
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data source badge */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className={[
            "w-2 h-2 rounded-full shrink-0",
            data_freshness_ok ? "bg-green-400 animate-pulse" : "bg-amber-400",
          ].join(" ")} />
          <div>
            <p className="text-[11px] font-medium text-slate-300">
              {data_freshness_ok ? "실시간 데이터" : "백업 데이터"}
            </p>
            <p className="text-[10px] text-slate-500">
              {current_data_source} · {weather_data_source}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

import type { RiskForecastResult, RiskGridCellProperties, GeoJSONFeatureCollection } from "@/types/contracts";

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// ── Sea area definitions ───────────────────────────────────────────────────

type BBox4 = [number, number, number, number];

interface AreaDef {
  bbox: BBox4;
  maxWind: number;
  maxWave: number;
  baseDri: number;
  peakOffsetH: number;
}

const SEA_AREAS: Record<string, AreaDef> = {
  "연평도 인근 서해":  { bbox: [124.1, 37.6, 124.9, 38.3], maxWind: 16.2, maxWave: 1.9, baseDri: 0.78, peakOffsetH: 1 },
  "인천/경기만":       { bbox: [124.5, 37.0, 126.0, 37.8], maxWind: 12.5, maxWave: 1.2, baseDri: 0.55, peakOffsetH: 2 },
  "목포/신안 해역":    { bbox: [125.2, 33.8, 126.2, 34.8], maxWind: 14.0, maxWave: 2.1, baseDri: 0.65, peakOffsetH: 1 },
  "군산/새만금":       { bbox: [125.0, 35.4, 126.3, 36.2], maxWind: 10.5, maxWave: 1.0, baseDri: 0.42, peakOffsetH: 3 },
  "여수/거문도":       { bbox: [126.8, 33.5, 127.8, 34.5], maxWind: 11.8, maxWave: 1.5, baseDri: 0.51, peakOffsetH: 2 },
  "부산/영도":         { bbox: [128.5, 33.5, 130.5, 34.7], maxWind:  9.5, maxWave: 1.0, baseDri: 0.38, peakOffsetH: 4 },
  "포항/영일만":       { bbox: [129.5, 35.5, 131.0, 36.7], maxWind: 13.5, maxWave: 1.8, baseDri: 0.62, peakOffsetH: 2 },
  "속초/고성":         { bbox: [129.0, 37.8, 130.5, 38.9], maxWind: 18.5, maxWave: 2.8, baseDri: 0.82, peakOffsetH: 1 },
  "제주도 서방":       { bbox: [125.5, 32.5, 126.5, 33.5], maxWind: 20.5, maxWave: 3.2, baseDri: 0.90, peakOffsetH: 1 },
  "제주도 동방":       { bbox: [127.0, 32.5, 128.2, 33.5], maxWind: 15.5, maxWave: 2.5, baseDri: 0.70, peakOffsetH: 2 },
};

function simpleHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function buildRiskGrid(
  bbox: BBox4,
  areaName: string,
  baseDri: number,
): GeoJSONFeatureCollection<RiskGridCellProperties> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const COLS = 14;
  const ROWS = 12;
  const dLon = (maxLon - minLon) / COLS;
  const dLat = (maxLat - minLat) / ROWS;

  const areaSeed = simpleHash(areaName);
  const hotspotCol = (areaSeed % 100) / 100;
  const hotspotRow = ((areaSeed >> 8) % 100) / 100;

  const features: GeoJSONFeatureCollection<RiskGridCellProperties>["features"] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const nCol = (col + 0.5) / COLS;
      const nRow = (row + 0.5) / ROWS;
      const dist = Math.sqrt((nCol - hotspotCol) ** 2 + (nRow - hotspotRow) ** 2) / Math.SQRT2;
      const spatialFactor = 1 - dist * 0.75;

      const cellSeed = simpleHash(`${areaName}-${row}-${col}`);
      const noise = ((cellSeed % 1000) / 1000 - 0.5) * 0.50;

      const dri = Math.max(0.05, Math.min(0.97, baseDri * spatialFactor + noise));
      const risk_level = dri >= 0.65 ? "고위험" : dri >= 0.38 ? "주의" : "관찰";

      const lon0 = minLon + col * dLon;
      const lat0 = minLat + row * dLat;

      features.push({
        type: "Feature",
        properties: { risk_level, dri_score: parseFloat(dri.toFixed(3)) },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [lon0, lat0],
            [lon0 + dLon, lat0],
            [lon0 + dLon, lat0 + dLat],
            [lon0, lat0 + dLat],
            [lon0, lat0],
          ]],
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

function buildRiskForecast(areaName?: string): RiskForecastResult {
  const name = areaName && areaName in SEA_AREAS ? areaName : "연평도 인근 서해";
  const def = SEA_AREAS[name];
  const now = new Date();
  const peakTime = new Date(now.getTime() + def.peakOffsetH * 3600_000);
  const endTime = new Date(now.getTime() + 3 * 3600_000);
  const tidalTime = new Date(now.getTime() + (def.peakOffsetH + 0.5) * 3600_000);
  const highCount = simpleHash(`${name}-vessels`) % 120 + 30;
  const highArea = parseFloat((def.baseDri * 40 + 10).toFixed(1));

  const windSev: "고위험" | "주의" | "관찰" = def.maxWind >= 14 ? "고위험" : def.maxWind >= 10 ? "주의" : "관찰";
  const waveSev: "고위험" | "주의" | "관찰" = def.maxWave >= 2.0 ? "고위험" : def.maxWave >= 1.5 ? "주의" : "관찰";
  const tidalHH = String(peakTime.getHours()).padStart(2, "0");
  const tidalMM = String(peakTime.getMinutes()).padStart(2, "0");

  const windDesc = def.maxWind >= 14
    ? `${def.maxWind} m/s — 소형어선 귀항 권고 수준, 출항 통제 검토`
    : def.maxWind >= 10
    ? `${def.maxWind} m/s — 조업 한계 근접, 낚시어선 출항 주의`
    : `${def.maxWind} m/s — 정상 운항 가능 (소형어선 한계 10 m/s)`;

  const waveDesc = def.maxWave >= 2.0
    ? `유의파고 ${def.maxWave} m — 소형어선 안전기준(2 m) 초과, 전복 위험`
    : def.maxWave >= 1.5
    ? `유의파고 ${def.maxWave} m — 낚시어선 제한기준(1.5 m) 초과, 선체 동요 주의`
    : `유의파고 ${def.maxWave} m — 관찰 수준 (낚시어선 기준 1.5 m 이하)`;

  const actions = def.baseDri >= 0.60
    ? [
        { priority: 1, action: "순찰정 긴급 출동",      target: "고위험 해역 즉시 봉쇄·구조 대기" },
        { priority: 2, action: "V-Pass 귀항 권고 발송", target: `조업 선박 ${highCount}척 대상` },
        { priority: 3, action: "VHF Ch.16 경보 방송",   target: "출항 통제 및 항만 입항 안내" },
      ]
    : def.baseDri >= 0.30
    ? [
        { priority: 1, action: "순찰정 사전 배치",      target: "주의 해역 경계 강화" },
        { priority: 2, action: "V-Pass 주의 알림 발송", target: `조업 선박 ${highCount}척 대상` },
        { priority: 3, action: "출항 자제 안내 방송",   target: "해양경계방송 송출" },
      ]
    : [
        { priority: 1, action: "기상 모니터링 강화",    target: "3시간 간격 재분석" },
        { priority: 2, action: "취약 시간대 집중 순찰", target: "일출·일몰 전후 2시간" },
        { priority: 3, action: "정기 위치 보고 독려",   target: `조업 선박 ${highCount}척 대상` },
      ];

  return {
    forecast_id: `mock-${simpleHash(name).toString(16).slice(0, 8)}`,
    forecasted_at: now.toISOString(),
    area_name: name,
    bbox: def.bbox,
    time_range_start: now.toISOString(),
    time_range_end: endTime.toISOString(),
    peak_risk_time: peakTime.toISOString(),
    vessel_types_targeted: ["소형어선", "레저보트"],
    risk_grid: buildRiskGrid(def.bbox, name, def.baseDri),
    dri_score: def.baseDri,
    dri_percentile: parseFloat((def.baseDri * 100).toFixed(1)),
    risk_causes: [
      { factor: "풍속",     description: windDesc, severity: windSev },
      { factor: "파고",     description: waveDesc, severity: waveSev },
      { factor: "조류 반전", description: `${tidalHH}:${tidalMM} 조류 반전 예정 — 표류체 방향 급변, 협수로 주의`, severity: def.baseDri >= 0.65 ? "고위험" : "주의" },
    ],
    recommended_actions: actions,
    max_wind_speed_ms: def.maxWind,
    max_wave_height_m: def.maxWave,
    tidal_reversal_time: tidalTime.toISOString(),
    vessels_at_risk_count: highCount,
    high_risk_area_km2: highArea,
  };
}

// ── Exported mock ──────────────────────────────────────────────────────────

export const riskMock = {
  getRiskForecast: (params?: { area_name?: string }) =>
    delay(600, buildRiskForecast(params?.area_name)),
};

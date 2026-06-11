/**
 * Mock API — serves contracts/examples/*.json directly.
 * Active when VITE_USE_MOCK=true.
 */
import type {
  PredictionRequest,
  EnginePredictionResult,
  BriefingResult,
  RiskForecastResult,
} from "@/types/contracts";

import predictionResultRaw from "../../../contracts/examples/engine_prediction_result_example.json";
import briefingResultRaw from "../../../contracts/examples/briefing_result_example.json";
import riskForecastRaw from "../../../contracts/examples/risk_forecast_result_example.json";

const predictionResult = predictionResultRaw as unknown as EnginePredictionResult;
const briefingResult = briefingResultRaw as unknown as BriefingResult;
const riskForecast = riskForecastRaw as unknown as RiskForecastResult;

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function buildTimeSteps(result: EnginePredictionResult): EnginePredictionResult {
  if (result.time_steps && result.time_steps.length > 0) return result;

  const hours = result.time_horizon_hours;
  const { predicted_center, search_zones } = result;

  const time_steps = Array.from({ length: hours }, (_, i) => {
    const h = i + 1;
    const scale = Math.sqrt(h / hours);
    const scaledZones = {
      ...search_zones,
      features: search_zones.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          radius_km: f.properties.radius_km * scale,
          area_km2: f.properties.area_km2 * scale * scale,
        },
      })),
    };
    return {
      hours: h,
      search_zones: scaledZones,
      predicted_center,
      drift_distance_nm: (result.drift_vector.speed_knots * h),
    };
  });

  return { ...result, time_steps };
}

export const mockClient = {
  createPrediction: (_req: PredictionRequest) =>
    delay(800, buildTimeSteps(predictionResult)),

  getPrediction: (_id: string) =>
    delay(200, buildTimeSteps(predictionResult)),

  createBriefing: (_predictionId: string) =>
    delay(1200, briefingResult),

  getRiskForecast: (_params?: unknown) =>
    delay(600, riskForecast),
};

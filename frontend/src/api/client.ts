import type {
  PredictionRequest,
  EnginePredictionResult,
  BriefingResult,
  RiskForecastResult,
} from "@/types/contracts";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw Object.assign(new Error(res.statusText), { status: res.status, detail });
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`, location.href);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw Object.assign(new Error(res.statusText), { status: res.status });
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  createPrediction: (req: PredictionRequest) =>
    post<EnginePredictionResult>("/api/v1/predictions/", req),

  getPrediction: (id: string) =>
    get<EnginePredictionResult>(`/api/v1/predictions/${id}/`),

  createBriefing: (predictionId: string) =>
    post<BriefingResult>(`/api/v1/predictions/${predictionId}/briefing/`),

  getRiskForecast: (params?: {
    area_name?: string;
    bbox?: string;
    vessel_types?: string;
  }) => get<RiskForecastResult>("/api/v1/risk/forecast/", params as Record<string, string>),
};

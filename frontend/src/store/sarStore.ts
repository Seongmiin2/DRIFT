import { create } from "zustand";
import type {
  EnginePredictionResult,
  BriefingResult,
  RiskForecastResult,
  PredictionRequest,
} from "@/types/contracts";

export type AppTab = "incident" | "briefing" | "risk";

interface SarState {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  predictionRequest: Partial<PredictionRequest>;
  setPredictionRequest: (req: Partial<PredictionRequest>) => void;

  prediction: EnginePredictionResult | null;
  setPrediction: (p: EnginePredictionResult | null) => void;

  briefing: BriefingResult | null;
  setBriefing: (b: BriefingResult | null) => void;

  riskForecast: RiskForecastResult | null;
  setRiskForecast: (r: RiskForecastResult | null) => void;

  selectedTimeStepHour: number;
  setSelectedTimeStepHour: (h: number) => void;

  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;

  isBriefingLoading: boolean;
  setIsBriefingLoading: (v: boolean) => void;
}

export const useSarStore = create<SarState>((set) => ({
  activeTab: "incident",
  setActiveTab: (tab) => set({ activeTab: tab }),

  predictionRequest: {
    vessel_type: "소형어선",
    simulation_hours: 6,
  },
  setPredictionRequest: (req) =>
    set((s) => ({ predictionRequest: { ...s.predictionRequest, ...req } })),

  prediction: null,
  setPrediction: (p) => set({ prediction: p, selectedTimeStepHour: p?.time_horizon_hours ?? 6 }),

  briefing: null,
  setBriefing: (b) => set({ briefing: b }),

  riskForecast: null,
  setRiskForecast: (r) => set({ riskForecast: r }),

  selectedTimeStepHour: 6,
  setSelectedTimeStepHour: (h) => set({ selectedTimeStepHour: h }),

  isSubmitting: false,
  setIsSubmitting: (v) => set({ isSubmitting: v }),

  isBriefingLoading: false,
  setIsBriefingLoading: (v) => set({ isBriefingLoading: v }),
}));

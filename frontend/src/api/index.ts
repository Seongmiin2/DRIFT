import { apiClient } from "./client";
import { mockClient } from "./mockClient";

export const api =
  import.meta.env.VITE_USE_MOCK === "true" ? mockClient : apiClient;

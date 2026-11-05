
import { request } from "./api";

import type {
    SystemMetric,
    SystemMetricsHistoryResponse,
} from "./types/metrics.types";

export const metricsService = {
  collectMetrics(): Promise<SystemMetric> {
    return request<SystemMetric>("/metrics");
  },

  getMetricsHistory(
    limit: number = 100
  ): Promise<SystemMetricsHistoryResponse> {
    return request<SystemMetricsHistoryResponse>(
      `/metrics/history?limit=${limit}`
    );
  },
};

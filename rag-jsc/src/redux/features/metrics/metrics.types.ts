
import type { SystemMetric } from "../../../services/types/metrics.types";

export interface MetricsState {
  systemMetrics: SystemMetric | null;
  systemMetricsHistory: SystemMetric[];

  systemMetricsLoading: boolean;
  systemMetricsHistoryLoading: boolean;

  systemMetricsError: string | null;
  systemMetricsHistoryError: string | null;
}

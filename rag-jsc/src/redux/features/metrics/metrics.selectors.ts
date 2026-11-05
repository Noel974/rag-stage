
import type { RootState } from "../../store/store";

export const selectSystemMetrics = (state: RootState) =>
  state.metrics.systemMetrics;

export const selectSystemMetricsHistory = (state: RootState) =>
  state.metrics.systemMetricsHistory;

export const selectSystemMetricsLoading = (state: RootState) =>
  state.metrics.systemMetricsLoading;

export const selectSystemMetricsHistoryLoading = (state: RootState) =>
  state.metrics.systemMetricsHistoryLoading;

export const selectSystemMetricsError = (state: RootState) =>
  state.metrics.systemMetricsError;

export const selectSystemMetricsHistoryError = (state: RootState) =>
  state.metrics.systemMetricsHistoryError;

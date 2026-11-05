
import { createAsyncThunk } from "@reduxjs/toolkit";

import { metricsService } from "../../../services/metrics.service";

import type {
    SystemMetric,
    SystemMetricsHistoryResponse,
} from "../../../services/types/metrics.types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Une erreur inconnue est survenue";
}

// Collecter les métriques
export const fetchSystemMetrics = createAsyncThunk<
  SystemMetric,
  void,
  { rejectValue: string }
>(
  "metrics/fetchSystemMetrics",
  async (_, { rejectWithValue }) => {
    try {
      return await metricsService.collectMetrics();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Récupérer l'historique
export const fetchSystemMetricsHistory = createAsyncThunk<
  SystemMetricsHistoryResponse,
  number | undefined,
  { rejectValue: string }
>(
  "metrics/fetchSystemMetricsHistory",
  async (limit = 100, { rejectWithValue }) => {
    try {
      return await metricsService.getMetricsHistory(limit);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

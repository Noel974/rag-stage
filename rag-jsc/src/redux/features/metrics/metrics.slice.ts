
import { createSlice } from "@reduxjs/toolkit";

import type { MetricsState } from "./metrics.types";

import {
    fetchSystemMetrics,
    fetchSystemMetricsHistory,
} from "./metrics.thunks";

const initialState: MetricsState = {
  systemMetrics: null,
  systemMetricsHistory: [],

  systemMetricsLoading: false,
  systemMetricsHistoryLoading: false,

  systemMetricsError: null,
  systemMetricsHistoryError: null,
};

const metricsSlice = createSlice({
  name: "metrics",
  initialState,

  reducers: {
    clearSystemMetrics(state) {
      state.systemMetrics = null;
      state.systemMetricsHistory = [];

      state.systemMetricsError = null;
      state.systemMetricsHistoryError = null;
    },

    clearSystemMetricsErrors(state) {
      state.systemMetricsError = null;
      state.systemMetricsHistoryError = null;
    },
  },

  extraReducers: (builder) => {
    builder

      // COLLECTE
      .addCase(fetchSystemMetrics.pending, (state) => {
        state.systemMetricsLoading = true;
        state.systemMetricsError = null;
      })
      .addCase(fetchSystemMetrics.fulfilled, (state, action) => {
        state.systemMetricsLoading = false;
        state.systemMetrics = action.payload;

        state.systemMetricsHistory = [
          action.payload,
          ...state.systemMetricsHistory.filter(
            (metric) => metric.id !== action.payload.id
          ),
        ];
      })
      .addCase(fetchSystemMetrics.rejected, (state, action) => {
        state.systemMetricsLoading = false;
        state.systemMetricsError =
          action.payload ?? action.error.message ?? "Erreur inconnue";
      })

      // HISTORIQUE
      .addCase(fetchSystemMetricsHistory.pending, (state) => {
        state.systemMetricsHistoryLoading = true;
        state.systemMetricsHistoryError = null;
      })
      .addCase(fetchSystemMetricsHistory.fulfilled, (state, action) => {
        state.systemMetricsHistoryLoading = false;
        state.systemMetricsHistory = action.payload.metrics;

        if (action.payload.metrics.length > 0) {
          state.systemMetrics = action.payload.metrics[0];
        }
      })
      .addCase(fetchSystemMetricsHistory.rejected, (state, action) => {
        state.systemMetricsHistoryLoading = false;
        state.systemMetricsHistoryError =
          action.payload ?? action.error.message ?? "Erreur inconnue";
      });
  },
});

export const {
  clearSystemMetrics,
  clearSystemMetricsErrors,
} = metricsSlice.actions;

export default metricsSlice.reducer;

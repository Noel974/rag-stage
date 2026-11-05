
import { createSlice } from "@reduxjs/toolkit";

import type { RagasState } from "./ragas.types";

import {
    fetchDataset,
    fetchEvaluationById,
    fetchEvaluationMetrics,
    fetchEvaluations,
} from "./ragas.thunks";

const initialState: RagasState = {
  evaluations: [],
  evaluationsLoading: false,
  evaluationsError: null,

  currentEvaluation: null,
  evaluationLoading: false,
  evaluationError: null,

  dataset: null,
  datasetLoading: false,
  datasetError: null,

  evaluationMetrics: null,
  metricsLoading: false,
  metricsError: null,
};

const ragasSlice = createSlice({
  name: "ragas",
  initialState,

  reducers: {
    clearEvaluation(state) {
      state.currentEvaluation = null;
      state.evaluationError = null;
    },

    clearRagasErrors(state) {
      state.evaluationsError = null;
      state.evaluationError = null;
      state.datasetError = null;
      state.metricsError = null;
    },

    clearRagasData(state) {
      state.evaluations = [];
      state.currentEvaluation = null;
      state.dataset = null;
      state.evaluationMetrics = null;
    },
  },

  extraReducers: (builder) => {
    builder

      // LISTE DES EVALUATIONS
      .addCase(fetchEvaluations.pending, (state) => {
        state.evaluationsLoading = true;
        state.evaluationsError = null;
      })
      .addCase(fetchEvaluations.fulfilled, (state, action) => {
        state.evaluationsLoading = false;
        state.evaluations = action.payload;
      })
      .addCase(fetchEvaluations.rejected, (state, action) => {
        state.evaluationsLoading = false;
        state.evaluationsError =
          action.payload ?? action.error.message ?? "Erreur inconnue";
      })

      // RAPPORT
      .addCase(fetchEvaluationById.pending, (state) => {
        state.evaluationLoading = true;
        state.evaluationError = null;
        state.currentEvaluation = null;
      })
      .addCase(fetchEvaluationById.fulfilled, (state, action) => {
        state.evaluationLoading = false;
        state.currentEvaluation = action.payload;
      })
      .addCase(fetchEvaluationById.rejected, (state, action) => {
        state.evaluationLoading = false;
        state.evaluationError =
          action.payload ?? action.error.message ?? "Erreur inconnue";
      })

      // DATASET
      .addCase(fetchDataset.pending, (state) => {
        state.datasetLoading = true;
        state.datasetError = null;
      })
      .addCase(fetchDataset.fulfilled, (state, action) => {
        state.datasetLoading = false;
        state.dataset = action.payload;
      })
      .addCase(fetchDataset.rejected, (state, action) => {
        state.datasetLoading = false;
        state.datasetError =
          action.payload ?? action.error.message ?? "Erreur inconnue";
      })

      // METRIQUES RAGAS
      .addCase(fetchEvaluationMetrics.pending, (state) => {
        state.metricsLoading = true;
        state.metricsError = null;
      })
      .addCase(fetchEvaluationMetrics.fulfilled, (state, action) => {
        state.metricsLoading = false;
        state.evaluationMetrics = action.payload;
      })
      .addCase(fetchEvaluationMetrics.rejected, (state, action) => {
        state.metricsLoading = false;
        state.metricsError =
          action.payload ?? action.error.message ?? "Erreur inconnue";
      });
  },
});

export const {
  clearEvaluation,
  clearRagasErrors,
  clearRagasData,
} = ragasSlice.actions;

export default ragasSlice.reducer;

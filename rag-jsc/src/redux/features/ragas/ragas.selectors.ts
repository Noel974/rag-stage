
import type { RootState } from "../../store/store";

export const selectEvaluations = (state: RootState) =>
  state.ragas.evaluations;

export const selectEvaluationsLoading = (state: RootState) =>
  state.ragas.evaluationsLoading;

export const selectEvaluationsError = (state: RootState) =>
  state.ragas.evaluationsError;

export const selectCurrentEvaluation = (state: RootState) =>
  state.ragas.currentEvaluation;

export const selectEvaluationLoading = (state: RootState) =>
  state.ragas.evaluationLoading;

export const selectEvaluationError = (state: RootState) =>
  state.ragas.evaluationError;

export const selectDataset = (state: RootState) =>
  state.ragas.dataset;

export const selectDatasetLoading = (state: RootState) =>
  state.ragas.datasetLoading;

export const selectEvaluationMetrics = (state: RootState) =>
  state.ragas.evaluationMetrics;

export const selectMetricsLoading = (state: RootState) =>
  state.ragas.metricsLoading;

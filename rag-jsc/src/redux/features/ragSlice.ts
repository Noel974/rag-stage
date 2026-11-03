import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import {
  metricsService,
  ragService,
  ragasService,
  type AskResponse,
  type Dataset,
  type Evaluation,
  type EvaluationMetrics,
  type IndexingStatus,
  type SystemMetric,
  type SystemMetricsHistoryResponse,
} from "../../services/api";

// ==========================================
// RAG : Poser une question
// ==========================================

export const sendQuestion = createAsyncThunk<
  AskResponse,
  string,
  { rejectValue: string }
>("rag/askQuestion", async (question, { rejectWithValue }) => {
  try {
    const response = await ragService.askQuestion(question);

    if (response.error) {
      return rejectWithValue(response.error);
    }

    return response;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Erreur inconnue"
    );
  }
});

// ==========================================
// RAG : Statut de l'indexation
// ==========================================

export const fetchIndexingStatus = createAsyncThunk<
  IndexingStatus,
  void,
  { rejectValue: string }
>("rag/fetchIndexingStatus", async (_, { rejectWithValue }) => {
  try {
    return await ragService.getIndexingStatus();
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Erreur inconnue"
    );
  }
});

// ==========================================
// RAGAS : Liste des évaluations
// ==========================================

export const fetchEvaluations = createAsyncThunk<
  Evaluation[],
  void,
  { rejectValue: string }
>("rag/fetchEvaluations", async (_, { rejectWithValue }) => {
  try {
    return await ragasService.getEvaluations();
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Erreur inconnue"
    );
  }
});

// ==========================================
// RAGAS : Détail d'une évaluation
// ==========================================

export const fetchEvaluationById = createAsyncThunk<
  Evaluation,
  string,
  { rejectValue: string }
>("rag/fetchEvaluationById", async (id, { rejectWithValue }) => {
  try {
    return await ragasService.getEvaluation(id);
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Erreur inconnue"
    );
  }
});

// ==========================================
// RAGAS : Dataset
// ==========================================

export const fetchDataset = createAsyncThunk<
  Dataset,
  void,
  { rejectValue: string }
>("rag/fetchDataset", async (_, { rejectWithValue }) => {
  try {
    return await ragasService.getDataset();
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Erreur inconnue"
    );
  }
});

// ==========================================
// RAGAS : Métriques d'une évaluation
// ==========================================

export const fetchEvaluationMetrics = createAsyncThunk<
  EvaluationMetrics,
  void,
  { rejectValue: string }
>("rag/fetchEvaluationMetrics", async (_, { rejectWithValue }) => {
  try {
    return await ragasService.getMetrics();
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Erreur inconnue"
    );
  }
});

// ==========================================
// SYSTEM METRICS : Collecte des métriques
// ==========================================

export const fetchSystemMetrics = createAsyncThunk<
  SystemMetric,
  void,
  { rejectValue: string }
>("rag/fetchSystemMetrics", async (_, { rejectWithValue }) => {
  try {
    return await metricsService.collectMetrics();
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Erreur inconnue"
    );
  }
});

// ==========================================
// SYSTEM METRICS : Historique
// ==========================================

export const fetchSystemMetricsHistory = createAsyncThunk<
  SystemMetricsHistoryResponse,
  number | undefined,
  { rejectValue: string }
>(
  "rag/fetchSystemMetricsHistory",
  async (limit = 100, { rejectWithValue }) => {
    try {
      return await metricsService.getMetricsHistory(limit);
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Erreur inconnue"
      );
    }
  }
);

// ==========================================
// STATE REDUX
// ==========================================

interface RagState {
  // RAG
  answer: AskResponse | null;
  indexingStatus: IndexingStatus | null;
  questionLoading: boolean;
  statusLoading: boolean;
  questionError: string | null;
  statusError: string | null;
  currentRequestId: string | null;

  // RAGAS : Evaluations
  evaluations: Evaluation[];
  evaluationsLoading: boolean;
  evaluationsError: string | null;

  // RAGAS : Evaluation detail
  currentEvaluation: Evaluation | null;
  evaluationLoading: boolean;
  evaluationError: string | null;

  // RAGAS : Dataset
  dataset: Dataset | null;
  datasetLoading: boolean;
  datasetError: string | null;

  // RAGAS : Evaluation metrics
  evaluationMetrics: EvaluationMetrics | null;
  metricsLoading: boolean;
  metricsError: string | null;

  // SYSTEM METRICS
  systemMetrics: SystemMetric | null;
  systemMetricsHistory: SystemMetric[];
  systemMetricsLoading: boolean;
  systemMetricsHistoryLoading: boolean;
  systemMetricsError: string | null;
  systemMetricsHistoryError: string | null;
}

// ==========================================
// INITIAL STATE
// ==========================================

const initialState: RagState = {
  // RAG
  answer: null,
  indexingStatus: null,
  questionLoading: false,
  statusLoading: false,
  questionError: null,
  statusError: null,
  currentRequestId: null,

  // RAGAS
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

  // SYSTEM METRICS
  systemMetrics: null,
  systemMetricsHistory: [],
  systemMetricsLoading: false,
  systemMetricsHistoryLoading: false,
  systemMetricsError: null,
  systemMetricsHistoryError: null,
};

// ==========================================
// SLICE
// ==========================================

const ragSlice = createSlice({
  name: "rag",
  initialState,

  // ========================================
  // REDUCERS
  // ========================================

  reducers: {
    clearAnswer(state) {
      state.answer = null;
      state.questionError = null;
    },

    clearEvaluation(state) {
      state.currentEvaluation = null;
      state.evaluationError = null;
      state.evaluationMetrics = null;
      state.metricsError = null;
    },

    clearRagasErrors(state) {
      state.evaluationsError = null;
      state.evaluationError = null;
      state.datasetError = null;
      state.metricsError = null;
    },

    // SYSTEM METRICS

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

  // ========================================
  // EXTRA REDUCERS
  // ========================================

  extraReducers: (builder) => {
    builder

      // ======================================
      // RAG : QUESTION
      // ======================================

      .addCase(sendQuestion.pending, (state, action) => {
        state.questionLoading = true;
        state.questionError = null;
        state.answer = null;
        state.currentRequestId = action.meta.requestId;
      })

      .addCase(sendQuestion.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.questionLoading = false;
        state.answer = action.payload;
        state.currentRequestId = null;
      })

      .addCase(sendQuestion.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.questionLoading = false;
        state.questionError =
          action.payload ?? action.error.message ?? "Erreur inconnue";
        state.currentRequestId = null;
      })

      // ======================================
      // RAG : INDEXATION
      // ======================================

      .addCase(fetchIndexingStatus.pending, (state) => {
        state.statusLoading = true;
        state.statusError = null;
      })

      .addCase(fetchIndexingStatus.fulfilled, (state, action) => {
        state.statusLoading = false;
        state.indexingStatus = action.payload;
      })

      .addCase(fetchIndexingStatus.rejected, (state, action) => {
        state.statusLoading = false;
        state.statusError =
          action.payload ?? action.error.message ?? "Erreur inconnue";
      })

      // ======================================
      // RAGAS : LISTE DES EVALUATIONS
      // ======================================

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

      // ======================================
      // RAGAS : DETAIL EVALUATION
      // ======================================

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

      // ======================================
      // RAGAS : DATASET
      // ======================================

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

      // ======================================
      // RAGAS : METRIQUES
      // ======================================

      .addCase(fetchEvaluationMetrics.pending, (state) => {
        state.metricsLoading = true;
        state.metricsError = null;
        state.evaluationMetrics = null;
      })

      .addCase(fetchEvaluationMetrics.fulfilled, (state, action) => {
        state.metricsLoading = false;
        state.evaluationMetrics = action.payload;
      })

      .addCase(fetchEvaluationMetrics.rejected, (state, action) => {
        state.metricsLoading = false;
        state.metricsError =
          action.payload ?? action.error.message ?? "Erreur inconnue";
      })

      // ======================================
      // SYSTEM METRICS : COLLECTE
      // ======================================

      .addCase(fetchSystemMetrics.pending, (state) => {
        state.systemMetricsLoading = true;
        state.systemMetricsError = null;
      })

      .addCase(fetchSystemMetrics.fulfilled, (state, action) => {
        state.systemMetricsLoading = false;
        state.systemMetrics = action.payload;

        // Ajouter la nouvelle mesure au début
        // de l'historique sans doublon.

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

      // ======================================
      // SYSTEM METRICS : HISTORIQUE
      // ======================================

      .addCase(fetchSystemMetricsHistory.pending, (state) => {
        state.systemMetricsHistoryLoading = true;
        state.systemMetricsHistoryError = null;
      })

      .addCase(fetchSystemMetricsHistory.fulfilled, (state, action) => {
        state.systemMetricsHistoryLoading = false;
        state.systemMetricsHistory = action.payload.metrics;

        // Récupérer la dernière mesure disponible.

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

// ==========================================
// EXPORT DES ACTIONS
// ==========================================

export const {
  clearAnswer,
  clearEvaluation,
  clearRagasErrors,
  clearSystemMetrics,
  clearSystemMetricsErrors,
} = ragSlice.actions;

// ==========================================
// EXPORT DU REDUCER
// ==========================================

export default ragSlice.reducer;
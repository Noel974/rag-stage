
import { createAsyncThunk } from "@reduxjs/toolkit";

import { ragasService } from "../../../services/ragas.service";

import type {
    Dataset,
    Evaluation,
    EvaluationMetrics,
    EvaluationReport,
} from "../../../services/types/ragas.types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Une erreur inconnue est survenue";
}

// Liste des évaluations
export const fetchEvaluations = createAsyncThunk<
  Evaluation[],
  void,
  { rejectValue: string }
>(
  "ragas/fetchEvaluations",
  async (_, { rejectWithValue }) => {
    try {
      return await ragasService.getEvaluations();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Rapport complet
export const fetchEvaluationById = createAsyncThunk<
  EvaluationReport,
  string,
  { rejectValue: string }
>(
  "ragas/fetchEvaluationById",
  async (id, { rejectWithValue }) => {
    try {
      return await ragasService.getEvaluation(id);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Dataset
export const fetchDataset = createAsyncThunk<
  Dataset,
  void,
  { rejectValue: string }
>(
  "ragas/fetchDataset",
  async (_, { rejectWithValue }) => {
    try {
      return await ragasService.getDataset();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Métriques globales
export const fetchEvaluationMetrics = createAsyncThunk<
  EvaluationMetrics,
  void,
  { rejectValue: string }
>(
  "ragas/fetchEvaluationMetrics",
  async (_, { rejectWithValue }) => {
    try {
      return await ragasService.getMetrics();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

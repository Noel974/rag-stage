import { createAsyncThunk } from "@reduxjs/toolkit";

import { ragService } from "../../../services/rag.service";

import type {
  AskResponse,
  IndexingStatus,
} from "../../../services/types/rag.types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Une erreur inconnue est survenue";
}

// Poser une question
export const sendQuestion = createAsyncThunk<
  AskResponse,
  string,
  { rejectValue: string }
>(
  "rag/sendQuestion",
  async (question, { rejectWithValue }) => {
    try {
      const response = await ragService.askQuestion(question);

      if (response.error) {
        return rejectWithValue(response.error);
      }

      return response;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Récupérer le statut d'indexation
export const fetchIndexingStatus = createAsyncThunk<
  IndexingStatus,
  void,
  { rejectValue: string }
>(
  "rag/fetchIndexingStatus",
  async (_, { rejectWithValue }) => {
    try {
      return await ragService.getIndexingStatus();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);
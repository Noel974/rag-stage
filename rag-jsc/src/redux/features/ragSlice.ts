
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  askQuestion,
  getIndexingStatus,
  type AskResponse,
  type IndexingStatus,
} from "../../services/api";

export const sendQuestion = createAsyncThunk<
  AskResponse,
  string,
  { rejectValue: string }
>("rag/askQuestion", async (question, { rejectWithValue }) => {
  try {
    const response = await askQuestion(question);

    if (response.error) {
      return rejectWithValue(response.error);
    }

    return response;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Erreur inconnue",
    );
  }
});

export const fetchIndexingStatus = createAsyncThunk<
  IndexingStatus,
  void,
  { rejectValue: string }
>("rag/fetchIndexingStatus", async (_, { rejectWithValue }) => {
  try {
    return await getIndexingStatus();
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Erreur inconnue",
    );
  }
});

interface RagState {
  answer: AskResponse | null;
  indexingStatus: IndexingStatus | null;
  questionLoading: boolean;
  statusLoading: boolean;
  questionError: string | null;
  statusError: string | null;
  currentRequestId: string | null;
}

const initialState: RagState = {
  answer: null,
  indexingStatus: null,
  questionLoading: false,
  statusLoading: false,
  questionError: null,
  statusError: null,
  currentRequestId: null,
};

const ragSlice = createSlice({
  name: "rag",
  initialState,

  reducers: {
    clearAnswer(state) {
      state.answer = null;
      state.questionError = null;
    },
  },

  extraReducers: (builder) => {
    builder
      // Nouvelle recherche
      .addCase(sendQuestion.pending, (state, action) => {
        state.questionLoading = true;
        state.questionError = null;
        state.answer = null;
        state.currentRequestId = action.meta.requestId;
      })

      // Réponse reçue
      .addCase(sendQuestion.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) {
          return;
        }

        state.questionLoading = false;
        state.answer = action.payload;
        state.currentRequestId = null;
      })

      // Erreur de recherche
      .addCase(sendQuestion.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) {
          return;
        }

        state.questionLoading = false;
        state.questionError =
          action.payload ?? action.error.message ?? "Erreur inconnue";
        state.currentRequestId = null;
      })

      // Statut d'indexation
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
      });
  },
});

export const { clearAnswer } = ragSlice.actions;

export default ragSlice.reducer;

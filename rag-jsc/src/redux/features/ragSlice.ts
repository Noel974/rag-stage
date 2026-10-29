
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
    askQuestion,
    getIndexingStatus,
    type AskResponse,
    type IndexingStatus,
} from "../../services/api";

// Appel du backend pour poser une question
export const sendQuestion = createAsyncThunk<
  AskResponse,
  string,
  { rejectValue: string }
>("rag/askQuestion", async (question, { rejectWithValue }) => {
  try {
    return await askQuestion(question);
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Erreur inconnue"
    );
  }
});

// Appel du backend pour connaître l'état de l'indexation
export const fetchIndexingStatus = createAsyncThunk<
  IndexingStatus,
  void,
  { rejectValue: string }
>("rag/fetchIndexingStatus", async (_, { rejectWithValue }) => {
  try {
    return await getIndexingStatus();
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Erreur inconnue"
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
}

const initialState: RagState = {
  answer: null,
  indexingStatus: null,
  questionLoading: false,
  statusLoading: false,
  questionError: null,
  statusError: null,
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
      .addCase(sendQuestion.pending, (state) => {
        state.questionLoading = true;
        state.questionError = null;
      })
      .addCase(sendQuestion.fulfilled, (state, action) => {
        state.questionLoading = false;
        state.answer = action.payload;
      })
      .addCase(sendQuestion.rejected, (state, action) => {
        state.questionLoading = false;
        state.questionError =
          action.payload ?? action.error.message ?? "Erreur inconnue";
      })
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

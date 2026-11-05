
import { createSlice } from "@reduxjs/toolkit";

import type { RagState } from "./rag.types";

import {
    fetchIndexingStatus,
    sendQuestion,
} from "./rag.thunks";

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

    clearRagErrors(state) {
      state.questionError = null;
      state.statusError = null;
    },
  },

  extraReducers: (builder) => {
    builder

      // QUESTION
      .addCase(sendQuestion.pending, (state, action) => {
        state.questionLoading = true;
        state.questionError = null;
        state.answer = null;
        state.currentRequestId = action.meta.requestId;
      })

      .addCase(sendQuestion.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) {
          return;
        }

        state.questionLoading = false;
        state.answer = action.payload;
        state.currentRequestId = null;
      })

      .addCase(sendQuestion.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) {
          return;
        }

        state.questionLoading = false;
        state.questionError =
          action.payload ?? action.error.message ?? "Erreur inconnue";

        state.currentRequestId = null;
      })

      // INDEXATION
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

export const {
  clearAnswer,
  clearRagErrors,
} = ragSlice.actions;

export default ragSlice.reducer;

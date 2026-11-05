
import type { RootState } from "../../store/store";

export const selectRagAnswer = (state: RootState) =>
  state.rag.answer;

export const selectRagLoading = (state: RootState) =>
  state.rag.questionLoading;

export const selectRagError = (state: RootState) =>
  state.rag.questionError;

export const selectIndexingStatus = (state: RootState) =>
  state.rag.indexingStatus;

export const selectIndexingLoading = (state: RootState) =>
  state.rag.statusLoading;

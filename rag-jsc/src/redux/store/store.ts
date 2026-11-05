
import { configureStore } from "@reduxjs/toolkit";

import metricsReducer from "../features/metrics/metrics.slice";
import ragReducer from "../features/rag/rag.slice";
import ragasReducer from "../features/ragas/ragas.slice";

export const store = configureStore({
  reducer: {
    rag: ragReducer,
    ragas: ragasReducer,
    metrics: metricsReducer,
  },

  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;

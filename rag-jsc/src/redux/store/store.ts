
import { configureStore } from "@reduxjs/toolkit";
import ragReducer from "../features/ragSlice";

export const store = configureStore({
  reducer: {
    rag: ragReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

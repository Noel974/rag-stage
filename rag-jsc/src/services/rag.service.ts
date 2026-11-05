
import { request } from "./api";

import type {
    AskResponse,
    IndexingStatus,
} from "./types/rag.types";

import type {
    RagasHistoryItem,
} from "./types/ragas.types";

export const ragService = {
  askQuestion(question: string): Promise<AskResponse> {
    return request<AskResponse>("/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  },

  getHistory(): Promise<RagasHistoryItem[]> {
    return request<RagasHistoryItem[]>(
      "/evaluations/history"
    );
  },

  getIndexingStatus(): Promise<IndexingStatus> {
    return request<IndexingStatus>("/status");
  },
};

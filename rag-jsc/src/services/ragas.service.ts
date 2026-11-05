
import { request } from "./api";

import type {
    Dataset,
    Evaluation,
    EvaluationMetrics,
    EvaluationReport,
    EvaluationsResponse,
} from "./types/ragas.types";

export const ragasService = {
  async getEvaluations(): Promise<Evaluation[]> {
    const response = await request<EvaluationsResponse>(
      "/evaluations"
    );

    return response.evaluations ?? [];
  },

  getEvaluation(id: string): Promise<EvaluationReport> {
    return request<EvaluationReport>(
      `/evaluations/${encodeURIComponent(id)}`
    );
  },

  getDataset(): Promise<Dataset> {
    return request<Dataset>("/evaluations/dataset");
  },

  getMetrics(): Promise<EvaluationMetrics> {
    return request<EvaluationMetrics>(
      "/evaluations/metrics"
    );
  },
};

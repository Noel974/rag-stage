import type {
    Dataset,
    Evaluation,
    EvaluationMetrics,
    EvaluationReport,
} from "../../../services/types/ragas.types";

export interface RagasState {
  evaluations: Evaluation[];
  evaluationsLoading: boolean;
  evaluationsError: string | null;

  currentEvaluation: EvaluationReport | null;
  evaluationLoading: boolean;
  evaluationError: string | null;

  dataset: Dataset | null;
  datasetLoading: boolean;
  datasetError: string | null;

  evaluationMetrics: EvaluationMetrics | null;
  metricsLoading: boolean;
  metricsError: string | null;
}

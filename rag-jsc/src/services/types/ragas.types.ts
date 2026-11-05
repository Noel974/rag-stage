
export interface RagasHistoryItem {
  id: string;
  created_at: string;
  hit_rate: number;
  mrr: number;
  faithfulness: number;
  answer_relevancy: number;
  context_precision: number;
  context_recall: number;
  avg_latency_ms: number;
}

export interface Evaluation {
  id: string;
  filename: string;
  created_at: number;
  label?: string;
  [key: string]: unknown;
}

export interface RagasScores {
  faithfulness: number | null;
  answer_relevancy: number | null;
  context_precision: number | null;
  context_recall: number | null;
}

export interface RagasAggregate {
  n_questions: number;
  n_answerable: number;
  hit_rate: number | null;
  mrr: number | null;
  abstention_rate: number | null;
  avg_latency_ms: number | null;
  errors: number;
  faithfulness: number | null;
  answer_relevancy: number | null;
  context_precision: number | null;
  context_recall: number | null;
}

export interface RetrievedDocument {
  name: string;
  drive_id: string;
  score: number;
  location: string | null;
}

export interface RagasQuestionResult {
  id: string;
  question: string;
  reference: string;
  answerable: boolean;
  expected_docs: string[];
  answer: string;
  contexts: string[];
  retrieved: RetrievedDocument[];
  hit: boolean;
  rr: number;
  abstained: boolean | null;
  latency_ms: number;
  search_ms: number;
  generation_ms: number;
  error: string | null;
  ragas: RagasScores;
}

export interface EvaluationReport {
  label: string;
  started_at: string;
  config: Record<string, unknown>;
  aggregate: RagasAggregate;
  results: RagasQuestionResult[];
}

export interface EvaluationsResponse {
  total: number;
  evaluations: Evaluation[];
}

export interface EvaluationMetrics {
  total: number;
  results: {
    id: string;
    metrics: Record<string, unknown>;
  }[];
}

export interface Dataset {
  [key: string]: unknown;
}


export interface SystemMetric {
  id: number;
  created_at: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  pgvector_size_mb: number | null;
  documents_count: number | null;
  chunks_count: number | null;
}

export interface SystemMetricsHistoryResponse {
  total: number;
  metrics: SystemMetric[];
}

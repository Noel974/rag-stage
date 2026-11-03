
const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api"
).replace(/\/+$/, "");

// ==========================================
// Fonction générique pour les appels API
// ==========================================

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  // Content-Type uniquement lorsqu'on envoie un body
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Accept", "application/json");

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Impossible de contacter l'API. Vérifiez le serveur et la configuration CORS."
    );
  }

  // Lecture de la réponse
  const responseText = await response.text();

  let data: unknown = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }
  }

  // Gestion des erreurs HTTP
  if (!response.ok) {
    const errorData = data as {
      error?: string;
      message?: string;
    };

    const message =
      errorData?.error ??
      errorData?.message ??
      (typeof data === "string" ? data : null) ??
      `Erreur API : ${response.status}`;

    throw new Error(message);
  }

  return data as T;
}

// ==========================================
// Types RAG
// ==========================================

export interface AskSource {
  n: number;
  name: string;
  link: string | null;
  location: string | null;
  score: number;
  excerpt: string;
}

export interface AskDocument {
  drive_id: string;
  name: string;
  view_url: string | null;
  download_url: string;
}

export interface AskResponse {
  answer?: string;
  error?: string;
  sources?: AskSource[];
  documents?: AskDocument[];
}

export type IndexingStatus = Record<string, unknown>;

// ==========================================
// Types RAGAS
// ==========================================

export interface Evaluation {
  id: string;
  filename: string;
  created_at: number;
  [key: string]: unknown;
}

export interface EvaluationsResponse {
  total: number;
  evaluations: Evaluation[];
}

export interface Dataset {
  [key: string]: unknown;
}

export interface EvaluationMetrics {
  total: number;
  results: {
    id: string;
    metrics: Record<string, unknown>;
  }[];
}

// ==========================================
// Service RAG
// ==========================================

export const ragService = {
  askQuestion(question: string): Promise<AskResponse> {
    return request<AskResponse>("/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  },

  getIndexingStatus(): Promise<IndexingStatus> {
    return request<IndexingStatus>("/status");
  },
};

// ==========================================
// Service RAGAS
// ==========================================

export const ragasService = {
  // Liste des évaluations
  async getEvaluations(): Promise<Evaluation[]> {
    const response = await request<EvaluationsResponse>(
      "/evaluations"
    );

    return response.evaluations ?? [];
  },

  // Détail d'une évaluation
  getEvaluation(id: string): Promise<Evaluation> {
    return request<Evaluation>(
      `/evaluations/${encodeURIComponent(id)}`
    );
  },

  // Dataset utilisé pour les évaluations
  getDataset(): Promise<Dataset> {
    return request<Dataset>("/evaluations/dataset");
  },

  // Métriques de toutes les évaluations
  getMetrics(): Promise<EvaluationMetrics> {
    return request<EvaluationMetrics>("/evaluations/metrics");
  },
};

// ==========================================
// TYPES SYSTEM METRICS
// ==========================================

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


// ==========================================
// SERVICE SYSTEM METRICS
// ==========================================

export const metricsService = {

  // Collecter et enregistrer les métriques système
  collectMetrics(): Promise<SystemMetric> {
    return request<SystemMetric>("/metrics", {
      method: "GET",
    });
  },

  // Récupérer l'historique des métriques
  getMetricsHistory(
    limit: number = 100
  ): Promise<SystemMetricsHistoryResponse> {
    return request<SystemMetricsHistoryResponse>(
      `/metrics/history?limit=${limit}`
    );
  },

};

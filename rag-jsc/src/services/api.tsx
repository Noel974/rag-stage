
const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Erreur API : ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Extraits utilisés pour construire la réponse du RAG
export interface AskSource {
  n: number;
  name: string;
  link: string | null;
  location: string | null;
  score: number;
  excerpt: string;
}

// Document proposé à l'utilisateur
export interface AskDocument {
  drive_id: string;
  name: string;
  view_url: string | null;
  download_url: string;
}

// Réponse complète de /api/ask
export interface AskResponse {
  answer?: string;
  error?: string;
  sources?: AskSource[];
  documents?: AskDocument[];
}

// Statut de l'indexation
export type IndexingStatus = Record<string, unknown>;

export function askQuestion(
  question: string
): Promise<AskResponse> {
  return request<AskResponse>("/ask", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export function getIndexingStatus(): Promise<IndexingStatus> {
  return request<IndexingStatus>("/status");
}

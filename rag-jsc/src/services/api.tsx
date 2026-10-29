
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
    throw new Error(
      message || `Erreur API : ${response.status}`
    );
  }

  return response.json() as Promise<T>;
}

// À adapter à la structure réelle renvoyée par ton backend.
export interface AskResponse {
  answer: string;
  sources?: Array<{
    name?: string;
    page?: number;
    content?: string;
  }>;
}

// Remplace ces champs par ceux de ton endpoint /status.
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

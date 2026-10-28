// src/services/api.ts

const API_URL = "http://localhost:8000/api";

export async function askQuestion(question: string) {
  const response = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
    }),
  });

  return response.json();
}
 

export async function getIndexingStatus() {
  const response = await fetch(`${API_URL}/status`);

  if (!response.ok) {
    throw new Error("Impossible de récupérer le statut de l'indexation");
  }

  return response.json();
}


import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { askQuestion } from "../services/api";

export default function AssistantIA() {
  const location = useLocation();

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitQuestion = async (
    questionText: string
  ) => {
    if (!questionText.trim()) return;

    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const result = await askQuestion(
        questionText.trim()
      );

      setAnswer(
        result.answer || "Aucune réponse reçue."
      );
    } catch (error) {
      console.error(error);

      setError(
        "Une erreur est survenue. Veuillez réessayer."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialQuestion =
      location.state?.question;

    if (!initialQuestion) return;

    setQuestion(initialQuestion);

    submitQuestion(initialQuestion);
  }, [location.state]);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!question.trim() || loading) return;

    await submitQuestion(question);
  };

  return (
    <main className="assistant-page">
      <div className="assistant-container">

        <header className="assistant-header">
          <div className="brand">
            <div className="brand-icon">
              ✦
            </div>

            <div>
              <h1>Assistant IA</h1>
              <p>Votre assistant documentaire</p>
            </div>
          </div>

          <div className="status">
            <span className="status-dot" />
            Prêt à vous aider
          </div>
        </header>

        <section className="assistant-hero">
          <div className="hero-badge">
            ✦ Assistant intelligent
          </div>

          <h2>
            Bonjour, que puis-je
            <span> faire pour vous ?</span>
          </h2>

          <p className="hero-description">
            Posez une question concernant la
            documentation, les procédures ou les
            informations disponibles dans
            l'entreprise.
          </p>
        </section>

        <section className="assistant-card">
          <div className="card-heading">
            <div>
              <h3>Posez votre question</h3>
              <p>
                Je recherche les informations
                pertinentes dans la base
                documentaire.
              </p>
            </div>

            <div className="card-sparkle">
              ✦
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="assistant-question"
              className="input-label"
            >
              Votre question
            </label>

            <div className="question-wrapper">
              <textarea
                id="assistant-question"
                value={question}
                onChange={(e) =>
                  setQuestion(
                    e.target.value
                  )
                }
                placeholder="Exemple : Comment effectuer une demande de congé ?"
                rows={4}
                disabled={loading}
              />

              <div className="input-footer">
                <span>
                  Décrivez votre demande avec
                  précision.
                </span>

                <span className="character-count">
                  {question.length} caractères
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="send-button"
              disabled={
                !question.trim() ||
                loading
              }
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Recherche en cours...
                </>
              ) : (
                <>
                  Envoyer ma question
                </>
              )}
            </button>
          </form>

          {error && (
            <div
              className="error-message"
              role="alert"
            >
              {error}
            </div>
          )}

          {answer && (
            <section
              className="answer-section"
              aria-live="polite"
            >
              <div className="answer-heading">
                <div className="answer-icon">
                  ✦
                </div>

                <div>
                  <h3>
                    Réponse de
                    l'assistant
                  </h3>

                  <p>
                    Résultat de votre
                    recherche
                  </p>
                </div>
              </div>

              <div className="answer-content">
                <ReactMarkdown
                  remarkPlugins={[
                    remarkGfm,
                  ]}
                >
                  {answer}
                </ReactMarkdown>
              </div>

              <div className="answer-actions">
                <button
                  type="button"
                  className="copy-button"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      answer
                    )
                  }
                >
                  Copier la réponse
                </button>

                <button
                  type="button"
                  className="new-question-button"
                  onClick={() => {
                    setQuestion("");
                    setAnswer("");
                    setError("");
                  }}
                >
                  Nouvelle question
                </button>
              </div>
            </section>
          )}
        </section>

        <footer className="assistant-footer">
          <span>
            ✦ Propulsé par l'IA et votre
            base documentaire
          </span>
        </footer>

      </div>
    </main>
  );
}
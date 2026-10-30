
import type { FormEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useLocation } from "react-router-dom";
import remarkGfm from "remark-gfm";

import {
  clearAnswer,
  sendQuestion,
} from "../redux/features/ragSlice";
import { useAppDispatch, useAppSelector } from "../redux/store/hoooks";

const MAX_QUESTION_CHARS = 1000;

type SourceItem = {
  n?: number;
  name?: string;
  link?: string | null;
  location?: string | null;
};

type DocumentItem = {
  drive_id?: string;
  name: string;
  view_url?: string | null;
  download_url?: string | null;
  refs?: number[];
};

type RagResponse = {
  answer?: string;
  error?: string;
  sources?: SourceItem[];
  documents?: DocumentItem[];
  no_result?: boolean;
};

function normalizeResponse(value: unknown): RagResponse | null {
  if (typeof value === "string") {
    return value ? { answer: value } : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  return value as RagResponse;
}

function isDocumentRequest(question: string): boolean {
  const normalized = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return /\b(document|documents|fichier|fichiers|telecharger|telecharge|telechargez|fournir|envoie|envoyer|envoi|obtenir|recuperer|piece jointe|pieces jointes)\b/.test(
    normalized,
  );
}

export default function AssistantIA() {
  const location = useLocation();
  const dispatch = useAppDispatch();

  const { answer, questionLoading, questionError } = useAppSelector(
    (state) => state.rag,
  );

  const [question, setQuestion] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Empêche la question d'accueil de revenir après une nouvelle recherche.
  const initialQuestionHandled = useRef(false);

  const response = useMemo(
    () => normalizeResponse(answer),
    [answer],
  );

  const answerText =
    response?.answer ??
    response?.error ??
    (response?.no_result
      ? "Aucun résultat pertinent n'a été trouvé dans la base documentaire."
      : "");

  // Récupérer les documents, ou les déduire des sources de l'API.
  const documents = useMemo<DocumentItem[]>(() => {
    if (!response) {
      return [];
    }

    if (response.documents?.length) {
      return response.documents;
    }

    const byName = new Map<string, DocumentItem>();

    for (const source of response.sources ?? []) {
      if (!source.name) {
        continue;
      }

      const existing = byName.get(source.name);

      if (existing) {
        if (
          source.n !== undefined &&
          !existing.refs?.includes(source.n)
        ) {
          existing.refs = [...(existing.refs ?? []), source.n];
        }

        continue;
      }

      byName.set(source.name, {
        name: source.name,
        view_url: source.link ?? null,
        refs: source.n !== undefined ? [source.n] : [],
      });
    }

    return Array.from(byName.values());
  }, [response]);

  // Envoyer une nouvelle question.

const submitQuestion = useCallback(
  (questionText: string) => {
    const trimmedQuestion = questionText.trim();

    if (
      !trimmedQuestion ||
      trimmedQuestion.length > MAX_QUESTION_CHARS ||
      questionLoading
    ) {
      return;
    }

    setShowAnswer(false);
    setShowDocuments(isDocumentRequest(trimmedQuestion));
    setCopySuccess(false);

    dispatch(clearAnswer());
    dispatch(sendQuestion(trimmedQuestion));
  },
  [dispatch, questionLoading],
);


  // Traiter une seule fois la question transmise par la page d'accueil.
  useEffect(() => {
    if (initialQuestionHandled.current) {
      return;
    }

    const initialQuestion = location.state?.question;

    if (
      typeof initialQuestion !== "string" ||
      !initialQuestion.trim()
    ) {
      return;
    }

    const trimmedQuestion = initialQuestion.trim();

    // Important : mémoriser avant l'envoi pour éviter une répétition.
    initialQuestionHandled.current = true;

    setQuestion(trimmedQuestion);
    submitQuestion(trimmedQuestion);
  }, [location.state, submitQuestion]);

  // Afficher la nouvelle réponse quand elle arrive.
  useEffect(() => {
    if (answer) {
      setShowAnswer(true);
    }
  }, [answer]);

  // Soumission du formulaire.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitQuestion(question);
  };

  // Ctrl + Entrée ou Cmd + Entrée.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter"
    ) {
      event.preventDefault();
      submitQuestion(question);
    }
  };

  // Copier la réponse.
  const handleCopy = async () => {
    if (!answerText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(answerText);
      setCopySuccess(true);
    } catch {
      setCopySuccess(false);
    }
  };

  // Commencer une nouvelle question sans restaurer l'ancienne.

const handleNewQuestion = () => {
  dispatch(clearAnswer());

  setQuestion("");
  setShowAnswer(false);
  setShowDocuments(false);
  setCopySuccess(false);

  // Ne pas réinitialiser le marqueur de la question initiale.
  textareaRef.current?.focus();
};


  const hasAnswer = Boolean(answerText);
  const shouldShowDocuments =
    showDocuments && documents.length > 0;

  return (
    <main className="assistant-page">
      <div className="assistant-container">
        <header className="assistant-header">
          <div className="brand">
            <div className="brand-icon">✦</div>

            <div>
              <h1>Assistant IA</h1>
              <p>Votre assistant documentaire</p>
            </div>
          </div>

          <div className="status">
            <span className="status-dot" />
            {questionLoading
              ? "Recherche en cours..."
              : "Prêt à vous aider"}
          </div>
        </header>

        <section className="assistant-hero">
          <div className="hero-badge">✦ Assistant intelligent</div>

          <h2>
            Bonjour, que puis-je
            <span> faire pour vous ?</span>
          </h2>

          <p className="hero-description">
            Posez une question concernant la documentation, les
            procédures ou les informations disponibles dans
            l'entreprise.
          </p>
        </section>

        <section className="assistant-card">
          <div className="card-heading">
            <div>
              <h3>Posez votre question</h3>
              <p>
                Je recherche les informations pertinentes dans la base
                documentaire.
              </p>
            </div>

            <div className="card-sparkle">✦</div>
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
                ref={textareaRef}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Exemple : Comment effectuer une demande de congé ?"
                rows={4}
                maxLength={MAX_QUESTION_CHARS}
                disabled={questionLoading}
                aria-describedby="question-help"
              />

              <div className="input-footer">
                <span id="question-help">
                  Décrivez votre demande avec précision. Ctrl + Entrée
                  pour envoyer.
                </span>

                <span className="character-count">
                  {question.length} / {MAX_QUESTION_CHARS} caractères
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="send-button"
              disabled={!question.trim() || questionLoading}
            >
              {questionLoading ? (
                <>
                  <span className="spinner" />
                  Recherche en cours...
                </>
              ) : (
                "Envoyer ma question"
              )}
            </button>
          </form>

          {questionError && (
            <div className="error-message" role="alert">
              {questionError}
            </div>
          )}

          <div aria-live="polite" aria-busy={questionLoading}>
            {showAnswer && hasAnswer && (
              <section className="answer-section">
                <div className="answer-heading">
                  <div className="answer-icon">✦</div>

                  <div>
                    <h3>Réponse de l'assistant</h3>
                    <p>Résultat de votre recherche</p>
                  </div>
                </div>

                <div className="answer-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children, ...props }) => (
                        <a
                          {...props}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {answerText}
                  </ReactMarkdown>
                </div>

                <div className="answer-actions">
                  <button
                    type="button"
                    className="copy-button"
                    onClick={handleCopy}
                    disabled={!answerText}
                  >
                    {copySuccess ? "Copié ✓" : "Copier la réponse"}
                  </button>

                  <button
                    type="button"
                    className="new-question-button"
                    onClick={handleNewQuestion}
                  >
                    Nouvelle question
                  </button>
                </div>

                {shouldShowDocuments && (
                  <section className="answer-documents">
                    <div className="documents-heading">
                      <h4>Documents disponibles</h4>
                      <p>
                        Voici les documents associés à votre recherche.
                      </p>
                    </div>

                    <div className="documents-list">
                      {documents.map((doc, index) => (
                        <article
                          className="document-item"
                          key={
                            doc.drive_id ??
                            doc.view_url ??
                            `${doc.name}-${index}`
                          }
                        >
                          <div
                            className="document-icon"
                            aria-hidden="true"
                          >
                            📄
                          </div>

                          <div className="document-info">
                            <h5>{doc.name}</h5>

                            <p>
                              Document disponible sur Google Drive
                              {doc.refs?.length
                                ? ` · extraits ${doc.refs
                                    .map((n) => `[${n}]`)
                                    .join(" ")}`
                                : ""}
                            </p>
                          </div>

                          <div className="document-actions">
                            {doc.view_url && (
                              <a
                                href={doc.view_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="document-link"
                              >
                                Ouvrir sur Drive
                              </a>
                            )}

                            {doc.download_url && (
                              <a
                                href={doc.download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="document-download"
                              >
                                Télécharger l'original
                              </a>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </section>
            )}
          </div>
        </section>

        <footer className="assistant-footer">
          <span>
            ✦ Propulsé par l'IA et votre base documentaire
          </span>
        </footer>
      </div>
    </main>
  );
}

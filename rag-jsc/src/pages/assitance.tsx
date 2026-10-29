import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useLocation } from "react-router-dom";
import remarkGfm from "remark-gfm";


import { sendQuestion } from "../redux/features/ragSlice";
import { useAppDispatch, useAppSelector } from "../redux/store/hoooks";

// Doit correspondre à MAX_QUESTION_CHARS côté API
const MAX_QUESTION_CHARS = 1000;

// Forme de la réponse de POST /api/ask (voir README, section API)
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
  refs?: number[]; // numéros d'extraits cités ([1], [2]...)
};

type RagResponse = {
  answer?: string;
  error?: string;
  sources?: SourceItem[];
  documents?: DocumentItem[];
  no_result?: boolean;
};

export default function AssistantIA() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [showDocumets, setShowDocuments] = useState(false); 

  // Données provenant de Redux
  const { answer, questionLoading, questionError } = useAppSelector(
    (state) => state.rag,
  );

  // État local du formulaire
  const [question, setQuestion] = useState("");
  const [showAnswer, setShowAnswer] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Évite de renvoyer la même question lors d'un nouvel effet
  const lastDispatchedQuestion = useRef<string | null>(null);

  // La réponse du store peut être un objet (API) ou une simple chaîne : on normalise
  const response = useMemo<RagResponse | null>(() => {
    if (!answer) return null;
    if (typeof answer === "string") return { answer };
    return answer as unknown as RagResponse;
  }, [answer]);

  const answerText = response?.answer ?? response?.error ?? "";

  // Documents associés : champ `documents` s'il existe, sinon déduits des `sources` de l'API
  const documents = useMemo<DocumentItem[]>(() => {
    if (!response) return [];
    if (response.documents && response.documents.length > 0) {
      return response.documents;
    }

    const byName = new Map<string, DocumentItem>();
    for (const source of response.sources ?? []) {
      if (!source.name) continue;
      const existing = byName.get(source.name);
      if (existing) {
        if (source.n) existing.refs = [...(existing.refs ?? []), source.n];
        continue;
      }
      byName.set(source.name, {
        name: source.name,
        view_url: source.link ?? null,
        refs: source.n ? [source.n] : [],
      });
    }
    return Array.from(byName.values());
  }, [response]);

  // Envoi d'une question
  const submitQuestion = (questionText: string) => {
    const trimmedQuestion = questionText.trim();

    if (!trimmedQuestion || questionLoading) {
      return;
    }

    setShowAnswer(false);
    setCopySuccess(false);

    dispatch(sendQuestion(trimmedQuestion));
  };

  // Récupération de la question envoyée depuis la page d'accueil
  useEffect(() => {
    const initialQuestion = location.state?.question;

    if (typeof initialQuestion !== "string" || !initialQuestion.trim()) {
      return;
    }

    const trimmedQuestion = initialQuestion.trim();

    if (lastDispatchedQuestion.current === trimmedQuestion) {
      return;
    }

    lastDispatchedQuestion.current = trimmedQuestion;
    setQuestion(trimmedQuestion);
    submitQuestion(trimmedQuestion);
    // submitQuestion dépend de questionLoading : on ne relance volontairement
    // l'envoi que lorsque la question de navigation change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, dispatch]);

  // Affiche la nouvelle réponse lorsqu'elle est mise à jour
  useEffect(() => {
    if (answer) {
      setShowAnswer(true);
    }
  }, [answer]);

  // Soumission du formulaire
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitQuestion(question);
  };

  // Ctrl + Entrée (ou Cmd + Entrée) envoie la question
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      submitQuestion(question);
    }
  };

  // Copie de la réponse (le texte, pas l'objet de réponse complet)
  const handleCopy = async () => {
    if (!answerText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(answerText);
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setCopySuccess(false);
    }
  };

  // Préparation d'une nouvelle question
  const handleNewQuestion = () => {
    setQuestion("");
    setShowAnswer(false);
    setCopySuccess(false);
    lastDispatchedQuestion.current = null;
    textareaRef.current?.focus();
  };

// Functon qui permmet de reconnaitre les demandes explicites de documents: 
  function isDocumentRequest(question;: string) boolean {
    
  }

  return (
    <main className="assistant-page">
      <div className="assistant-container">
        {/* En-tête */}
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
            {questionLoading ? "Recherche en cours..." : "Prêt à vous aider"}
          </div>
        </header>

        {/* Présentation */}
        <section className="assistant-hero">
          <div className="hero-badge">✦ Assistant intelligent</div>

          <h2>
            Bonjour, que puis-je
            <span> faire pour vous ?</span>
          </h2>

          <p className="hero-description">
            Posez une question concernant la documentation, les procédures ou
            les informations disponibles dans l'entreprise.
          </p>
        </section>

        {/* Formulaire de question */}
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
            <label htmlFor="assistant-question" className="input-label">
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
                  Décrivez votre demande avec précision. Ctrl + Entrée pour
                  envoyer.
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

          {/* Erreur Redux */}
          {questionError && (
            <div className="error-message" role="alert">
              {questionError}
            </div>
          )}

          {/* Réponse de l'assistant (la zone live existe avant la réponse,
              ce qui permet aux lecteurs d'écran de l'annoncer) */}
          <div aria-live="polite">
            {showAnswer && response && (
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
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer">
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

                {/* Documents associés à la réponse */}
                {documents.length > 0 && (
                  <section className="answer-documents">
                    <div className="documents-heading">
                      <h4>Documents disponibles</h4>
                      <p>Voici les documents associés à votre recherche.</p>
                    </div>

                    <div className="documents-list">
                      {documents.map((doc) => (
                        <article
                          className="document-item"
                          key={doc.drive_id ?? doc.view_url ?? doc.name}
                        >
                          <div className="document-icon" aria-hidden="true">
                            📄
                          </div>

                          <div className="document-info">
                            <h5>{doc.name}</h5>
                            <p>
                              Document disponible sur Google Drive
                              {doc.refs && doc.refs.length > 0
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

        {/* Pied de page */}
        <footer className="assistant-footer">
          <span>✦ Propulsé par l'IA et votre base documentaire</span>
        </footer>
      </div>
    </main>
  );
}

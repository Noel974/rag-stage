
import EvaluationChart from "./evaluationchart";

// ========================================
// INTERFACES TYPESCRIPT
// ========================================

interface Evaluation {
  filename?: string;
  hit?: boolean;
  search_ms?: number | string | null;
  generation_ms?: number | string | null;
  latency_ms?: number | string | null;
  ragas?: Record<string, unknown> | null;
}

interface EvaluationCardProps {
  evaluation?: Evaluation;
}

// ========================================
// COMPOSANT CARTE ÉVALUATION
// ========================================

function EvaluationCard({
  evaluation = {},
}: EvaluationCardProps) {
  const hit = Boolean(evaluation.hit);

  const ragasScores =
    evaluation.ragas &&
    typeof evaluation.ragas === "object" &&
    !Array.isArray(evaluation.ragas)
      ? Object.entries(evaluation.ragas)
      : [];

  // ========================================
  // FORMATAGE DES SCORES
  // ========================================

  const formatScore = (value: unknown): string => {
    if (typeof value === "number") {
      return Number.isFinite(value)
        ? value.toFixed(3)
        : "N/A";
    }

    return String(value ?? "N/A");
  };

  // ========================================
  // RENDU DU COMPOSANT
  // ========================================

  return (
    <div className="col-md-6 col-xl-4 mb-4">
      <div className="ragas-evaluation-card">
        <div className="ragas-evaluation-body">

          <div className="ragas-evaluation-header">
            <h5>{evaluation.filename}</h5>

            <span
              className={
                hit
                  ? "ragas-badge-success"
                  : "ragas-badge-danger"
              }
            >
              {hit ? "Hit" : "Miss"}
            </span>
          </div>

          <hr />

          <EvaluationChart evaluation={evaluation} />

          {ragasScores.length > 0 && (
            <div className="ragas-scores">
              {ragasScores.map(([key, value]) => (
                <div key={key}>
                  <span>{key}</span>
                  <strong>
                    {formatScore(value)}
                  </strong>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default EvaluationCard;

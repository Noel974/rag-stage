
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  EvaluationReport,
  RagasAggregate,
} from "../services/api";

interface EvaluationSummaryProps {
  evaluations?: EvaluationReport[];
  loading?: boolean;
}

const formatPercent = (value: number | null) =>
  value == null ? "N/A" : `${(value * 100).toFixed(1)}%`;

const formatNumber = (value: number | null, decimals = 3) =>
  value == null ? "N/A" : value.toFixed(decimals);

const average = (values: (number | null | undefined)[]) => {
  const valid = values.filter(
    (v): v is number =>
      typeof v === "number" && Number.isFinite(v)
  );

  return valid.length
    ? valid.reduce((a, b) => a + b, 0) / valid.length
    : null;
};

function EvaluationSummary({
  evaluations = [],
  loading = false,
}: EvaluationSummaryProps) {

  if (loading) {
    return (
      <div className="summary-empty">
        <h5>Chargement des évaluations RAGAS...</h5>
      </div>
    );
  }

  if (!evaluations.length) {
    return (
      <div className="summary-empty">
        <div className="summary-empty-icon">📊</div>
        <h5>Aucune évaluation disponible</h5>
        <p>Les résultats RAGAS apparaîtront ici.</p>
      </div>
    );
  }

  // ==========================================
  // EXTRACTION DES AGRÉGATS
  // ==========================================

  const aggregates: RagasAggregate[] = evaluations
    .map((evaluation) => evaluation.aggregate)
    .filter(
      (aggregate): aggregate is RagasAggregate =>
        aggregate != null
    );

  if (!aggregates.length) {
    return (
      <div className="summary-empty">
        <h5>Aucun agrégat RAGAS disponible</h5>
        <p>Vérifiez le contenu des rapports retournés par l'API.</p>
      </div>
    );
  }

  const total = aggregates.reduce(
    (sum, item) => sum + (item.n_questions ?? 0),
    0
  );

  const totalAnswerable = aggregates.reduce(
    (sum, item) => sum + (item.n_answerable ?? 0),
    0
  );

  // ==========================================
  // MOYENNES PONDÉRÉES
  // ==========================================

  const weightedAverage = (
    key: keyof RagasAggregate
  ): number | null => {
    let weightedSum = 0;
    let count = 0;

    aggregates.forEach((item) => {
      const value = item[key];

      if (
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        const weight = item.n_questions ?? 1;
        weightedSum += value * weight;
        count += weight;
      }
    });

    return count ? weightedSum / count : null;
  };

  const hitRate = weightedAverage("hit_rate");
  const mrr = weightedAverage("mrr");
  const abstention = weightedAverage("abstention_rate");
  const faithfulness = weightedAverage("faithfulness");
  const answerRelevancy = weightedAverage("answer_relevancy");
  const contextPrecision = weightedAverage("context_precision");
  const contextRecall = weightedAverage("context_recall");

  const avgLatency = weightedAverage("avg_latency_ms");

  const errors = aggregates.reduce(
    (sum, item) => sum + (item.errors ?? 0),
    0
  );

  // ==========================================
  // TEMPS DE TRAITEMENT
  // ==========================================

  const allResults = evaluations.flatMap(
    (evaluation) => evaluation.results ?? []
  );

  const avgSearch = average(
    allResults.map((item) => item.search_ms)
  );

  const avgGeneration = average(
    allResults.map((item) => item.generation_ms)
  );

  // ==========================================
  // DONNÉES GRAPHIQUE
  // ==========================================

  const chartData = [
    { name: "Recherche", temps: avgSearch ?? 0 },
    { name: "Génération", temps: avgGeneration ?? 0 },
    { name: "Latence totale", temps: avgLatency ?? 0 },
  ];

  // ==========================================
  // STATISTIQUES
  // ==========================================

  const stats = [
    {
      title: "Total questions",
      value: total,
      icon: "📊",
      color: "indigo",
      description: "Questions évaluées",
    },
    {
      title: "Hit Rate",
      value: formatPercent(hitRate),
      icon: "🎯",
      color: "green",
      description: "Documents pertinents retrouvés",
    },
    {
      title: "MRR moyen",
      value: formatNumber(mrr),
      icon: "🏆",
      color: "purple",
      description: "Qualité du classement",
    },
    {
      title: "Abstention",
      value: formatPercent(abstention),
      icon: "🛡️",
      color: "orange",
      description: "Questions sans réponse",
    },
    {
      title: "Faithfulness",
      value: formatPercent(faithfulness),
      icon: "🧠",
      color: "blue",
      description: "Fidélité des réponses",
    },
    {
      title: "Context Precision",
      value: formatPercent(contextPrecision),
      icon: "🔎",
      color: "cyan",
      description: "Précision du contexte",
    },
    {
      title: "Context Recall",
      value: formatPercent(contextRecall),
      icon: "📚",
      color: "pink",
      description: "Rappel du contexte",
    },
    {
      title: "Erreurs",
      value: errors,
      icon: "⚠️",
      color: "orange",
      description: "Erreurs rencontrées",
    },
  ];

  // ==========================================
  // SCORES RAGAS
  // ==========================================

  const ragasMetrics = [
    {
      name: "Faithfulness",
      value: faithfulness,
    },
    {
      name: "Answer Relevancy",
      value: answerRelevancy,
    },
    {
      name: "Context Precision",
      value: contextPrecision,
    },
    {
      name: "Context Recall",
      value: contextRecall,
    },
  ];

  return (
    <div className="summary-dashboard">

      {/* INTRODUCTION */}

      <div className="summary-intro">
        <div>
          <span className="summary-eyebrow">
            ANALYTICS & PERFORMANCE
          </span>

          <h3>Vue globale des évaluations RAGAS</h3>

          <p>
            Analyse des performances et de la qualité
            du système RAG.
          </p>
        </div>

        <div className="summary-total-badge">
          <span className="summary-live-dot" />
          {evaluations.length} rapports analysés
        </div>
      </div>

      {/* STATISTIQUES */}

      <div className="summary-stats-grid">
        {stats.map((stat, index) => (
          <div
            key={stat.title}
            className={`summary-stat-card summary-${stat.color}`}
            style={{ animationDelay: `${index * 0.06}s` }}
          >
            <div className="summary-stat-top">
              <div className="summary-stat-icon">
                {stat.icon}
              </div>

              <span className="summary-stat-label">
                {stat.title}
              </span>
            </div>

            <h2 className="summary-stat-value">
              {stat.value}
            </h2>

            <p className="summary-stat-description">
              {stat.description}
            </p>
          </div>
        ))}
      </div>

      {/* GRAPHIQUE TEMPS */}

      <div className="summary-panel">

        <div className="summary-panel-header">
          <div>
            <span className="summary-eyebrow">
              PERFORMANCE
            </span>

            <h5>Temps moyen d'exécution</h5>

            <p>
              Comparaison des temps de traitement en millisecondes.
            </p>
          </div>

          <span className="summary-chart-tag">
            Moyenne globale
          </span>
        </div>

        <div className="summary-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                right: 20,
                left: 0,
                bottom: 5,
              }}
              barCategoryGap="35%"
            >
              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="#edf0f5"
              />

              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />

              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e8edf5",
                }}
                formatter={(value) => [
                  `${Number(value).toFixed(2)} ms`,
                  "Temps moyen",
                ]}
              />

              <Bar
                dataKey="temps"
                fill="#6366f1"
                radius={[8, 8, 0, 0]}
                barSize={55}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SCORES RAGAS */}

      <div className="summary-panel">

        <div className="summary-panel-header">
          <div>
            <span className="summary-eyebrow">
              QUALITÉ DU SYSTÈME
            </span>

            <h5>Indicateurs RAGAS</h5>

            <p>
              Scores calculés à partir des agrégats des rapports.
            </p>
          </div>

          <span className="summary-chart-tag">
            {ragasMetrics.length} métriques
          </span>
        </div>

        <div className="summary-ragas-grid">

          {ragasMetrics.map((metric, index) => {
            const percentage =
              metric.value == null
                ? 0
                : Math.max(
                    0,
                    Math.min(100, metric.value * 100)
                  );

            return (
              <div
                key={metric.name}
                className="summary-ragas-item"
              >
                <div className="summary-ragas-info">
                  <span>{metric.name}</span>

                  <strong>
                    {formatPercent(metric.value)}
                  </strong>
                </div>

                <div className="summary-progress-track">
                  <div
                    className="summary-progress-bar"
                    style={{
                      width: `${percentage}%`,
                      animationDelay: `${index * 0.1}s`,
                    }}
                  />
                </div>
              </div>
            );
          })}

        </div>
      </div>

      {/* INFORMATIONS COMPLEMENTAIRES */}

      <div className="summary-panel">
        <h5>Informations complémentaires</h5>

        <p>
          Questions répondables : {totalAnswerable}/{total}
        </p>

        <p>
          Latence moyenne :{" "}
          {avgLatency == null
            ? "N/A"
            : `${avgLatency.toFixed(0)} ms`}
        </p>

        <p>
          Nombre total d'erreurs : {errors}
        </p>

        <p>
          Pertinence des réponses : {formatPercent(answerRelevancy)}
        </p>
      </div>

    </div>
  );
}

export default EvaluationSummary;

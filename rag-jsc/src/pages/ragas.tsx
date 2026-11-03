
import { useEffect } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchEvaluations,
  fetchSystemMetrics,
  fetchSystemMetricsHistory,
} from "../redux/features/ragSlice";

import {
  useAppDispatch,
  useAppSelector,
} from "../redux/store/hoooks";

// ========================================
// CARTE STATISTIQUE
// ========================================

function StatCard({ title, value, unit, color, icon }) {
  return (
    <div className="col-md-6 col-xl-3 mb-4">
      <div className={`ragas-stat-card ragas-stat-${color}`}>

        <div className="ragas-stat-content">

          <div>
            <p className="ragas-stat-title">
              {title}
            </p>

            <h3 className="ragas-stat-value">
              {value} {unit}
            </h3>
          </div>

          <div className="ragas-stat-icon">
            {icon}
          </div>

        </div>

      </div>
    </div>
  );
}

// ========================================
// GRAPHIQUE DES TEMPS D'EXÉCUTION
// ========================================

function EvaluationChart({ evaluation }) {
  const data = [
    {
      name: "Recherche",
      temps: Number(evaluation.search_ms ?? 0),
    },
    {
      name: "Génération",
      temps: Number(evaluation.generation_ms ?? 0),
    },
    {
      name: "Latence totale",
      temps: Number(evaluation.latency_ms ?? 0),
    },
  ];

  return (
    <div className="ragas-chart-container">

      <ResponsiveContainer width="100%" height="100%">

        <BarChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: -15,
            bottom: 5,
          }}
        >

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
          />

          <XAxis
            dataKey="name"
            tick={{
              fontSize: 11,
              fill: "#64748b",
            }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tick={{
              fontSize: 11,
              fill: "#64748b",
            }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid #edf0f7",
            }}
            formatter={(value) => [
              `${value} ms`,
              "Temps",
            ]}
          />

          <Bar
            dataKey="temps"
            fill="#6366f1"
            radius={[6, 6, 0, 0]}
            barSize={35}
          />

        </BarChart>

      </ResponsiveContainer>

    </div>
  );
}

// ========================================
// CARTE D'ÉVALUATION
// ========================================

function EvaluationCard({ evaluation }) {
  const hit = Boolean(evaluation.hit);

  const ragasScores = evaluation.ragas
    ? Object.entries(evaluation.ragas)
    : [];

  return (
    <div className="col-md-6 col-xl-4 mb-4">

      <div className="ragas-evaluation-card">

        <div className="ragas-evaluation-body">

          {/* EN-TÊTE */}

          <div className="ragas-evaluation-header">

            <h5 className="ragas-filename">
              {evaluation.filename ?? "Document sans nom"}
            </h5>

            <span
              className={`ragas-badge ${
                hit
                  ? "ragas-badge-success"
                  : "ragas-badge-danger"
              }`}
            >
              {hit ? "Hit" : "Miss"}
            </span>

          </div>

          <hr className="ragas-divider" />

          {/* MÉTRIQUES */}

          <div className="row g-3 mb-3">

            <div className="col-6">

              <div className="ragas-metric-box">

                <p className="ragas-metric-label">
                  Hit Rate
                </p>

                <h3
                  className={`ragas-metric-value ${
                    hit
                      ? "ragas-text-success"
                      : "ragas-text-danger"
                  }`}
                >
                  {hit ? "100%" : "0%"}
                </h3>

              </div>

            </div>

            <div className="col-6">

              <div className="ragas-metric-box">

                <p className="ragas-metric-label">
                  Reciprocal Rank
                </p>

                <h3 className="ragas-metric-value ragas-text-primary">
                  {evaluation.rr ?? "N/A"}
                </h3>

              </div>

            </div>

          </div>

          <hr className="ragas-divider" />

          {/* TEMPS D'EXÉCUTION */}

          <h6 className="ragas-chart-title">
            Temps d'exécution
          </h6>

          <EvaluationChart evaluation={evaluation} />

          <hr className="ragas-divider" />

          {/* ABSTENTION */}

          <div className="ragas-evaluation-details">

            <p>
              <strong>Abstention :</strong>{" "}

              {evaluation.abstained === null ||
              evaluation.abstained === undefined
                ? "Non renseignée"
                : evaluation.abstained
                  ? "Oui"
                  : "Non"}
            </p>

            <p>
              <strong>Erreur :</strong>{" "}

              {evaluation.error || "Aucune"}
            </p>

          </div>

          {/* SCORES RAGAS */}

          {ragasScores.length > 0 && (

            <div className="mt-3">

              <h6 className="ragas-chart-title">
                Scores RAGAS
              </h6>

              <div className="ragas-scores">

                {ragasScores.map(([key, value]) => (

                  <div
                    key={key}
                    className="ragas-score-item"
                  >

                    <span className="ragas-score-name">
                      {key.replaceAll("_", " ")}
                    </span>

                    <strong className="ragas-score-value">
                      {typeof value === "number"
                        ? value.toFixed(3)
                        : String(value ?? "N/A")}
                    </strong>

                  </div>

                ))}

              </div>

            </div>

          )}

        </div>

      </div>

    </div>
  );
}

// ========================================
// COMPOSANT PRINCIPAL
// ========================================

function RagasDashboard() {

  const dispatch = useAppDispatch();

  const {
    evaluations,
    evaluationsLoading,
    evaluationsError,

    systemMetrics,
    systemMetricsHistory,
    systemMetricsLoading,
    systemMetricsError,

  } = useAppSelector((state) => state.rag);

  // ========================================
  // CHARGEMENT DES DONNÉES
  // ========================================

  useEffect(() => {

    dispatch(fetchEvaluations());

    dispatch(fetchSystemMetricsHistory(100));

    dispatch(fetchSystemMetrics());

    const interval = setInterval(() => {

      dispatch(fetchSystemMetrics());

    }, 60000);

    return () => clearInterval(interval);

  }, [dispatch]);

  // ========================================
  // ACTUALISATION MANUELLE
  // ========================================

  const handleRefresh = () => {

    dispatch(fetchEvaluations());

    dispatch(fetchSystemMetricsHistory(100));

    dispatch(fetchSystemMetrics());

  };

  // ========================================
  // AFFICHAGE
  // ========================================

  return (

    <div className="ragas-dashboard">

      {/* ================================= */}
      {/* HEADER */}
      {/* ================================= */}

      <div className="ragas-header">

        <div>

          <h2>
            Dashboard RAGAS
          </h2>

          <p>
            Suivi des performances et monitoring du système RAG
          </p>

        </div>

        <button
          className="ragas-refresh-btn"
          onClick={handleRefresh}
          disabled={systemMetricsLoading}
        >
          ↻ Actualiser
        </button>

      </div>

      {/* ================================= */}
      {/* MONITORING SYSTÈME */}
      {/* ================================= */}

      <div className="ragas-section-title">

        <h4>
          Monitoring système
        </h4>

      </div>

      {systemMetricsError && (

        <div className="ragas-alert ragas-alert-danger">
          {systemMetricsError}
        </div>

      )}

      {systemMetricsLoading && !systemMetrics ? (

        <div className="ragas-loading">

          <div className="ragas-spinner" />

          <p>
            Chargement des métriques système...
          </p>

        </div>

      ) : systemMetrics ? (

        <div className="row">

          <StatCard
            title="Utilisation CPU"
            value={systemMetrics.cpu_percent ?? "N/A"}
            unit="%"
            color="blue"
            icon="⚡"
          />

          <StatCard
            title="Utilisation RAM"
            value={systemMetrics.memory_percent ?? "N/A"}
            unit="%"
            color="orange"
            icon="💾"
          />

          <StatCard
            title="Documents"
            value={systemMetrics.documents_count ?? 0}
            unit=""
            color="green"
            icon="📄"
          />

          <StatCard
            title="Chunks"
            value={systemMetrics.chunks_count ?? 0}
            unit=""
            color="cyan"
            icon="🧩"
          />

        </div>

      ) : (

        <div className="ragas-alert ragas-alert-info">
          Aucune métrique système disponible.
        </div>

      )}

      {/* ================================= */}
      {/* STOCKAGE PGVECTOR */}
      {/* ================================= */}

      {systemMetrics && (

        <div className="ragas-storage-card">

          <h6>
            Stockage vectoriel
          </h6>

          <h3>
            {systemMetrics.pgvector_size_mb ?? "N/A"} MB
          </h3>

          <p>
            Taille utilisée par Pgvector
          </p>

        </div>

      )}

      {/* ================================= */}
      {/* HISTORIQUE */}
      {/* ================================= */}

      <div className="mb-4">

        <span className="ragas-history-badge">
          {systemMetricsHistory?.length ?? 0} mesures historiques
        </span>

      </div>

      <hr className="ragas-divider" />

      {/* ================================= */}
      {/* ÉVALUATIONS RAGAS */}
      {/* ================================= */}

      <div className="ragas-section-title">

        <h4>
          Évaluations RAGAS
        </h4>

        <span className="ragas-history-badge">
          {evaluations?.length ?? 0} évaluations
        </span>

      </div>

      {evaluationsLoading ? (

        <div className="ragas-loading">

          <div className="ragas-spinner" />

          <p>
            Chargement des évaluations...
          </p>

        </div>

      ) : evaluationsError ? (

        <div className="ragas-alert ragas-alert-danger">

          <strong>Erreur :</strong> {evaluationsError}

        </div>

      ) : !evaluations?.length ? (

        <div className="ragas-alert ragas-alert-info">
          Aucune évaluation disponible.
        </div>

      ) : (

        <div className="row">

          {evaluations.map((evaluation, index) => (

            <EvaluationCard
              key={evaluation.id ?? index}
              evaluation={evaluation}
            />

          ))}

        </div>

      )}

    </div>
  );
}

export default RagasDashboard;
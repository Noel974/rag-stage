
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ========================================
// INTERFACES TYPESCRIPT
// ========================================

interface StatCardProps {
  title: string;
  value: string | number;
  unit: string;
  color: string;
  icon: string;
}

interface HistoryItem {
  timestamp?: string | number;
  cpu_percent?: number | string | null;
  memory_percent?: number | string | null;
}

interface Metrics {
  cpu_percent?: number | string | null;
  memory_percent?: number | string | null;
  documents_count?: number | null;
  chunks_count?: number | null;
  pgvector_size_mb?: number | string | null;
}

interface MetricsSummaryProps {
  metrics: Metrics | null;
  history?: HistoryItem[];
  loading: boolean;
  error?: string | null;
}

// ========================================
// CARTE STATISTIQUE
// ========================================

function StatCard({
  title,
  value,
  unit,
  color,
  icon,
}: StatCardProps) {
  return (
    <div className="col-md-6 col-xl-3 mb-4">
      <div className={`ragas-stat-card ragas-stat-${color}`}>
        <div className="ragas-stat-content">
          <div>
            <p className="ragas-stat-title">{title}</p>
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
// GRAPHIQUE HISTORIQUE CPU / RAM
// ========================================

interface MetricsHistoryChartProps {
  history?: HistoryItem[];
}

function MetricsHistoryChart({
  history,
}: MetricsHistoryChartProps) {
  const data = (history || []).map((item, index) => ({
    name: item.timestamp
      ? new Date(item.timestamp).toLocaleTimeString()
      : `Mesure ${index + 1}`,

    cpu: Number(item.cpu_percent ?? 0),
    memory: Number(item.memory_percent ?? 0),
  }));

  if (!data.length) {
    return (
      <div className="ragas-alert ragas-alert-info">
        Aucune donnée historique disponible.
      </div>
    );
  }

  return (
    <div className="ragas-chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
          />

          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            formatter={(value) => [`${value}%`]}
          />

          <Legend />

          <Area
            type="monotone"
            dataKey="cpu"
            name="CPU"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.15}
          />

          <Area
            type="monotone"
            dataKey="memory"
            name="RAM"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.15}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ========================================
// STOCKAGE VECTORIEL
// ========================================

interface StorageCardProps {
  size?: number | string | null;
}

function StorageCard({ size }: StorageCardProps) {
  return (
    <div className="ragas-storage-card">
      <h6>Stockage vectoriel</h6>

      <h3>{size ?? "N/A"} MB</h3>

      <p>Taille utilisée par PgVector</p>
    </div>
  );
}

// ========================================
// COMPOSANT PRINCIPAL METRICS
// ========================================

function MetricsSummary({
  metrics,
  history,
  loading,
  error,
}: MetricsSummaryProps) {
  if (loading && !metrics) {
    return (
      <div className="ragas-loading">
        <div className="ragas-spinner" />
        <p>Chargement des métriques système...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ragas-alert ragas-alert-danger">
        <strong>Erreur :</strong> {error}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="ragas-alert ragas-alert-info">
        Aucune métrique système disponible.
      </div>
    );
  }

  return (
    <div className="ragas-metrics-summary">

      {/* STATISTIQUES */}

      <div className="row">

        <StatCard
          title="Utilisation CPU"
          value={metrics.cpu_percent ?? "N/A"}
          unit="%"
          color="blue"
          icon="⚡"
        />

        <StatCard
          title="Utilisation RAM"
          value={metrics.memory_percent ?? "N/A"}
          unit="%"
          color="orange"
          icon="💾"
        />

        <StatCard
          title="Documents"
          value={metrics.documents_count ?? 0}
          unit=""
          color="green"
          icon="📄"
        />

        <StatCard
          title="Chunks"
          value={metrics.chunks_count ?? 0}
          unit=""
          color="cyan"
          icon="🧩"
        />

      </div>

      {/* STOCKAGE */}

      <StorageCard
        size={metrics.pgvector_size_mb}
      />

      {/* HISTORIQUE */}

      <div className="ragas-section-title mt-4">
        <h4>Historique des performances</h4>

        <span className="ragas-history-badge">
          {history?.length ?? 0} mesures historiques
        </span>
      </div>

      <div className="ragas-evaluation-card">
        <div className="ragas-evaluation-body">

          <h6 className="ragas-chart-title">
            Évolution CPU et RAM
          </h6>

          <MetricsHistoryChart history={history} />

        </div>
      </div>

    </div>
  );
}

export default MetricsSummary;

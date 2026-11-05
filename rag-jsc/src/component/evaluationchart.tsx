
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

// ========================================
// INTERFACES TYPESCRIPT
// ========================================

interface Evaluation {
  search_ms?: number | string | null;
  generation_ms?: number | string | null;
  latency_ms?: number | string | null;
}

interface EvaluationChartProps {
  evaluation?: Evaluation;
}

// ========================================
// COMPOSANT GRAPHIQUE ÉVALUATION
// ========================================

function EvaluationChart({
  evaluation = {},
}: EvaluationChartProps) {
  const data = [
    {
      name: "Recherche",
      temps: Number(evaluation.search_ms) || 0,
    },
    {
      name: "Génération",
      temps: Number(evaluation.generation_ms) || 0,
    },
    {
      name: "Latence totale",
      temps: Number(evaluation.latency_ms) || 0,
    },
  ];

  return (
    <div className="ragas-chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />

          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${value} ms`}
          />

          <Tooltip
            formatter={(value) => [
              `${value} ms`,
              "Temps d'exécution",
            ]}
          />

          <Bar
            dataKey="temps"
            fill="#6366f1"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default EvaluationChart;


// ========================================
// INTERFACE TYPESCRIPT
// ========================================

interface StorageMetrics {
  pgvector_size_mb?: number | string | null;
}

interface StorageCardProps {
  metrics: StorageMetrics | null;
}

// ========================================
// COMPOSANT STOCKAGE VECTORIEL
// ========================================

function StorageCard({ metrics }: StorageCardProps) {
  if (!metrics) return null;

  return (
    <div className="ragas-storage-card">
      <h6>Stockage vectoriel</h6>

      <h3>
        {metrics.pgvector_size_mb ?? "N/A"} MB
      </h3>

      <p>
        Taille utilisée par Pgvector
      </p>
    </div>
  );
}

export default StorageCard;

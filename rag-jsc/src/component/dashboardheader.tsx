function DashboardHeader({
  onRefresh,
  loading,
}) {
  return (
    <div className="ragas-header">
      <div>
        <h2>Dashboard RAGAS</h2>

        <p>
          Suivi des performances et monitoring
          du système RAG
        </p>
      </div>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="ragas-refresh-btn"
      >
        ↻ Actualiser
      </button>
    </div>
  );
}

export default DashboardHeader;
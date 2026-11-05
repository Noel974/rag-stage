
import { useCallback, useEffect } from "react";

import {
  fetchEvaluations,
  fetchSystemMetrics,
  fetchSystemMetricsHistory,
  useAppDispatch,
  useAppSelector,
} from "../redux";

import {
  selectEvaluations,
  selectEvaluationsError,
  selectEvaluationsLoading,
} from "../redux/features/ragas/ragas.selectors";

import {
  selectSystemMetrics,
  selectSystemMetricsError,
  selectSystemMetricsHistory,
  selectSystemMetricsLoading,
} from "../redux/features/metrics/metrics.selectors";

import DashboardHeader from "../component/dashboardheader";
import EmptyState from "../component/emptystate";
import ErrorState from "../component/errorstate";
import LoadingState from "../component/loadingstate";
import StorageCard from "../component/stroragecard";

import EvaluationSummary from "../component/evaluation";
import MetricsSummary from "../component/metric";

function RagasDashboard() {
  const dispatch = useAppDispatch();

  // ======================================
  // RAGAS : EVALUATIONS
  // ======================================

  const evaluations = useAppSelector(selectEvaluations);
  const evaluationsLoading = useAppSelector(selectEvaluationsLoading);
  const evaluationsError = useAppSelector(selectEvaluationsError);

  // ======================================
  // SYSTEM METRICS
  // ======================================

  const systemMetrics = useAppSelector(selectSystemMetrics);

  const systemMetricsHistory = useAppSelector(
    selectSystemMetricsHistory
  );

  const systemMetricsLoading = useAppSelector(
    selectSystemMetricsLoading
  );

  const systemMetricsError = useAppSelector(
    selectSystemMetricsError
  );

  // ======================================
  // REFRESH
  // ======================================

  const handleRefresh = useCallback(() => {
    dispatch(fetchEvaluations());
    dispatch(fetchSystemMetricsHistory(100));
    dispatch(fetchSystemMetrics());
  }, [dispatch]);

  // ======================================
  // INITIALISATION + AUTO REFRESH
  // ======================================

  useEffect(() => {
    handleRefresh();

    const interval = setInterval(() => {
      dispatch(fetchSystemMetrics());
    }, 60000);

    return () => clearInterval(interval);
  }, [dispatch, handleRefresh]);

  // ======================================
  // SECURISATION DES DONNEES
  // ======================================

  const evaluationsList = Array.isArray(evaluations)
    ? evaluations
    : [];

  const historyList = Array.isArray(systemMetricsHistory)
    ? systemMetricsHistory
    : [];

  // ======================================
  // RENDER
  // ======================================

  return (
    <div className="ragas-dashboard">

      <DashboardHeader
        onRefresh={handleRefresh}
        loading={systemMetricsLoading}
      />

      <MetricsSummary
        metrics={systemMetrics}
        history={historyList}
        loading={systemMetricsLoading}
        error={systemMetricsError}
      />

      <StorageCard metrics={systemMetrics} />

      <hr className="ragas-divider" />

      {evaluationsLoading ? (
        <LoadingState />
      ) : evaluationsError ? (
        <ErrorState error={evaluationsError} />
      ) : evaluationsList.length === 0 ? (
        <EmptyState />
      ) : (
        <EvaluationSummary
          evaluations={evaluationsList}
        />
      )}

    </div>
  );
}

export default RagasDashboard;

function ErrorState({ error }) {
  return (
    <div className="ragas-alert ragas-alert-danger">
      <strong>Erreur :</strong> {error}
    </div>
  );
}

export default ErrorState;
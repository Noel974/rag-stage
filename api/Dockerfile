# Réutilise l'image d'ingestion : torch CPU, sentence-transformers,
# psycopg2 et le modèle multilingual-e5-base y sont déjà installés.
FROM rag-ingest:latest

WORKDIR /app
RUN pip install --no-cache-dir --retries 5 flask flask-cors gunicorn requests
COPY app.py .

EXPOSE 8000
# 1 worker : le modèle n'est chargé qu'une fois en mémoire, 4 threads pour les requêtes
CMD ["gunicorn", "-b", "0.0.0.0:8000", "-w", "1", "--threads", "4", "--timeout", "120", "app:app"]
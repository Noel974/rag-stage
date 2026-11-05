
FROM rag-ingest:latest

WORKDIR /app

# Installer les dépendances
COPY requirements.txt /app/requirements.txt

RUN python -m pip install --no-cache-dir -r requirements.txt

# Copier les fichiers nécessaires
COPY api/ /app/api/
COPY evaluation/ /app/evaluation/

# Créer les dossiers de résultats
RUN mkdir -p /app/evaluation/reports /app/results

CMD ["python", "/app/evaluation/evaluate_rag.py"]

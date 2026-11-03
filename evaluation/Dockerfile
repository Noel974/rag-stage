FROM python:3.12-slim

WORKDIR /app

WORKDIR /app

# Installation des dépendances
RUN pip install --no-cache-dir \
    ragas==0.4.3 \
    langchain-core==1.7.3 \
    langchain-community==0.4.2 \
    langchain-mistralai==1.1.6 \
    langchain-huggingface \
    sentence-transformers \
    numpy \
    flask \
    psutil \
    flask-cors \
    gunicorn \
    requests \
    python-dotenv \
    psycopg2-binary \
    pgvector
    
# Vérification de psycopg2
RUN python -c "import psycopg2; from psycopg2.extras import Json, execute_values; print('PSYCOPG2 OK:', psycopg2.__version__)"

# Copier les fichiers API
COPY api/ /app/api/

# Copier les fichiers evaluation
COPY evaluation/ /app/evaluation/

# Dossier des rapports
RUN mkdir -p /app/evaluation/reports /app/results

CMD ["python", "/app/evaluation/evaluate_rag.py"]
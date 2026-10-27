FROM python:3.12-slim

# PyTorch version CPU (beaucoup plus léger que la version GPU)
RUN pip install --no-cache-dir --retries 5 torch --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir --retries 5 \
    langchain-huggingface langchain-mistralai sentence-transformers \
    google-api-python-client google-auth psycopg2-binary pgvector

# Le modèle est téléchargé au build, pas à chaque exécution
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-base')"

# Ajout pour l'ingestion (couche séparée : le cache évite de tout refaire)
RUN pip install --no-cache-dir --retries 5 pypdf openpyxl xlrd pandas pyarrow
 
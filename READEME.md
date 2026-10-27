# RAG Google Drive : Kestra, pgvector, Flask et Mistral

Prototype de système RAG (Retrieval-Augmented Generation) qui indexe automatiquement les documents d'un dossier Google Drive et permet de les interroger en langage naturel.

- **Orchestration** : Kestra planifie et exécute l'ingestion (Drive, extraction, découpage, embeddings, pgvector).
- **Stockage vectoriel** : PostgreSQL avec l'extension pgvector.
- **API** : Flask (recherche sémantique, génération de la réponse avec Mistral, sources citées).
- **Notifications** : Slack signale chaque exécution (mise à jour effectuée, rien de nouveau, erreur).
- **Front** : React (à venir).

> État du projet : l'ingestion, la mise à jour incrémentale, la recherche et l'API sont validées. Le front React reste à développer.

---

## Sommaire

1. [Architecture](#1-architecture)
2. [Structure du projet](#2-structure-du-projet)
3. [Prérequis](#3-prérequis)
4. [Configuration](#4-configuration)
5. [Encodage des secrets et des données](#5-encodage-des-secrets-et-des-données)
6. [Rôle des Dockerfile et des services](#6-rôle-des-dockerfile-et-des-services)
7. [Base de données](#7-base-de-données)
8. [Flow d'ingestion Kestra](#8-flow-dingestion-kestra)
9. [API](#9-api)
10. [Démarrage](#10-démarrage)
11. [Tests et vérifications](#11-tests-et-vérifications)
12. [Dépannage](#12-dépannage)
13. [Historique de création](#13-historique-de-création)
14. [Sécurité](#14-sécurité)
15. [Limites et évolutions](#15-limites-et-évolutions)

---

## 1. Architecture

```
Google Drive ──► Kestra (flow ingest_drive) ──écrit──► pgvector ◄──lit── API Flask ◄──► React
                     │                                                     │
                     └──► Slack (résumé / erreurs)                          └──► Mistral (génération)
```

Kestra et l'API ne communiquent pas directement : **la base pgvector est le point de rencontre**. Kestra écrit, l'API lit.

Règles qui garantissent la cohérence entre indexation et recherche :

| Règle | Valeur |
|---|---|
| Modèle d'embedding (ingestion **et** API) | `intfloat/multilingual-e5-base` (768 dimensions, CPU) |
| Préfixe des documents | `passage: ` (ajouté par Kestra) |
| Préfixe des questions | `query: ` (ajouté par l'API) |
| Normalisation | `normalize_embeddings=True` des deux côtés |
| Distance | cosinus (`<=>` côté requête, `vector_cosine_ops` pour l'index) |

Un changement de modèle impose de modifier la dimension du vecteur dans `sql/init.sql` et de réindexer tous les documents.

### Technologies

| Composant | Technologie |
|---|---|
| Orchestrateur | Kestra 1.3 (édition open source, Docker) |
| Base de l'orchestrateur | PostgreSQL 18 (séparée de la base RAG) |
| Base vectorielle | PostgreSQL + pgvector (`pgvector/pgvector:pg18`), index HNSW |
| Embeddings | sentence-transformers, `multilingual-e5-base`, PyTorch CPU |
| Génération | Mistral (`open-mistral-7b`) via l'API REST |
| API | Flask, gunicorn |
| Source des données | Google Drive API v3 (compte de service) |
| Notifications | Slack (webhook entrant) |

---

## 2. Structure du projet

```
Stage/
├── docker-compose.yml        # postgres (Kestra), pgvector, kestra, api
├── .env                      # secrets (ne jamais versionner)
├── .gitignore
├── README.md
├── Dockerfile                # image d'ingestion rag-ingest (ou ingest/Dockerfile)
├── sql/
│   └── init.sql              # schéma pgvector (tables, index)
├── flows/
│   └── ingest_drive.yaml     # copie du flow Kestra
├── api/
│   ├── Dockerfile            # image de l'API
│   └── app.py                # API Flask
└── donnee/                   # dossier monté dans Kestra
```

Le flow est exécuté dans Kestra : le fichier `flows/ingest_drive.yaml` n'est qu'une copie de référence à garder synchronisée avec l'éditeur Kestra.

---

## 3. Prérequis

- Docker Desktop (Windows) et Docker Compose.
- Un compte Google avec un dossier Drive contenant les documents.
- Un projet Google Cloud avec l'API Google Drive activée.
- Un espace de travail Slack et une application avec un webhook entrant.
- Une clé API Mistral.
- PowerShell pour les commandes de ce document (les équivalents Linux et macOS sont indiqués pour le base64).

---

## 4. Configuration

### 4.1 Google Drive

1. Créer un projet Google Cloud et activer **Google Drive API** (API et services, Bibliothèque).
2. Créer un **compte de service** (IAM et administration, Comptes de service). Aucun rôle IAM n'est nécessaire.
3. Créer une clé **JSON** pour ce compte (Clés, Ajouter une clé).
4. Dans Drive, **partager le dossier** à indexer avec l'adresse `...@<projet>.iam.gserviceaccount.com` en **Lecteur**. Sans ce partage, l'API Drive renvoie une liste vide.
5. Récupérer l'**ID du dossier** : la fin de l'URL `drive.google.com/drive/folders/<ID>`. Cet identifiant n'est pas un secret, il se place dans les variables du flow.

**Blocage de création de clé.** Les organisations Google Cloud récentes appliquent la règle `iam.disableServiceAccountKeyCreation`. La résolution suivie dans ce projet :

1. S'attribuer le rôle **Administration des règles de l'organisation** (`roles/orgpolicy.policyAdmin`) au niveau de l'organisation.
2. Sur le **projet** uniquement, ouvrir la règle `iam.disableServiceAccountKeyCreation` (ancienne version, état Active), puis Gérer la règle, Remplacer la règle du parent, Application : Désactivée.
3. Créer la clé, puis remettre la règle sur « Hériter de la règle parente ».

### 4.2 Slack

Une application Slack avec la portée `incoming-webhook` et un webhook lié au canal de notification. Le webhook est lié au canal dès sa création : le bot n'a pas besoin d'y être invité (avec `chat.postMessage` et un bot token, l'erreur `not_in_channel` apparaît tant que le bot n'est pas membre du canal).

### 4.3 Mistral

Créer une clé API sur console.mistral.ai. Le modèle de génération est réglé par la variable `MISTRAL_MODEL` du service `api`. Le modèle `open-mistral-7b` (celui du code de formation) est utilisé ; Mistral le redirige actuellement vers `ministral-8b-latest`. `mistral-small-latest` a renvoyé des erreurs 429 sur le compte de test.

### 4.4 Fichier `.env`

Exemple (valeurs fictives) :

```
# --- Secrets lus par Kestra : préfixe SECRET_, valeur en BASE64 ---
SECRET_GOOGLE_SA_JSON=<contenu du fichier JSON encodé en base64>
SECRET_PGVECTOR_PASSWORD=<mot de passe pgvector encodé en base64>
SECRET_SLACK_WEBHOOK=<URL du webhook encodée en base64>

# --- Variable lue par l'API : valeur en CLAIR ---
MISTRAL_API_KEY=<clé Mistral en clair>
```

Les secrets optionnels (`SECRET_SLACK_BOT_TOKEN`, `SECRET_MISTRAL_API_KEY`) ne servent qu'à d'éventuels flows de test.

---

## 5. Encodage des secrets et des données

### 5.1 Pourquoi du base64 ?

Kestra (édition open source) expose comme secrets toutes les variables d'environnement préfixées par `SECRET_`, **dont la valeur est en base64**. Au chargement, Kestra décode la valeur : `{{ secret('NOM') }}` (sans le préfixe) renvoie la valeur **en clair** dans le flow.

| Variable dans `.env` | Format | Lue par | Usage dans le flow |
|---|---|---|---|
| `SECRET_GOOGLE_SA_JSON` | base64 | Kestra | `{{ secret('GOOGLE_SA_JSON') }}` |
| `SECRET_PGVECTOR_PASSWORD` | base64 | Kestra | `{{ secret('PGVECTOR_PASSWORD') }}` |
| `SECRET_SLACK_WEBHOOK` | base64 | Kestra | `{{ secret('SLACK_WEBHOOK') }}` |
| `MISTRAL_API_KEY` | **clair** | API Flask | variable d'environnement du service `api` |

L'API ne décode rien : si elle recevait une clé en base64, Mistral répondrait 401.

### 5.2 Commandes d'encodage

PowerShell (Windows), pour un texte :

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("valeur à encoder"))
```

PowerShell, pour un fichier (clé JSON du compte de service), depuis la racine du projet :

```powershell
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\cle-compte-service.json"))
Add-Content -Path .env -Value "SECRET_GOOGLE_SA_JSON=$b64" -Encoding UTF8
```

Linux et macOS :

```bash
echo -n "valeur" | base64 -w0                      # Linux
echo -n "valeur" | base64                          # macOS
base64 -w0 cle-compte-service.json                 # fichier (Linux), -i sous macOS
```

Après l'encodage, **supprimer le fichier JSON** du disque.

### 5.3 Règles de format du `.env`

- Une variable par ligne, `NOM=valeur`, **sans guillemets ni espaces** autour du `=`.
- Le base64 de la clé JSON fait plusieurs milliers de caractères sur **une seule ligne** (aucun retour à la ligne).
- Fichier enregistré en **UTF-8** (PowerShell 5 peut écrire en UTF-16 avec `Add-Content` sans `-Encoding UTF8`).
- Vérifier que chaque variable est sur sa propre ligne : `Add-Content` colle la nouvelle valeur à la dernière ligne si le fichier ne finit pas par un retour à la ligne. Pour des ajouts manuels, préférer VS Code.
- **Recréer** le conteneur après toute modification : `docker compose up -d --force-recreate kestra api`. Un simple redémarrage ne relit pas `.env`.

Vérifier ce que voit Kestra, sans afficher les valeurs :

```powershell
docker exec rag_kestra env | findstr "SECRET_"
```

Vérifier la longueur de la clé Mistral vue par l'API (32 caractères attendus) :

```powershell
docker exec rag_api python -c "import os; print(len(os.environ.get('MISTRAL_API_KEY','')))"
```

### 5.4 Encodage des requêtes vers l'API

PowerShell 5 envoie les chaînes dans l'encodage de la console, ce qui corrompt les accents. Il faut envoyer le corps en octets UTF-8 :

```powershell
$body = [Text.Encoding]::UTF8.GetBytes('{"question":"Quelle est la durée de conservation ?"}')
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/ask `
  -ContentType "application/json; charset=utf-8" -Body $body | ConvertTo-Json -Depth 5
```

Côté ingestion, les fichiers texte sont décodés en `utf-8-sig` puis en `latin-1` en repli, et les caractères nuls (`\x00`), refusés par PostgreSQL, sont retirés avant l'écriture.

---

## 6. Rôle des Dockerfile et des services

### 6.1 `Dockerfile` racine : image `rag-ingest`

Image utilisée par les tâches Python de Kestra (via le Docker task runner). Elle contient tout ce que le script d'ingestion importe :

| Couche | Rôle |
|---|---|
| `python:3.12-slim` | Base légère |
| `torch` (index CPU) | PyTorch sans GPU, beaucoup plus léger que la version complète |
| `langchain-huggingface`, `langchain-mistralai`, `sentence-transformers` | Calcul des embeddings |
| `google-api-python-client`, `google-auth` | Accès à l'API Drive |
| `psycopg2-binary`, `pgvector` | Connexion à PostgreSQL |
| Téléchargement du modèle e5 | Le modèle est inclus dans l'image, pas téléchargé à chaque exécution |
| `pypdf`, `openpyxl`, `xlrd`, `pandas`, `pyarrow` | Extraction PDF, Excel, CSV, Parquet |

Construction (à refaire après toute modification du Dockerfile) :

```powershell
docker build -t rag-ingest:latest .
```

L'image est locale : le flow utilise `pullPolicy: NEVER` pour que Kestra ne cherche pas `rag-ingest` sur Docker Hub.

### 6.2 `api/Dockerfile` : image de l'API

Part de `rag-ingest:latest` pour réutiliser torch, le modèle e5 et psycopg2 déjà installés, puis ajoute Flask, flask-cors, gunicorn et requests, et copie `app.py`. Gunicorn est lancé avec **1 worker et 4 threads** : le modèle n'est chargé qu'une seule fois en mémoire.

Ordre de construction : `rag-ingest` d'abord, puis `api`. `app.py` est copié dans l'image : toute modification du code impose `docker compose up -d --build api`.

### 6.3 Services Docker Compose

| Service | Conteneur | Rôle | Ports |
|---|---|---|---|
| `postgres` | `rag_kestra_postgres` | Base interne de Kestra (ne pas y mélanger les données RAG) | aucun |
| `pgvector` | `rag_pgvector` | Base RAG (documents, chunks, embeddings) | 5433 (hôte) vers 5432 |
| `kestra` | `rag_kestra` | Orchestrateur et interface web | 8080, 8081 |
| `api` | `rag_api` | API de questions-réponses | 8000 |

Extrait des services ajoutés :

```yaml
  pgvector:
    image: pgvector/pgvector:pg18
    container_name: rag_pgvector
    volumes:
      - pgvector-data:/var/lib/postgresql
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    environment:
      POSTGRES_DB: rag
      POSTGRES_USER: rag
      POSTGRES_PASSWORD: <MOT_DE_PASSE_PGVECTOR>
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -d $${POSTGRES_DB} -U $${POSTGRES_USER}"]
      interval: 30s
      timeout: 10s
      retries: 10
    networks:
      - RAG_kestra-net

  api:
    build: ./api
    container_name: rag_api
    environment:
      DB_HOST: rag_pgvector
      DB_PORT: "5432"
      DB_NAME: rag
      DB_USER: rag
      DB_PASSWORD: <MOT_DE_PASSE_PGVECTOR>
      MISTRAL_API_KEY: ${MISTRAL_API_KEY}
      MISTRAL_MODEL: open-mistral-7b
      CORS_ORIGINS: http://localhost:5173,http://localhost:3000
      HF_HUB_OFFLINE: "1"
    ports:
      - "8000:8000"
    depends_on:
      pgvector:
        condition: service_healthy
    networks:
      - RAG_kestra-net
```

Le service `kestra` dépend aussi de `pgvector` (`condition: service_healthy`).

---

## 7. Base de données

Le script `sql/init.sql` crée l'extension `vector` et deux tables. Il n'est exécuté **qu'à la première initialisation du volume** `pgvector-data`.

| Table | Contenu |
|---|---|
| `documents` | Un fichier Drive : identifiant, nom, type MIME, version (md5 ou date de modification), lien, statut (`indexed`, `error`, `skipped`), message d'erreur |
| `chunks` | Un extrait : texte, métadonnées JSON (page, feuille, plage de lignes), vecteur `vector(768)`, empreinte `content_hash` (SHA-256) |

Index : HNSW en cosinus sur `embedding`, index unique `(drive_id, content_hash)`, index sur `drive_id`. La suppression d'un document supprime ses chunks (`ON DELETE CASCADE`).

Recréer le schéma (la base RAG ne contient que des données reconstructibles depuis Drive) :

```powershell
docker exec -i rag_pgvector psql -U rag -d rag -c "DROP TABLE IF EXISTS chunks, documents CASCADE;"
Get-Content sql\init.sql -Raw | docker exec -i rag_pgvector psql -U rag -d rag
```

---

## 8. Flow d'ingestion Kestra

Fichier : `flows/ingest_drive.yaml` (namespace `rag`, flow `ingest_drive`). Variables à renseigner : `folder_id` (ID du dossier Drive).

### 8.1 Déroulement

1. Lister récursivement le dossier Drive (sous-dossiers inclus).
2. Comparer chaque fichier à la table `documents` : la version est le `md5Checksum`, ou `modifiedTime` pour les fichiers Google natifs.
3. Pour chaque fichier nouveau ou modifié : extraire le texte, découper, synchroniser les chunks.
4. Supprimer de la base les fichiers disparus de Drive.
5. Envoyer le résumé sur Slack. En cas d'échec du flow, un message d'erreur est envoyé.

Le déclencheur `Schedule` (toutes les heures) est livré avec `disabled: true` : le passer à `false` une fois les tests validés.

### 8.2 Types de fichiers pris en charge

| Type | Méthode | Découpage |
|---|---|---|
| Google Docs, Slides | Export en texte | Par blocs d'environ 1 500 caractères, chevauchement de 200 |
| Google Sheets | Export en xlsx | Voir tableaux |
| PDF | `pypdf`, page par page | Par page puis par blocs (OCR non géré) |
| Excel (xlsx, xls) | `pandas` / `openpyxl` | Un chunk de résumé par feuille, puis blocs de 20 lignes avec en-têtes |
| CSV, Parquet | `pandas` | Idem tableaux |
| JSON | `json` | Par groupes de 10 éléments |
| txt, md | Texte brut | Par blocs |

Les autres formats (docx, pptx importés, images) sont marqués `skipped`. Les tableaux sont plafonnés à `MAX_ROWS` lignes (5 000 par défaut), et l'en-tête est détecté parmi les 20 premières lignes de chaque feuille.

### 8.3 Mise à jour incrémentale

Chaque chunk est identifié par le SHA-256 de son contenu. Quand un fichier change, une seule transaction :

| Situation | Action |
|---|---|
| Chunk identique | Conservé, embedding non recalculé (position et métadonnées mises à jour) |
| Chunk nouveau ou modifié | Embedding calculé par lots, insertion |
| Chunk absent de la nouvelle version | Supprimé |

Limite : insérer ou supprimer du contenu au milieu d'un document décale les chunks suivants, qui sont alors recalculés. Une modification en place ne touche qu'un bloc.

Un fichier en erreur est marqué `error` dans `documents` et retenté à l'exécution suivante, sans bloquer les autres. Si Drive renvoie 0 fichier alors que la base en contient, le flow s'arrête par sécurité au lieu de tout supprimer.

### 8.4 Connexion à la base depuis le conteneur d'ingestion

Le script se connecte via `host.docker.internal:5433` (Docker Desktop). Alternative : `networkMode` du task runner sur le réseau Compose (`docker network ls` pour le nom exact) avec `PGHOST=rag_pgvector` et `PGPORT=5432`.

---

## 9. API

Base : `http://localhost:8000`

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Vérifie que l'API répond |
| `GET` | `/api/status` | Documents par statut, nombre de chunks, dernière indexation, fichiers en erreur |
| `POST` | `/api/ask` | Corps JSON `{"question": "...", "top_k": 5}` ; renvoie `answer` et `sources` |

Déroulement de `/api/ask` : embedding de `query: <question>`, recherche des `top_k` chunks les plus proches (documents au statut `indexed`), construction du prompt, appel Mistral avec jusqu'à 4 tentatives en cas de 429.

Chaque source contient : `n` (numéro cité dans la réponse), `name`, `link` (Drive), `location` (page, feuille et lignes), `score` et `excerpt`. En cas de saturation de Mistral, l'API répond 503 **avec les sources**.

Le prompt impose de répondre uniquement à partir des extraits, de citer les numéros `[1]`, et de dire explicitement quand la réponse est absente.

---

## 10. Démarrage

```powershell
# 1. Secrets : renseigner .env (voir sections 4 et 5)

# 2. Construire l'image d'ingestion (première fois, plusieurs minutes)
docker build -t rag-ingest:latest .

# 3. Démarrer les services
docker compose up -d

# 4. Vérifier les conteneurs
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

Interface Kestra : http://localhost:8080 (créer le flow `ingest_drive` en collant le YAML, puis renseigner `folder_id`).

Pour l'API après modification du code : `docker compose up -d --build api`.

---

## 11. Tests et vérifications

### 11.1 Base de données

```powershell
$env:PGPASSWORD = "<MOT_DE_PASSE_PGVECTOR>"
docker exec -e PGPASSWORD=$env:PGPASSWORD rag_pgvector psql -h 127.0.0.1 -U rag -d rag -c "\dx"
docker exec -e PGPASSWORD=$env:PGPASSWORD rag_pgvector psql -h 127.0.0.1 -U rag -d rag -c "\d chunks"
```

Attendu : extension `vector`, colonne `embedding vector(768)`, colonne `content_hash`, index `chunks_embedding_idx` (hnsw).

### 11.2 Accès Drive

Si le flow liste 0 fichier, vérifier le partage du dossier avec le compte de service. Pour voir tout ce que le compte voit, exécuter dans un flow de test :

```python
res = drive.files().list(q="trashed=false", fields="files(id,name,mimeType,parents)").execute()
```

### 11.3 Ingestion

| Test | Action | Résultat attendu |
|---|---|---|
| 1. Premier passage | Exécuter `ingest_drive` | Logs `OK <fichier> -> conservés: 0 / ajoutés: N` ; Slack annonce un nouveau fichier |
| 2. Rien ne change | Relancer le flow | Slack : « rien de nouveau » ; aucun embedding calculé |
| 3. Modification | Changer une phrase d'un Doc, relancer | Quelques chunks ajoutés et supprimés, les autres conservés |
| 4. Suppression de contenu | Retirer un paragraphe, relancer | Chunks correspondants supprimés |
| 5. Suppression du fichier | Mettre le fichier à la corbeille, relancer | Document et chunks supprimés |
| 6. Types de fichiers | Ajouter un PDF, un CSV, un classeur Excel | Statut `indexed`, métadonnées page ou feuille renseignées |

Contrôles en base après chaque test :

```powershell
docker exec -e PGPASSWORD=$env:PGPASSWORD rag_pgvector psql -h 127.0.0.1 -U rag -d rag -c "SELECT name, status, error FROM documents;"
docker exec -e PGPASSWORD=$env:PGPASSWORD rag_pgvector psql -h 127.0.0.1 -U rag -d rag -c "SELECT count(*) FROM chunks;"
docker exec -e PGPASSWORD=$env:PGPASSWORD rag_pgvector psql -h 127.0.0.1 -U rag -d rag -c "SELECT name, error FROM documents WHERE status='error';"
```

### 11.4 Modèle d'embedding

```powershell
docker run --rm rag-ingest:latest python -c "import pandas, pypdf, openpyxl, pyarrow, psycopg2; print('OK')"
```

### 11.5 API

```powershell
Invoke-RestMethod http://localhost:8000/api/health
Invoke-RestMethod http://localhost:8000/api/status
```

Questions de validation sur un document de test contenant une procédure de sauvegarde (durée de conservation, heure de lancement, procédure en cas d'échec) :

| Question | Résultat attendu |
|---|---|
| Question dont la réponse est dans le document | Réponse correcte avec citation `[1]` et source cliquable |
| Question dont la réponse n'est pas dans les documents | L'API indique qu'elle ne trouve pas l'information, sans inventer |
| Modification d'une valeur dans le Doc, puis ré-ingestion | La réponse reflète la nouvelle valeur |

Une question très générale (« De quoi parle le document ? ») donne de moins bons résultats qu'une question précise : la recherche compare des extraits à la question et ne résume pas un fichier entier.

### 11.6 Mistral

```powershell
docker exec rag_api python -c "import os,requests; r=requests.post('https://api.mistral.ai/v1/chat/completions',headers={'Authorization':'Bearer '+os.environ['MISTRAL_API_KEY']},json={'model':'open-mistral-7b','messages':[{'role':'user','content':'Dis OK'}],'max_tokens':5},timeout=30); print(r.status_code, r.text[:200])"
```

Code `200` attendu. Un `401` indique une clé invalide ou encodée à tort en base64, un `429` un quota atteint pour ce modèle.

---

## 12. Dépannage

Erreurs rencontrées pendant le développement et leur résolution.

| Symptôme | Cause | Solution |
|---|---|---|
| `La création de clés de compte de service est désactivée` | Règle d'organisation `iam.disableServiceAccountKeyCreation` | Voir 4.1 (surcharge sur le projet) |
| Alerte Google sur les clés de compte de service | Recommandation générale | Compte sans rôle IAM, dossier partagé en lecture seule, clé stockée uniquement dans les secrets, fichier supprimé |
| `HttpError 404 File not found` avec `q=''` | ID de dossier vide (secret mal encodé) | Mettre l'ID dans `variables.folder_id` du flow |
| `0 fichier(s)` alors que le dossier contient un document | Dossier non partagé avec le compte de service | Partager avec l'adresse exacte du compte (affichée dans les logs) |
| `THESE PACKAGES DO NOT MATCH THE HASHES` | Téléchargement pip corrompu (réseau, antivirus) | Relancer avec `--no-cache-dir --retries 5`, puis image avec dépendances préinstallées |
| `No such image: rag-ingest:latest` | Image non construite | `docker build -t rag-ingest:latest .` |
| `ModuleNotFoundError: No module named 'pandas'` | Image construite avant l'ajout des dépendances d'ingestion | Reconstruire l'image |
| `Cannot find secret for key '...'` | Secret absent de `.env`, préfixe `SECRET_` manquant, ou Kestra non recréé | Corriger `.env`, puis `docker compose up -d --force-recreate kestra` |
| `password authentication failed for user "rag"` | Secret `SECRET_PGVECTOR_PASSWORD` non encodé en base64 | Encoder la valeur (section 5) |
| `role "rag" does not exist` | Conteneur issu d'une ancienne image (`ankane/pgvector`) ou volume initialisé avec une autre configuration | Supprimer conteneur et volume `pgvector-data`, recréer avec l'image du compose |
| `relation "documents" does not exist` | `init.sql` non exécuté (volume déjà existant) | Exécuter `init.sql` manuellement (section 7) |
| `syntax error at or near "d"` à la fin de `init.sql` | Caractère parasite en fin de fichier | Supprimer la ligne parasite |
| Slack `not_in_channel` | Appel `chat.postMessage` sans que le bot soit membre du canal | Utiliser le webhook entrant |
| Slack : « Un nom de membre valide est requis » | Mauvais nom d'application dans `/invite` | Utiliser le nom exact du bot, ou le webhook |
| Mistral `429 Rate limit exceeded` sur `mistral-small-latest` | Limite propre au modèle sur le compte | Utiliser `open-mistral-7b` |
| Réponse « document vide » pour un document très court | Petit modèle et extrait presque vide | Prompt précisé dans `app.py` ; tester avec un vrai contenu |
| Avertissements en rouge dans les logs Kestra (`Loading weights`, HF Hub) | Sortie d'erreur standard du script | Sans gravité (informations) ; `HF_HUB_OFFLINE=1` côté API |

---

## 13. Historique de création

Chronologie du projet (26 et 27 octobre 2026).

**Phase 1. Cadrage de l'architecture**
- Choix : l'ingestion est orchestrée par Kestra, l'API ne gère que les requêtes.
- Décision de séparer la base de Kestra et la base RAG, pour ne pas mélanger migrations et données.
- Kestra et Slack étaient déjà opérationnels avant le début du travail sur les embeddings.

**Phase 2. Base vectorielle**
- Ajout du service pgvector au Docker Compose.
- Premier schéma, puis enrichissement : colonne `version` (le md5 n'existe pas pour les fichiers Google natifs), `mime_type`, `web_view_link`, `status`, et `metadata` JSONB par chunk pour citer page, feuille ou plage de lignes.
- Stratégie pour les classeurs Excel : un chunk de résumé par feuille puis des blocs de lignes avec en-têtes répétés.

**Phase 3. Accès Google Drive**
- Création du projet Google Cloud, activation de l'API Drive, création du compte de service.
- Blocage de la création de clé par la politique d'organisation, levé sur le projet seulement.
- Mise en place des secrets Kestra en base64.
- Tests de liste Drive : ID de dossier vide, puis 0 fichier (dossier non partagé), puis 2 éléments visibles.

**Phase 4. Choix des embeddings**
- Abandon de FAISS (stockage vectoriel assuré par pgvector) et du modèle anglais `all-MiniLM-L6-v2` (documents en français).
- Choix de `multilingual-e5-base` (768 dimensions) sur CPU, avec les préfixes `passage:` et `query:`.
- Création de l'image `rag-ingest` et validation (dimension 768, similarité cohérente).

**Phase 5. Flow d'ingestion**
- Première version : suppression de tous les chunks d'un fichier puis réinsertion.
- Deuxième version : mise à jour incrémentale par empreinte de contenu, pour ne recalculer que les chunks modifiés.
- Ajout de la détection d'en-tête pour Excel, du plafond de lignes, de la gestion des erreurs par fichier et du résumé Slack.

**Phase 6. Intégration et corrections**
- Secrets manquants, image à reconstruire, dépendances absentes.
- Conteneur pgvector hérité d'un ancien essai (`ankane/pgvector`) : recréation avec `pgvector/pgvector:pg18`.
- Création manuelle des tables, correction d'un caractère parasite dans `init.sql`.
- Mot de passe non encodé dans le secret Kestra.
- Notification Slack : abandon du bot token (`not_in_channel`) au profit du webhook entrant.

**Phase 7. API de questions-réponses**
- Choix de Flask pour partager exactement le même code d'embedding que l'ingestion (Node.js a été envisagé avec Transformers.js).
- Génération avec Mistral : erreurs 429 avec `mistral-small-latest`, résolues avec `open-mistral-7b` (modèle du code de formation).
- Ajustement du prompt et retrait de l'en-tête `Fichier:` des extraits envoyés au modèle.

**Phase 8. Validation**
- Tests d'ingestion, de mise à jour incrémentale et de questions-réponses réussis.
- Prochaine étape : front React.

---

## 14. Sécurité

- **Ne jamais versionner** `.env`, la clé JSON du compte de service, ni les URLs de webhook. Vérifier que `.gitignore` contient `.env`.
- Une clé ou un token affiché dans une capture, un message ou un dépôt doit être considéré comme compromis : le **révoquer et le régénérer**.
- Le compte de service n'a aucun rôle IAM et ne lit que le dossier partagé, en lecture seule.
- Les mots de passe du `docker-compose.yml` sont des valeurs de développement. Pour une mise en production : secrets Docker ou gestionnaire de secrets, mots de passe forts, et ne pas exposer le port 5433.
- L'API n'a pas d'authentification : elle convient à un usage local, pas à une exposition sur Internet.
- Si un webhook Kestra est ajouté (déclenchement depuis le front), sa clé doit rester secrète.

---

## 15. Limites et évolutions

**Limites connues**

- Pas d'OCR : les PDF scannés sont en erreur.
- Un RAG retrouve des extraits, il ne calcule pas : les questions chiffrées sur de gros classeurs donnent des réponses partielles.
- Les fichiers docx et pptx importés dans Drive sont ignorés.
- Pas de seuil de pertinence : l'API renvoie toujours les meilleurs extraits, même hors sujet, et laisse le modèle indiquer l'absence d'information.
- Le petit modèle de génération suit moins bien les consignes qu'un grand modèle.

**Évolutions envisagées**

- Front React (Vite) : question, réponse avec citations, sources cliquables, état de l'indexation.
- Bouton « mettre à jour maintenant » via un déclencheur webhook de Kestra.
- Support des docx, pptx et OCR.
- Tables SQL pour les questions chiffrées sur les classeurs.
- Filtres par fichier ou par type dans `/api/ask`.
- Authentification de l'API et déploiement sécurisé.

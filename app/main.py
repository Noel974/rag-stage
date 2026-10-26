from flask import Flask, jsonify
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "rag-api"
        }), 200

@app.get("/")
def home():
    return jsonify({
        "message": "Welcome to the RAG API"
    }), 200

if __name__ == "__main__":
    app.run(debug=True)
    
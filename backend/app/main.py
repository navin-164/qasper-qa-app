from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# These imports will light up once we create models.py next!
from app.models import QuestionRequest, AnswerResponse
from app.rag_engine import load_artifacts, answer_question, RagArtifacts

# Global variable to hold our loaded models and DB connections
ENGINE: Optional[RagArtifacts] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: Loads heavy models on startup, cleans up on shutdown."""
    global ENGINE
    print("🚀 Starting up: Loading RAG Artifacts (FAISS, Neo4j, Groq, SentenceTransformers)...")
    try:
        ENGINE = load_artifacts()
        print("✅ RAG Engine successfully loaded!")
    except Exception as e:
        print(f"❌ Failed to load RAG Engine: {e}")
    
    yield  # The application runs while yielded
    
    print("🛑 Shutting down: Cleaning up resources...")
    if ENGINE and ENGINE.driver:
        ENGINE.driver.close()

# Initialize FastAPI app
app = FastAPI(
    title="QASPER Graph RAG API",
    description="Backend API for the Research Paper Question Answering application.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS so our Next.js frontend (default port 3000) can talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    """Simple health check endpoint to verify the server is running."""
    return {
        "status": "ok", 
        "engine_loaded": ENGINE is not None
    }

@app.post("/api/ask", response_model=AnswerResponse)
def ask_question(request: QuestionRequest):
    """Core endpoint that receives a question and returns a generated answer with evidence."""
    if ENGINE is None:
        raise HTTPException(status_code=500, detail="RAG Engine is not initialized. Check server logs.")
    
    try:
        result = answer_question(
            artifacts=ENGINE,
            question=request.question,
            paper_id=request.paper_id,
            top_k=request.top_k,
            detailed=request.detailed
        )
        return result
    except Exception as e:
        print(f"Error during question processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))
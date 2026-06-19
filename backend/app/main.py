from __future__ import annotations

import os
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    QuestionRequest, 
    AnswerResponse, 
    GraphSchemaResponse, 
    EvalDashboardResponse,
    PaperListResponse,
    EvalRequest  # <-- Import the new EvalRequest model
)
from app.rag_engine import (
    load_artifacts, 
    answer_question, 
    get_graph_snapshot, 
    run_evaluation_suite,
    get_all_papers  # <-- Imported our new engine function
)

app = FastAPI(
    title="Graph RAG Hybrid Engine API",
    description="Production-grade backend powering dense vectors, Neo4j knowledge graphs, and cross-encoders.",
    version="1.4.0"
)

# Enable CORS so our Next.js frontend can communicate safely with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, swap with exact origin domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global holder for our RAG systems memory allocation
rag_artifacts = None

@app.on_event("startup")
def startup_event():
    """Initializes models and database drivers once upon server startup."""
    global rag_artifacts
    try:
        rag_artifacts = load_artifacts()
        print("💡 RAG Core Context initialized successfully. Ready for incoming requests.")
    except Exception as e:
        print(f"❌ CRITICAL: Failed to load RAG engine artifacts: {e}")
        # In a real pipeline, we'd fail safe or exit gracefully here
        pass

@app.get("/api/health")
def health_check() -> Dict[str, str]:
    """Simple container/health check probe."""
    if rag_artifacts is None:
        raise HTTPException(status_code=503, detail="RAG Core is still loading or unavailable.")
    return {"status": "healthy", "engine": "GraphRAG-V1.4"}

@app.post("/api/chat", response_model=AnswerResponse)
async def chat_endpoint(payload: QuestionRequest):
    """
    Executes the full hybrid retrieval query path.
    Extracts entities, hits vector FAISS and graph Neo4j, re-ranks via Cross-Encoder,
    and returns a conversational answer protected by sentence-by-sentence hallucination guardrails.
    """
    if rag_artifacts is None:
        raise HTTPException(status_code=503, detail="RAG engine is uninitialized.")
    
    try:
        results = answer_question(
            artifacts=rag_artifacts,
            question=payload.question,
            paper_id=payload.paper_id,
            top_k=payload.top_k,
            detailed=payload.detailed
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QA Generation Pipeline Failure: {str(e)}")

@app.get("/api/graph/schema", response_model=GraphSchemaResponse)
async def graph_schema_endpoint(limit: int = Query(80, ge=1, le=5000)):
    """Fetches a current snapshot topology of the entity knowledge graph."""
    if rag_artifacts is None:
        raise HTTPException(status_code=503, detail="Graph driver is uninitialized.")
    
    try:
        snapshot = get_graph_snapshot(rag_artifacts, limit=limit)
        return snapshot
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Graph Engine topology error: {str(e)}")

@app.post("/api/evaluate", response_model=EvalDashboardResponse) # <-- Changed to POST
async def evaluation_dashboard_endpoint(payload: EvalRequest):
    """Triggers an online batch evaluation run scoring faithfulness, relevance, and precision."""
    if rag_artifacts is None:
        raise HTTPException(status_code=503, detail="LLM-as-a-Judge system offline.")
    
    try:
        # Pass the dynamic queries straight into the engine!
        eval_report = run_evaluation_suite(rag_artifacts, test_queries=payload.queries)
        return eval_report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation Suite execution crash: {str(e)}")

@app.get("/api/papers", response_model=PaperListResponse)
async def get_papers_endpoint():
    """
    NEW: Returns a collection of all ingested research papers found in the database.
    Provides metadata including ArXiv IDs, titles, abstracts, and processed paragraph depths.
    """
    if rag_artifacts is None:
        raise HTTPException(status_code=503, detail="Database context uninitialized.")
    
    try:
        papers_data = get_all_papers(rag_artifacts)
        return {"papers": papers_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pull paper catalog: {str(e)}")
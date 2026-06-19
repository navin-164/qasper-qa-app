from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# --- CORE RAG MODELS ---

class QuestionRequest(BaseModel):
    """Schema for incoming QA requests from the frontend."""
    question: str = Field(..., description="The user's natural language question.")
    paper_id: Optional[str] = Field(None, description="Optional ID to restrict search to a specific paper.")
    top_k: int = Field(30, description="Number of initial documents/facts to retrieve before re-ranking.")
    detailed: bool = Field(True, description="If True, generates a conversational answer. If False, extracts a strict concise answer.")

class TokenStats(BaseModel):
    """Tracks token usage and context window limits for the generation cycle."""
    prompt_tokens: int = Field(0, description="Tokens used by the system prompt and question.")
    context_tokens: int = Field(0, description="Tokens consumed by the retrieved vector and graph evidence.")
    answer_tokens: int = Field(0, description="Tokens generated in the final answer.")
    total_tokens: int = Field(0, description="Total tokens used in the entire transaction.")

class SentenceValidation(BaseModel):
    """Tracks whether a generated sentence is hallucinated or supported by evidence."""
    sentence: str = Field(..., description="A single extracted sentence from the LLM's final answer.")
    status: str = Field(..., description="Must be exactly: Supported, Partially Supported, or Unsupported.")

class AnswerResponse(BaseModel):
    """Schema for the outgoing QA response to the frontend."""
    question: str = Field(..., description="The original question.")
    answer: str = Field(..., description="The generated LLM answer.")
    evidence_paragraphs: List[Dict[str, Any]] = Field(..., description="Top re-ranked paragraphs used as context.")
    graph_facts: List[Dict[str, Any]] = Field(..., description="Extracted Neo4j triples used as context.")
    context: str = Field(..., description="The raw combined context string fed to the LLM.")
    token_stats: TokenStats = Field(..., description="Telemetry data for LLM token consumption.")
    validations: List[SentenceValidation] = Field(default_factory=list, description="Hallucination guardrail results per sentence.")

# --- MODELS FOR GRAPH EXPLORER ---

class GraphNode(BaseModel):
    """Represents a single entity node in the Neo4j Graph."""
    id: str = Field(..., description="Unique identifier for the node.")
    name: str = Field(..., description="Display name of the entity.")
    type: str = Field(..., description="The node label/category (e.g., Entity, Paper, Paragraph).")
    properties: str = Field("", description="Stringified metadata or descriptions.")

class GraphEdge(BaseModel):
    """Represents a relationship (triple) connecting two nodes."""
    source: str = Field(..., description="Name of the source node.")
    target: str = Field(..., description="Name of the target node.")
    relation: str = Field(..., description="The relationship type (e.g., RELATED_TO, MENTIONS).")
    confidence: float = Field(1.0, description="Confidence score of the extracted relationship.")

class GraphSchemaResponse(BaseModel):
    """Schema for the outgoing Knowledge Graph snapshot payload."""
    nodes: List[GraphNode] = Field(..., description="List of graph nodes.")
    edges: List[GraphEdge] = Field(..., description="List of graph edges.")

# --- MODELS FOR EVALUATION DASHBOARD ---

class EvalRun(BaseModel):
    """Represents a single evaluation test case result."""
    id: str = Field(..., description="Run identifier (e.g., RUN-001).")
    query: str = Field(..., description="The test question asked.")
    faithfulness: float = Field(..., description="Score (0-1) for hallucination absence.")
    relevance: float = Field(..., description="Score (0-1) for answer addressing the prompt.")
    contextPrecision: float = Field(..., description="Score (0-1) for retrieval ranking quality.")
    status: str = Field(..., description="Overall status: Pass, Warning, or Fail.")

class EvalDashboardResponse(BaseModel):
    """Schema for the aggregate evaluation dashboard payload."""
    avg_faithfulness: float = Field(..., description="Mean faithfulness across all runs.")
    avg_relevance: float = Field(..., description="Mean answer relevance across all runs.")
    avg_precision: float = Field(..., description="Mean context precision across all runs.")
    runs: List[EvalRun] = Field(..., description="Detailed list of individual test runs.")

# --- NEW MODELS FOR PAPER BROWSER ---

class PaperMetadata(BaseModel):
    """Metadata representing an ingested research paper."""
    paper_id: str = Field(..., description="The unique arXiv/QASPER ID of the paper.")
    title: str = Field(..., description="The title of the research paper.")
    abstract: str = Field("", description="The paper abstract or summary.")
    paragraph_count: int = Field(0, description="Total number of text paragraphs ingested for this paper.")

class PaperListResponse(BaseModel):
    """Schema for the outgoing list of ingested papers."""
    papers: List[PaperMetadata] = Field(..., description="List of all available papers in the database.")
    
# ... existing code ...

class PaperListResponse(BaseModel):
    """Schema for the outgoing list of ingested papers."""
    papers: List[PaperMetadata] = Field(..., description="List of all available papers in the database.")

# --- NEW MODEL FOR DYNAMIC EVALUATIONS ---
class EvalRequest(BaseModel):
    """Schema for triggering an evaluation run with custom queries."""
    queries: Optional[List[str]] = Field(None, description="Custom list of test queries to evaluate.")
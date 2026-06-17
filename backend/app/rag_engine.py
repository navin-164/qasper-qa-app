from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import faiss
import numpy as np
from dotenv import load_dotenv
from neo4j import GraphDatabase
from sentence_transformers import SentenceTransformer, CrossEncoder
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

# Resolve path to the backend root directory
BACKEND_ROOT = Path(__file__).resolve().parents[1]

STOPWORDS = {
    "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "by",
    "is", "are", "was", "were", "be", "been", "this", "that", "these", "those",
    "what", "which", "who", "whom", "when", "where", "why", "how", "does", "do",
    "did", "can", "could", "should", "would", "may", "might", "will"
}

@dataclass
class RagArtifacts:
    driver: Any
    database: str
    embedder: SentenceTransformer
    faiss_index: faiss.Index
    paragraphs: List[Dict[str, Any]]
    llm: ChatGroq
    cross_encoder: CrossEncoder


def normalize_text(text: str) -> str:
    return " ".join((text or "").split()).strip()


def fallback_extract_entities(question: str) -> List[str]:
    question = normalize_text(question)
    ents = []
    for m in re.finditer(r"\b[A-Z][A-Za-z0-9\-]+(?:\s+[A-Z][A-Za-z0-9\-]+)*\b", question):
        val = normalize_text(m.group(0))
        if len(val) > 1:
            ents.append(val)
    if not ents:
        ents = [w for w in re.findall(r"[A-Za-z0-9\-]+", question) if len(w) > 2]
    return sorted(set(ents))


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
    return rows


def load_artifacts() -> RagArtifacts:
    """Initializes and loads all models, databases, and LLM clients into memory."""
    load_dotenv(BACKEND_ROOT / ".env")

    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "password123")
    database = os.getenv("NEO4J_DATABASE", "neo4j")
    embedding_model = os.getenv("EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5")
    
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise ValueError("GROQ_API_KEY is missing from the environment variables.")

    print("Connecting to Neo4j...")
    driver = GraphDatabase.driver(uri, auth=(user, password))
    
    print("Loading Vector Embedding Model...")
    embedder = SentenceTransformer(embedding_model)
    
    print("Loading Cross-Encoder Re-Ranker...")
    cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    
    print("Initializing Groq LLM...")
    llm = ChatGroq(
        model_name="llama-3.1-8b-instant", 
        temperature=0.0,
        groq_api_key=groq_api_key
    )

    faiss_path = BACKEND_ROOT / "data/faiss/paragraph.index"
    meta_path = BACKEND_ROOT / "data/embeddings/paragraph_meta.jsonl"

    if not faiss_path.exists():
        raise FileNotFoundError(f"FAISS index not found at {faiss_path}")
    if not meta_path.exists():
        raise FileNotFoundError(f"Metadata not found at {meta_path}")

    print("Loading FAISS Index into memory...")
    index = faiss.read_index(str(faiss_path))
    paragraphs = read_jsonl(meta_path)

    return RagArtifacts(
        driver=driver,
        database=database,
        embedder=embedder,
        faiss_index=index,
        paragraphs=paragraphs,
        llm=llm,
        cross_encoder=cross_encoder
    )


def analyze_query(llm: ChatGroq, question: str) -> Dict[str, Any]:
    """Uses the LLM to route the query optimally to both Vector and Graph databases."""
    parser = JsonOutputParser()
    prompt = PromptTemplate(
        template="""You are an expert retrieval systems engineer. Analyze the following academic question.
        Provide a JSON output with exactly two keys:
        1. 'entities': A list of strings. Extract the core entities (noun phrases, algorithms, datasets) to search in a Knowledge Graph.
        2. 'vector_query': A string. Rewrite the question to be optimized for dense vector similarity search (remove conversational filler, emphasize keywords).
        
        CRITICAL INSTRUCTIONS: 
        - DO NOT write any Python code or explanations.
        - OUTPUT ONLY THE RAW JSON OBJECT.
        
        {format_instructions}
        
        Question: {question}
        """,
        input_variables=["question"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )
    
    chain = prompt | llm | parser
    try:
        result = chain.invoke({"question": question})
        return {
            "entities": result.get("entities", fallback_extract_entities(question)),
            "vector_query": result.get("vector_query", question)
        }
    except Exception as e:
        print(f"Query Analysis Failed, falling back to basic extraction: {e}")
        return {"entities": fallback_extract_entities(question), "vector_query": question}


def search_vector(artifacts: RagArtifacts, optimized_query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Searches FAISS for semantically similar paragraphs."""
    qvec = artifacts.embedder.encode([optimized_query], show_progress_bar=False)
    qvec = np.asarray(qvec, dtype="float32")
    faiss.normalize_L2(qvec)

    scores, idxs = artifacts.faiss_index.search(qvec, top_k)
    results = []

    for score, idx in zip(scores[0], idxs[0]):
        if idx < 0 or idx >= len(artifacts.paragraphs):
            continue
        row = dict(artifacts.paragraphs[idx])
        row["score"] = float(score)
        row["source"] = "vector"
        results.append(row)

    return results


def search_graph(artifacts: RagArtifacts, entities: List[str], paper_id: Optional[str], top_k: int = 5) -> List[Dict[str, Any]]:
    """Traverses Neo4j to find paragraphs explicitly mentioning the extracted entities."""
    if not entities:
        return []

    query = """
    MATCH (p:Paragraph)-[:MENTIONS]->(e:Entity)
    WHERE toLower(e.name) IN $entities
      AND ($paper_id IS NULL OR p.paper_id = $paper_id)
    RETURN DISTINCT p.paragraph_id AS paragraph_id,
                    p.paper_id AS paper_id,
                    p.section_idx AS section_idx,
                    p.section_name AS section_name,
                    p.paragraph_idx AS paragraph_idx,
                    p.text AS text
    LIMIT $limit
    """

    rows = []
    with artifacts.driver.session(database=artifacts.database) as session:
        result = session.run(
            query,
            entities=[e.lower() for e in entities],
            paper_id=paper_id,
            limit=top_k,
        )
        for rec in result:
            rows.append(
                {
                    "paragraph_id": rec["paragraph_id"],
                    "paper_id": rec["paper_id"],
                    "section_idx": rec["section_idx"],
                    "section_name": rec.get("section_name", ""),
                    "paragraph_idx": rec["paragraph_idx"],
                    "text": rec["text"],
                    "source": "graph",
                }
            )

    return rows


def search_graph_facts(artifacts: RagArtifacts, entities: List[str], paper_id: Optional[str], top_k: int = 10) -> List[Dict[str, Any]]:
    """Extracts explicit factual triples from the Knowledge Graph related to the query."""
    if not entities:
        return []

    query = """
    MATCH (a:Entity)-[r:RELATED_TO]->(b:Entity)
    WHERE (toLower(a.name) IN $entities OR toLower(b.name) IN $entities)
      AND ($paper_id IS NULL OR r.paper_id = $paper_id)
    RETURN a.name AS subject,
           r.relation AS relation,
           b.name AS object,
           r.confidence AS confidence,
           r.sentence AS sentence
    LIMIT $limit
    """

    facts = []
    with artifacts.driver.session(database=artifacts.database) as session:
        result = session.run(
            query,
            entities=[e.lower() for e in entities],
            paper_id=paper_id,
            limit=top_k,
        )
        for rec in result:
            facts.append(
                {
                    "subject": rec["subject"],
                    "relation": rec["relation"],
                    "object": rec["object"],
                    "confidence": rec["confidence"],
                    "sentence": rec["sentence"],
                }
            )
    return facts


def deduplicate_paragraphs(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out = []
    for item in items:
        pid = item.get("paragraph_id")
        if pid in seen:
            continue
        seen.add(pid)
        out.append(item)
    return out


def build_context(paragraphs: List[Dict[str, Any]], facts: List[Dict[str, Any]]) -> str:
    """Formats retrieved data into a dense, LLM-readable context block."""
    parts = []

    if facts:
        parts.append("Graph Facts:")
        for f in facts:
            parts.append(f"- {f['subject']} [{f['relation']}] {f['object']}")

    if paragraphs:
        parts.append("\nEvidence Paragraphs:")
        for i, row in enumerate(paragraphs, 1):
            parts.append(
                f"[{i}] {row.get('text')}"
            )

    return "\n".join(parts).strip()


def generate_llm_answer(llm: ChatGroq, question: str, context: str, detailed: bool = False) -> str:
    """
    Generates the final answer. 
    If detailed=False, it performs strict extraction (ideal for eval scripts).
    If detailed=True, it generates a human-readable chat response.
    """
    if detailed:
        # Template for the Chatbot UI
        template = """You are an expert AI research assistant. 
        Answer the question using ONLY the provided Context. 
        If the answer is not present, say "I cannot answer this based on the provided evidence."
        Include inline citations pointing to the evidence (e.g., "based on Graph Facts" or "as seen in Evidence [1]").
        
        Context:
        {context}
        
        Question: {question}
        Detailed Answer:"""
    else:
        # Template for Strict Evaluation (F1/EM/SAS Scores)
        template = """You are a strict data extraction system evaluating arXiv papers.
        Extract the exact answer to the question using ONLY the provided Context. 
        If the answer cannot be confidently deduced from the Context, output exactly: UNANSWERABLE
        
        CRITICAL RULES FOR HIGH F1 SCORES:
        - Output ONLY the exact entity, algorithm name, number, or short phrase.
        - NEVER write full sentences.
        - DO NOT add conversational filler or explain your reasoning.
        
        Context:
        {context}
        
        Question: {question}
        Extracted Answer:"""

    prompt = PromptTemplate(
        template=template,
        input_variables=["context", "question"]
    )
    
    chain = prompt | llm
    try:
        response = chain.invoke({"context": context, "question": question})
        return response.content.strip()
    except Exception as e:
        print(f"Generation Failed: {e}")
        return "UNANSWERABLE"


def answer_question(artifacts: RagArtifacts, question: str, paper_id: Optional[str] = None, top_k: int = 30, detailed: bool = False) -> Dict[str, Any]:
    """The master orchestration function combining Vector, Graph, and Cross-Encoder."""
    
    # 1. Routing & Extraction
    query_plan = analyze_query(artifacts.llm, question)
    entities = query_plan["entities"]
    vector_query = query_plan["vector_query"]

    # 2. Parallel Retrieval
    vector_hits = search_vector(artifacts, vector_query, top_k=top_k)
    graph_hits = search_graph(artifacts, entities, paper_id=paper_id, top_k=top_k)
    facts = search_graph_facts(artifacts, entities, paper_id=paper_id, top_k=top_k)

    combined_paragraphs = deduplicate_paragraphs(graph_hits + vector_hits)
    
    # 3. Cross-Encoder Re-Ranking
    if combined_paragraphs:
        pairs = [[question, item["text"]] for item in combined_paragraphs]
        scores = artifacts.cross_encoder.predict(pairs)
        
        for item, score in zip(combined_paragraphs, scores):
            item["rerank_score"] = float(score)
            
        # Sort and prune down to the absolute top 5 contextual matches
        combined_paragraphs = sorted(combined_paragraphs, key=lambda x: x["rerank_score"], reverse=True)[:5]

    # 4. Context Assembly & Generation
    context = build_context(paragraphs=combined_paragraphs, facts=facts)

    if combined_paragraphs or facts:
        answer = generate_llm_answer(artifacts.llm, question, context, detailed=detailed)
    else:
        answer = "I cannot answer this based on the provided evidence." if detailed else "UNANSWERABLE"

    return {
        "question": question,
        "answer": answer,
        "evidence_paragraphs": combined_paragraphs,
        "graph_facts": facts,
        "context": context,
    }
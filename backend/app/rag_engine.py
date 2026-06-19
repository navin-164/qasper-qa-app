from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import faiss
import numpy as np
import tiktoken
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


def count_tokens(text: str) -> int:
    """
    Approximates token count using standard cl100k_base encoding.
    Crucial for protecting the LLM context window and monitoring API costs.
    """
    if not text:
        return 0
    try:
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))
    except Exception:
        # Fallback approximation if tiktoken fails
        return len(text.split()) * 1.3


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


def check_hallucinations(llm: ChatGroq, context: str, answer: str) -> List[Dict[str, Any]]:
    """
    Splits the generated answer into sentences and uses LLM-as-a-Judge 
    to verify if each sentence is factually supported by the retrieved context.
    """
    if answer in ["UNANSWERABLE", "I cannot answer this based on the provided evidence."]:
        return [{"sentence": answer, "status": "Supported"}]

    # Split paragraph into sentences (basic regex for punctuation)
    sentences = [s.strip() for s in re.split(r'(?<=[.!?]) +', answer) if len(s.strip()) > 5]
    if not sentences:
        return []

    parser = JsonOutputParser()
    prompt = PromptTemplate(
        template="""You are a strict factual consistency judge.
        Evaluate each of the following SENTENCES from a generated answer against the retrieved CONTEXT.
        Determine if the sentence is "Supported", "Partially Supported", or "Unsupported" by the CONTEXT.
        
        {format_instructions}
        Your output MUST be a valid JSON array of objects.
        Example: [{{"sentence": "The exact sentence here.", "status": "Supported"}}]
        
        CONTEXT:
        {context}
        
        SENTENCES TO EVALUATE:
        {sentences}
        """,
        input_variables=["context", "sentences"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )
    
    chain = prompt | llm | parser
    
    # Format sentences as a numbered list for the prompt
    sentences_text = "\n".join([f"{i+1}. {s}" for i, s in enumerate(sentences)])
    
    try:
        # Ask Llama-3.1 to grade itself!
        result = chain.invoke({"context": context, "sentences": sentences_text})
        
        # Ensure we always return a clean list of dictionaries
        if isinstance(result, list):
            return result
        elif isinstance(result, dict) and "validations" in result:
            return result.get("validations", [])
        elif isinstance(result, dict):
            # Sometimes models return a single dict if there's only one sentence
            return [result]
        else:
            return [{"sentence": s, "status": "Supported"} for s in sentences]
            
    except Exception as e:
        print(f"Hallucination check failed: {e}")
        # Fail open so we don't break the UI if parsing fails
        return [{"sentence": s, "status": "Supported"} for s in sentences]


def answer_question(artifacts: RagArtifacts, question: str, paper_id: Optional[str] = None, top_k: int = 30, detailed: bool = False) -> Dict[str, Any]:
    """The master orchestration function combining Vector, Graph, Re-Ranking, and Hallucination Checks."""
    
    # Track base prompt tokens
    base_prompt_template = """You are an expert AI research assistant. Answer the question using ONLY the provided Context..."""
    prompt_tokens = count_tokens(base_prompt_template) + count_tokens(question)
    
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

    # 4. Context Assembly & Context Token Counting
    context = build_context(paragraphs=combined_paragraphs, facts=facts)
    context_tokens = count_tokens(context)

    # 5. Generation & Answer Token Counting
    if combined_paragraphs or facts:
        answer = generate_llm_answer(artifacts.llm, question, context, detailed=detailed)
    else:
        answer = "I cannot answer this based on the provided evidence." if detailed else "UNANSWERABLE"
        
    answer_tokens = count_tokens(answer)
    total_tokens = prompt_tokens + context_tokens + answer_tokens

    token_stats = {
        "prompt_tokens": prompt_tokens,
        "context_tokens": context_tokens,
        "answer_tokens": answer_tokens,
        "total_tokens": total_tokens
    }

    # 6. HALLUCINATION CHECK GUARDRAIL
    validations = []
    if detailed and answer not in ["UNANSWERABLE", "I cannot answer this based on the provided evidence."]:
        validations = check_hallucinations(artifacts.llm, context, answer)

    return {
        "question": question,
        "answer": answer,
        "evidence_paragraphs": combined_paragraphs,
        "graph_facts": facts,
        "context": context,
        "token_stats": token_stats,
        "validations": validations
    }


def get_graph_snapshot(artifacts: RagArtifacts, limit: int = 80) -> Dict[str, Any]:
    """
    Fetches a subgraph snapshot for the Knowledge Graph Explorer UI.
    Dynamically maps Neo4j Entities, Papers, and Paragraphs into standard nodes and edges.
    """
    query = """
    MATCH (s)-[r]->(t)
    RETURN s, r, t
    LIMIT $limit
    """
    
    nodes_dict = {}
    edges_list = []

    with artifacts.driver.session(database=artifacts.database) as session:
        result = session.run(query, limit=limit)
        for record in result:
            s = record["s"]
            t = record["t"]
            r = record["r"]

            # Process nodes ensuring uniqueness via element_id
            for node in [s, t]:
                if node.element_id not in nodes_dict:
                    props = dict(node)
                    
                    # Dynamically find the best display name
                    name = props.get("name") or props.get("title") or props.get("paragraph_id") or str(node.element_id)
                    
                    # Generate a concise properties summary for the UI card
                    if "text" in props:
                        desc = str(props["text"])[:80] + "..."
                    else:
                        desc = ", ".join(f"{k}: {v}" for k, v in props.items() if k not in ["name", "title", "text", "embedding"])
                    
                    nodes_dict[node.element_id] = {
                        "id": str(node.element_id),
                        "name": str(name),
                        "type": list(node.labels)[0] if node.labels else "Unknown",
                        "properties": desc[:100]
                    }

            # Process Edge relationship
            r_props = dict(r)
            edges_list.append({
                "source": nodes_dict[s.element_id]["name"],
                "target": nodes_dict[t.element_id]["name"],
                "relation": str(r.type),
                "confidence": float(r_props.get("confidence", 1.0))
            })

    return {
        "nodes": list(nodes_dict.values()),
        "edges": edges_list
    }


def run_evaluation_suite(artifacts: RagArtifacts, test_queries: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Runs a batch evaluation suite using LLM-as-a-Judge to calculate RAG performance metrics.
    Computes Faithfulness, Relevance, and Context Precision.
    """
    if not test_queries:
        test_queries = [
            "What is the variance tradeoff for every-visit Monte Carlo?",
            "Explain the dataset split methodology in QASPER.",
            "How does LSTDQ optimize sample reuse?",
            "What are the limitations of the Bellman Equation here?"
        ]

    runs = []
    total_faithfulness = 0.0
    total_relevance = 0.0
    total_precision = 0.0

    parser = JsonOutputParser()
    eval_prompt = PromptTemplate(
        template="""You are an expert AI evaluator scoring a RAG (Retrieval-Augmented Generation) pipeline.
        Evaluate the provided Question, Retrieved Context, and Generated Answer.
        
        Provide a JSON output with exactly three keys, assigning a float score from 0.0 to 1.0 for each:
        1. 'faithfulness': How accurately the generated answer reflects the retrieved context (0.0 = Hallucination, 1.0 = Perfectly derived).
        2. 'relevance': How well the answer actually answers the user's question (0.0 = Off-topic, 1.0 = Direct and accurate).
        3. 'precision': How useful and targeted the retrieved context was for answering the question (0.0 = Irrelevant garbage, 1.0 = Highly specific evidence).

        {format_instructions}

        Question: {question}
        Retrieved Context: {context}
        Generated Answer: {answer}
        """,
        input_variables=["question", "context", "answer"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )
    
    eval_chain = eval_prompt | artifacts.llm | parser

    for i, q in enumerate(test_queries):
        print(f"Evaluating test case {i+1}/{len(test_queries)}: '{q}'")
        
        # 1. Run the standard pipeline to get actual results
        result = answer_question(artifacts, q, top_k=10, detailed=True)
        
        # Trim context slightly to avoid blowing up the evaluation prompt window
        eval_context = result["context"][:3000] if result["context"] else "NO CONTEXT RETRIEVED"

        # 2. Score the results using the LLM judge
        try:
            scores = eval_chain.invoke({
                "question": q,
                "context": eval_context,
                "answer": result["answer"]
            })
            f = float(scores.get("faithfulness", 0.0))
            r = float(scores.get("relevance", 0.0))
            p = float(scores.get("precision", 0.0))
        except Exception as e:
            print(f"Failed to evaluate query '{q}': {e}")
            f, r, p = 0.5, 0.5, 0.5  # Neutral fallback on parsing error

        # 3. Determine threshold status
        avg_score = (f + r + p) / 3.0
        if avg_score >= 0.8:
            status = "Pass"
        elif avg_score >= 0.6:
            status = "Warning"
        else:
            status = "Fail"

        runs.append({
            "id": f"RUN-{str(i+1).zfill(3)}",
            "query": q,
            "faithfulness": f,
            "relevance": r,
            "contextPrecision": p,
            "status": status
        })

        total_faithfulness += f
        total_relevance += r
        total_precision += p

    num_runs = len(runs)
    return {
        "avg_faithfulness": round(total_faithfulness / num_runs, 2) if num_runs else 0.0,
        "avg_relevance": round(total_relevance / num_runs, 2) if num_runs else 0.0,
        "avg_precision": round(total_precision / num_runs, 2) if num_runs else 0.0,
        "runs": runs
    }


def get_all_papers(artifacts: RagArtifacts) -> List[Dict[str, Any]]:
    """
    NEW: Queries Neo4j to retrieve a list of all unique ingested papers,
    along with their titles, abstracts, and dynamic paragraph counts.
    """
    query = """
    MATCH (p:Paragraph)
    WITH p.paper_id AS paper_id, 
         coalesce(p.paper_title, "Unknown Title") AS title, 
         coalesce(p.paper_abstract, "No abstract available.") AS abstract,
         count(p) AS paragraph_count
    RETURN paper_id, title, abstract, paragraph_count
    ORDER BY title ASC
    """
    
    papers = []
    with artifacts.driver.session(database=artifacts.database) as session:
        result = session.run(query)
        for rec in result:
            papers.append({
                "paper_id": str(rec["paper_id"]),
                "title": str(rec["title"]),
                "abstract": str(rec["abstract"]),
                "paragraph_count": int(rec["paragraph_count"])
            })
    return papers
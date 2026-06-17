from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
from tqdm import tqdm
from sentence_transformers import SentenceTransformer

# Ensure paths resolve correctly to the backend/ directory
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# We will build the rag_engine in the next step!
from app.rag_engine import load_artifacts, answer_question


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
    return rows


def write_jsonl(path: Path, rows: List[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def normalize_answer(s: str) -> str:
    import re
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\b(a|an|the)\b", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def exact_match(pred: str, gold: str) -> float:
    return float(normalize_answer(pred) == normalize_answer(gold))


def f1_score(pred: str, gold: str) -> float:
    pred_tokens = normalize_answer(pred).split()
    gold_tokens = normalize_answer(gold).split()

    if not pred_tokens and not gold_tokens:
        return 1.0
    if not pred_tokens or not gold_tokens:
        return 0.0

    common = {}
    for tok in pred_tokens:
        common[tok] = common.get(tok, 0) + 1

    num_same = 0
    for tok in gold_tokens:
        if common.get(tok, 0) > 0:
            num_same += 1
            common[tok] -= 1

    if num_same == 0:
        return 0.0

    precision = num_same / len(pred_tokens)
    recall = num_same / len(gold_tokens)
    return 2 * precision * recall / (precision + recall)


def semantic_answer_similarity(pred: str, gold: str, model: SentenceTransformer) -> float:
    """Calculates cosine similarity between the predicted answer and gold answer."""
    if not pred or not gold:
        return 0.0
    
    emb1 = model.encode([pred], show_progress_bar=False)[0]
    emb2 = model.encode([gold], show_progress_bar=False)[0]
    
    dot_product = np.dot(emb1, emb2)
    norm_a = np.linalg.norm(emb1)
    norm_b = np.linalg.norm(emb2)
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
        
    return float(dot_product / (norm_a * norm_b))


def best_metric(pred: str, gold_answers: List[str], sas_model: SentenceTransformer) -> Dict[str, float]:
    if not gold_answers:
        gold_answers = ["UNANSWERABLE"]

    em = max(exact_match(pred, g) for g in gold_answers)
    f1 = max(f1_score(pred, g) for g in gold_answers)
    sas = max(semantic_answer_similarity(pred, g, sas_model) for g in gold_answers)
    
    return {"em": em, "f1": f1, "sas": sas}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--qas", default=str(BACKEND_ROOT / "data/raw/qasper_eval_qas.jsonl"))
    parser.add_argument("--max_questions", type=int, default=10) # Default to 10 for quick MVP testing
    parser.add_argument("--top_k", type=int, default=30)
    parser.add_argument("--output", default=str(BACKEND_ROOT / "data/processed/predictions.jsonl"))
    parser.add_argument("--sas_model", default="sentence-transformers/all-MiniLM-L6-v2")
    args = parser.parse_args()

    qas_path = Path(args.qas)
    qas = read_jsonl(qas_path)
    if args.max_questions is not None:
        qas = qas[: args.max_questions]

    print("Initializing RAG Engine Artifacts (FAISS, Neo4j, Groq)...")
    engine = load_artifacts()
    
    print(f"Loading SAS Evaluation Model: {args.sas_model}...")
    sas_model = SentenceTransformer(args.sas_model)

    results = []
    em_total = 0.0
    f1_total = 0.0
    sas_total = 0.0

    for row in tqdm(qas, desc="Evaluating Pipeline"):
        try:
            # We fetch top 30 initially, the cross-encoder inside answer_question will filter to top 5
            result = answer_question(
                engine,
                question=row["question"],
                paper_id=row["paper_id"],
                top_k=args.top_k,
            )

            pred = result["answer"]
            gold_answers = row.get("answers", []) or ["UNANSWERABLE"]
            
            scores = best_metric(pred, gold_answers, sas_model)

            em_total += scores["em"]
            f1_total += scores["f1"]
            sas_total += scores["sas"]

            results.append(
                {
                    "paper_id": row["paper_id"],
                    "question_id": row["question_id"],
                    "question": row["question"],
                    "prediction": pred,
                    "gold_answers": gold_answers,
                    "em": scores["em"],
                    "f1": scores["f1"],
                    "sas": scores["sas"],
                }
            )
            
            # Brief delay to prevent Groq API rate limits
            time.sleep(1) 

        except Exception as e:
            print(f"\nFailed on question {row['question_id']} due to error: {e}")
            time.sleep(2)

    n = max(len(results), 1)
    avg_em = em_total / n
    avg_f1 = f1_total / n
    avg_sas = sas_total / n

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    write_jsonl(out_path, results)

    print(f"\n--- EVALUATION COMPLETE ---")
    print(f"Evaluated {len(results)} questions successfully.")
    print(f"Exact Match:                 {avg_em:.4f}")
    print(f"Token F1 Score:              {avg_f1:.4f}")
    print(f"Semantic Answer Sim (SAS):   {avg_sas:.4f}")
    print(f"Saved predictions to {out_path}")


if __name__ == "__main__":
    main()
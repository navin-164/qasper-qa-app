from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import faiss
import numpy as np
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

# Ensure paths resolve correctly to the backend/ directory
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


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


def main() -> None:
    # Load the environment variables from the backend/.env file
    load_dotenv(BACKEND_ROOT / ".env")
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(BACKEND_ROOT / "data/processed/paragraphs.jsonl"))
    parser.add_argument("--output_dir", default=str(BACKEND_ROOT / "data"))
    
    # Load embedding model from .env or default to the highly optimized BGE model
    default_model = os.getenv("EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5")
    parser.add_argument("--model", default=default_model)
    args = parser.parse_args()

    input_path = Path(args.input)
    out_dir = Path(args.output_dir).resolve()
    emb_dir = out_dir / "embeddings"
    faiss_dir = out_dir / "faiss"
    
    emb_dir.mkdir(parents=True, exist_ok=True)
    faiss_dir.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print(f"Error: {input_path} not found. Please run 01_prepare_data.py first.")
        sys.exit(1)

    rows = read_jsonl(input_path)
    texts = [r["text"] for r in rows]

    print(f"Loading embedding model: {args.model}")
    model = SentenceTransformer(args.model)
    
    print("Generating dense vector embeddings... This might take a moment.")
    embeddings = model.encode(texts, batch_size=32, show_progress_bar=True)
    embeddings = np.asarray(embeddings, dtype="float32")

    print("Normalizing vectors and building FAISS Inner Product index...")
    faiss.normalize_L2(embeddings)
    # Using IndexFlatIP (Inner Product) since vectors are normalized, which is equivalent to Cosine Similarity
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)

    # Save artifacts for the RAG server to load instantly
    np.save(emb_dir / "paragraph_embeddings.npy", embeddings)
    write_jsonl(emb_dir / "paragraph_meta.jsonl", rows)
    faiss.write_index(index, str(faiss_dir / "paragraph.index"))

    print(f"Success! Saved embeddings shape: {embeddings.shape}")
    print(f"Saved FAISS index to {faiss_dir / 'paragraph.index'}")


if __name__ == "__main__":
    main()
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from tqdm import tqdm

from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

# Ensure paths resolve correctly to the backend/ directory
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def normalize_text(text: str) -> str:
    return " ".join((text or "").split()).strip()


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


def setup_llm_extractor():
    load_dotenv(BACKEND_ROOT / ".env")
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise ValueError("GROQ_API_KEY is missing. Please add it to your .env file.")

    llm = ChatGroq(
        model_name="llama-3.1-8b-instant",
        temperature=0.0,
        groq_api_key=groq_api_key
    )
    
    parser = JsonOutputParser()
    
    prompt = PromptTemplate(
        template="""You are an expert data extractor. Extract the core semantic relationships from the following academic text.
        Format the output strictly as a JSON array of objects. Each object MUST contain exactly these keys: 'subject', 'relation', 'object'.
        
        Rules:
        1. Subjects and Objects should be concise noun phrases.
        2. Relations should be clear verbs, uppercase, with underscores for spaces (e.g., 'EVALUATES_ON', 'TRAINED_USING').
        3. Do not invent information. Only extract facts explicitly stated in the text.
        
        CRITICAL INSTRUCTIONS: 
        - DO NOT write any Python code.
        - DO NOT provide explanations. 
        - DO NOT use markdown formatting like ```json.
        - OUTPUT ONLY THE RAW JSON ARRAY.
        
        {format_instructions}
        
        Text: {text}
        """,
        input_variables=["text"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )
    return prompt | llm | parser


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(BACKEND_ROOT / "data/processed/paragraphs.jsonl"))
    parser.add_argument("--output", default=str(BACKEND_ROOT / "data/triples/triples.jsonl"))
    # Default to 50 rows so the MVP builds fast without hitting rate limits
    parser.add_argument("--max_rows", type=int, default=50) 
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    rows = read_jsonl(input_path)
    if args.max_rows is not None:
        rows = rows[: args.max_rows]

    out = []
    
    print("Initializing Groq LLM extractor...")
    llm_extractor = setup_llm_extractor()

    for row in tqdm(rows, desc="Extracting triples via LLM"):
        text = row["text"]
        
        try:
            # Process the entire paragraph at once for maximum context
            llm_response = llm_extractor.invoke({"text": text})
            
            triples = []
            if isinstance(llm_response, list):
                triples = llm_response
            elif isinstance(llm_response, dict):
                if "subject" in [k.lower() for k in llm_response.keys()]:
                    triples = [llm_response]
                else:
                    for val in llm_response.values():
                        if isinstance(val, list):
                            triples.extend(val)
            
            for t in triples:
                if not isinstance(t, dict): 
                    continue
                    
                safe_t = {str(k).lower(): v for k, v in t.items()}
                
                subj = safe_t.get("subject", safe_t.get("entity1", safe_t.get("source")))
                rel = safe_t.get("relation", safe_t.get("predicate", safe_t.get("action")))
                obj = safe_t.get("object", safe_t.get("entity2", safe_t.get("target")))
                
                if subj and rel and obj:
                    out.append({
                        "paper_id": row["paper_id"],
                        "paragraph_id": row["paragraph_id"],
                        "section_idx": row["section_idx"],
                        "section_name": row["section_name"],
                        "sentence": text, 
                        "subject": normalize_text(str(subj)),
                        "relation": str(rel).strip().upper().replace(" ", "_"),
                        "object": normalize_text(str(obj)),
                        "confidence": 0.95
                    })
        except Exception as e:
            # No fallback mechanism. Strictly LLM. If it fails, it skips gracefully.
            pass

    write_jsonl(output_path, out)
    print(f"Saved {len(out)} triples to {output_path}")


if __name__ == "__main__":
    main()
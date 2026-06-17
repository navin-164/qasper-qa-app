from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Set

from dotenv import load_dotenv
from neo4j import GraphDatabase
from tqdm import tqdm

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


def sanitize_relation(rel: str) -> str:
    rel = (rel or "RELATED_TO").upper()
    rel = re.sub(r"[^A-Z0-9_]+", "_", rel)
    rel = re.sub(r"_+", "_", rel).strip("_")
    return rel or "RELATED_TO"


def extract_basic_entities(text: str) -> Set[str]:
    """Lightweight fallback to ensure basic capitalized terms are indexed."""
    text = normalize_text(text)
    ents = set()
    for m in re.finditer(r"\b[A-Z][A-Za-z0-9\-]+(?:\s+[A-Z][A-Za-z0-9\-]+)*\b", text):
        val = normalize_text(m.group(0))
        if len(val) >= 2:
            ents.add(val)
    return ents


def get_driver():
    load_dotenv(BACKEND_ROOT / ".env")
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "qasperqaapp")
    database = os.getenv("NEO4J_DATABASE", "neo4j")
    driver = GraphDatabase.driver(uri, auth=(user, password))
    return driver, database


def run_schema(session) -> None:
    queries = [
        "CREATE CONSTRAINT paper_id IF NOT EXISTS FOR (p:Paper) REQUIRE p.paper_id IS UNIQUE",
        "CREATE CONSTRAINT section_id IF NOT EXISTS FOR (s:Section) REQUIRE s.section_id IS UNIQUE",
        "CREATE CONSTRAINT paragraph_id IF NOT EXISTS FOR (p:Paragraph) REQUIRE p.paragraph_id IS UNIQUE",
        "CREATE CONSTRAINT entity_name IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE",
        "CREATE INDEX paragraph_text IF NOT EXISTS FOR (p:Paragraph) ON (p.text)",
    ]
    for q in queries:
        session.run(q)


def ingest_papers(session, papers: List[Dict[str, Any]]) -> None:
    for row in tqdm(papers, desc="Ingesting papers"):
        session.run(
            """
            MERGE (p:Paper {paper_id: $paper_id})
            SET p.title = $title,
                p.abstract = $abstract,
                p.source = 'QASPER'
            """,
            paper_id=row["paper_id"],
            title=row.get("title", ""),
            abstract=row.get("abstract", ""),
        )


def ingest_paragraphs(session, paragraphs: List[Dict[str, Any]]) -> None:
    for row in tqdm(paragraphs, desc="Ingesting paragraphs"):
        section_id = f'{row["paper_id"]}::{row["section_idx"]}'
        paragraph_id = row["paragraph_id"]

        session.run(
            """
            MERGE (p:Paper {paper_id: $paper_id})
            SET p.title = coalesce(p.title, $title),
                p.source = 'QASPER'

            MERGE (s:Section {section_id: $section_id})
            SET s.paper_id = $paper_id,
                s.section_idx = $section_idx,
                s.section_name = $section_name

            MERGE (p)-[:HAS_SECTION]->(s)

            MERGE (g:Paragraph {paragraph_id: $paragraph_id})
            SET g.paper_id = $paper_id,
                g.section_id = $section_id,
                g.section_idx = $section_idx,
                g.paragraph_idx = $paragraph_idx,
                g.text = $text

            MERGE (s)-[:HAS_PARAGRAPH]->(g)
            """,
            paper_id=row["paper_id"],
            title=row.get("paper_title", ""),
            section_id=section_id,
            section_idx=row["section_idx"],
            section_name=row.get("section_name", ""),
            paragraph_id=paragraph_id,
            paragraph_idx=row["paragraph_idx"],
            text=row["text"],
        )


def ingest_mentions_and_triples(session, paragraphs: List[Dict[str, Any]], triples: List[Dict[str, Any]]) -> None:
    # 1. Base entities (Regex fallback for general context)
    for row in tqdm(paragraphs, desc="Creating base mention edges"):
        paragraph_id = row["paragraph_id"]
        entities = extract_basic_entities(row["text"])

        for ent in entities:
            session.run(
                """
                MATCH (p:Paragraph {paragraph_id: $paragraph_id})
                MERGE (e:Entity {name: $name})
                ON CREATE SET e.entity_type = 'UNKNOWN'
                MERGE (p)-[:MENTIONS]->(e)
                """,
                paragraph_id=paragraph_id,
                name=ent,
            )

    # 2. Strict LLM Triples
    for row in tqdm(triples, desc="Ingesting LLM Triples & Forcing Graph Links"):
        paragraph_id = row.get("paragraph_id")
        subject = normalize_text(row.get("subject", ""))
        relation = sanitize_relation(row.get("relation", ""))
        obj = normalize_text(row.get("object", ""))

        if not paragraph_id or len(subject) < 2 or len(obj) < 2:
            continue

        session.run(
            """
            MATCH (p:Paragraph {paragraph_id: $paragraph_id})
            
            MERGE (s_node:Entity {name: $subject})
            ON CREATE SET s_node.entity_type = 'UNKNOWN'
            
            MERGE (o_node:Entity {name: $object})
            ON CREATE SET o_node.entity_type = 'UNKNOWN'
            
            MERGE (p)-[:MENTIONS]->(s_node)
            MERGE (p)-[:MENTIONS]->(o_node)
            
            MERGE (s_node)-[r:RELATED_TO {relation: $relation, paragraph_id: $paragraph_id}]->(o_node)
            SET r.confidence = $confidence,
                r.sentence = $sentence,
                r.paper_id = $paper_id
            """,
            paragraph_id=paragraph_id,
            subject=subject,
            object=obj,
            relation=relation,
            confidence=float(row.get("confidence", 0.95)),
            sentence=row.get("sentence", ""),
            paper_id=row.get("paper_id", "")
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--papers", default=str(BACKEND_ROOT / "data/raw/papers.jsonl"))
    parser.add_argument("--paragraphs", default=str(BACKEND_ROOT / "data/processed/paragraphs.jsonl"))
    parser.add_argument("--triples", default=str(BACKEND_ROOT / "data/triples/triples.jsonl"))
    args = parser.parse_args()

    papers_path = Path(args.papers)
    paragraphs_path = Path(args.paragraphs)
    triples_path = Path(args.triples)

    papers = read_jsonl(papers_path)
    paragraphs = read_jsonl(paragraphs_path)
    triples = read_jsonl(triples_path) if triples_path.exists() else []

    print("Connecting to Neo4j...")
    driver, database = get_driver()

    try:
        with driver.session(database=database) as session:
            run_schema(session)
            ingest_papers(session, papers)
            ingest_paragraphs(session, paragraphs)
            if triples:
                ingest_mentions_and_triples(session, paragraphs, triples)
    finally:
        driver.close()

    print("Neo4j Graph ingestion completed successfully.")


if __name__ == "__main__":
    main()
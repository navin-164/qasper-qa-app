// Force IPv4 loopback to match Uvicorn's default binding safely
const API_BASE_URL = "http://127.0.0.1:8000/api";

export interface QuestionRequest {
  question: string;
  paper_id?: string;
  top_k?: number;
  detailed?: boolean;
}

export interface EvidenceParagraph {
  paragraph_id: string;
  paper_id: string;
  section_name: string;
  text: string;
  source: string;
  rerank_score?: number;
}

export interface GraphFact {
  subject: string;
  relation: string;
  object: string;
  confidence: number;
}

// --- TOKEN TRACKING TYPE ---
export interface TokenStats {
  prompt_tokens: number;
  context_tokens: number;
  answer_tokens: number;
  total_tokens: number;
}

// --- NEW HALLUCINATION GUARDRAIL TYPE ---
export interface SentenceValidation {
  sentence: string;
  status: string; // "Supported", "Partially Supported", or "Unsupported"
}

export interface AnswerResponse {
  question: string;
  answer: string;
  evidence_paragraphs: EvidenceParagraph[];
  graph_facts: GraphFact[];
  context: string;
  token_stats: TokenStats;
  validations: SentenceValidation[];
}

// --- TYPES FOR GRAPH EXPLORER ---

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  properties: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  confidence: number;
}

export interface GraphSchemaResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// --- TYPES FOR EVALUATION DASHBOARD ---

export interface EvalRun {
  id: string;
  query: string;
  faithfulness: number;
  relevance: number;
  contextPrecision: number;
  status: string;
}

export interface EvalRequest {
  queries?: string[];
}

export interface EvalDashboardResponse {
  avg_faithfulness: number;
  avg_relevance: number;
  avg_precision: number;
  runs: EvalRun[];
}

// --- NEW TYPES FOR PAPER BROWSER ---

export interface PaperMetadata {
  paper_id: string;
  title: string;
  abstract: string;
  paragraph_count: number;
}

export interface PaperListResponse {
  papers: PaperMetadata[];
}

// --- API METHODS ---

export async function askQuestion(req: QuestionRequest): Promise<AnswerResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    throw new Error(`QA API Error: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchGraphSchema(limit: number = 80): Promise<GraphSchemaResponse> {
  const response = await fetch(`${API_BASE_URL}/graph/schema?limit=${limit}`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Graph Schema API Error: ${response.statusText}`);
  }

  return response.json();
}

export async function runEvaluation(req?: EvalRequest): Promise<EvalDashboardResponse> {
  const response = await fetch(`${API_BASE_URL}/evaluate`, {
    method: "POST", // Changed from GET to POST
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(req || {}), // Send the custom queries
  });

  if (!response.ok) {
    throw new Error(`Evaluation API Error: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchPapers(): Promise<PaperListResponse> {
  const response = await fetch(`${API_BASE_URL}/papers`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Papers API Error: ${response.statusText}`);
  }

  return response.json();
}
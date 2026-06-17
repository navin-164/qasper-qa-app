import axios from "axios";

// Points to our running FastAPI development server
const API_BASE_URL = "http://localhost:8000/api";

export interface QuestionRequest {
  question: string;
  paper_id?: string | null;
  top_k?: number;
  detailed?: boolean;
}

export interface EvidenceParagraph {
  paper_id: string;
  paper_title?: string;
  section_idx: number;
  section_name?: string;
  paragraph_idx: number;
  paragraph_id: string;
  text: string;
  source: "vector" | "graph";
  rerank_score?: number;
}

export interface GraphFact {
  subject: string;
  relation: string;
  object: string;
  confidence: number;
  sentence: string;
}

export interface AnswerResponse {
  question: string;
  answer: string;
  evidence_paragraphs: EvidenceParagraph[];
  graph_facts: GraphFact[];
  context: string;
}

/**
 * Sends a hybrid RAG QA query to the FastAPI backend server.
 */
export async function askQuestion(payload: QuestionRequest): Promise<AnswerResponse> {
  try {
    const response = await axios.post<AnswerResponse>(`${API_BASE_URL}/ask`, {
      question: payload.question,
      paper_id: payload.paper_id || null,
      top_k: payload.top_k ?? 30,
      detailed: payload.detailed ?? true,
    });
    return response.data;
  } catch (error) {
    console.error("API Communication Error:", error);
    throw error;
  }
}

/**
 * Checks the running health status of the backend API.
 */
export async function checkBackendHealth(): Promise<{ status: string; engine_loaded: boolean }> {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  } catch (error) {
    return { status: "disconnected", engine_loaded: false };
  }
}
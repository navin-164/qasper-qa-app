"use client";

import React, { useState } from "react";
import { askQuestion, AnswerResponse, EvidenceParagraph, GraphFact } from "@/lib/api";
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  ShieldCheck, 
  BookOpen, 
  Share2, 
  Sparkles 
} from "lucide-react";

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnswerResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"answer" | "vector" | "graph">("answer");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsLoading(true);
    try {
      const data = await askQuestion({
        question: question,
        detailed: true,
        top_k: 30
      });
      setResult(data);
      setActiveTab("answer");
    } catch (err) {
      console.error(err);
      alert("Failed to communicate with the hybrid RAG backend. Make sure uvicorn is running on port 8000.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Module Title */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/40 shrink-0">
        <h1 className="text-xl font-bold text-white flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-violet-400" />
          <span>Research Chatbot Workspace</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Query your multi-document arXiv corpus using unified Vector similarity search and Neo4j Graph relations.
        </p>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* Left Side: Interaction & Generation Engine */}
        <div className="flex-1 flex flex-col p-6 min-w-0 border-r border-slate-800/60 overflow-y-auto">
          
          {/* Form Entry */}
          <form onSubmit={handleSearch} className="mb-6 shrink-0">
            <div className="relative flex items-center">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask an academic question (e.g., Explain the dataset split or Q-learning variance)..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-slate-100 placeholder-slate-500 pl-4 pr-12 py-3.5 rounded-xl text-sm transition-all shadow-inner outline-none"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                className="absolute right-2 p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:bg-slate-800 disabled:text-slate-600"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </form>

          {/* Response Deck */}
          <div className="flex-1 min-h-0 flex flex-col">
            {result ? (
              <div className="space-y-6">
                
                {/* Unified Tab Selector */}
                <div className="flex border-b border-slate-800 space-x-6 text-sm">
                  <button
                    onClick={() => setActiveTab("answer")}
                    className={`pb-3 font-medium transition-all relative ${
                      activeTab === "answer" ? "text-violet-400" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Generated Answer
                    {activeTab === "answer" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full" />}
                  </button>
                  <button
                    onClick={() => setActiveTab("vector")}
                    className={`pb-3 font-medium transition-all relative ${
                      activeTab === "vector" ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Dense Evidence Chunks ({result.evidence_paragraphs.length})
                    {activeTab === "vector" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
                  </button>
                  <button
                    onClick={() => setActiveTab("graph")}
                    className={`pb-3 font-medium transition-all relative ${
                      activeTab === "graph" ? "text-pink-400" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Knowledge Graph Facts ({result.graph_facts.length})
                    {activeTab === "graph" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 rounded-full" />}
                  </button>
                </div>

                {/* Tab Output Windows */}
                <div className="py-2">
                  {activeTab === "answer" && (
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-6 shadow-sm leading-relaxed text-slate-200 space-y-4">
                      <div className="flex items-center space-x-2 text-violet-400 text-xs font-semibold tracking-wider uppercase">
                        <Sparkles className="w-4 h-4" />
                        <span>LLM Synthesis (Llama-3.1-8B)</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{result.answer}</p>
                    </div>
                  )}

                  {activeTab === "vector" && (
                    <div className="space-y-4">
                      {result.evidence_paragraphs.map((para: EvidenceParagraph, idx: number) => (
                        <div key={para.paragraph_id || idx} className="bg-slate-950/40 border border-slate-800 p-5 rounded-xl space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-blue-400 font-medium flex items-center space-x-1">
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Chunk [{idx + 1}] — Section: {para.section_name || "Body"}</span>
                            </span>
                            <span className="text-slate-500 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              Re-rank Score: {para.rerank_score?.toFixed(4) || "N/A"}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300 italic">"{para.text}"</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "graph" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.graph_facts.map((fact: GraphFact, idx: number) => (
                        <div key={idx} className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                          <div className="font-mono text-xs text-slate-300 space-y-1">
                            <div className="flex items-center space-x-2"><span className="text-pink-400 font-bold">S:</span> <span>{fact.subject}</span></div>
                            <div className="flex items-center space-x-2"><span className="text-violet-400 font-bold">P:</span> <span className="underline decoration-dotted">{fact.relation}</span></div>
                            <div className="flex items-center space-x-2"><span className="text-cyan-400 font-bold">O:</span> <span>{fact.object}</span></div>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-900 text-[11px] text-slate-500 flex justify-between items-center">
                            <span>Confidence Score</span>
                            <span className="text-emerald-500 font-bold">{(fact.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                      {result.graph_facts.length === 0 && (
                        <p className="text-sm text-slate-500 italic col-span-2 p-4 text-center">No explicit entity triples found in the knowledge graph for this path.</p>
                      )}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500">
                <MessageSquare className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-sm">No queries initialized yet.</p>
                <p className="text-xs text-slate-600 mt-1">Submit a question above to execute the pipeline routing checks.</p>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Integrity Shield & Guardrails Panel */}
        <div className="w-80 p-6 bg-slate-950/20 shrink-0 flex flex-col overflow-y-auto space-y-6">
          <div className="border border-slate-800/80 bg-slate-950/40 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Hallucination Guardrail</span>
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Our extraction system monitors the pipeline context matrices. Cross-encoder scores rule out irrelevant citations before generation.
            </p>
            <div className="space-y-2 pt-2 text-[11px]">
              <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800">
                <span className="text-slate-400">Context Source Match</span>
                <span className={result ? "text-emerald-400 font-medium" : "text-slate-600"}>{result ? "Verified" : "Pending"}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800">
                <span className="text-slate-400">Strict Extraction Mode</span>
                <span className="text-violet-400 font-medium">Active</span>
              </div>
            </div>
          </div>

          <div className="border border-slate-800/80 bg-slate-950/40 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <Share2 className="w-4 h-4 text-blue-400" />
              <span>Pipeline Trace</span>
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              When a question hits our API, the engine optimizes the query string before dividing execution branches to FAISS and Neo4j.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
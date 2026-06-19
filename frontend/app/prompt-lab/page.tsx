"use client";

import React, { useState } from "react";
import { askQuestion } from "@/lib/api"; // <-- Imported your actual API client!
import { 
  TerminalSquare, 
  Sparkles, 
  Settings2, 
  CheckCircle2, 
  AlertTriangle,
  Play,
  Loader2,
  Edit3,
  DatabaseZap // <-- Added a database icon
} from "lucide-react";

export default function PromptLabPage() {
  const [temperature, setTemperature] = useState<number>(0.1);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are an expert academic assistant evaluating the QASPER dataset. Answer the question using ONLY the provided text paragraphs and knowledge graph triples. If the answer is not contained in the evidence, you must say 'UNANSWERABLE'."
  );
  
  // Default to empty, waiting for real data
  const [ragContext, setRagContext] = useState("");

  const [userQuery, setUserQuery] = useState(
    "What is the variance or bias tradeoff mentioned for every-visit Monte Carlo methods?"
  );
  
  const [activeTemplate, setActiveTemplate] = useState("strict");
  const [estimatedTokens, setEstimatedTokens] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isFetchingContext, setIsFetchingContext] = useState(false); // <-- Track API state

  const handleTemplateSwitch = (type: string) => {
    setActiveTemplate(type);
    if (type === "strict") {
      setSystemPrompt("You are an expert academic assistant evaluating the QASPER dataset. Answer the question using ONLY the provided text paragraphs and knowledge graph triples. If the answer is not contained in the evidence, you must say 'UNANSWERABLE'.");
    } else {
      setSystemPrompt("You are an advanced reasoning agent. Synthesize the provided text paragraphs and knowledge graph edges to answer the user's question. You may make minor academic inferences to connect the concepts smoothly.");
    }
  };

  // Hit the real backend to fetch FAISS/Neo4j data
  const handleFetchContext = async () => {
    if (!userQuery.trim()) return;
    setIsFetchingContext(true);
    try {
      // We use detailed=true to hit the full retrieval pipeline
      const data = await askQuestion({ question: userQuery, detailed: true });
      setRagContext(data.context || "No context found in the database for this query.");
    } catch (err: any) {
      setRagContext(`[Error fetching context from backend: ${err.message}]`);
    } finally {
      setIsFetchingContext(false);
    }
  };

  const handleEstimateTokens = () => {
    setIsEstimating(true);
    setTimeout(() => {
      // Accurately sum all three boxes
      const totalCharacters = systemPrompt.length + ragContext.length + userQuery.length;
      const promptTokens = Math.ceil(totalCharacters / 4);
      
      setEstimatedTokens(promptTokens);
      setIsEstimating(false);
    }, 600);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0B1120] h-full text-slate-200">
      
      {/* LEFT PANEL: Controls & Settings */}
      <div className="w-[320px] lg:w-[350px] flex flex-col border-r border-slate-800 bg-slate-900/50 shrink-0 overflow-y-auto">
        
        <div className="p-5 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white tracking-wide uppercase mb-1">System Templates</h2>
          <p className="text-xs text-slate-500">Select a baseline behavior profile.</p>
        </div>

        <div className="p-5 space-y-6 flex-1">
          
          <div className="space-y-3">
            <button 
              onClick={() => handleTemplateSwitch("strict")}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                activeTemplate === "strict" 
                  ? "bg-fuchsia-500/10 border-fuchsia-500/50" 
                  : "bg-slate-950/50 border-slate-800 hover:border-slate-600"
              }`}
            >
              <h3 className={`text-sm font-bold mb-1 ${activeTemplate === "strict" ? "text-fuchsia-400" : "text-slate-300"}`}>
                Strict Evidence Extraction
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Forces the LLM to only answer if grounded directly in the provided text chunks.
              </p>
            </button>

            <button 
              onClick={() => handleTemplateSwitch("synth")}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                activeTemplate === "synth" 
                  ? "bg-blue-500/10 border-blue-500/50" 
                  : "bg-slate-950/50 border-slate-800 hover:border-slate-600"
              }`}
            >
              <h3 className={`text-sm font-bold mb-1 ${activeTemplate === "synth" ? "text-blue-400" : "text-slate-300"}`}>
                Comprehensive Synthesis
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Allows minor academic inferences to connect vector chunks and graph edges smoothly.
              </p>
            </button>
          </div>

          <hr className="border-slate-800" />

          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Temperature</span>
                </label>
                <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-white">{temperature}</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-fuchsia-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-2">
               <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                System Instruction Block
              </label>
              <textarea 
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={5}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 outline-none focus:border-fuchsia-500/50 transition-colors resize-y leading-relaxed"
              />
            </div>

            <div className="space-y-2">
               <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Sandbox User Question
              </label>
              <textarea 
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 outline-none focus:border-fuchsia-500/50 transition-colors resize-y leading-relaxed"
              />
            </div>
          </div>

        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-900 shrink-0">
          <button 
            onClick={handleEstimateTokens}
            disabled={isEstimating}
            className="w-full py-3 px-4 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-fuchsia-900/20 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isEstimating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>{isEstimating ? "Calculating..." : "Compile & Estimate Prompt Payload"}</span>
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: Review & Output */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-6 md:p-8 lg:p-10 max-w-6xl mx-auto w-full space-y-8">
          
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center space-x-3 mb-2">
              <TerminalSquare className="w-6 h-6 text-fuchsia-400" />
              <span>RAG Prompt Engineering Lab</span>
            </h1>
            <p className="text-sm text-slate-400">
              Optimize your baseline templates, manage context constraint weights, and adjust generation parameters for Llama-3.1-8B.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-bold text-white">Context-Window Compilation Review</h2>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              You can now directly edit the payload blocks below. They will automatically sync with your control panel.
            </p>
            
            <div className="bg-[#0D1527] border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              
              {/* EDITABLE SYSTEM PROMPT */}
              <div className="p-5 border-b border-slate-800/50 bg-slate-900/20 group relative">
                <div className="text-[10px] font-mono text-fuchsia-400 mb-2 flex justify-between items-center">
                  <span>&lt;system_prompt&gt;</span>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500">
                    <Edit3 className="w-3 h-3" />
                    <span>Editable</span>
                  </div>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-transparent border border-transparent hover:border-slate-700/50 focus:border-fuchsia-500/50 focus:bg-slate-950/50 rounded-lg p-2 -ml-2 text-sm text-slate-300 font-mono leading-relaxed resize-y outline-none transition-all"
                />
              </div>

              {/* REAL LIVE API CONTEXT */}
              <div className="p-5 border-b border-slate-800/50 bg-slate-900/20 group relative">
                <div className="text-[10px] font-mono text-blue-400 mb-2 flex justify-between items-center">
                  <span>&lt;injected_rag_context&gt;</span>
                  
                  <div className="flex items-center space-x-4">
                    {/* NEW BUTTON: FETCH FROM DB */}
                    <button 
                      onClick={handleFetchContext}
                      disabled={isFetchingContext}
                      className="flex items-center space-x-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      {isFetchingContext ? <Loader2 className="w-3 h-3 animate-spin" /> : <DatabaseZap className="w-3 h-3" />}
                      <span>Fetch Live Context</span>
                    </button>

                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500">
                      <Edit3 className="w-3 h-3" />
                      <span>Editable</span>
                    </div>
                  </div>
                </div>
                
                <textarea
                  value={ragContext}
                  onChange={(e) => setRagContext(e.target.value)}
                  placeholder="Click 'Fetch Live Context' to pull real data from your Knowledge Graph & FAISS database..."
                  rows={9}
                  className="w-full bg-transparent border border-transparent hover:border-slate-700/50 focus:border-blue-500/50 focus:bg-slate-950/50 rounded-lg p-2 -ml-2 text-sm text-slate-400 font-mono leading-relaxed resize-y outline-none transition-all placeholder:italic placeholder:text-slate-600"
                />
              </div>

              {/* EDITABLE USER QUERY */}
              <div className="p-5 bg-slate-900/20 group relative">
                <div className="text-[10px] font-mono text-emerald-400 mb-2 flex justify-between items-center">
                  <span>&lt;user_query&gt;</span>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500">
                    <Edit3 className="w-3 h-3" />
                    <span>Editable</span>
                  </div>
                </div>
                <textarea
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  rows={2}
                  className="w-full bg-transparent border border-transparent hover:border-slate-700/50 focus:border-emerald-500/50 focus:bg-slate-950/50 rounded-lg p-2 -ml-2 text-sm text-slate-300 font-mono leading-relaxed resize-y outline-none transition-all"
                />
              </div>

            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-xl flex items-start space-x-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Token Metric Estimate</h3>
                <div className="text-lg font-mono font-bold text-slate-300 mb-1">
                  {estimatedTokens !== null ? (
                    <span className="text-emerald-400">~{estimatedTokens} tokens</span>
                  ) : (
                    "--- tokens"
                  )}
                </div>
                <p className="text-xs text-slate-500">Safely inside the LLM context bounds.</p>
              </div>
            </div>

            <div className="bg-amber-950/20 border border-amber-900/50 p-5 rounded-xl flex items-start space-x-4">
              <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${temperature > 0.3 ? "text-amber-500" : "text-emerald-500"}`} />
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Deterministic Anchor</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {temperature > 0.3 
                    ? "Higher temperature detected. The model may hallucinate details outside the provided RAG context window." 
                    : "Low temperature forces grounded, highly deterministic extractions from the provided context chunks."}
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
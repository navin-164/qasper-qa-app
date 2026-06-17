"use client";

import React, { useState } from "react";
import { 
  Terminal, 
  Sparkles, 
  Sliders, 
  HelpCircle, 
  Play, 
  FileText, 
  CheckCircle, 
  AlertTriangle 
} from "lucide-react";

// Pre-configured system templates typical for engineering a QASPER Graph RAG pipeline
const templatePresets = [
  {
    id: "strict-evidence",
    name: "Strict Evidence Extraction",
    description: "Forces the LLM to only answer if grounded directly in the provided text chunks.",
    systemPrompt: "You are an expert academic assistant evaluating the QASPER dataset. Answer the question using ONLY the provided text paragraphs and knowledge graph triples. If the answer cannot be directly derived from the context, respond with 'INSUFFICIENT_EVIDENCE'. Do not extrapolate.",
    temperature: 0.1,
  },
  {
    id: "comprehensive-synthesis",
    name: "Comprehensive Synthesis",
    description: "Allows minor academic inferences to connect vector chunks and graph edges smoothly.",
    systemPrompt: "You are an advanced research analyzer. Synthesize the provided vector similarity chunks and Neo4j relational facts into a coherent summary. Detail contradictory findings if they exist in separate papers. Use clear technical terminology.",
    temperature: 0.4,
  }
];

export default function PromptLabPage() {
  const [selectedPreset, setSelectedPreset] = useState(templatePresets[0]);
  const [systemPrompt, setSystemPrompt] = useState(templatePresets[0].systemPrompt);
  const [userQuery, setUserQuery] = useState("What is the variance or bias tradeoff mentioned for every-visit Monte Carlo methods?");
  const [temperature, setTemperature] = useState(templatePresets[0].temperature);
  const [isCompiling, setIsCompiling] = useState(false);
  const [outputTokenEstimation, setOutputTokenEstimation] = useState<number | null>(null);

  const handleApplyPreset = (preset: typeof templatePresets[0]) => {
    setSelectedPreset(preset);
    setSystemPrompt(preset.systemPrompt);
    setTemperature(preset.temperature);
  };

  const handleTestPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCompiling(true);
    
    // Simulate compilation latency and evaluate context window impact
    setTimeout(() => {
      setIsCompiling(false);
      const combinedLength = systemPrompt.length + userQuery.length + 1200; // adding 1200 chars for mock injected context
      setOutputTokenEstimation(Math.ceil(combinedLength / 4));
    }, 700);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Top Banner */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/40 shrink-0">
        <h1 className="text-xl font-bold text-white flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-pink-400" />
          <span>RAG Prompt Engineering Lab</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Optimize your baseline templates, manage context constraint weights, and adjust generation parameters for Llama-3.1-8B.
        </p>
      </div>

      {/* Main Grid Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden p-6 gap-6">
        
        {/* Left Controller Panel */}
        <form onSubmit={handleTestPrompt} className="w-[450px] bg-slate-950/40 border border-slate-800 rounded-xl p-5 flex flex-col min-h-0 space-y-5">
          
          {/* Preset Selector */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-2">
              System Templates
            </label>
            <div className="space-y-2">
              {templatePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={`w-full text-left p-3 rounded-lg border transition-all text-xs ${
                    selectedPreset.id === preset.id
                      ? "bg-pink-500/10 border-pink-500/40 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="font-semibold text-slate-200 mb-0.5">{preset.name}</div>
                  <div className="text-[11px] text-slate-400 leading-normal">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* System Prompt Input */}
          <div className="flex-1 flex flex-col min-h-0">
            <label className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-2">
              System Instruction Block
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono leading-relaxed resize-none outline-none focus:border-pink-500 transition-all shadow-inner"
              placeholder="Enter system rules here..."
            />
          </div>

          {/* Hyperparameters slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium flex items-center space-x-1">
                <Sliders className="w-3.5 h-3.5 text-violet-400" />
                <span>Temperature</span>
              </span>
              <span className="font-mono font-bold bg-slate-900 text-violet-400 px-2 py-0.5 border border-slate-800 rounded">
                {temperature}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-pink-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Sandbox User Question Test */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-2">
              Sandbox User Question
            </label>
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5 outline-none focus:border-pink-500 transition-all"
            />
          </div>

          {/* Compilation CTA */}
          <button
            type="submit"
            disabled={isCompiling}
            className="w-full py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium text-xs transition-all flex items-center justify-center space-x-2 shadow-md disabled:bg-slate-800 disabled:text-slate-600"
          >
            {isCompiling ? (
              <span>Evaluating Token Load...</span>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Compile & Estimate Prompt Payload</span>
              </>
            )}
          </button>
        </form>

        {/* Right Output Validation Panel */}
        <div className="flex-1 bg-slate-950/20 border border-slate-800/60 rounded-xl p-6 flex flex-col min-h-0 justify-between">
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white mb-1 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span>Context-Window Compilation Review</span>
              </h2>
              <p className="text-xs text-slate-400">
                Inspect how your system rules will wrap around raw text nodes before getting submitted down to the inference endpoint.
              </p>
            </div>

            {/* Simulated Frame Structure Preview */}
            <div className="space-y-3 font-mono text-[11px] leading-relaxed">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <span className="text-pink-400 font-bold">&lt;system_prompt&gt;</span>
                <p className="text-slate-400 mt-1 pl-2 truncate">{systemPrompt}</p>
              </div>

              <div className="bg-slate-950 border border-dashed border-slate-800 rounded-lg p-3 text-slate-600">
                <span className="text-blue-400 font-bold">&lt;injected_rag_context&gt;</span>
                <p className="italic mt-1 pl-2">
                  [Dynamic injection of top_k vector elements + pulled Neo4j triples from backend pipeline execution]
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <span className="text-violet-400 font-bold">&lt;user_query&gt;</span>
                <p className="text-slate-400 mt-1 pl-2">{userQuery}</p>
              </div>
            </div>
          </div>

          {/* Metric Guardrails Report Footer */}
          <div className="border-t border-slate-800/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 flex items-start space-x-3">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-white text-xs">Token Metric Estimate</h4>
                <p className="font-mono text-sm font-bold text-slate-200 mt-1">
                  {outputTokenEstimation ? `${outputTokenEstimation} tokens` : "--- tokens"}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Safely inside the LLM context bounds.</p>
              </div>
            </div>

            <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 flex items-start space-x-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-white text-xs">Deterministic Anchor</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  {temperature <= 0.2 
                    ? "Low temperature forces greedy path selection, perfect for evidence retrieval validation." 
                    : "Higher temperature detected. Ensure structured parsing chains handle structural variance safely."}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
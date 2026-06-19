"use client";

import React, { useState } from "react";
import { runEvaluation, EvalDashboardResponse } from "@/lib/api";
import { 
  BarChart2, 
  Play, 
  Loader2, 
  CheckCircle2, 
  Target, 
  AlertCircle,
  History,
  Settings
} from "lucide-react";

export default function EvalPage() {
  const [data, setData] = useState<EvalDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // NEW: Editable local state for your custom Golden Dataset
  const [customQueries, setCustomQueries] = useState(
    "What is the variance tradeoff for every-visit Monte Carlo?\nExplain the dataset split methodology in QASPER.\nHow does LSTDQ optimize sample reuse?\nWhat are the limitations of the Bellman Equation here?"
  );

  const handleRunEvaluation = async () => {
    setLoading(true);
    setError(null);
    try {
      // Split the text area by newlines and remove any empty lines
      const queryArray = customQueries
        .split("\n")
        .map(q => q.trim())
        .filter(q => q.length > 0);

      const result = await runEvaluation({ queries: queryArray.length > 0 ? queryArray : undefined });
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to run evaluation suite.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-y-auto bg-[#0B1120] text-slate-200">
      <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Header & Run Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center space-x-3 mb-2">
              <BarChart2 className="w-6 h-6 text-emerald-400" />
              <span>RAG Evaluation Metrics</span>
            </h1>
            <p className="text-sm text-slate-400">
              Monitor pipeline accuracy, hallucination rates, and retrieval precision across your corpus.
            </p>
          </div>
          
          <button 
            onClick={handleRunEvaluation}
            disabled={loading}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-900/20 flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{loading ? "Evaluating Pipeline..." : "Run Evaluation Suite"}</span>
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* NEW: Dynamic Golden Dataset Configuration Box */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-2 mb-4">
            <Settings className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Test Suite Configuration</h2>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Enter your custom Golden Dataset test queries below (one query per line). The LLM-as-a-Judge will evaluate the pipeline's performance against these specific questions.
          </p>
          <textarea
            value={customQueries}
            onChange={(e) => setCustomQueries(e.target.value)}
            rows={5}
            disabled={loading}
            className="w-full bg-[#0D1527] border border-slate-800 rounded-lg p-4 text-sm text-slate-300 font-mono outline-none focus:border-emerald-500/50 transition-colors resize-y disabled:opacity-50 leading-relaxed"
          />
        </div>

        {/* Aggregated Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold text-slate-300">Avg Faithfulness</h3>
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              {data ? data.avg_faithfulness.toFixed(2) : "0.00"}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">Measures if the answer is strictly derived from retrieved context.</p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold text-slate-300">Answer Relevance</h3>
              <Target className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              {data ? data.avg_relevance.toFixed(2) : "0.00"}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">Measures how well the generated answer addresses the actual prompt.</p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold text-slate-300">Context Precision</h3>
              <AlertCircle className="w-5 h-5 text-pink-400" />
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              {data ? data.avg_precision.toFixed(2) : "0.00"}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">Evaluates if the most relevant chunks were ranked highest.</p>
          </div>
        </div>

        {/* Run Ledger Table */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-800 bg-slate-950/40 flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Evaluation Run Ledger</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                  <th className="p-4 font-bold">Run ID</th>
                  <th className="p-4 font-bold">Test Query</th>
                  <th className="p-4 font-bold">Faithfulness</th>
                  <th className="p-4 font-bold">Relevance</th>
                  <th className="p-4 font-bold">Precision</th>
                  <th className="p-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-300">
                {!data ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-600 italic">
                      Click "Run Evaluation Suite" to generate pipeline metrics.
                    </td>
                  </tr>
                ) : (
                  data.runs.map((run) => (
                    <tr key={run.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 font-mono text-slate-500">{run.id}</td>
                      <td className="p-4 font-medium text-white max-w-md truncate">{run.query}</td>
                      <td className="p-4 font-mono text-indigo-400">{run.faithfulness.toFixed(2)}</td>
                      <td className="p-4 font-mono text-blue-400">{run.relevance.toFixed(2)}</td>
                      <td className="p-4 font-mono text-pink-400">{run.contextPrecision.toFixed(2)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          run.status === "Pass" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : run.status === "Warning"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                          {run.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
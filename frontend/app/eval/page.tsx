"use client";

import React, { useState } from "react";
import { 
  BarChart3, 
  Target, 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  History,
  Play
} from "lucide-react";

// Mock evaluation data representing RAGAS/TruLens style metrics
const mockEvalRuns = [
  {
    id: "RUN-001",
    query: "What is the variance tradeoff for every-visit Monte Carlo?",
    faithfulness: 0.95,
    relevance: 0.92,
    contextPrecision: 0.88,
    status: "Pass"
  },
  {
    id: "RUN-002",
    query: "Explain the dataset split methodology in QASPER.",
    faithfulness: 0.82,
    relevance: 0.85,
    contextPrecision: 0.76,
    status: "Warning"
  },
  {
    id: "RUN-003",
    query: "How does LSTDQ optimize sample reuse?",
    faithfulness: 0.98,
    relevance: 0.96,
    contextPrecision: 0.94,
    status: "Pass"
  },
  {
    id: "RUN-004",
    query: "What are the limitations of the Bellman Equation here?",
    faithfulness: 0.45,
    relevance: 0.60,
    contextPrecision: 0.30,
    status: "Fail"
  }
];

export default function EvaluationDashboard() {
  const [isRunning, setIsRunning] = useState(false);

  const handleRunEval = () => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Header Section */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/40 shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span>RAG Evaluation Metrics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor pipeline accuracy, hallucination rates, and retrieval precision across your corpus.
          </p>
        </div>
        <button 
          onClick={handleRunEval}
          disabled={isRunning}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-all flex items-center space-x-2 disabled:bg-slate-800 disabled:text-slate-500"
        >
          {isRunning ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>{isRunning ? "Running Batch Eval..." : "Run Evaluation Suite"}</span>
        </button>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Aggregate Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-xl flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-slate-300">Avg Faithfulness</h3>
              <CheckCircle2 className="w-5 h-5 text-violet-400" />
            </div>
            <div className="text-3xl font-bold text-white">0.80</div>
            <p className="text-[11px] text-slate-500 mt-2">Measures if the answer is strictly derived from retrieved context.</p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-xl flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-slate-300">Answer Relevance</h3>
              <Target className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-white">0.83</div>
            <p className="text-[11px] text-slate-500 mt-2">Measures how well the generated answer addresses the actual prompt.</p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-xl flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-slate-300">Context Precision</h3>
              <AlertCircle className="w-5 h-5 text-pink-400" />
            </div>
            <div className="text-3xl font-bold text-white">0.72</div>
            <p className="text-[11px] text-slate-500 mt-2">Evaluates if the most relevant chunks were ranked highest.</p>
          </div>
        </div>

        {/* Detailed Evaluation History Table */}
        <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-white">Recent Evaluation Runs</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-900 text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Run ID</th>
                  <th className="px-6 py-4 font-medium">Test Query</th>
                  <th className="px-6 py-4 font-medium">Faithfulness</th>
                  <th className="px-6 py-4 font-medium">Relevance</th>
                  <th className="px-6 py-4 font-medium">Precision</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {mockEvalRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{run.id}</td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-200">{run.query}</td>
                    <td className="px-6 py-4 font-mono text-xs text-violet-400">{run.faithfulness.toFixed(2)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-blue-400">{run.relevance.toFixed(2)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-pink-400">{run.contextPrecision.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full border ${
                        run.status === "Pass" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                        run.status === "Warning" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                        "bg-red-500/10 text-red-400 border-red-500/30"
                      }`}>
                        {run.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
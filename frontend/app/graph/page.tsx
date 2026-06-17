"use client";

import React, { useState } from "react";
import { 
  Network, 
  Search, 
  Database, 
  GitCommit, 
  HelpCircle, 
  Filter,
  CheckCircle2
} from "lucide-react";

// Mock snapshot data representing our local Neo4j entity graph layout
const sampleNodes = [
  { id: "N1", name: "Q-learning", type: "Algorithm", properties: "Model-free, Temporal Difference" },
  { id: "N2", name: "Every-Visit MC", type: "Method", properties: "Unbiased expectation, high variance" },
  { id: "N3", name: "LSTDQ", type: "Algorithm", properties: "Least-Squares TD, Sample Reuse focus" },
  { id: "N4", name: "Variance", type: "Metric", properties: "Affected by sample correlation" },
  { id: "N5", name: "Bellman Equation", type: "Mathematical Foundation", properties: "Dynamic Programming basis" },
  { id: "N6", name: "Taxi-World", type: "Environment", properties: "Hierarchical Task Call-Graph" },
];

const sampleEdges = [
  { source: "Every-Visit MC", target: "Variance", relation: "HAS_HIGH", confidence: 0.95 },
  { source: "Q-learning", target: "Bellman Equation", relation: "RELIERS_ON", confidence: 0.99 },
  { source: "LSTDQ", target: "Q-learning", relation: "OPTIMIZES_VIA_SAMPLE_REUSE", confidence: 0.92 },
  { source: "Taxi-World", target: "Bellman Equation", relation: "SOLVED_BY_HIERARCHICAL", confidence: 0.88 },
];

export default function GraphExplorerPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("All");

  const filteredNodes = sampleNodes.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          node.properties.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "All" || node.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Top Meta Bar */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/40 shrink-0">
        <h1 className="text-xl font-bold text-white flex items-center space-x-2">
          <Network className="w-5 h-5 text-pink-400" />
          <span>Graph RAG Knowledge Base Explorer</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspect entities, relations, and cross-document assertions extracted directly into Neo4j.
        </p>
      </div>

      {/* Main Panel Viewport */}
      <div className="flex-1 flex min-h-0 overflow-hidden p-6 gap-6">
        
        {/* Left Side: Schema Filters & Query Node Register */}
        <div className="w-96 bg-slate-950/40 border border-slate-800 rounded-xl flex flex-col min-h-0 p-4 space-y-4">
          <div className="shrink-0 space-y-3">
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center space-x-2">
              <Filter className="w-4 h-4 text-violet-400" />
              <span>Filter Entities</span>
            </h2>
            
            {/* Interactive Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search nodes or structural types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs pl-9 pr-4 py-2 rounded-lg outline-none focus:border-pink-500 transition-all"
              />
            </div>

            {/* Entity Class Selection */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["All", "Algorithm", "Method", "Metric", "Mathematical Foundation"].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                    selectedType === type
                      ? "bg-pink-500/10 text-pink-400 border-pink-500/30"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Node List Container */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Matching Subgraph Nodes</h3>
            {filteredNodes.map((node) => (
              <div key={node.id} className="bg-slate-950 border border-slate-800/60 p-3 rounded-lg hover:border-slate-700 transition-all">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-white">{node.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-violet-400 font-mono">
                    {node.type}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 font-sans leading-relaxed">{node.properties}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Structural Relations & Schema Ledger */}
        <div className="flex-1 bg-slate-950/20 border border-slate-800/60 rounded-xl p-6 overflow-y-auto space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white mb-1 flex items-center space-x-2">
              <Database className="w-5 h-5 text-blue-400" />
              <span>Active Relationship Matrix</span>
            </h2>
            <p className="text-xs text-slate-400">Semantic triplets extracted from text paragraphs to back up our cross-encoder ranking system.</p>
          </div>

          <div className="space-y-3">
            {sampleEdges.map((edge, idx) => (
              <div key={idx} className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-4 min-w-0 flex-1">
                  {/* Subject Node */}
                  <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 truncate max-w-[160px]">
                    {edge.source}
                  </div>
                  
                  {/* Directed Link Visualizer */}
                  <div className="flex-1 flex flex-col items-center px-2 min-w-[120px]">
                    <span className="text-[10px] font-mono text-pink-400 bg-pink-950/20 px-2 py-0.5 rounded border border-pink-900/30 text-center truncate w-full">
                      {edge.relation}
                    </span>
                    <div className="w-full flex items-center mt-1">
                      <div className="w-full h-[1px] bg-slate-800 relative">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 transform border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent border-l-slate-700" />
                      </div>
                    </div>
                  </div>

                  {/* Object Node */}
                  <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 truncate max-w-[160px]">
                    {edge.target}
                  </div>
                </div>

                {/* Score badge */}
                <div className="ml-6 flex flex-col items-end shrink-0">
                  <span className="text-[10px] text-slate-500 font-mono">Confidence</span>
                  <span className="text-xs font-bold text-emerald-400">{(edge.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Connected Framework Metadata Footer */}
          <div className="pt-4 border-t border-slate-800/60 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 flex items-start space-x-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-white text-xs">Entity Disambiguation</h4>
                <p className="text-[11px] text-slate-500 mt-1">Synonyms and variants are consolidated automatically under single unique entity nodes via our back-end graph factory pipeline.</p>
              </div>
            </div>
            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 flex items-start space-x-3">
              <GitCommit className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-white text-xs">Graph-Augmented Pathing</h4>
                <p className="text-[11px] text-slate-500 mt-1">The chatbot traverses these relations up to 2 hops out to capture underlying dependencies and counter potential context splits.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
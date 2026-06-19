"use client";

import React, { useState, useEffect } from "react";
import { fetchGraphSchema, GraphNode, GraphEdge } from "@/lib/api";
import { 
  Network, 
  Search, 
  Layers, 
  FileText, 
  Loader2, 
  AlertCircle,
  ArrowRight,
  Filter
} from "lucide-react";

export default function GraphExplorerPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtering and interaction states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilterType, setActiveFilterType] = useState<"All" | "Paper" | "Section">("All");
  
  // Drill-down selection anchors
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  useEffect(() => {
    async function loadGraphData() {
      try {
        setLoading(true);
        // FIX: Increased the extraction limit from 200 to 2500! 
        // This ensures Neo4j doesn't cut off the paragraphs for the later sections.
        const data = await fetchGraphSchema(2500); 
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      } catch (err: any) {
        setError(err.message || "Failed to establish a live connection to Neo4j.");
      } finally {
        setLoading(false);
      }
    }
    loadGraphData();
  }, []);

  // 1. Dynamic Filtering for the LEFT panel node index directory
  const filteredNodes = nodes.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          node.properties.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilterType === "All") return matchesSearch && (node.type === "Paper" || node.type === "Section");
    return matchesSearch && node.type === activeFilterType;
  });

  // 2. Strict Conditional Hierarchy Filtering for the RIGHT relationship matrix
  const filteredEdges = edges.filter(edge => {
    // SCENARIO A: A specific Section is highlighted -> show ONLY its constituent paragraph mappings
    if (selectedSection) {
      return edge.source === selectedSection && edge.relation === "HAS_PARAGRAPH";
    }
    // SCENARIO B: A specific Paper is highlighted -> show ONLY its top-level section mappings
    if (selectedPaper) {
      return edge.source === selectedPaper && edge.relation === "HAS_SECTION";
    }
    // FALLBACK: If no selection anchor exists, show standard global relationship context
    return true;
  });

  const handleNodeClick = (node: GraphNode) => {
    if (node.type === "Paper") {
      setSelectedPaper(node.name);
      setSelectedSection(null); // Reset downstream section state
    } else if (node.type === "Section") {
      setSelectedSection(node.name);
      setSelectedPaper(null); // FIX: Ensure paper state is cleared so filters isolate properly
    }
  };

  const handleClearDrilldown = () => {
    setSelectedPaper(null);
    setSelectedSection(null);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0B1120] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400 mb-3" />
        <p className="text-sm">Traversing Deep Graph Topologies...</p>
        <p className="text-xs text-slate-500 mt-2">Extracting up to 2,500 relational connections.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0B1120] p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-white font-semibold mb-2">Neo4j Driver Connection Aborted</h3>
        <p className="text-slate-400 text-sm max-w-md mb-6">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0B1120] h-full text-slate-200">
      
      {/* LEFT PANEL: Hierarchy Index Cards */}
      <div className="w-[420px] flex flex-col border-r border-slate-800 bg-slate-900/20 shrink-0">
        
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 space-y-3 shrink-0">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-fuchsia-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Filter Entities</h2>
          </div>
          
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes or structural types..."
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-4 py-2 outline-none focus:border-fuchsia-500/40 transition-all"
            />
          </div>

          {/* Pill Selector tabs */}
          <div className="flex space-x-1.5 pt-1">
            {(["All", "Paper", "Section"] as const).map((type) => (
              <button
                key={type}
                onClick={() => { setActiveFilterType(type); handleClearDrilldown(); }}
                className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${
                  activeFilterType === type 
                    ? "bg-fuchsia-600 text-white" 
                    : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Nodes Feed */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredNodes.length === 0 ? (
            <div className="text-center text-slate-600 text-xs p-8 italic">No matching architectural elements.</div>
          ) : (
            filteredNodes.map((node) => {
              const isPaperSelected = selectedPaper === node.name;
              const isSectionSelected = selectedSection === node.name;
              const isActive = isPaperSelected || isSectionSelected;

              return (
                <div
                  key={node.id}
                  onClick={() => handleNodeClick(node)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all text-left group ${
                    isActive 
                      ? "bg-slate-950 border-fuchsia-500/50 shadow-md shadow-fuchsia-950/10" 
                      : "bg-slate-950/40 border-slate-800/80 hover:bg-slate-900/40 hover:border-slate-700"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <h3 className={`text-xs font-bold leading-relaxed pr-2 line-clamp-2 ${isActive ? "text-fuchsia-400" : "text-white group-hover:text-fuchsia-400"}`}>
                      {node.name}
                    </h3>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      node.type === "Paper" 
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                        : "bg-violet-500/10 text-violet-400 border-violet-500/20"
                    }`}>
                      {node.type}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-sans">
                    {node.properties || "Structural grouping index."}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Reactive Relationship Flow View */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0B1120]">
        
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <Network className="w-4 h-4 text-blue-400" />
              <span>Active Relationship Matrix</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedSection 
                ? `Isolating Paragraph blocks for Section: "${selectedSection}"`
                : selectedPaper 
                ? `Isolating Section elements for Paper: "${selectedPaper}"`
                : "Displaying generalized top-level entity schema."}
            </p>
          </div>

          {(selectedPaper || selectedSection) && (
            <button 
              onClick={handleClearDrilldown}
              className="text-[11px] font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded-md transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* The Matrix Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredEdges.length === 0 ? (
            <div className="text-center text-slate-600 text-xs p-12 italic">
              No matching semantic pathways mapped for this selected state hierarchy.
            </div>
          ) : (
            filteredEdges.map((edge, idx) => (
              <div 
                key={idx} 
                className="bg-slate-950/50 border border-slate-800/70 p-4 rounded-xl flex items-center justify-between hover:border-slate-700/60 transition-colors"
              >
                {/* Source Subject Node */}
                <div className="flex-1 min-w-0 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">Subject Node</div>
                  <div className="text-xs font-semibold text-slate-200 truncate">{edge.source}</div>
                </div>

                {/* Relational Direction Vector */}
                <div className="px-4 flex flex-col items-center justify-center shrink-0 min-w-[140px]">
                  <span className="text-[10px] font-mono font-bold bg-fuchsia-950/40 text-fuchsia-400 px-2 py-0.5 rounded border border-fuchsia-900/40 uppercase tracking-wide">
                    {edge.relation}
                  </span>
                  <div className="w-full flex items-center mt-1">
                    <div className="h-[1px] bg-slate-800 flex-1"></div>
                    <ArrowRight className="w-3 h-3 text-slate-700 -ml-1" />
                  </div>
                </div>

                {/* Target Object Node */}
                <div className="flex-1 min-w-0 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">Object Target</div>
                  <div className="text-xs font-semibold text-slate-200 truncate">{edge.target}</div>
                </div>

                {/* Confidence Badge */}
                <div className="ml-4 pl-4 border-l border-slate-800/80 text-right shrink-0">
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Confidence</div>
                  <div className="text-xs font-mono font-bold text-emerald-400">{(edge.confidence * 100).toFixed(0)}%</div>
                </div>

              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
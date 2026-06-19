"use client";

import React, { useState, useEffect } from "react";
import { fetchPapers, PaperMetadata } from "@/lib/api";
import { 
  BookOpen, 
  Search, 
  Layers, 
  FileText, 
  Loader2, 
  AlertCircle,
  ArrowRight,
  ExternalLink
} from "lucide-react";

export default function PaperBrowserPage() {
  const [papers, setPapers] = useState<PaperMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<PaperMetadata | null>(null);

  // Fetch papers from the FastAPI catalog upon component mount
  useEffect(() => {
    async function loadPapersData() {
      try {
        setLoading(true);
        const data = await fetchPapers();
        setPapers(data.papers || []);
        if (data.papers && data.papers.length > 0) {
          setSelectedPaper(data.papers[0]); // Default to first paper for inspection
        }
      } catch (err: any) {
        setError(err.message || "Failed to retrieve the paper index.");
      } finally {
        setLoading(false);
      }
    }
    loadPapersData();
  }, []);

  // Filter papers list dynamically based on search query
  const filteredPapers = papers.filter(paper => 
    paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    paper.paper_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    paper.abstract.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm">Querying Neo4j Document Catalog...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-white font-semibold mb-2">Catalog Sync Failed</h3>
        <p className="text-slate-400 text-sm max-w-md mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-800 text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-700 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-900 h-full">
      
      {/* LEFT PANEL: Core Paper Directory */}
      <div className="w-[400px] flex flex-col border-r border-slate-800 bg-slate-950/20 shrink-0">
        
        {/* Header Block */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 shrink-0">
          <div className="flex items-center space-x-2.5 mb-3">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <h1 className="text-sm font-semibold text-white">Corpus Index Browser</h1>
          </div>
          
          {/* Search Inputs */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, ID, or abstract content..."
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-4 py-2.5 outline-none focus:border-emerald-500/40 transition-all"
            />
          </div>
        </div>

        {/* Scrollable Document List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredPapers.length === 0 ? (
            <div className="text-center text-slate-600 text-xs p-8 italic">
              No ingested papers match your criteria.
            </div>
          ) : (
            filteredPapers.map((paper) => {
              const isSelected = selectedPaper?.paper_id === paper.paper_id;
              return (
                <div
                  key={paper.paper_id}
                  onClick={() => setSelectedPaper(paper)}
                  className={`p-3.5 rounded-xl cursor-pointer border text-left transition-all ${
                    isSelected 
                      ? "bg-slate-950 border-emerald-500/40 shadow-md shadow-emerald-950/20" 
                      : "bg-slate-950/40 border-slate-800/60 hover:bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <div className="text-[10px] font-mono text-emerald-400 mb-1 flex justify-between items-center">
                    <span>ID: {paper.paper_id}</span>
                    <span className="flex items-center space-x-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      <Layers className="w-2.5 h-2.5 text-slate-500" />
                      <span className="text-slate-300 font-sans font-medium">{paper.paragraph_count} chunks</span>
                    </span>
                  </div>
                  <h3 className={`text-xs font-semibold line-clamp-2 leading-relaxed ${
                    isSelected ? "text-white" : "text-slate-300"
                  }`}>
                    {paper.title}
                  </h3>
                </div>
              );
            })
          )}
        </div>
        
        {/* Summary Footer */}
        <div className="p-3 bg-slate-950/40 border-t border-slate-800 text-[11px] text-slate-500 font-medium tracking-wide shrink-0">
          Total Knowledge Matrix Scale: <span className="text-slate-300 font-mono font-bold">{papers.length} Papers Ingested</span>
        </div>
      </div>

      {/* RIGHT PANEL: Comprehensive Document Blueprint Inspector */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
        {!selectedPaper ? (
          <div className="flex-1 flex items-center justify-center p-6 text-slate-500 text-xs italic">
            Select an ingested research paper from the index directory directory to map its architecture.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">
            
            {/* Structural Document Identity Card */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono mb-3">
                <span className="flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-slate-400 font-semibold uppercase">Ingested Blueprint Metadata</span>
                </span>
                <span className="text-slate-600">QASPER DATASET SCHEMATIC</span>
              </div>
              
              <h2 className="text-lg font-bold text-white leading-snug mb-3">
                {selectedPaper.title}
              </h2>

              <div className="flex flex-wrap gap-2 pt-2">
                <div className="text-[11px] font-mono bg-slate-900 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-md">
                  <span className="text-slate-600 mr-1 font-sans">Document ID:</span>{selectedPaper.paper_id}
                </div>
                <div className="text-[11px] font-mono bg-slate-900 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-md">
                  <span className="text-slate-600 mr-1 font-sans">Granular Depth:</span>{selectedPaper.paragraph_count} Paragraph Units
                </div>
                <a
                  href={`https://arxiv.org/abs/${selectedPaper.paper_id.replace("_", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 px-2.5 py-1 rounded-md flex items-center space-x-1 hover:bg-emerald-900/40 transition-colors"
                >
                  <span>Verify on ArXiv</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Document Abstract Block */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <span>Abstract Narrative Summary</span>
              </h3>
              <div className="bg-slate-950/30 border border-slate-800/80 rounded-xl p-5 text-sm text-slate-300 leading-relaxed font-sans shadow-inner">
                {selectedPaper.abstract}
              </div>
            </div>

            {/* Downstream Deployment Integration CTA */}
            <div className="bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Ready to query this paper?</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Head over to the Graph RAG workspace. The entire structure of this literature has been tokenized, embedded, and mapped out inside your Knowledge Graph.
                </p>
              </div>
              <a 
                href="/chat"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-emerald-950/40 flex items-center space-x-1.5 shrink-0 transition-all transform active:scale-95"
              >
                <span>Open Core RAG</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
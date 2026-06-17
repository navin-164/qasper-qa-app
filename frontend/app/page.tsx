import React from "react";
import Link from "next/link";
import { 
  FileText, 
  Database, 
  Network, 
  MessageSquare, 
  ArrowRight,
  Activity,
  Terminal
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex-1 overflow-y-auto p-8 text-slate-200">
      {/* Header Section */}
      <header className="mb-10 mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Workspace Dashboard</h1>
        <p className="text-slate-400">Welcome to your Graph RAG evaluation environment for QASPER.</p>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-400">Indexed Papers</h3>
            <FileText className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-white">10</p>
          <p className="text-xs text-emerald-400 mt-2">Loaded via HuggingFace</p>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-400">Vector Chunks</h3>
            <Database className="w-5 h-5 text-violet-500" />
          </div>
          <p className="text-3xl font-bold text-white">~350</p>
          <p className="text-xs text-slate-500 mt-2">FAISS BGE-Base-v1.5</p>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-400">Graph Nodes</h3>
            <Network className="w-5 h-5 text-pink-500" />
          </div>
          {/* Using the exact number from the Neo4j screenshot you shared earlier! */}
          <p className="text-3xl font-bold text-white">2,693</p>
          <p className="text-xs text-slate-500 mt-2">Extracted via Llama-3.1</p>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-400">API Status</h3>
            <Activity className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-white">Online</p>
          <p className="text-xs text-slate-500 mt-2">localhost:8000 connected</p>
        </div>
      </div>

      {/* Quick Actions & Launch Pad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Launch Pad</h2>
          <div className="space-y-4">
            <Link href="/chat" className="group block bg-slate-950 border border-slate-800 hover:border-violet-500 p-5 rounded-xl transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-violet-500/10 p-3 rounded-lg">
                    <MessageSquare className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Research Chatbot</h3>
                    <p className="text-sm text-slate-400">Query papers with Hybrid RAG & Evidence</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>

            <Link href="/prompt-lab" className="group block bg-slate-950 border border-slate-800 hover:border-pink-500 p-5 rounded-xl transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-pink-500/10 p-3 rounded-lg">
                    <Terminal className="w-6 h-6 text-pink-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Prompt Lab</h3>
                    <p className="text-sm text-slate-400">Test constraints, lengths, and tone rules</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-4">System Architecture</h2>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 h-full flex flex-col justify-center">
             <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-2 h-2 mt-2 rounded-full bg-violet-500 shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-white">1. Contextualized Vector Retrieval</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">Queries are embedded using BGE-Base and searched via FAISS Inner Product to find dense semantic matches.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-2 h-2 mt-2 rounded-full bg-pink-500 shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-white">2. Graph Fact Traversal</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">LLM-extracted entities are matched in Neo4j to pull exact factual triples and structural paragraph links.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-white">3. Cross-Encoder Re-Ranking</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">An MS-MARCO model re-scores the combined graph and vector hits to find the top 5 absolute best contexts.</p>
                  </div>
                </div>
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}
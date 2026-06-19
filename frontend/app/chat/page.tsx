"use client";

import React, { useState, useRef, useEffect } from "react";
import { askQuestion, AnswerResponse, TokenStats } from "@/lib/api";
import { 
  Send, 
  Bot, 
  User, 
  Database, 
  Network, 
  Cpu,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle
} from "lucide-react";

// Types for local UI state
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  responseMeta?: AnswerResponse;
}

export default function ChatbotPage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: "welcome",
    role: "assistant",
    content: "System initialized. Graph RAG Hybrid Engine online. Ask me a question about the QASPER dataset corpus."
  }]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Track the most recent metadata to populate the right-hand panel
  const [activeMeta, setActiveMeta] = useState<AnswerResponse | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: query };
    setMessages(prev => [...prev, userMsg]);
    setQuery("");
    setIsLoading(true);

    try {
      // Hit our FastAPI backend (now with Hallucination Checking!)
      const data = await askQuestion({ question: userMsg.content, detailed: true });
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        responseMeta: data
      };
      
      setMessages(prev => [...prev, botMsg]);
      setActiveMeta(data); // Update the right panel with this message's data
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Error:** ${err.message || "Failed to connect to AI Engine."}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // UI Helper for the Token Progress Bar (Assuming 8192 context window for Llama 3)
  const MAX_TOKENS = 8192;
  const renderTokenBar = (stats?: TokenStats) => {
    if (!stats) return null;
    const pct = Math.min((stats.total_tokens / MAX_TOKENS) * 100, 100);
    let colorClass = "bg-emerald-500";
    if (pct > 60) colorClass = "bg-amber-500";
    if (pct > 85) colorClass = "bg-red-500";

    return (
      <div className="mt-4 space-y-3">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Context Window Usage</span>
          <span className="font-mono">{stats.total_tokens} / {MAX_TOKENS}</span>
        </div>
        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
          <div className={`h-full ${colorClass} transition-all duration-1000`} style={{ width: `${pct}%` }} />
        </div>
        {pct > 85 && (
          <div className="flex items-center space-x-2 text-[10px] text-amber-400 mt-2 bg-amber-950/30 p-2 rounded border border-amber-900/50">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>Approaching LLM context limit. Risk of truncation.</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-900 h-full">
      
      {/* LEFT PANEL: Chat Interface */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800">
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 shrink-0 flex items-center space-x-3">
          <Bot className="w-5 h-5 text-emerald-400" />
          <h1 className="text-sm font-semibold text-white">Graph RAG Assistant</h1>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex space-x-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-emerald-400" />
                </div>
              )}
              
              <div className={`max-w-[80%] rounded-xl p-4 text-sm leading-relaxed ${
                msg.role === "user" 
                  ? "bg-blue-600 text-white" 
                  : "bg-slate-950/60 border border-slate-800 text-slate-200"
              }`}>
                {/* Text Content */}
                <div className="whitespace-pre-wrap">{msg.content}</div>
                
                {/* Meta Indicator Button */}
                {msg.responseMeta && (
                   <button 
                     onClick={() => setActiveMeta(msg.responseMeta!)}
                     className="mt-3 flex items-center space-x-2 text-[10px] uppercase tracking-wider font-bold text-slate-500 hover:text-emerald-400 transition-colors"
                   >
                     <ShieldCheck className="w-3 h-3" />
                     <span>View Trace Data</span>
                   </button>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-blue-400" />
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start space-x-4">
               <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center space-x-3 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Traversing Knowledge Graph & Verifying Facts...</span>
                </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-950/40 border-t border-slate-800 shrink-0">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about a methodology, variance tradeoff, dataset split..."
              disabled={isLoading}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-xl pl-4 pr-12 py-4 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all disabled:opacity-50"
            />
            <button 
              type="submit" 
              disabled={isLoading || !query.trim()}
              className="absolute right-2 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT PANEL: Inspection & Telemetry */}
      <div className="w-[450px] flex flex-col bg-slate-950/20 shrink-0">
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 shrink-0">
          <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-violet-400" />
            <span>Execution Telemetry</span>
          </h2>
        </div>

        {!activeMeta ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-500 text-xs">
            Send a query to visualize the retrieval trace, hallucination checks, and token telemetry.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* NEW: Hallucination Guardrail Panel */}
            {activeMeta.validations && activeMeta.validations.length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                 <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Factuality Guardrail</span>
                 </h3>
                 <div className="space-y-2">
                   {activeMeta.validations.map((v, i) => {
                     let color = "text-emerald-400";
                     let bg = "bg-emerald-500/10 border-emerald-500/20";
                     let Icon = CheckCircle2;
                     
                     if (v.status === "Partially Supported") {
                       color = "text-amber-400";
                       bg = "bg-amber-500/10 border-amber-500/20";
                       Icon = AlertTriangle;
                     } else if (v.status === "Unsupported") {
                       color = "text-red-400";
                       bg = "bg-red-500/10 border-red-500/20";
                       Icon = XCircle;
                     }

                     return (
                       <div key={i} className={`p-3 border rounded-lg transition-colors ${bg}`}>
                         <div className={`flex items-center space-x-1.5 mb-1 ${color} font-bold text-[9px] uppercase tracking-wider`}>
                           <Icon className="w-3 h-3" />
                           <span>{v.status}</span>
                         </div>
                         <p className="text-[11px] text-slate-200 leading-relaxed">{v.sentence}</p>
                       </div>
                     )
                   })}
                 </div>
              </div>
            )}

            {/* Token Metrics Tracker */}
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span>Token Metrics</span>
              </h3>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg">
                  <div className="text-lg font-mono font-semibold text-violet-400">{activeMeta.token_stats?.prompt_tokens || 0}</div>
                  <div className="text-[9px] text-slate-500 uppercase mt-1">Prompt</div>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg">
                  <div className="text-lg font-mono font-semibold text-blue-400">{activeMeta.token_stats?.context_tokens || 0}</div>
                  <div className="text-[9px] text-slate-500 uppercase mt-1">Context</div>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg">
                  <div className="text-lg font-mono font-semibold text-emerald-400">{activeMeta.token_stats?.answer_tokens || 0}</div>
                  <div className="text-[9px] text-slate-500 uppercase mt-1">Answer</div>
                </div>
              </div>
              
              {renderTokenBar(activeMeta.token_stats)}
            </div>

            {/* Extracted Graph Facts */}
            <div className="space-y-2">
               <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <Network className="w-3 h-3 text-pink-400" />
                <span>Graph Triplets ({activeMeta.graph_facts.length})</span>
              </h3>
              {activeMeta.graph_facts.length === 0 ? (
                <div className="text-xs text-slate-600 italic px-2">No relevant triples found.</div>
              ) : (
                <div className="space-y-2">
                  {activeMeta.graph_facts.map((fact, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800/60 rounded p-2 text-[11px] flex items-center space-x-2 text-slate-300">
                      <span className="font-semibold text-white max-w-[100px] truncate">{fact.subject}</span>
                      <span className="text-pink-400 font-mono shrink-0">[{fact.relation}]</span>
                      <span className="font-semibold text-white max-w-[100px] truncate">{fact.object}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vector Evidence Chunks */}
            <div className="space-y-2">
               <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <Database className="w-3 h-3 text-blue-400" />
                <span>Vector Evidence ({activeMeta.evidence_paragraphs.length})</span>
              </h3>
              {activeMeta.evidence_paragraphs.length === 0 ? (
                <div className="text-xs text-slate-600 italic px-2">No vector chunks retrieved.</div>
              ) : (
                <div className="space-y-3">
                  {activeMeta.evidence_paragraphs.map((para, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800/60 rounded-lg p-3 text-xs text-slate-400 hover:border-slate-700 transition-colors">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-mono text-[10px] text-blue-400">{para.paragraph_id}</span>
                        {para.rerank_score && (
                          <span className="font-mono text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                            Score: {para.rerank_score.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-4 leading-relaxed">{para.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
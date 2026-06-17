"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  MessageSquare, 
  Network, 
  Terminal, 
  BarChart3, 
  Layers, 
  HelpCircle,
  FileText
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: "Home / Dashboard", href: "/", icon: Layers },
  { name: "Research Chatbot", href: "/chat", icon: MessageSquare },
  { name: "Graph RAG Explorer", href: "/graph", icon: Network },
  { name: "Prompt Lab", href: "/prompt-lab", icon: Terminal },
  { name: "Evaluation Dashboard", href: "/eval", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-screen text-slate-200 shrink-0">
      {/* Workstation Header */}
      <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
        <FileText className="w-6 h-6 text-violet-500" />
        <div>
          <h1 className="font-bold text-sm tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-blue-400">
            QASPER-RAG
          </h1>
          <p className="text-[10px] text-slate-500 font-mono">v1.0.0 Workstation</p>
        </div>
      </div>

      {/* Navigation Options */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Connection & Architecture Info Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50 font-mono text-[11px] text-slate-500 space-y-1.5">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Core API: localhost:8000</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Graph DB: Neo4j Connected</span>
        </div>
      </div>
    </aside>
  );
}
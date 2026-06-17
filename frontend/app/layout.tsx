import type { Metadata } from "next";
import { Inter } from "next/font/google";
// @ts-expect-error - Stylesheet module import for Next.js build target
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QASPER Graph RAG Workstation",
  description: "Advanced Research Paper Question Answering Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-900 text-slate-100 antialiased h-screen overflow-hidden flex`}>
        {/* Persistent Workspace Navigation */}
        <Sidebar />
        
        {/* Core Stage Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-900 relative">
          {children}
        </main>
      </body>
    </html>
  );
}

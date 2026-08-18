import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileSearch, UploadCloud, FileText, Sparkles, Download, Copy, Check, Clock, Tag, CheckCircle2, ArrowRight, FileCode } from 'lucide-react';
import { FileSummary } from '../types';
import { summarizeDocument } from '../services/api';

export const FileSummarizerPage: React.FC = () => {
  const [fileName, setFileName] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [summary, setSummary] = useState<FileSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const sampleReportText = `EXECUTIVE PROJECT BRIEF: Q3 MULTI-AGENT AI PLATFORM

1. OVERVIEW & STRATEGIC MISSION
Our organization is deploying an enterprise-grade AI Productivity Platform powered by Gemini 3.6 Flash.
The primary goal is to combine multi-modal reasoning, real-time voice processing, Kanban task automation, and document summarization into a single cybernetic dashboard.

2. ARCHITECTURAL MILESTONES
- Phase 1: Full-stack Express server setup with secure Gemini API proxy endpoints.
- Phase 2: Cybernetic dark glassmorphism UI layout with Tailwind CSS and Framer Motion.
- Phase 3: Client-side local storage synchronization for persistent Kanban cards, notes, and calendar events.
- Phase 4: Integration of browser Web Speech synthesis and recognition for voice control.

3. RESOURCE ALLOCATION & TIMELINE
- Development Team: 4 Senior Full-Stack Engineers & 2 UX Designers.
- Target Release Date: Q3 Sprint 4 Milestone.
- Budget Approval: $120,000 for serverless deployment and Cloud Run hosting.

4. RISK ANALYSIS & RECOMMENDATIONS
- Ensure strict API key masking via server-side endpoints.
- Optimize voice speech rate and PCM audio buffer streaming to minimize latency.
- Implement automated linting and continuous build verification.`;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setFileContent(text);
        processSummary(text, file.name, file.type);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setFileName('Executive_Q3_AI_Strategy_Brief.docx');
    setFileContent(sampleReportText);
    processSummary(sampleReportText, 'Executive_Q3_AI_Strategy_Brief.docx', 'docx');
  };

  const processSummary = async (content: string, name: string, type: string) => {
    setLoading(true);
    try {
      const res = await summarizeDocument(content, name, type);
      setSummary(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!summary) return;
    const md = `# Summary: ${fileName}

## Executive Summary
${summary.executiveSummary}

## Key Points
${summary.keyPoints.map(p => `- ${p}`).join('\n')}

## Actionable Insights
${summary.actionableInsights.map(a => `- ${a}`).join('\n')}

Reading Time: ${summary.readingTime}
Category: ${summary.sentimentOrCategory}`;

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!summary) return;
    const text = `SUMMARY REPORT: ${fileName}
Executive Summary:
${summary.executiveSummary}

Key Points:
${summary.keyPoints.map(p => `â€¢ ${p}`).join('\n')}

Actionable Insights:
${summary.actionableInsights.map(a => `â€¢ ${a}`).join('\n')}
`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_Summary.txt`;
    a.click();
  };

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div><h1 className="text-2xl font-black text-white flex items-center space-x-2"><FileSearch className="w-6 h-6 text-purple-400" /><span>AI File & PDF Summarizer</span></h1><p className="text-xs text-slate-400 mt-0.5">Extract executive takeaways, key points, and actionable decisions from documents</p></div>
        <button onClick={handleLoadSample} className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 font-bold text-xs shadow-md transition-all shrink-0"><Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" /><span>Load Sample Executive Brief</span></button>
      </div>
      <div className="p-8 rounded-3xl bg-slate-950/80 border-2 border-dashed border-white/15 hover:border-purple-500/50 transition-all text-center relative overflow-hidden group">
        <input type="file" onChange={handleFileUpload} accept=".txt,.md,.json,.csv,.doc,.docx,.pdf" className="absolute inset-0 opacity-0 cursor-pointer z-10" />
        <div className="relative z-0 flex flex-col items-center justify-center space-y-3"><div className="p-4 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/30 group-hover:scale-110 transition-transform"><UploadCloud className="w-8 h-8" /></div><div><p className="text-sm font-bold text-white">Drag & Drop PDF, DOCX, TXT, or Markdown Document</p><p className="text-xs text-slate-400 mt-1">or click to browse from your device</p></div><span className="text-[10px] font-mono bg-slate-900 text-cyan-400 border border-white/10 px-3 py-1 rounded-full">Supported formats: .txt, .md, .pdf, .docx, .json</span></div>
      </div>
      {loading && <div className="p-8 rounded-3xl bg-slate-900/80 border border-purple-500/30 text-center space-y-3 shadow-xl"><Sparkles className="w-8 h-8 text-cyan-400 animate-spin mx-auto" /><h3 className="text-sm font-bold text-white">Gemini AI Analyzing Document...</h3><p className="text-xs text-slate-400">Extracting executive takeaways, sentiment, and actionable insights.</p></div>}
      {summary && !loading && <div className="p-6 rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3"><div><div className="flex items-center space-x-2"><FileText className="w-4 h-4 text-cyan-400" /><span className="text-xs font-mono text-cyan-300 font-bold">{fileName}</span></div><h2 className="text-lg font-black text-white mt-1">Executive Document Analysis</h2></div><div className="flex items-center space-x-2 shrink-0"><button onClick={handleCopyMarkdown} className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-white/10 transition-colors">{copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}<span>{copied ? 'Copied' : 'Copy MD'}</span></button><button onClick={handleDownloadTxt} className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-md transition-colors"><Download className="w-3.5 h-3.5" /><span>Download TXT</span></button></div></div>
        <div className="flex flex-wrap gap-3"><span className="text-xs font-bold px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center space-x-1"><Clock className="w-3.5 h-3.5" /><span>Reading Time: {summary.readingTime}</span></span><span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center space-x-1"><Tag className="w-3.5 h-3.5" /><span>Category: {summary.sentimentOrCategory}</span></span></div>
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-1"><h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Executive Overview</h3><p className="text-xs text-slate-200 leading-relaxed font-sans">{summary.executiveSummary}</p></div>
        <div className="space-y-2"><h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Key Document Takeaways</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{summary.keyPoints.map((point, idx) => <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 flex items-start space-x-2 text-xs text-slate-200"><CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" /><span className="leading-relaxed">{point}</span></div>)}</div></div>
        <div className="space-y-2"><h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Actionable Next Steps</h3><div className="space-y-2">{summary.actionableInsights.map((insight, idx) => <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 flex items-center justify-between text-xs text-slate-200"><span className="flex items-center space-x-2"><ArrowRight className="w-4 h-4 text-emerald-400" /><span>{insight}</span></span><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Action</span></div>)}</div></div>
      </div>}
    </div>
  );
};

import React, { useState } from 'react';
import { processUploadedDocument, queryDocumentAI } from '../services/documentService';
import { useData } from '../context/DataContext';
import { 
  CloudUpload as LuUploadCloud, 
  FileText as LuFileText, 
  CheckCircle2 as LuCheckCircle2, 
  Sparkles as LuSparkles, 
  Send as LuSend, 
  CircleHelp as LuHelpCircle,
  Trash2 as LuTrash2
} from 'lucide-react';

export default function DocumentUploader() {
  const { documents, addDocument, deleteDocument } = useData();
  const [selectedDoc, setSelectedDoc] = useState(documents[0] || null);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [aiAnswers, setAiAnswers] = useState([]);
  const [isAsking, setIsAsking] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const processed = await processUploadedDocument(file);
      addDocument(processed);
      setSelectedDoc(processed);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim() || !selectedDoc) return;

    const q = question;
    setQuestion('');
    setIsAsking(true);

    try {
      const ans = await queryDocumentAI(selectedDoc.extractedText, q);
      setAiAnswers(prev => [...prev, { question: q, answer: ans, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Upload & Document Selector Area */}
      <div className="space-y-6">
        {/* Drag & Drop Area */}
        <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border-2 border-dashed border-purple-500/30 hover:border-purple-500/60 dark:border-purple-500/20 text-center transition-all">
          <input
            type="file"
            id="file-upload"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center py-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
              <LuUploadCloud className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Upload Document</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">PDF, DOCX, or TXT up to 25MB</p>
            <span className="mt-4 px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-semibold shadow-md shadow-purple-900/20">
              Select File
            </span>
          </label>
        </div>

        {/* Uploaded Documents List */}
        <div className="bg-white dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Uploaded Documents ({documents.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                  selectedDoc?.id === doc.id
                    ? 'bg-purple-600/10 border-purple-500 text-purple-600 dark:text-purple-400 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <LuFileText className="w-4 h-4 shrink-0 text-purple-500" />
                  <span className="text-xs truncate">{doc.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDocument(doc.id);
                    if (selectedDoc?.id === doc.id) setSelectedDoc(null);
                  }}
                  className="text-slate-400 hover:text-rose-500 p-1"
                >
                  <LuTrash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Analysis and Extracted Text View */}
      <div className="lg:col-span-2 space-y-6">
        {selectedDoc ? (
          <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
            {/* Header info */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                  <LuFileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{selectedDoc.name}</h2>
                  <p className="text-xs text-slate-400">Size: {selectedDoc.size} • Uploaded {selectedDoc.uploadedAt}</p>
                </div>
              </div>
            </div>

            {/* AI Summary Section */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <LuSparkles className="w-4 h-4 text-cyan-400" />
                AI Generated Executive Summary
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                {selectedDoc.summary}
              </p>
            </div>

            {/* Extracted Text Box */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Extracted Document Text</h3>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                {selectedDoc.extractedText}
              </div>
            </div>

            {/* Q&A Section */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <LuHelpCircle className="w-4 h-4 text-cyan-400" />
                Ask Questions About This Document
              </h3>

              {/* Answers Feed */}
              {aiAnswers.length > 0 && (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {aiAnswers.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                      <p className="font-bold text-purple-600 dark:text-purple-400">Q: {item.question}</p>
                      <p className="text-slate-700 dark:text-slate-200 leading-relaxed">A: {item.answer}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Question Input Form */}
              <form onSubmit={handleAskQuestion} className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. What are the major functional modules defined?"
                  className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || isAsking}
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-xs font-semibold rounded-xl disabled:opacity-40 shadow-md shadow-purple-900/20"
                >
                  <LuSend className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900/80 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-slate-400">
            Select or upload a document to view AI text extraction and summary.
          </div>
        )}
      </div>
    </div>
  );
}

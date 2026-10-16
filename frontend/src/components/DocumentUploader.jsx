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
  Trash2 as LuTrash2,
  Database as LuDatabase,
  Layers as LuLayers,
  RefreshCw as LuRefreshCw,
  Info as LuInfo
} from 'lucide-react';

export default function DocumentUploader() {
  const { documents, addDocument, deleteDocument } = useData();
  const [selectedDoc, setSelectedDoc] = useState(documents[0] || null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('idle'); // 'idle' | 'progress' | 'success' | 'duplicate' | 'error'
  const [question, setQuestion] = useState('');
  const [aiAnswers, setAiAnswers] = useState([]);
  const [isAsking, setIsAsking] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setStatusType('progress');
    setStatusMessage(`Preparing ${file.name}...`);

    try {
      const processed = await processUploadedDocument(file, (status) => {
        if (status.step === 'duplicate') {
          setStatusType('duplicate');
          setStatusMessage(status.message);
        } else if (status.step === 'ready') {
          setStatusType('success');
          setStatusMessage(status.message);
        } else if (status.step === 'error') {
          setStatusType('error');
          setStatusMessage(status.message);
        } else {
          setStatusType('progress');
          setStatusMessage(status.message);
        }
      });

      addDocument(processed);
      setSelectedDoc(processed);

      if (processed.isDuplicate) {
        setStatusType('duplicate');
        setStatusMessage('Duplicate detected: Reused existing Qdrant vector embeddings & cached summary.');
      } else {
        setStatusType('success');
        setStatusMessage(`Successfully indexed into Qdrant Cloud (${processed.chunksCount || 1} chunks).`);
      }
    } catch (err) {
      console.error(err);
      setStatusType('error');
      setStatusMessage(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
      // Reset file input value so re-selecting same file triggers onChange
      e.target.value = '';
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim() || !selectedDoc) return;

    const q = question;
    setQuestion('');
    setIsAsking(true);

    try {
      const ans = await queryDocumentAI(selectedDoc.extractedText, q, {
        documentId: selectedDoc.id,
        documentHash: selectedDoc.contentHash,
        fileName: selectedDoc.name,
      });
      setAiAnswers(prev => [
        ...prev, 
        { 
          question: q, 
          answer: ans, 
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }
      ]);
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
        <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border-2 border-dashed border-purple-500/30 hover:border-purple-500/60 dark:border-purple-500/20 text-center transition-all relative overflow-hidden">
          <input
            type="file"
            id="file-upload"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
          />
          <label 
            htmlFor="file-upload" 
            className={`cursor-pointer flex flex-col items-center justify-center py-4 ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
              {loading ? (
                <LuRefreshCw className="w-6 h-6 animate-spin text-purple-500" />
              ) : (
                <LuUploadCloud className="w-6 h-6 animate-pulse" />
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {loading ? 'Processing Document...' : 'Upload Document'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              PDF, DOCX, or TXT (Auto-indexed to Qdrant)
            </p>
            <span className="mt-4 px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-semibold shadow-md shadow-purple-900/20">
              {loading ? 'Indexing...' : 'Select File'}
            </span>
          </label>

          {/* Status Message Banner */}
          {statusMessage && (
            <div className={`mt-3 p-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all ${
              statusType === 'progress' 
                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60'
                : statusType === 'duplicate'
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60'
                : statusType === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60'
            }`}>
              {statusType === 'progress' && <LuRefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />}
              {statusType === 'duplicate' && <LuLayers className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
              {statusType === 'success' && <LuCheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />}
              {statusType === 'error' && <LuInfo className="w-3.5 h-3.5 shrink-0 text-rose-500" />}
              <span className="truncate">{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Uploaded Documents List */}
        <div className="bg-white dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Uploaded Documents ({documents.length})
            </h3>
            <span className="text-[10px] text-purple-500 dark:text-purple-400 font-medium flex items-center gap-1">
              <LuDatabase className="w-3 h-3" /> Qdrant Sync
            </span>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {documents.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No documents uploaded yet.</p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                    selectedDoc?.id === doc.id
                      ? 'bg-purple-600/10 border-purple-500 text-purple-600 dark:text-purple-400 font-semibold shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <LuFileText className="w-4 h-4 shrink-0 text-purple-500" />
                    <div className="min-w-0">
                      <span className="text-xs truncate block font-medium">{doc.name}</span>
                      <span className="text-[10px] text-slate-400 block">
                        {doc.size || 'PDF'} {doc.chunksCount ? `• ${doc.chunksCount} chunks` : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDocument(doc.id);
                      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
                    }}
                    className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                    title="Delete document"
                  >
                    <LuTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Analysis and Extracted Text View */}
      <div className="lg:col-span-2 space-y-6">
        {selectedDoc ? (
          <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold shrink-0">
                  <LuFileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{selectedDoc.name}</h2>
                  <p className="text-xs text-slate-400">Size: {selectedDoc.size} • Uploaded {selectedDoc.uploadedAt}</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {selectedDoc.isDuplicate ? (
                  <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                    <LuLayers className="w-3.5 h-3.5" />
                    <span>Qdrant Vectors Reused ({selectedDoc.chunksCount || 1} Chunks)</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                    <LuCheckCircle2 className="w-3.5 h-3.5" />
                    <span>Qdrant Vector Indexed ({selectedDoc.chunksCount || 1} Chunks)</span>
                  </span>
                )}
              </div>
            </div>

            {/* AI Summary Section */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <LuSparkles className="w-4 h-4 text-cyan-400" />
                AI Generated Executive Summary
              </h3>
              <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                {selectedDoc.summary}
              </div>
            </div>

            {/* Extracted Text Box */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Extracted Document Text</h3>
                {selectedDoc.contentHash && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Hash: {selectedDoc.contentHash.slice(0, 12)}...
                  </span>
                )}
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                {selectedDoc.extractedText}
              </div>
            </div>

            {/* Q&A Section */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <LuHelpCircle className="w-4 h-4 text-cyan-400" />
                  Ask Questions About This Document
                </h3>
                <span className="text-[10px] text-slate-400">Powered by Qdrant Vector Retrieval</span>
              </div>

              {/* Answers Feed */}
              {aiAnswers.length > 0 && (
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {aiAnswers.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-purple-600 dark:text-purple-400">Q: {item.question}</p>
                        <span className="text-[10px] text-slate-400">{item.timestamp}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">A: {item.answer}</p>
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
                  placeholder="e.g. What are the key architectural components or security protocols?"
                  disabled={isAsking}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || isAsking}
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-xs font-semibold rounded-xl disabled:opacity-40 shadow-md shadow-purple-900/20 flex items-center gap-1.5 hover:opacity-95 transition-opacity"
                >
                  {isAsking ? (
                    <LuRefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <LuSend className="w-4 h-4" />
                  )}
                  <span>Ask</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900/80 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-slate-400">
            Select or upload a document to view AI text extraction, executive summary, and ask questions.
          </div>
        )}
      </div>
    </div>
  );
}


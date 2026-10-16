import React, { useState, useRef, useEffect } from 'react';
import { generateAIResponse, fetchChatHistory, deleteChatHistory } from '../services/aiService';
import { apiUploadKnowledgeDocument } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Send as LuSend,
  Mic as LuMic,
  MicOff as LuMicOff,
  Sparkles as LuSparkles,
  Trash2 as LuTrash2,
  Bot as LuBot,
  User as LuUser,
  Copy as LuCopy,
  Check as LuCheck,
  Paperclip as LuPaperclip,
  FileText as LuFileText,
  X as LuX,
  CheckCircle2 as LuCheckCircle2,
  AlertCircle as LuAlertCircle,
  Loader2 as LuLoader2,
  UploadCloud as LuUploadCloud,
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function AIChat({ initialPrompt = '' }) {
  const { user } = useAuth();
  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'ai',
      text: `Hello ${userName}! I'm **ASTRA AI**, your intelligent productivity assistant. How can I assist you today? You can also attach documents (PDF, DOCX, TXT, MD, CSV, JSON) for instant analysis and semantic vector search.`,
      timestamp: 'Just now',
    },
  ]);
  const [input, setInput] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [attachedDoc, setAttachedDoc] = useState(null);
  const [attachError, setAttachError] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  const suggestedPrompts = [
    "Plan my day",
    "Explain this concept",
    "Create a study schedule",
    "Summarize my notes",
  ];

  // Fetch real chat history from MongoDB on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await fetchChatHistory(50);
        if (history && history.length > 0) {
          const mapped = history.map((msg) => ({
            id: msg.id || String(Math.random()),
            sender: msg.role === 'user' ? 'user' : 'ai',
            text: msg.content,
            attachment: msg.attachment || null,
            timestamp: msg.created_at
              ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Just now',
          }));
          setMessages(mapped);
        }
      } catch (err) {
        console.warn('Could not load chat history from backend:', err);
      }
    }
    loadHistory();
  }, []);

  const handleFileUpload = async (file) => {
    if (!file) return;

    const validExtensions = ['pdf', 'docx', 'doc', 'txt', 'md', 'csv', 'json'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(ext)) {
      setAttachError(`Unsupported format .${ext}. Please upload a PDF, Word, TXT, MD, CSV, or JSON file.`);
      return;
    }

    setAttachError(null);
    const newDoc = {
      file,
      name: file.name,
      size: file.size,
      status: 'uploading',
      chunksCount: 0,
      documentId: null,
      documentHash: null,
      errorMessage: null,
    };
    setAttachedDoc(newDoc);

    try {
      const res = await apiUploadKnowledgeDocument(file);
      const isReused = Boolean(res.is_duplicate || res.status === 'already_indexed' || res.status === 'reused');
      const chunksCount = res.chunks_count || res.points_count || 1;

      setAttachedDoc({
        file,
        name: file.name,
        size: file.size,
        status: isReused ? 'reused' : 'indexed',
        chunksCount,
        documentId: res.id,
        documentHash: res.content_hash,
        errorMessage: null,
      });
    } catch (err) {
      console.error('Document upload/indexing failed:', err);
      setAttachedDoc({
        file,
        name: file.name,
        size: file.size,
        status: 'error',
        chunksCount: 0,
        documentId: null,
        documentHash: null,
        errorMessage: err.message || 'Text extraction or Qdrant vector indexing failed.',
      });
    }
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend !== undefined ? textToSend : input).trim();
    const hasDoc = attachedDoc && (attachedDoc.status === 'indexed' || attachedDoc.status === 'reused');

    if ((!query && !hasDoc) || loading) return;
    if (attachedDoc && attachedDoc.status === 'uploading') {
      return;
    }

    const effectiveQuery = query || `Please analyze and summarize the attached document: "${attachedDoc.name}".`;

    const docMeta = hasDoc
      ? {
          document_id: attachedDoc.documentId,
          document_hash: attachedDoc.documentHash,
          file_name: attachedDoc.name,
          chunks_count: attachedDoc.chunksCount,
          status: attachedDoc.status,
        }
      : null;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: effectiveQuery,
      attachment: docMeta
        ? {
            file_name: docMeta.file_name,
            document_hash: docMeta.document_hash,
            document_id: docMeta.document_id,
            chunksCount: docMeta.chunks_count,
            status: docMeta.status,
          }
        : null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (textToSend === undefined) setInput('');
    setLoading(true);

    const docToSend = docMeta
      ? {
          document_id: docMeta.document_id,
          document_hash: docMeta.document_hash,
          file_name: docMeta.file_name,
        }
      : null;

    setAttachedDoc(null);

    try {
      const responseText = await generateAIResponse(effectiveQuery, null, docToSend);
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('Error generating AI response:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: err.message || "I encountered a minor issue processing that query. Please try again!",
          timestamp: 'Just now',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPrompt) {
      handleSend(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = async () => {
    try {
      await deleteChatHistory();
    } catch (e) {
      console.warn('Failed to clear chat history on server:', e);
    }
    setAttachedDoc(null);
    setAttachError(null);
    setMessages([
      {
        id: '1',
        sender: 'ai',
        text: "New conversation initiated. What would you like to build or plan next?",
        timestamp: 'Just now',
      },
    ]);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex flex-col h-[calc(100vh-7rem)] bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-purple-900/40 backdrop-blur-sm border-2 border-dashed border-purple-400 rounded-2xl flex flex-col items-center justify-center pointer-events-none transition-all">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 text-white flex items-center justify-center shadow-xl mb-3 animate-bounce">
            <LuUploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white tracking-wide">Drop Document to Attach & Vector Index</h3>
          <p className="text-xs text-purple-200 mt-1">PDF, Word, TXT, MD, CSV, JSON supported for semantic search</p>
        </div>
      )}

      {/* Top Chat Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-purple-900/30">
            <LuBot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              ASTRA AI Assistant
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gemini & Qdrant Vector Intelligence Ready</p>
          </div>
        </div>

        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <LuTrash2 className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 max-w-3xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-xs ${
                msg.sender === 'user'
                  ? 'bg-purple-600 shadow-md shadow-purple-900/30'
                  : 'bg-gradient-to-tr from-purple-600 to-cyan-500'
              }`}
            >
              {msg.sender === 'user' ? <LuUser className="w-5 h-5" /> : <LuSparkles className="w-5 h-5" />}
            </div>

            {/* Bubble */}
            <div className={`space-y-1 ${msg.sender === 'user' ? 'items-end text-right' : ''}`}>
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-purple-600 text-white rounded-tr-none shadow-md shadow-purple-900/20'
                    : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700/60'
                }`}
              >
                {/* User Attachment Badge */}
                {msg.attachment && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-2 rounded-xl bg-purple-700/80 border border-purple-400/40 text-xs text-purple-100 shadow-sm backdrop-blur-sm">
                    <LuPaperclip className="w-3.5 h-3.5 text-purple-200 shrink-0" />
                    <span className="font-semibold truncate max-w-[200px] sm:max-w-[280px]">
                      {msg.attachment.file_name}
                    </span>
                    {msg.attachment.chunksCount ? (
                      <span className="text-[10px] bg-purple-900/70 text-purple-200 px-1.5 py-0.5 rounded font-mono">
                        {msg.attachment.chunksCount} chunks
                      </span>
                    ) : null}
                  </div>
                )}

                {msg.sender === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : (
                  <MarkdownRenderer content={msg.text} />
                )}
              </div>

              <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400">
                <span>{msg.timestamp}</span>
                {msg.sender === 'ai' && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="hover:text-purple-400 transition-colors"
                    title="Copy response"
                  >
                    {copiedId === msg.id ? <LuCheck className="w-3 h-3 text-emerald-400" /> : <LuCopy className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white">
              <LuSparkles className="w-5 h-5 animate-spin" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-100" />
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce delay-200" />
              <span>ASTRA is thinking...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested Prompts pills */}
      <div className="px-6 py-2 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">Prompts:</span>
        {suggestedPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            className="px-3 py-1 rounded-full text-xs bg-slate-200/70 dark:bg-slate-800 hover:bg-purple-600 hover:text-white dark:hover:bg-purple-600 text-slate-700 dark:text-slate-300 transition-all shrink-0 font-medium border border-slate-300/40 dark:border-slate-700/40"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Attachment Error Banner */}
      {attachError && (
        <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuAlertCircle className="w-4 h-4 shrink-0" />
            <span>{attachError}</span>
          </div>
          <button
            onClick={() => setAttachError(null)}
            className="p-1 hover:text-rose-800 dark:hover:text-rose-200 transition-colors"
          >
            <LuX className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Active Attachment Chip */}
      {attachedDoc && (
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <LuFileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px] sm:max-w-[340px]">
                  {attachedDoc.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {formatBytes(attachedDoc.size)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                {attachedDoc.status === 'uploading' && (
                  <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1.5 font-medium">
                    <LuLoader2 className="w-3.5 h-3.5 animate-spin" />
                    Extracting text & generating Qdrant vector embeddings...
                  </span>
                )}
                {attachedDoc.status === 'indexed' && (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-semibold">
                    <LuCheckCircle2 className="w-3.5 h-3.5" />
                    Indexed into Qdrant vector storage ({attachedDoc.chunksCount} chunks)
                  </span>
                )}
                {attachedDoc.status === 'reused' && (
                  <span className="text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5 font-semibold">
                    <LuSparkles className="w-3.5 h-3.5" />
                    Duplicate hash matched • Vector embeddings reused ({attachedDoc.chunksCount} chunks)
                  </span>
                )}
                {attachedDoc.status === 'error' && (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-medium">
                    <LuAlertCircle className="w-3.5 h-3.5" />
                    {attachedDoc.errorMessage || 'Indexing failed'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {attachedDoc.status === 'error' && (
              <button
                type="button"
                onClick={() => handleFileUpload(attachedDoc.file)}
                className="px-2.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
              >
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={() => setAttachedDoc(null)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Remove attachment"
            >
              <LuX className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input Box */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2 focus-within:ring-2 focus-within:ring-purple-500/50 transition-all"
        >
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.docx,.doc,.txt,.md,.csv,.json"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
              e.target.value = '';
            }}
            className="hidden"
          />

          {/* Paperclip Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-2 transition-colors rounded-lg ${
              attachedDoc
                ? 'text-purple-600 bg-purple-500/10 dark:text-purple-400'
                : 'text-slate-400 hover:text-purple-500 hover:bg-slate-200/50 dark:hover:bg-slate-800'
            }`}
            title="Attach document (PDF, Word, TXT, MD, CSV, JSON)"
          >
            <LuPaperclip className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              attachedDoc && (attachedDoc.status === 'indexed' || attachedDoc.status === 'reused')
                ? `Ask anything about ${attachedDoc.name} or press send to summarize...`
                : "Type your prompt or attach a document..."
            }
            className="flex-1 bg-transparent px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />

          <button
            type="button"
            onClick={toggleListening}
            className={`p-2 transition-colors rounded-lg ${
              isListening
                ? 'text-rose-500 bg-rose-500/10 animate-pulse'
                : 'text-slate-400 hover:text-purple-500'
            }`}
            title={isListening ? "Listening... Click to stop" : "Voice input"}
          >
            {isListening ? <LuMicOff className="w-5 h-5" /> : <LuMic className="w-5 h-5" />}
          </button>

          <button
            type="submit"
            disabled={
              (!input.trim() && !(attachedDoc && (attachedDoc.status === 'indexed' || attachedDoc.status === 'reused'))) ||
              loading ||
              (attachedDoc && attachedDoc.status === 'uploading')
            }
            className="p-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg disabled:opacity-40 hover:opacity-90 shadow-md shadow-purple-900/20 transition-all"
            title="Send Message"
          >
            <LuSend className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

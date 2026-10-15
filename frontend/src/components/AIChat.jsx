import React, { useState, useRef, useEffect } from 'react';
import { generateAIResponse, fetchChatHistory, deleteChatHistory } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { Send as LuSend, Mic as LuMic, MicOff as LuMicOff, Sparkles as LuSparkles, Trash2 as LuTrash2, Bot as LuBot, User as LuUser, Copy as LuCopy, Check as LuCheck } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

export default function AIChat({ initialPrompt = '' }) {
  const { user } = useAuth();
  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'ai',
      text: `Hello ${userName}! I'm **ASTRA AI**, your intelligent productivity assistant. How can I assist you today?`,
      timestamp: 'Just now'
    }
  ]);
  const [input, setInput] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const suggestedPrompts = [
    "Plan my day",
    "Explain this concept",
    "Create a study schedule",
    "Summarize my notes"
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

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const responseText = await generateAIResponse(query);
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
          timestamp: 'Just now'
        }
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
    setMessages([
      {
        id: '1',
        sender: 'ai',
        text: "New conversation initiated. What would you like to build or plan next?",
        timestamp: 'Just now'
      }
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

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
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
            <p className="text-xs text-slate-500 dark:text-slate-400">Gemini & Groq AI Engine Ready</p>
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

      {/* Input Box */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2 focus-within:ring-2 focus-within:ring-purple-500/50 transition-all"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your prompt here..."
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
            disabled={!input.trim() || loading}
            className="p-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg disabled:opacity-40 hover:opacity-90 shadow-md shadow-purple-900/20 transition-all"
          >
            <LuSend className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

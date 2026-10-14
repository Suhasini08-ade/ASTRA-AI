import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  apiGetChatHistory,
  apiGetChatConversations,
  apiSendAgentMessage,
  apiClearChatHistory,
} from '../services/api';
import { cleanVoiceResponse } from '../utils/voiceResponse';

const newConversationId = () => (crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function AssistantPage() {
  const [searchParams] = useSearchParams();
  const { showError, showSuccess, showInfo } = useToast();
  const [selectedModel, setSelectedModel] = useState('Astra 3.6 Pro');
  const [showHistory, setShowHistory] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(newConversationId);

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'astra',
      text: 'Hello! I am your Astra AI Assistant. How can I help you manage tasks, take notes, set reminders, check weather, or automate workflows today?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const handledSearchQueryRef = useRef('');

  // Load chat history from backend
  const loadConversations = async () => {
    const res = await apiGetChatConversations();
    setConversations(res?.data || []);
    return res?.data || [];
  };

  const loadHistory = async (conversationId = activeConversationId) => {
    setLoadingHistory(true);
    try {
      const res = await apiGetChatHistory(100, conversationId);
      const history = res?.data?.messages || [];
      if (history.length > 0) {
        const formatted = history.map((m, idx) => ({
          id: m.id || idx + 1,
          sender: m.role === 'user' ? 'user' : 'astra',
          text: m.content,
          time: m.created_at
            ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Recently',
        }));
        setMessages(formatted);
      } else {
        setMessages([{ id: 'welcome', sender: 'astra', text: 'Hello! I am your Astra AI Assistant. How can I help you today?', time: 'Now' }]);
      }
    } catch (e) {
      console.warn("Failed to load chat history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    const initializeHistory = async () => {
      try {
        const saved = await loadConversations();
        if (saved[0]?.id) {
          setActiveConversationId(saved[0].id);
          await loadHistory(saved[0].id);
          return;
        }
      } catch (e) {
        console.warn('Failed to load conversations:', e);
      }
      setLoadingHistory(false);
    };
    initializeHistory();
  }, []);

  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery && handledSearchQueryRef.current !== initialQuery) {
      handledSearchQueryRef.current = initialQuery;
      handleSendMessage(initialQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const startNewChat = () => {
    setActiveConversationId(newConversationId());
    setMessages([{ id: `welcome-${Date.now()}`, sender: 'astra', text: 'New chat started. What would you like to work on?', time: 'Now' }]);
    setShowHistory(false);
  };

  const handleClearHistory = async () => {
    try {
      await apiClearChatHistory();
      setConversations([]);
      startNewChat();
      if (showSuccess) showSuccess('Cleared all chat history');
    } catch (e) {
      if (showError) showError('Failed to clear history: ' + e.message);
    }
  };

  const handleFileAttach = (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      setAttachedFile(files[0]);
      if (showSuccess) showSuccess(`Attached ${files[0].name}`);
    }
  };

  const speakText = (msgId, text) => {
    if ('speechSynthesis' in window) {
      if (speakingMsgId === msgId) {
        window.speechSynthesis.cancel();
        setSpeakingMsgId(null);
        return;
      }

      const voiceText = cleanVoiceResponse(text);
      if (!voiceText) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(voiceText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setSpeakingMsgId(null);
      utterance.onerror = () => setSpeakingMsgId(null);
      setSpeakingMsgId(msgId);
      window.speechSynthesis.speak(utterance);
    } else if (showError) {
      showError('Text-to-speech is not supported in this browser.');
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputMessage;
    if (!text.trim() && !attachedFile) return;

    let fullPrompt = text;
    if (attachedFile) {
      fullPrompt = `[Attached File: ${attachedFile.name}]\n${text}`;
    }

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: fullPrompt,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setAttachedFile(null);
    setIsTyping(true);

    try {
      const res = await apiSendAgentMessage(fullPrompt, activeConversationId);
      const replyText = res?.data?.reply || res?.reply || "Done! Request processed.";
      const astraReply = {
        id: Date.now() + 1,
        sender: 'astra',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, astraReply]);
      loadConversations().catch(() => {});
    } catch (e) {
      if (showError) showError("Error from AI service: " + e.message);
      const errorReply = {
        id: Date.now() + 1,
        sender: 'astra',
        text: `Sorry, I encountered an error: ${e.message}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-6rem)] flex flex-col pt-2 pb-6 relative">
      {/* Top Bar with Model Picker & History Toggle */}
      <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 rounded-xl bg-surface-container-low dark:bg-slate-800 text-on-surface dark:text-slate-200 hover:bg-surface-container-high transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Chat History"
          >
            <span className="material-symbols-outlined text-lg">history</span>
            <span className="hidden sm:inline">History</span>
          </button>

          <div>
            <h2 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100 flex items-center gap-2">
              <span>AI Assistant Workspace</span>
            </h2>
            <p className="text-xs text-on-surface-variant dark:text-slate-400">
              Connected to FastAPI AI Provider Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startNewChat}
            className="p-2 px-3 rounded-xl bg-primary-fixed dark:bg-blue-950/80 text-primary dark:text-blue-300 hover:bg-primary/20 text-xs font-semibold transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span className="hidden sm:inline">New Chat</span>
          </button>

          {/* Model Dropdown */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-surface-container-low dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-xl px-3 py-1.5 font-label text-xs font-semibold text-on-surface dark:text-slate-200 focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="Astra 3.6 Pro">Astra Agent (Gemini Primary)</option>
            <option value="Groq Fallback">Groq LLM Fallback</option>
            <option value="OpenRouter Fallback">OpenRouter Fallback</option>
          </select>
        </div>
      </div>

      {/* History Drawer Modal / Sidebar */}
      {showHistory && (
        <div className="absolute top-16 left-0 z-30 w-72 bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center pb-3 mb-2 border-b border-outline-variant/30 dark:border-slate-700">
            <h3 className="font-headline text-sm font-bold text-on-surface dark:text-slate-100">
              Chat Controls
            </h3>
            <button onClick={() => setShowHistory(false)} className="text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleClearHistory}
              className="w-full p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-xs font-semibold flex items-center gap-2 hover:bg-red-100 transition-colors"
            >
              <span className="material-symbols-outlined text-base">delete</span>
              <span>Delete All History</span>
            </button>
            <button
              onClick={() => loadHistory(activeConversationId)}
              className="w-full p-2.5 rounded-xl bg-surface-container-low dark:bg-slate-700 text-on-surface dark:text-slate-200 text-xs font-semibold flex items-center gap-2 hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              <span>Reload Messages</span>
            </button>
            {conversations.length > 0 && <div className="pt-3 mt-3 border-t border-outline-variant/30 dark:border-slate-700"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Saved conversations</p><div className="max-h-56 space-y-1 overflow-y-auto">{conversations.map((conversation) => <button key={conversation.id} onClick={() => { setActiveConversationId(conversation.id); loadHistory(conversation.id); setShowHistory(false); }} className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${conversation.id === activeConversationId ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low dark:hover:bg-slate-700'}`}><span className="block truncate font-semibold">{conversation.title}</span><span className="mt-0.5 block text-[10px] text-on-surface-variant">{conversation.message_count} messages</span></button>)}</div></div>}
          </div>
        </div>
      )}

      {/* Messages Stream Container */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6 px-2">
        {loadingHistory ? (
          <div className="text-center py-10 text-xs text-on-surface-variant flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg animate-spin">sync</span>
            <span>Loading conversation history from FastAPI backend...</span>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'astra' && (
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="material-symbols-outlined text-xl">auto_awesome</span>
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 shadow-sm text-sm relative group ${
                  msg.sender === 'user'
                    ? 'bg-primary text-white rounded-br-none'
                    : 'bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 text-on-surface dark:text-slate-200 rounded-bl-none'
                }`}
              >
                {msg.sender === 'astra' ? <MarkdownMessage content={msg.text} /> : <div className="whitespace-pre-wrap font-body leading-relaxed">{msg.text}</div>}
                
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5 dark:border-white/5">
                  {msg.sender === 'astra' ? (
                    <button
                      onClick={() => speakText(msg.id, msg.text)}
                      className="text-xs flex items-center gap-1 text-primary dark:text-blue-400 hover:underline"
                      title="Read response aloud"
                    >
                      <span className="material-symbols-outlined text-base">
                        {speakingMsgId === msg.id ? 'volume_up' : 'volume_mute'}
                      </span>
                      <span>{speakingMsgId === msg.id ? 'Speaking...' : 'Listen'}</span>
                    </button>
                  ) : <span />}
                  
                  <span
                    className={`text-[10px] ${
                      msg.sender === 'user' ? 'text-blue-100' : 'text-on-surface-variant dark:text-slate-400'
                    }`}
                  >
                    {msg.time}
                  </span>
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0 mt-1 font-bold text-xs">
                  You
                </div>
              )}
            </div>
          ))
        )}

        {isTyping && (
          <div className="flex gap-4 justify-start">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-xl animate-spin">sync</span>
            </div>
            <div className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 p-4 rounded-2xl rounded-bl-none text-xs text-on-surface-variant flex items-center gap-2">
              <span>Astra Agent is executing multi-tool request...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box with Attachment Support */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="mt-auto pt-2"
      >
        {attachedFile && (
          <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 bg-surface-container-low dark:bg-slate-700 rounded-lg text-xs text-on-surface dark:text-slate-200 border border-outline-variant/30">
            <span className="material-symbols-outlined text-sm text-primary">description</span>
            <span className="font-semibold">{attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)} className="hover:text-red-500 ml-1">
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          </div>
        )}

        <div className="bg-surface dark:bg-slate-800 border border-outline-variant/50 dark:border-slate-700 rounded-2xl p-2 shadow-lg flex items-center gap-2">
          <input
            type="file"
            id="assistant-file-input"
            onChange={handleFileAttach}
            className="hidden"
          />
          <label
            htmlFor="assistant-file-input"
            className="p-2 rounded-xl text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high dark:hover:bg-slate-700 cursor-pointer transition-colors"
            title="Attach Document"
          >
            <span className="material-symbols-outlined text-xl">attach_file</span>
          </label>

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message to Astra..."
            className="flex-1 bg-transparent px-2 py-2 border-none focus:ring-0 focus:outline-none font-body text-sm text-on-surface dark:text-slate-100 placeholder-on-surface-variant/50"
          />

          <button
            type="submit"
            disabled={isTyping}
            className="p-2.5 rounded-xl bg-primary text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xl">send</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function inlineMarkdown(text, keyPrefix) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\([^\)]+\))/g).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key} className="rounded bg-slate-900/10 px-1 py-0.5 font-mono text-[.85em] dark:bg-white/10">{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (link) return <a key={key} href={link[2]} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{link[1]}</a>;
    return part;
  });
}

function tableCells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
}

function MarkdownMessage({ content }) {
  const lines = String(content || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim(); const code = []; index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<pre key={`code-${index}`} className="my-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100"><code data-language={language}>{code.join('\n')}</code></pre>); continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) { const Tag = `h${heading[1].length}`; blocks.push(<Tag key={`heading-${index}`} className={heading[1].length === 1 ? 'mb-2 text-lg font-bold' : 'mb-1 mt-3 text-base font-bold'}>{inlineMarkdown(heading[2], `h-${index}`)}</Tag>); index += 1; continue; }
    if (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] || '')) {
      const header = tableCells(line); index += 2; const rows = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) rows.push(tableCells(lines[index++]));
      blocks.push(<div key={`table-${index}`} className="my-3 overflow-x-auto"><table className="w-full border-collapse text-left text-xs"><thead><tr>{header.map((cell, cellIndex) => <th key={cellIndex} className="border-b border-outline-variant/50 px-2 py-1.5 font-bold">{inlineMarkdown(cell, `th-${cellIndex}`)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{header.map((_, cellIndex) => <td key={cellIndex} className="border-b border-outline-variant/25 px-2 py-1.5">{inlineMarkdown(row[cellIndex] || '', `td-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody></table></div>); continue;
    }
    const isOrdered = /^\s*\d+[.)]\s+/.test(line); const isUnordered = /^\s*[-*+]\s+/.test(line);
    if (isOrdered || isUnordered) {
      const items = []; const matcher = isOrdered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
      while (index < lines.length && matcher.test(lines[index])) { items.push(lines[index].match(matcher)[1]); index += 1; }
      const List = isOrdered ? 'ol' : 'ul'; blocks.push(<List key={`list-${index}`} className={`${isOrdered ? 'list-decimal' : 'list-disc'} my-2 space-y-1 pl-5`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item, `li-${itemIndex}`)}</li>)}</List>); continue;
    }
    const paragraph = [line]; index += 1;
    while (index < lines.length && lines[index].trim() && !lines[index].startsWith('```') && !/^(#{1,3})\s+/.test(lines[index]) && !/^\s*(?:[-*+]|\d+[.)])\s+/.test(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={`p-${index}`} className="mb-2 last:mb-0">{inlineMarkdown(paragraph.join(' '), `p-${index}`)}</p>);
  }
  return <div className="font-body leading-relaxed">{blocks}</div>;
}

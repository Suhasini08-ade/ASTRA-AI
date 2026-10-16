import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
  Brain,
  Search,
  Sparkles,
  CheckCircle2,
  FileText,
  SquareCheck,
  Award,
  HelpCircle,
  Code2,
  Scale,
  MessageSquare,
  Plus,
  RefreshCw,
  History,
  ChevronRight,
  ChevronDown,
  BookOpen,
  ArrowRight,
  Send,
  Zap,
  Target,
  Clock,
  Compass,
  CornerDownRight,
  Flame,
  X,
  ExternalLink,
  GraduationCap,
  Layers,
  Network,
  GitBranch,
  Check,
  AlertCircle,
  FolderPlus,
  ListTree
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import {
  apiGetDeepDives,
  apiGetDeepDive,
  apiCreateDeepDive,
  apiUpdateDeepDive,
  apiDeepDiveAction
} from '../services/api';

// Curated suggestion chips for instant exploration
const SUGGESTED_TOPICS = [
  'Quantum Computing',
  'Transformer Neural Networks',
  'CRISPR-Cas9 Gene Editing',
  'Distributed Consensus Algorithms',
  'Rust Memory Safety & Borrowing',
  'Photosynthesis & Energy Transfer',
  'Black Holes & Event Horizons',
  'Neuromorphic Architecture'
];

export default function KnowledgeMap() {
  const { addNote, addTask } = useData();
  const { user } = useAuth();

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Search & creation state
  const [searchTopic, setSearchTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected node & exploration state
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeTab, setActiveTab] = useState('explain'); // 'explain' | 'example' | 'compare' | 'question' | 'challenge'
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState('');

  // Per-concept exploration cache { [nodeId]: { explain, subconcepts, example, compare, qaHistory, quiz } }
  const [conceptCache, setConceptCache] = useState({});

  // Custom question state for Ask Astra tab
  const [customQuestion, setCustomQuestion] = useState('');

  // Interactive Map View mode: 'graph' or 'tree'
  const [viewMode, setViewMode] = useState('graph');
  const [filterQuery, setFilterQuery] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());

  // Action toast state
  const [toastMessage, setToastMessage] = useState('');

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  }, []);

  // ---------------------------------------------------------------------------
  // Load session list on mount
  // ---------------------------------------------------------------------------
  const fetchSessions = useCallback(async (autoSelectFirst = true) => {
    setLoadingSessions(true);
    try {
      const list = await apiGetDeepDives();
      setSessions(list || []);
      if (autoSelectFirst && list && list.length > 0) {
        // Load the full first session
        const full = await apiGetDeepDive(list[0].id);
        setCurrentSession(full);
        const nodes = full?.knowledge_map?.nodes || [];
        const initialSelected = nodes.find((n) => n.id === full.selected_concept) || nodes[0];
        setSelectedNode(initialSelected || null);
      }
    } catch (err) {
      console.warn('Failed to fetch Deep Dive sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions(true);
  }, [fetchSessions]);

  // ---------------------------------------------------------------------------
  // Switch to an existing session
  // ---------------------------------------------------------------------------
  const handleSelectSession = async (sessionSummary) => {
    if (currentSession?.id === sessionSummary.id) {
      setHistoryOpen(false);
      return;
    }
    setLoadingSessions(true);
    try {
      const full = await apiGetDeepDive(sessionSummary.id);
      setCurrentSession(full);
      const nodes = full?.knowledge_map?.nodes || [];
      const targetNode = nodes.find((n) => n.id === full.selected_concept) || nodes[0];
      setSelectedNode(targetNode || null);
      setActiveTab('explain');
      setHistoryOpen(false);
    } catch (err) {
      console.error('Failed to switch Deep Dive session:', err);
      showToast('Failed to load selected session.');
    } finally {
      setLoadingSessions(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Create / Explore a new topic (supports any topic)
  // ---------------------------------------------------------------------------
  const handleExploreTopic = async (topicToExplore) => {
    const clean = (topicToExplore || searchTopic).trim();
    if (!clean) return;

    setIsGenerating(true);
    setErrorMsg('');
    try {
      const newSession = await apiCreateDeepDive(clean);
      if (newSession && newSession.id) {
        setCurrentSession(newSession);
        const nodes = newSession?.knowledge_map?.nodes || [];
        setSelectedNode(nodes[0] || null);
        setSearchTopic('');
        setActiveTab('explain');
        // Refresh session list
        setSessions((prev) => [newSession, ...prev.filter((s) => s.id !== newSession.id)]);
        showToast(`Knowledge Map created for "${clean}"!`);
      }
    } catch (err) {
      console.error('Deep dive creation failed:', err);
      setErrorMsg(
        err?.message || 'Could not generate mind map. Please check your topic and try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Select a node & persist exploration status to backend
  // ---------------------------------------------------------------------------
  const handleNodeClick = async (node) => {
    if (!node || !currentSession) return;
    setSelectedNode(node);

    const exploredList = currentSession.explored_concepts || [];
    const isAlreadyExplored = exploredList.includes(node.id);

    const updatePayload = {
      selected_concept: node.id,
    };

    if (!isAlreadyExplored) {
      updatePayload.explored_concepts = [...exploredList, node.id];
    }

    // Optimistically update current session state
    setCurrentSession((prev) => ({
      ...prev,
      selected_concept: node.id,
      explored_concepts: updatePayload.explored_concepts || prev.explored_concepts,
    }));

    // Sync with backend
    try {
      await apiUpdateDeepDive(currentSession.id, updatePayload);
    } catch (err) {
      console.warn('Failed to sync concept selection to server:', err);
    }
  };

  // Toggle collapse state for a node's children
  const toggleCollapse = (nodeId, e) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Dynamic Branching: Add AI-discovered subconcept to the map
  // ---------------------------------------------------------------------------
  const handleAddBranch = async (subconcept, parentNode) => {
    if (!currentSession || !subconcept) return;

    const existingNodes = currentSession.knowledge_map?.nodes || [];
    const baseSlug = (subconcept.label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `concept-${Date.now()}`;

    let uniqueId = baseSlug;
    let counter = 1;
    while (existingNodes.some((n) => n.id === uniqueId)) {
      uniqueId = `${baseSlug}-${counter++}`;
    }

    const newNode = {
      id: uniqueId,
      label: subconcept.label,
      parent: parentNode?.id || 'root',
      difficulty: subconcept.difficulty || 'Intermediate',
      summary: subconcept.summary || `Explore ${subconcept.label}.`,
    };

    const updatedNodes = [...existingNodes, newNode];
    const updatedKnowledgeMap = {
      ...currentSession.knowledge_map,
      nodes: updatedNodes,
    };

    // Optimistic update
    setCurrentSession((prev) => ({
      ...prev,
      knowledge_map: updatedKnowledgeMap,
    }));

    try {
      await apiUpdateDeepDive(currentSession.id, { knowledge_map: updatedKnowledgeMap });
      showToast(`Branch "${subconcept.label}" added to map!`);
    } catch (err) {
      console.error('Failed to persist new branch:', err);
      showToast('Failed to save branch to server.');
    }
  };

  // ---------------------------------------------------------------------------
  // Concept Exploration Actions (Explain, Example, Compare, Question, Challenge)
  // ---------------------------------------------------------------------------
  const executeConceptAction = useCallback(
    async (action, forcedPrompt = null, forceRefresh = false) => {
      if (!selectedNode || !currentSession) return;

      const nodeId = selectedNode.id;
      const currentCache = conceptCache[nodeId] || {};

      // Return early if cached (unless forced)
      if (!forceRefresh) {
        if (action === 'explain' && currentCache.explain) return;
        if (action === 'example' && currentCache.example) return;
        if (action === 'compare' && currentCache.compare) return;
      }

      setTabLoading(true);
      setTabError('');

      try {
        const nodes = currentSession.knowledge_map?.nodes || [];
        const relatedConcepts = nodes
          .filter((n) => n.id !== selectedNode.id)
          .map((n) => n.label)
          .slice(0, 5);

        const res = await apiDeepDiveAction(
          currentSession.id,
          selectedNode.label,
          action,
          forcedPrompt,
          relatedConcepts
        );

        if (!res) throw new Error('Empty response from AI engine');

        setConceptCache((prev) => {
          const prevNodeData = prev[nodeId] || {};
          let updated = { ...prevNodeData };

          if (action === 'explain') {
            updated.explain = res.answer || '';
            updated.subconcepts = res.subconcepts || [];
          } else if (action === 'example') {
            updated.example = res.answer || '';
            if (res.subconcepts && res.subconcepts.length > 0) {
              updated.subconcepts = [
                ...(updated.subconcepts || []),
                ...res.subconcepts.filter(
                  (sc) => !(updated.subconcepts || []).some((ex) => ex.label === sc.label)
                ),
              ];
            }
          } else if (action === 'compare') {
            updated.compare = res.answer || '';
            if (res.subconcepts && res.subconcepts.length > 0) {
              updated.subconcepts = [
                ...(updated.subconcepts || []),
                ...res.subconcepts.filter(
                  (sc) => !(updated.subconcepts || []).some((ex) => ex.label === sc.label)
                ),
              ];
            }
          } else if (action === 'question') {
            const qaList = prevNodeData.qaHistory || [];
            updated.qaHistory = [
              ...qaList,
              { question: forcedPrompt, answer: res.answer || 'No response.' },
            ];
          } else if (action === 'challenge') {
            updated.quiz = {
              question: res.question,
              options: res.options || [],
              answer: res.answer ?? 0,
              explanation: res.explanation || '',
              selected: null,
              isCorrect: null,
            };
          }

          return { ...prev, [nodeId]: updated };
        });

        // Ensure concept is marked explored
        const exploredList = currentSession.explored_concepts || [];
        if (!exploredList.includes(nodeId)) {
          const newExplored = [...exploredList, nodeId];
          setCurrentSession((prev) => ({ ...prev, explored_concepts: newExplored }));
          apiUpdateDeepDive(currentSession.id, { explored_concepts: newExplored }).catch(
            console.warn
          );
        }
      } catch (err) {
        console.error(`Deep Dive action ${action} failed:`, err);
        setTabError(err?.message || `Failed to generate ${action}. Please retry.`);
      } finally {
        setTabLoading(false);
      }
    },
    [selectedNode, currentSession, conceptCache]
  );

  // Auto-fetch explanation when switching to a node or the explain tab
  useEffect(() => {
    if (selectedNode && currentSession && activeTab === 'explain') {
      const cached = conceptCache[selectedNode.id]?.explain;
      if (!cached) {
        executeConceptAction('explain', null, false);
      }
    }
  }, [selectedNode?.id, activeTab, currentSession?.id, executeConceptAction]);

  // Tab switch handler
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setTabError('');
    if (!selectedNode || !currentSession) return;

    const nodeId = selectedNode.id;
    const cached = conceptCache[nodeId] || {};

    if (newTab === 'explain' && !cached.explain) {
      executeConceptAction('explain');
    } else if (newTab === 'example' && !cached.example) {
      executeConceptAction('example');
    } else if (newTab === 'compare' && !cached.compare) {
      executeConceptAction('compare');
    } else if (newTab === 'challenge' && !cached.quiz) {
      executeConceptAction('challenge');
    }
  };

  // Submit custom question in Ask Astra tab
  const handleAskQuestion = (e) => {
    e.preventDefault();
    if (!customQuestion.trim() || tabLoading) return;
    const q = customQuestion.trim();
    setCustomQuestion('');
    executeConceptAction('question', q, true);
  };

  // Answer a challenge question
  const handleSelectQuizAnswer = async (optionIndex) => {
    if (!selectedNode || !currentSession) return;
    const nodeId = selectedNode.id;
    const quiz = conceptCache[nodeId]?.quiz;
    if (!quiz || quiz.selected !== null) return; // already answered

    const isCorrect = optionIndex === quiz.answer;

    setConceptCache((prev) => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        quiz: {
          ...quiz,
          selected: optionIndex,
          isCorrect,
        },
      },
    }));

    // Record into session challenge_history
    const historyEntry = {
      concept: selectedNode.label,
      question: quiz.question,
      user_answer: optionIndex,
      correct_answer: quiz.answer,
      is_correct: isCorrect,
      timestamp: new Date().toISOString(),
    };

    const updatedHistory = [...(currentSession.challenge_history || []), historyEntry];
    setCurrentSession((prev) => ({
      ...prev,
      challenge_history: updatedHistory,
    }));

    try {
      await apiUpdateDeepDive(currentSession.id, { challenge_history: updatedHistory });
    } catch (err) {
      console.warn('Failed to save challenge result:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Productivity Integrations: Save to Notes & Tasks
  // ---------------------------------------------------------------------------
  const handleSaveAsNote = () => {
    if (!selectedNode || !currentSession) return;
    const nodeCache = conceptCache[selectedNode.id] || {};
    const content = `# Deep Dive: ${selectedNode.label}
**Topic:** ${currentSession.topic}
**Difficulty:** ${selectedNode.difficulty || 'Beginner'}

## Overview
${selectedNode.summary || 'Concept summary not provided.'}

${nodeCache.explain ? `## In-Depth Analysis\n${nodeCache.explain}\n` : ''}
${nodeCache.example ? `## Practical Example\n${nodeCache.example}\n` : ''}
${nodeCache.compare ? `## Comparative Context\n${nodeCache.compare}\n` : ''}

*Explored with ASTRA AI Deep Dive Engine on ${new Date().toLocaleDateString()}*`;

    addNote({
      title: `${selectedNode.label} (${currentSession.topic})`,
      content,
      category: 'Deep Dive',
      tags: ['Deep Dive', currentSession.topic, selectedNode.difficulty || 'Concept'],
    });

    showToast('Saved concept note to Notes!');
  };

  const handleSaveAsTask = () => {
    if (!selectedNode || !currentSession) return;
    addTask({
      title: `Study Concept: ${selectedNode.label}`,
      description: `Review Deep Dive exploration of "${selectedNode.label}" under topic "${currentSession.topic}". Focus: ${selectedNode.summary}`,
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      priority: selectedNode.difficulty === 'Advanced' ? 'High' : 'Medium',
      status: 'Pending',
    });

    showToast('Created study task in Tasks!');
  };

  // ---------------------------------------------------------------------------
  // Hierarchy & Tree Calculation for Knowledge Map
  // ---------------------------------------------------------------------------
  const nodes = currentSession?.knowledge_map?.nodes || [];

  const { rootNode, branchTree, totalNodes, exploredCount, masteryPercent } = useMemo(() => {
    if (!nodes || nodes.length === 0) {
      return {
        rootNode: null,
        branchTree: [],
        totalNodes: 0,
        exploredCount: 0,
        masteryPercent: 0,
      };
    }

    const root =
      nodes.find((n) => n.parent === null || n.parent === undefined || n.id === 'root') ||
      nodes[0];

    // Build branch tree: root -> level1 -> level2
    const level1 = nodes.filter((n) => n.parent === root?.id && n.id !== root?.id);

    const tree = level1.map((branch) => {
      const children = nodes.filter((n) => n.parent === branch.id);
      return {
        ...branch,
        children,
      };
    });

    const explored = (currentSession?.explored_concepts || []).length;
    const mastery = Math.min(100, Math.round((explored / Math.max(1, nodes.length)) * 100));

    return {
      rootNode: root,
      branchTree: tree,
      totalNodes: nodes.length,
      exploredCount: explored,
      masteryPercent: mastery,
    };
  }, [nodes, currentSession?.explored_concepts]);

  // Filtered nodes for search
  const matchesFilter = useCallback(
    (node) => {
      if (!filterQuery.trim()) return true;
      const q = filterQuery.toLowerCase();
      return (
        node.label.toLowerCase().includes(q) ||
        (node.summary && node.summary.toLowerCase().includes(q))
      );
    },
    [filterQuery]
  );

  // Helper for difficulty badge colors
  const getDifficultyBadge = (diff) => {
    const d = (diff || 'Beginner').toLowerCase();
    if (d.includes('adv')) {
      return 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
    }
    if (d.includes('inter')) {
      return 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30';
    }
    return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
  };

  // Current node's cached data
  const currentNodeData = selectedNode ? conceptCache[selectedNode.id] || {} : {};

  // Quiz scoring stats
  const quizHistory = currentSession?.challenge_history || [];
  const correctQuizzes = quizHistory.filter((q) => q.is_correct).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600/90 text-white text-xs font-semibold shadow-2xl backdrop-blur-md animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Search Bar */}
      <div className="relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 dark:bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-600/10 dark:bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Title & Stats */}
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 text-white shadow-lg shadow-purple-900/30 animate-pulse-glow">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Deep Dive Knowledge Engine</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    ASTRA AI
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Explore any subject into dynamic interactive visual knowledge branches
                </p>
              </div>
            </div>

            {/* Mastery & Nodes Pill when session is loaded */}
            {currentSession && (
              <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Topic:
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                    {currentSession.topic}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Concepts:
                  </span>
                  <span className="text-xs font-bold text-purple-400">
                    {exploredCount} / {totalNodes} Explored
                  </span>
                </div>

                {/* Mastery Bar */}
                <div className="flex items-center gap-2 min-w-[160px]">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Mastery:
                  </span>
                  <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${masteryPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-extrabold text-cyan-400">{masteryPercent}%</span>
                </div>

                {quizHistory.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                    <Award className="w-3.5 h-3.5" />
                    <span>
                      Quiz Score: {correctQuizzes}/{quizHistory.length}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search Input & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExploreTopic();
              }}
              className="relative flex-1 sm:w-80"
            >
              <input
                type="text"
                value={searchTopic}
                onChange={(e) => setSearchTopic(e.target.value)}
                placeholder="Enter any topic (e.g. Distributed Consensus)..."
                disabled={isGenerating}
                className="w-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700/80 rounded-2xl py-2.5 pl-9 pr-24 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />

              <button
                type="submit"
                disabled={isGenerating || !searchTopic.trim()}
                className="absolute right-1.5 top-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-900/30 hover:opacity-95 disabled:opacity-50 transition-all flex items-center gap-1"
              >
                {isGenerating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isGenerating ? 'Mapping...' : 'Explore'}</span>
              </button>
            </form>

            {/* History Sessions Drawer Toggle */}
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center gap-2 transition-colors relative"
              title="View Deep Dive Session History"
            >
              <History className="w-4 h-4 text-purple-400" />
              <span>History</span>
              {sessions.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {sessions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Explore Topics:
          </span>
          {SUGGESTED_TOPICS.map((suggested) => (
            <button
              key={suggested}
              onClick={() => handleExploreTopic(suggested)}
              disabled={isGenerating}
              className="shrink-0 text-[11px] px-2.5 py-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/70 hover:bg-purple-600/20 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 border border-slate-200 dark:border-slate-700/50 transition-colors"
            >
              {suggested}
            </button>
          ))}
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Session History Sidebar Modal / Drawer */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-2xl h-full overflow-hidden">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Past Deep Dives
                  </h3>
                </div>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-2.5 max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar pr-1">
                {sessions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No past sessions yet. Explore any topic above to create your first knowledge map!
                  </div>
                ) : (
                  sessions.map((sess) => {
                    const isActive = currentSession?.id === sess.id;
                    const sessNodes = sess.knowledge_map?.nodes || [];
                    const explored = (sess.explored_concepts || []).length;
                    const mastery = Math.min(
                      100,
                      Math.round((explored / Math.max(1, sessNodes.length)) * 100)
                    );

                    return (
                      <button
                        key={sess.id}
                        onClick={() => handleSelectSession(sess)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all ${
                          isActive
                            ? 'bg-purple-600/15 border-purple-500/80 shadow-md shadow-purple-900/20'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-purple-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                            {sess.topic}
                          </span>
                          {isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500 text-white font-bold">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{sessNodes.length} Concepts</span>
                          <span className="font-bold text-cyan-400">{mastery}% Mastery</span>
                          <span>
                            {sess.updated_at
                              ? new Date(sess.updated_at).toLocaleDateString()
                              : 'Recent'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setHistoryOpen(false);
                  setSearchTopic('');
                  const searchInput = document.querySelector('input[type="text"]');
                  if (searchInput) searchInput.focus();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Explore New Topic</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isGenerating ? (
        <div className="py-28 flex flex-col items-center justify-center text-center space-y-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
            <Brain className="w-8 h-8 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Generating Dynamic Knowledge Map...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Astra AI is structuring key concept branches, hierarchy relationships, and foundational
              summaries for "{searchTopic || 'your topic'}".
            </p>
          </div>
        </div>
      ) : !currentSession ? (
        /* Zero state: Welcome / prompt to explore */
        <div className="py-20 px-6 text-center bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-purple-900/30 animate-pulse-glow">
            <Compass className="w-10 h-10" />
          </div>
          <div className="max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Embark on an AI Deep Dive
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Enter any technical, scientific, historical, or philosophical topic in the exploration
              bar above. Astra AI will construct a real-time interactive knowledge map with branching
              concepts, practical examples, and tailored quizzes.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-2xl mx-auto">
            {SUGGESTED_TOPICS.map((topic) => (
              <button
                key={topic}
                onClick={() => handleExploreTopic(topic)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 hover:text-white dark:hover:bg-purple-600 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>{topic}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Active Workspace: Left Knowledge Graph Canvas + Right Exploration Panel */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* ========================================================================= */}
          {/* LEFT: Interactive Knowledge Map & Topic Branches (Col 7 / 12)             */}
          {/* ========================================================================= */}
          <div className="xl:col-span-7 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col justify-between min-h-[580px]">
            <div>
              {/* Map Controls & Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800/80 gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <span>Interactive Knowledge Map</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        ({nodes.length} nodes)
                      </span>
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Search Filter input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder="Filter nodes..."
                      className="w-32 sm:w-40 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-1 pl-7 pr-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                    {filterQuery && (
                      <button
                        onClick={() => setFilterQuery('')}
                        className="absolute right-1.5 top-1.5 text-slate-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* View Mode Toggle: Graph vs Tree */}
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setViewMode('graph')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                        viewMode === 'graph'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="Visual Graph View"
                    >
                      <Network className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Graph</span>
                    </button>
                    <button
                      onClick={() => setViewMode('tree')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                        viewMode === 'tree'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="Hierarchical Tree View"
                    >
                      <ListTree className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Tree</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* --------------------------------------------------------------------- */}
              {/* VIEW 1: Visual Graph Mind-Map with SVG Connector Lines               */}
              {/* --------------------------------------------------------------------- */}
              {viewMode === 'graph' ? (
                <div className="my-6 relative">
                  {/* Central Root Concept Card */}
                  {rootNode && (
                    <div className="flex justify-center mb-8">
                      <button
                        onClick={() => handleNodeClick(rootNode)}
                        className={`relative group max-w-md w-full p-5 rounded-2xl border text-center transition-all duration-300 ${
                          selectedNode?.id === rootNode.id
                            ? 'bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-blue-900/60 border-purple-400 shadow-xl shadow-purple-900/40 ring-2 ring-purple-500/70 scale-[1.02]'
                            : 'bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800/90 dark:to-slate-800/60 border-slate-300 dark:border-slate-700 hover:border-purple-500/50 shadow-md'
                        }`}
                      >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-[10px] font-extrabold tracking-wider uppercase shadow-md flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Core Topic Root</span>
                        </div>

                        <div className="flex items-center justify-center gap-2 mt-1">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                            {rootNode.label}
                          </h3>
                          {currentSession.explored_concepts?.includes(rootNode.id) && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
                          {rootNode.summary}
                        </p>

                        <div className="mt-3 flex items-center justify-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getDifficultyBadge(
                              rootNode.difficulty
                            )}`}
                          >
                            {rootNode.difficulty || 'Foundational'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {branchTree.length} Direct Branches
                          </span>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Branches Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {branchTree.map((branch) => {
                      const isBranchSelected = selectedNode?.id === branch.id;
                      const isBranchExplored = currentSession.explored_concepts?.includes(
                        branch.id
                      );
                      const isCollapsed = collapsedNodes.has(branch.id);
                      const branchMatches = matchesFilter(branch);
                      const visibleChildren = branch.children.filter(matchesFilter);

                      if (!branchMatches && visibleChildren.length === 0) return null;

                      return (
                        <div
                          key={branch.id}
                          className="flex flex-col space-y-3 p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 transition-all"
                        >
                          {/* Branch Node Card */}
                          <div
                            onClick={() => handleNodeClick(branch)}
                            role="button"
                            tabIndex={0}
                            className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 relative ${
                              isBranchSelected
                                ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-900/20 ring-1 ring-purple-500 scale-[1.01]'
                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/70 hover:border-purple-400/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <GitBranch className="w-4 h-4 text-purple-400 shrink-0" />
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {branch.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isBranchExplored && (
                                  <CheckCircle2
                                    className="w-3.5 h-3.5 text-emerald-400"
                                    title="Explored"
                                  />
                                )}
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${getDifficultyBadge(
                                    branch.difficulty
                                  )}`}
                                >
                                  {branch.difficulty || 'Concept'}
                                </span>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                              {branch.summary}
                            </p>

                            {/* Subconcept Count & Expand Button */}
                            {branch.children.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                <span className="text-[10px] text-purple-400 font-semibold">
                                  {branch.children.length} Sub-branch
                                  {branch.children.length > 1 ? 'es' : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => toggleCollapse(branch.id, e)}
                                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5 px-2 py-0.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                                >
                                  {isCollapsed ? (
                                    <>
                                      <span>Show</span>
                                      <ChevronDown className="w-3 h-3" />
                                    </>
                                  ) : (
                                    <>
                                      <span>Hide</span>
                                      <ChevronRight className="w-3 h-3" />
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Sub-Branch Nodes (Child branches) */}
                          {!isCollapsed && visibleChildren.length > 0 && (
                            <div className="pl-4 space-y-2 border-l-2 border-purple-500/30">
                              {visibleChildren.map((child) => {
                                const isChildSelected = selectedNode?.id === child.id;
                                const isChildExplored = currentSession.explored_concepts?.includes(
                                  child.id
                                );

                                return (
                                  <div
                                    key={child.id}
                                    onClick={() => handleNodeClick(child)}
                                    role="button"
                                    tabIndex={0}
                                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 relative ${
                                      isChildSelected
                                        ? 'bg-cyan-600/20 border-cyan-400 shadow-md shadow-cyan-900/20 ring-1 ring-cyan-400 scale-[1.01]'
                                        : 'bg-white/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-cyan-400/40 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1.5">
                                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <CornerDownRight className="w-3 h-3 text-cyan-400 shrink-0" />
                                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">
                                          {child.label}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {isChildExplored && (
                                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        )}
                                        <span
                                          className={`text-[8px] font-bold px-1 py-0.5 rounded ${getDifficultyBadge(
                                            child.difficulty
                                          )}`}
                                        >
                                          {child.difficulty || 'Subconcept'}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                      {child.summary}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* --------------------------------------------------------------------- */
                /* VIEW 2: Hierarchical Tree List                                       */
                /* --------------------------------------------------------------------- */
                <div className="my-6 space-y-3">
                  {rootNode && (
                    <div
                      onClick={() => handleNodeClick(rootNode)}
                      role="button"
                      tabIndex={0}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                        selectedNode?.id === rootNode.id
                          ? 'bg-purple-600/20 border-purple-400 ring-2 ring-purple-500/50'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {rootNode.label} (Core Root)
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold">
                          Root
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        {rootNode.summary}
                      </p>
                    </div>
                  )}

                  {branchTree.map((branch) => {
                    const isBranchSelected = selectedNode?.id === branch.id;
                    const isCollapsed = collapsedNodes.has(branch.id);
                    const visibleChildren = branch.children.filter(matchesFilter);

                    return (
                      <div
                        key={branch.id}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2"
                      >
                        <div
                          onClick={() => handleNodeClick(branch)}
                          role="button"
                          tabIndex={0}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                            isBranchSelected
                              ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 hover:border-purple-400/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <GitBranch className="w-4 h-4 text-purple-400 shrink-0" />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                              {branch.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${getDifficultyBadge(
                                branch.difficulty
                              )}`}
                            >
                              {branch.difficulty}
                            </span>
                            {branch.children.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => toggleCollapse(branch.id, e)}
                                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {!isCollapsed && visibleChildren.length > 0 && (
                          <div className="pl-6 space-y-1.5">
                            {visibleChildren.map((child) => {
                              const isChildSelected = selectedNode?.id === child.id;
                              return (
                                <div
                                  key={child.id}
                                  onClick={() => handleNodeClick(child)}
                                  role="button"
                                  tabIndex={0}
                                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                                    isChildSelected
                                      ? 'bg-cyan-600/20 border-cyan-400'
                                      : 'bg-white/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/50 hover:border-cyan-400/40'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <CornerDownRight className="w-3 h-3 text-cyan-400 shrink-0" />
                                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                                      {child.label}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[8px] font-bold px-1 py-0.5 rounded ${getDifficultyBadge(
                                      child.difficulty
                                    )}`}
                                  >
                                    {child.difficulty}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Actions: Convert Concept */}
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Selected:{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {selectedNode?.label || 'None'}
                </strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveAsNote}
                  disabled={!selectedNode}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 hover:text-white text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  <span>Save Note</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsTask}
                  disabled={!selectedNode}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-cyan-600 hover:text-white text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <SquareCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Create Task</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT: Concept Exploration Workspace (Col 5 / 12)                        */}
          {/* ========================================================================= */}
          <div className="xl:col-span-5 space-y-6">
            {selectedNode ? (
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl space-y-5">
                {/* Concept Header */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5" />
                      Concept Exploration
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getDifficultyBadge(
                        selectedNode.difficulty
                      )}`}
                    >
                      {selectedNode.difficulty || 'Beginner'}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {selectedNode.label}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    {selectedNode.summary}
                  </p>
                </div>

                {/* 5 Exploration Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'explain', label: 'Explain', icon: Sparkles },
                    { id: 'example', label: 'Example', icon: Code2 },
                    { id: 'compare', label: 'Compare', icon: Scale },
                    { id: 'question', label: 'Ask Astra', icon: MessageSquare },
                    { id: 'challenge', label: 'Quiz', icon: Award },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors border-b-2 -mb-[1px] ${
                          isActive
                            ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tab Error Alert */}
                {tabError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
                    <span className="line-clamp-2">{tabError}</span>
                    <button
                      onClick={() => executeConceptAction(activeTab, null, true)}
                      className="px-2 py-1 rounded bg-rose-500 text-white font-bold text-[10px] shrink-0 ml-2"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Tab Content Display */}
                {tabLoading ? (
                  <div className="py-14 text-center space-y-3">
                    <div className="w-8 h-8 mx-auto rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
                    <p className="text-xs text-slate-400 animate-pulse">
                      Astra AI is generating real-time {activeTab} for "{selectedNode.label}"...
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* TAB 1: Explain */}
                    {activeTab === 'explain' && (
                      <div className="space-y-4">
                        <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                          {currentNodeData.explain ? (
                            <MarkdownRenderer content={currentNodeData.explain} />
                          ) : (
                            <div className="text-center py-6">
                              <p className="text-slate-400">No explanation generated yet.</p>
                              <button
                                onClick={() => executeConceptAction('explain', null, true)}
                                className="mt-2 px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold"
                              >
                                Generate In-Depth Explanation
                              </button>
                            </div>
                          )}
                        </div>

                        {currentNodeData.explain && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => executeConceptAction('explain', null, true)}
                              className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Regenerate Explanation</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 2: Practical Example */}
                    {activeTab === 'example' && (
                      <div className="space-y-4">
                        <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                          {currentNodeData.example ? (
                            <MarkdownRenderer content={currentNodeData.example} />
                          ) : (
                            <div className="text-center py-6">
                              <p className="text-slate-400">
                                Click below to generate a practical real-world scenario or code
                                example for {selectedNode.label}.
                              </p>
                              <button
                                onClick={() => executeConceptAction('example', null, true)}
                                className="mt-3 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-xs font-bold"
                              >
                                Generate Practical Example
                              </button>
                            </div>
                          )}
                        </div>

                        {currentNodeData.example && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => executeConceptAction('example', null, true)}
                              className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Regenerate Example</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 3: Compare Concepts */}
                    {activeTab === 'compare' && (
                      <div className="space-y-4">
                        <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                          {currentNodeData.compare ? (
                            <MarkdownRenderer content={currentNodeData.compare} />
                          ) : (
                            <div className="text-center py-6">
                              <p className="text-slate-400">
                                Compare {selectedNode.label} against other concepts in this knowledge
                                map.
                              </p>
                              <button
                                onClick={() => executeConceptAction('compare', null, true)}
                                className="mt-3 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-xs font-bold"
                              >
                                Compare with Nearby Concepts
                              </button>
                            </div>
                          )}
                        </div>

                        {currentNodeData.compare && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => executeConceptAction('compare', null, true)}
                              className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Regenerate Comparison</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 4: Ask Astra (Custom Q&A) */}
                    {activeTab === 'question' && (
                      <div className="space-y-4">
                        {/* Q&A History */}
                        <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                          {(!currentNodeData.qaHistory ||
                            currentNodeData.qaHistory.length === 0) && (
                            <div className="py-6 text-center text-xs text-slate-400">
                              Ask any specific question about "{selectedNode.label}". Astra will
                              provide an immediate, focused response.
                            </div>
                          )}

                          {(currentNodeData.qaHistory || []).map((qa, index) => (
                            <div
                              key={index}
                              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs"
                            >
                              <div className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>{qa.question}</span>
                              </div>
                              <div className="text-slate-700 dark:text-slate-200 pl-4 border-l-2 border-purple-500/40">
                                <MarkdownRenderer content={qa.answer} />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Input Box */}
                        <form onSubmit={handleAskQuestion} className="flex gap-2">
                          <input
                            type="text"
                            value={customQuestion}
                            onChange={(e) => setCustomQuestion(e.target.value)}
                            placeholder={`Ask anything about ${selectedNode.label}...`}
                            disabled={tabLoading}
                            className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                          <button
                            type="submit"
                            disabled={tabLoading || !customQuestion.trim()}
                            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-50 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Ask</span>
                          </button>
                        </form>
                      </div>
                    )}

                    {/* TAB 5: AI Quiz Challenge */}
                    {activeTab === 'challenge' && (
                      <div className="space-y-4">
                        {currentNodeData.quiz ? (
                          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                                <Award className="w-3.5 h-3.5" />
                                Knowledge Challenge
                              </span>
                              {currentNodeData.quiz.selected !== null && (
                                <span
                                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                    currentNodeData.quiz.isCorrect
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                  }`}
                                >
                                  {currentNodeData.quiz.isCorrect ? 'Correct! 🎉' : 'Incorrect ✘'}
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">
                              {currentNodeData.quiz.question}
                            </p>

                            {/* Options */}
                            <div className="space-y-2 pt-1">
                              {currentNodeData.quiz.options.map((opt, i) => {
                                const isSelected = currentNodeData.quiz.selected === i;
                                const isCorrectAnswer = currentNodeData.quiz.answer === i;
                                const hasAnswered = currentNodeData.quiz.selected !== null;

                                let btnStyle =
                                  'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-400';

                                if (hasAnswered) {
                                  if (isCorrectAnswer) {
                                    btnStyle =
                                      'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold';
                                  } else if (isSelected && !isCorrectAnswer) {
                                    btnStyle =
                                      'bg-rose-500/20 border-rose-500 text-rose-300 font-bold';
                                  } else {
                                    btnStyle =
                                      'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500';
                                  }
                                }

                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => handleSelectQuizAnswer(i)}
                                    disabled={hasAnswered}
                                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between ${btnStyle}`}
                                  >
                                    <span>{opt}</span>
                                    {hasAnswered && isCorrectAnswer && (
                                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Explanation & Retry Button */}
                            {currentNodeData.quiz.selected !== null && (
                              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                                {currentNodeData.quiz.explanation && (
                                  <div className="p-3 rounded-xl bg-purple-600/10 border border-purple-500/20 text-xs text-purple-200">
                                    <strong className="block font-bold text-purple-400 mb-0.5">
                                      Explanation:
                                    </strong>
                                    <p>{currentNodeData.quiz.explanation}</p>
                                  </div>
                                )}

                                <button
                                  onClick={() => executeConceptAction('challenge', null, true)}
                                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Generate Another Quiz Question</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="py-8 text-center space-y-3">
                            <p className="text-xs text-slate-400">
                              Ready to test your comprehension on "{selectedNode.label}"?
                            </p>
                            <button
                              onClick={() => executeConceptAction('challenge', null, true)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-xs font-bold shadow-md shadow-purple-900/20"
                            >
                              Launch AI Quiz Challenge
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* DYNAMIC BRANCHES DISCOVERED: Allow user to add new subconcepts to the tree */}
                    {currentNodeData.subconcepts && currentNodeData.subconcepts.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                            <GitBranch className="w-3.5 h-3.5" />
                            Dynamic Branches Discovered
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Expand your visual knowledge map
                          </span>
                        </div>

                        <div className="space-y-2">
                          {currentNodeData.subconcepts.map((sub, idx) => {
                            const isAlreadyAdded = nodes.some(
                              (n) => n.label.toLowerCase() === sub.label.toLowerCase()
                            );

                            return (
                              <div
                                key={idx}
                                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                      {sub.label}
                                    </span>
                                    <span
                                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${getDifficultyBadge(
                                        sub.difficulty
                                      )}`}
                                    >
                                      {sub.difficulty}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                    {sub.summary}
                                  </p>
                                </div>

                                {isAlreadyAdded ? (
                                  <span className="text-[10px] text-emerald-400 font-bold px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 shrink-0 flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>In Map</span>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleAddBranch(sub, selectedNode)}
                                    className="px-2.5 py-1 rounded-lg bg-purple-600/15 hover:bg-purple-600 text-purple-600 hover:text-white dark:text-purple-300 font-bold text-[10px] border border-purple-500/30 transition-all shrink-0 flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Branch</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
                Click any concept in the knowledge map to open deep AI explanations, examples,
                comparisons, and quizzes.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

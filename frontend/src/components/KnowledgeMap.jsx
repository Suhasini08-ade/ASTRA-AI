import React, { useState } from 'react';
import { generateDeepDiveMap, requestDeepDiveAction } from '../services/aiService';
import { useData } from '../context/DataContext';
import { 
  Brain as LuBrain, 
  Search as LuSearch, 
  Sparkles as LuSparkles, 
  CheckCircle2 as LuCheckCircle2, 
  FileText as LuFileText, 
  SquareCheck as LuCheckSquare, 
  BellRing as LuBellRing, 
  Layers as LuLayers, 
  Award as LuAward,
  HelpCircle as LuHelpCircle
} from 'lucide-react';

export default function KnowledgeMap() {
  const { addNote, addTask, addReminder } = useData();
  const [topic, setTopic] = useState('Artificial Neural Networks');
  const [data, setData] = useState({
    id: null,
    topic: 'Artificial Neural Networks',
    nodes: [
      { id: '1', label: 'Artificial Neural Networks', type: 'root', description: 'Computing systems inspired by the biological neural networks that constitute animal brains.' },
      { id: '2', label: 'Perceptrons & Activation', type: 'concept', description: 'Single-layer neural networks using Sigmoid, ReLU, or Softmax activation functions.' },
      { id: '3', label: 'Backpropagation Algorithm', type: 'concept', description: 'Gradient descent optimization technique using chain rule calculus for weight adjustments.' },
      { id: '4', label: 'Deep Architectures (CNN/RNN)', type: 'concept', description: 'Convolutional layers for computer vision and Recurrent networks for sequential language processing.' },
      { id: '5', label: 'Transformer Models', type: 'concept', description: 'Self-attention mechanism architectures powering modern Large Language Models.' }
    ],
    challenges: [
      { id: 'q1', question: 'Which activation function is most widely used in deep neural network hidden layers?', options: ['A) Sigmoid', 'B) ReLU', 'C) Linear', 'D) Step'], answer: 1 }
    ],
    progress: 80
  });

  const [selectedNode, setSelectedNode] = useState(data.nodes[0]);
  const [loading, setLoading] = useState(false);
  const [convertStatus, setConvertStatus] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  const handleExplainConcept = async () => {
    if (!selectedNode || !data.id) {
      alert('Search and generate a live map session first to ask AI for deep concept explanations.');
      return;
    }
    setIsExplaining(true);
    try {
      const res = await requestDeepDiveAction(data.id, selectedNode.label, 'explain');
      if (res && res.answer) {
        const updatedDesc = res.answer;
        setSelectedNode((prev) => ({ ...prev, description: updatedDesc }));
        setData((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, description: updatedDesc } : n)),
        }));
      }
    } catch (err) {
      console.warn('Explain concept failed:', err);
    } finally {
      setIsExplaining(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedNode || !data.id) {
      alert('Search and generate a live map session first to generate tailored concept quizzes.');
      return;
    }
    setIsGeneratingQuiz(true);
    try {
      const res = await requestDeepDiveAction(data.id, selectedNode.label, 'challenge');
      if (res && res.question && Array.isArray(res.options)) {
        const newChallenge = {
          id: `q-${Date.now()}`,
          question: res.question,
          options: res.options,
          answer: res.answer ?? 0,
          explanation: res.explanation || '',
        };
        setData((prev) => ({
          ...prev,
          challenges: [newChallenge, ...prev.challenges],
        }));
      }
    } catch (err) {
      console.warn('Generate quiz failed:', err);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    try {
      const res = await generateDeepDiveMap(topic);
      setData(res);
      setSelectedNode(res.nodes[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsNote = () => {
    if (!selectedNode) return;
    addNote({
      title: `Deep Dive: ${selectedNode.label}`,
      content: `Topic: ${data.topic}\n\nConcept: ${selectedNode.label}\nDescription: ${selectedNode.description}\n\nExplored via ASTRA Deep Dive Engine.`,
      category: 'Deep Dive'
    });
    setConvertStatus('Saved to Notes!');
    setTimeout(() => setConvertStatus(''), 2500);
  };

  const handleSaveAsTask = () => {
    if (!selectedNode) return;
    addTask({
      title: `Study Concept: ${selectedNode.label}`,
      description: selectedNode.description,
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'High',
      status: 'Pending'
    });
    setConvertStatus('Added to Tasks!');
    setTimeout(() => setConvertStatus(''), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <LuBrain className="w-6 h-6 text-purple-500" />
            <span>AI Deep Dive Knowledge Map</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Explore complex topics into visual node structures</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter any topic (e.g. Quantum Computing)..."
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <LuSearch className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold text-xs rounded-xl shadow-md shadow-purple-900/20 flex items-center gap-1.5"
          >
            <LuSparkles className="w-4 h-4" />
            <span>Explore</span>
          </button>
        </form>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs animate-pulse">
          Generating visual knowledge map and concept nodes...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Interactive Knowledge Nodes Graph */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-between min-h-[420px]">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <LuLayers className="w-4 h-4 text-purple-500" />
                  Visual Node Graph: {data.topic}
                </span>

                {/* Understanding Progress Bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-400">Mastery:</span>
                  <div className="w-24 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full" style={{ width: `${data.progress}%` }} />
                  </div>
                  <span className="text-xs font-bold text-cyan-400">{data.progress}%</span>
                </div>
              </div>

              {/* Node Graph Diagram Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                {data.nodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-purple-500 shadow-lg shadow-purple-900/20 scale-[1.02]'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-purple-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{node.label}</span>
                        {node.type === 'root' && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold">
                            Root
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{node.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Convertible Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Convert selected concept to:</span>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveAsNote}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 hover:text-white text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <LuFileText className="w-3.5 h-3.5 text-purple-500" />
                  <span>Save Note</span>
                </button>
                <button
                  onClick={handleSaveAsTask}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-cyan-600 hover:text-white text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <LuCheckSquare className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Create Task</span>
                </button>
              </div>
            </div>

            {convertStatus && (
              <div className="mt-2 text-center text-xs font-bold text-emerald-400 animate-pulse">
                {convertStatus}
              </div>
            )}
          </div>

          {/* Node Details & Quiz Challenge */}
          <div className="space-y-6">
            {/* Selected Node Details Card */}
            {selectedNode && (
              <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-500">Selected Concept</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                    {selectedNode.type || 'concept'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{selectedNode.label}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedNode.description}
                </p>

                {/* AI Interactive Deep Dive Tools */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-2">
                  <button
                    onClick={handleExplainConcept}
                    disabled={isExplaining}
                    className="flex-1 min-w-[120px] px-3 py-1.5 rounded-xl bg-purple-600/10 hover:bg-purple-600 text-purple-600 hover:text-white dark:text-purple-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <LuSparkles className="w-3.5 h-3.5" />
                    <span>{isExplaining ? 'Explaining...' : 'Explain in Depth'}</span>
                  </button>

                  <button
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz}
                    className="flex-1 min-w-[120px] px-3 py-1.5 rounded-xl bg-cyan-600/10 hover:bg-cyan-600 text-cyan-600 hover:text-white dark:text-cyan-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <LuAward className="w-3.5 h-3.5" />
                    <span>{isGeneratingQuiz ? 'Creating Quiz...' : 'Create AI Quiz'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* AI Knowledge Challenge Quiz */}
            <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <LuAward className="w-4 h-4" />
                AI Knowledge Challenge
              </h3>

              {data.challenges.map((c) => (
                <div key={c.id} className="space-y-2 text-xs">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{c.question}</p>
                  <div className="space-y-1.5">
                    {c.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => alert(i === c.answer ? 'Correct answer! Great job!' : 'Try again!')}
                        className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-purple-600/20 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700/60"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

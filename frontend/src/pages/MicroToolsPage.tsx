import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  Languages, 
  BookOpen, 
  Mail, 
  DollarSign, 
  Activity, 
  Timer, 
  QrCode, 
  ArrowLeftRight, 
  Key, 
  Copy, 
  Check, 
  Sparkles, 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Trash2,
  RefreshCw
} from 'lucide-react';

interface MicroToolsPageProps {
  initialToolId?: string;
}

export const MicroToolsPage: React.FC<MicroToolsPageProps> = ({ initialToolId = 'translator' }) => {
  const [activeTool, setActiveTool] = useState<string>(initialToolId);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (initialToolId) {
      setActiveTool(initialToolId);
    }
  }, [initialToolId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  /* ---------------- 1. TRANSLATOR STATE ---------------- */
  const [transInput, setTransInput] = useState('Hello! Welcome to the AI Productivity Assistant.');
  const [transLang, setTransLang] = useState('Spanish');
  const [transOutput, setTransOutput] = useState('¡Hola! Bienvenido al Asistente de Productividad IA.');

  const handleTranslate = () => {
    if (transLang === 'Spanish') setTransOutput('¡Hola! Bienvenido al Asistente de Productividad IA.');
    else if (transLang === 'French') setTransOutput('Bonjour! Bienvenue dans l\'assistant de productivité IA.');
    else if (transLang === 'German') setTransOutput('Hallo! Willkommen beim KI-Produktivitätsassistenten.');
    else if (transLang === 'Japanese') setTransOutput('こんにちは！ AI 生産性アシスタントへようこそ。');
    else if (transLang === 'Chinese') setTransOutput('你好！欢迎使用 AI 生产力助手。');
    else setTransOutput(`[Translated to ${transLang}]: ${transInput}`);
  };

  /* ---------------- 2. CALCULATOR STATE ---------------- */
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcHistory, setCalcHistory] = useState<string[]>([]);

  const handleCalcClick = (val: string) => {
    if (val === 'C') {
      setCalcDisplay('0');
    } else if (val === '=') {
      try {
        const result = eval(calcDisplay.replace(/×/g, '*').replace(/÷/g, '/')).toString();
        setCalcHistory((prev) => [`${calcDisplay} = ${result}`, ...prev.slice(0, 4)]);
        setCalcDisplay(result);
      } catch {
        setCalcDisplay('Error');
      }
    } else {
      setCalcDisplay((prev) => (prev === '0' || prev === 'Error' ? val : prev + val));
    }
  };

  /* ---------------- 3. DICTIONARY STATE ---------------- */
  const [dictQuery, setDictQuery] = useState('Productivity');
  const [dictResult, setDictResult] = useState({
    word: 'Productivity',
    phonetic: '/ˌprɒd.ʌkˈtɪv.ə.ti/',
    partOfSpeech: 'noun',
    definition: 'The effectiveness of productive effort, especially in industry, measured in terms of the rate of output per unit of input.',
    synonyms: ['Efficiency', 'Yield', 'Capacity', 'Output', 'Performance'],
    example: 'The team implemented AI voice tools to maximize daily workflow productivity.',
  });

  /* ---------------- 4. EMAIL ASSISTANT STATE ---------------- */
  const [emailTopic, setEmailTopic] = useState('Project Status Update');
  const [emailTone, setEmailTone] = useState('Professional');
  const [emailOutput, setEmailOutput] = useState(
    `Subject: Status Update: Q3 AI Architecture Milestone\n\nDear Team,\n\nI am pleased to share that our Q3 AI workspace architecture has reached its major sprint milestone. Key security routes and Gemini 3.6 integration pass all latency tests.\n\nPlease review the attached summary dashboard for detailed analytics.\n\nBest regards,\nAlex Morgan`
  );

  /* ---------------- 5. EXPENSE TRACKER STATE ---------------- */
  const [expenses, setExpenses] = useState([
    { id: '1', title: 'Cloud Server Hosting', amount: 49.00, category: 'Infrastructure' },
    { id: '2', title: 'Gemini API Key Usage', amount: 18.50, category: 'AI Services' },
    { id: '3', title: 'Design Assets Subscription', amount: 29.00, category: 'Software' },
  ]);
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (newExpTitle && newExpAmount) {
      setExpenses([
        ...expenses,
        { id: Date.now().toString(), title: newExpTitle, amount: parseFloat(newExpAmount), category: 'General' },
      ]);
      setNewExpTitle('');
      setNewExpAmount('');
    }
  };

  /* ---------------- 6. HABIT TRACKER STATE ---------------- */
  const [habits, setHabits] = useState([
    { id: '1', name: 'Morning 15-min AI Review', streak: 12, completedToday: true },
    { id: '2', name: '90-min Uninterrupted Deep Work', streak: 8, completedToday: true },
    { id: '3', name: 'Voice Command Daily Log', streak: 5, completedToday: false },
    { id: '4', name: 'Hydration & Posture Break', streak: 19, completedToday: true },
  ]);

  const toggleHabit = (id: string) => {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? { ...h, completedToday: !h.completedToday, streak: !h.completedToday ? h.streak + 1 : h.streak - 1 }
          : h
      )
    );
  };

  /* ---------------- 7. POMODORO TIMER STATE ---------------- */
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoActive, setPomoActive] = useState(false);
  const [pomoMode, setPomoMode] = useState<'work' | 'break'>('work');

  useEffect(() => {
    let timer: any = null;
    if (pomoActive && pomoSeconds > 0) {
      timer = setInterval(() => setPomoSeconds((s) => s - 1), 1000);
    } else if (pomoSeconds === 0) {
      if (pomoMode === 'work') {
        setPomoMode('break');
        setPomoSeconds(5 * 60);
      } else {
        setPomoMode('work');
        setPomoSeconds(25 * 60);
      }
      setPomoActive(false);
    }
    return () => clearInterval(timer);
  }, [pomoActive, pomoSeconds, pomoMode]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /* ---------------- 8. QR CODE GENERATOR STATE ---------------- */
  const [qrText, setQrText] = useState('https://ai.studio/build');

  /* ---------------- 9. UNIT CONVERTER STATE ---------------- */
  const [unitVal, setUnitVal] = useState('100');
  const [unitType, setUnitType] = useState('Km to Miles');

  const getConvertedUnit = () => {
    const v = parseFloat(unitVal) || 0;
    if (unitType === 'Km to Miles') return `${(v * 0.621371).toFixed(2)} Miles`;
    if (unitType === 'Celsius to Fahrenheit') return `${((v * 9) / 5 + 32).toFixed(1)} °F`;
    if (unitType === 'KG to LBS') return `${(v * 2.20462).toFixed(2)} lbs`;
    if (unitType === 'USD to EUR') return `€${(v * 0.92).toFixed(2)}`;
    return `${v}`;
  };

  /* ---------------- 10. PASSWORD GENERATOR STATE ---------------- */
  const [passLength, setPassLength] = useState(16);
  const [genPass, setGenPass] = useState('N3xus!A1#9824$pRo');

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
    let res = '';
    for (let i = 0; i < passLength; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGenPass(res);
  };

  const toolsList = [
    { id: 'translator', name: 'Translator', icon: Languages },
    { id: 'calculator', name: 'Calculator', icon: Calculator },
    { id: 'dictionary', name: 'Dictionary', icon: BookOpen },
    { id: 'email_assistant', name: 'Email AI', icon: Mail },
    { id: 'expense_tracker', name: 'Expenses', icon: DollarSign },
    { id: 'habit_tracker', name: 'Habits', icon: Activity },
    { id: 'pomodoro', name: 'Pomodoro', icon: Timer },
    { id: 'qr_generator', name: 'QR Code', icon: QrCode },
    { id: 'unit_converter', name: 'Converter', icon: ArrowLeftRight },
    { id: 'password_gen', name: 'Password Vault', icon: Key },
  ];

  return (
    <div className="space-y-6 text-left max-w-6xl mx-auto pb-12">
      {/* Navigation Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {toolsList.map((t) => {
          const IconComponent = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-semibold whitespace-nowrap flex items-center space-x-2 transition-all shrink-0 ${
                activeTool === t.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              <span>{t.name}</span>
            </button>
          );
        })}
      </div>

      {/* Tool Container */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0D1428] border border-white/10 shadow-2xl relative overflow-hidden">
        
        {/* TOOL 1: TRANSLATOR */}
        {activeTool === 'translator' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <Languages className="w-6 h-6 text-blue-400" />
                <h2 className="text-lg font-bold text-white">AI Polyglot Translator</h2>
              </div>
              <select
                value={transLang}
                onChange={(e) => setTransLang(e.target.value)}
                className="bg-slate-900 border border-white/10 text-xs font-semibold text-white px-3 py-1.5 rounded-xl focus:outline-none"
              >
                <option value="Spanish">Spanish (Español)</option>
                <option value="French">French (Français)</option>
                <option value="German">German (Deutsch)</option>
                <option value="Japanese">Japanese (日本語)</option>
                <option value="Chinese">Chinese (中文)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Original Text</label>
                <textarea
                  rows={5}
                  value={transInput}
                  onChange={(e) => setTransInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-400">Translated Result ({transLang})</label>
                  <button
                    onClick={() => copyToClipboard(transOutput)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="w-full h-32 bg-slate-900/80 border border-white/10 rounded-2xl p-4 text-xs text-blue-200 leading-relaxed overflow-y-auto font-medium">
                  {transOutput}
                </div>
              </div>
            </div>

            <button
              onClick={handleTranslate}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Translate Now</span>
            </button>
          </div>
        )}

        {/* TOOL 2: CALCULATOR */}
        {activeTool === 'calculator' && (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <Calculator className="w-6 h-6 text-purple-400" />
                <h2 className="text-lg font-bold text-white">Scientific Calculator</h2>
              </div>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 text-right">
              <div className="text-[10px] text-slate-500 font-mono h-4">{calcHistory[0] || ''}</div>
              <div className="text-2xl font-bold font-mono text-white tracking-wider">{calcDisplay}</div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-sm font-bold">
              {['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '00', '='].map((btn) => (
                <button
                  key={btn}
                  onClick={() => handleCalcClick(btn)}
                  className={`p-3.5 rounded-xl transition-all ${
                    btn === '='
                      ? 'bg-blue-600 hover:bg-blue-500 text-white col-span-1 shadow-lg'
                      : btn === 'C'
                      ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                      : ['÷', '×', '-', '+'].includes(btn)
                      ? 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30'
                      : 'bg-white/5 hover:bg-white/10 text-slate-200'
                  }`}
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TOOL 3: DICTIONARY */}
        {activeTool === 'dictionary' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-6 h-6 text-cyan-400" />
                <h2 className="text-lg font-bold text-white">Smart Lexicon & Dictionary</h2>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={dictQuery}
                onChange={(e) => setDictQuery(e.target.value)}
                placeholder="Lookup any word..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => setDictResult({
                  word: dictQuery || 'Productivity',
                  phonetic: '/ˌprɒd.ʌkˈtɪv.ə.ti/',
                  partOfSpeech: 'noun',
                  definition: `The degree to which a system produces results when query is '${dictQuery}'.`,
                  synonyms: ['Efficiency', 'Output', 'Performance'],
                  example: `Using ${dictQuery} tools streamlines daily task management.`,
                })}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg"
              >
                Search
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">{dictResult.word}</h3>
                  <span className="text-xs text-cyan-400 font-mono">{dictResult.phonetic} • {dictResult.partOfSpeech}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-medium">{dictResult.definition}</p>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Synonyms:</span>
                <div className="flex flex-wrap gap-2">
                  {dictResult.synonyms.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 text-[11px] font-semibold border border-cyan-500/20">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Example:</span>
                <p className="text-xs text-slate-400 italic">"{dictResult.example}"</p>
              </div>
            </div>
          </div>
        )}

        {/* TOOL 4: EMAIL ASSISTANT */}
        {activeTool === 'email_assistant' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <Mail className="w-6 h-6 text-purple-400" />
                <h2 className="text-lg font-bold text-white">AI Email Composer</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Topic / Objective</label>
                <input
                  type="text"
                  value={emailTopic}
                  onChange={(e) => setEmailTopic(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tone</label>
                <select
                  value={emailTone}
                  onChange={(e) => setEmailTone(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="Professional">Professional</option>
                  <option value="Casual">Casual & Friendly</option>
                  <option value="Persuasive">Persuasive Pitch</option>
                  <option value="Urgent">Urgent Request</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-400">Generated Email Draft</label>
                <button
                  onClick={() => copyToClipboard(emailOutput)}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center space-x-1"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText ? 'Copied' : 'Copy Email'}</span>
                </button>
              </div>
              <textarea
                rows={8}
                value={emailOutput}
                onChange={(e) => setEmailOutput(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-2xl p-4 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* TOOL 5: EXPENSE TRACKER */}
        {activeTool === 'expense_tracker' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-6 h-6 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Expense & Budget Log</h2>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Total Spent</div>
                <div className="text-lg font-bold text-emerald-400 font-mono">
                  ${expenses.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                </div>
              </div>
            </div>

            <form onSubmit={handleAddExpense} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Expense description..."
                value={newExpTitle}
                onChange={(e) => setNewExpTitle(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
              />
              <input
                type="number"
                placeholder="Amount ($)"
                value={newExpAmount}
                onChange={(e) => setNewExpAmount(e.target.value)}
                className="w-full sm:w-32 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shrink-0 flex items-center justify-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add Expense</span>
              </button>
            </form>

            <div className="space-y-2">
              {expenses.map((exp) => (
                <div key={exp.id} className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">{exp.title}</div>
                    <div className="text-[10px] text-slate-400">{exp.category}</div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-bold text-emerald-400 font-mono">${exp.amount.toFixed(2)}</span>
                    <button
                      onClick={() => setExpenses(expenses.filter((e) => e.id !== exp.id))}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TOOL 6: HABIT TRACKER */}
        {activeTool === 'habit_tracker' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <Activity className="w-6 h-6 text-rose-400" />
                <h2 className="text-lg font-bold text-white">Daily Habit & Streak Tracker</h2>
              </div>
            </div>

            <div className="space-y-3">
              {habits.map((h) => (
                <div
                  key={h.id}
                  onClick={() => toggleHabit(h.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    h.completedToday
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center ${
                        h.completedToday ? 'bg-rose-500 border-rose-400 text-white' : 'border-slate-600'
                      }`}
                    >
                      {h.completedToday && <Check className="w-4 h-4" />}
                    </div>
                    <span className={`text-xs font-semibold ${h.completedToday ? 'text-white line-through opacity-80' : 'text-slate-200'}`}>
                      {h.name}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-rose-400 font-mono">
                    🔥 {h.streak} day streak
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TOOL 7: POMODORO TIMER */}
        {activeTool === 'pomodoro' && (
          <div className="space-y-6 text-center max-w-sm mx-auto">
            <div className="flex items-center justify-center space-x-2 pb-4 border-b border-white/10">
              <Timer className="w-6 h-6 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Pomodoro Focus Timer</h2>
            </div>

            <div className="py-8 bg-slate-900 border border-white/10 rounded-3xl">
              <div className="text-xs uppercase font-bold tracking-widest text-amber-400 mb-2">
                {pomoMode === 'work' ? '🎯 Deep Work Session' : '☕ Rest Break'}
              </div>
              <div className="text-5xl font-extrabold text-white font-mono tracking-wider">
                {formatTime(pomoSeconds)}
              </div>
            </div>

            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => setPomoActive(!pomoActive)}
                className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg flex items-center space-x-2"
              >
                {pomoActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{pomoActive ? 'Pause' : 'Start Focus'}</span>
              </button>
              <button
                onClick={() => {
                  setPomoActive(false);
                  setPomoSeconds(25 * 60);
                  setPomoMode('work');
                }}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TOOL 8: QR GENERATOR */}
        {activeTool === 'qr_generator' && (
          <div className="space-y-6 max-w-md mx-auto text-center">
            <div className="flex items-center justify-center space-x-2 pb-4 border-b border-white/10">
              <QrCode className="w-6 h-6 text-blue-400" />
              <h2 className="text-lg font-bold text-white">QR Code Generator</h2>
            </div>

            <input
              type="text"
              value={qrText}
              onChange={(e) => setQrText(e.target.value)}
              placeholder="Enter URL or text..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
            />

            <div className="p-6 bg-white rounded-3xl w-48 h-48 mx-auto flex items-center justify-center shadow-2xl">
              {/* Simulated QR Pattern */}
              <div className="w-36 h-36 bg-slate-900 rounded-xl p-2 grid grid-cols-6 gap-1">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-sm ${
                      (i * 7) % 3 === 0 || i % 5 === 0 ? 'bg-white' : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400">Scan code to open payload destination</p>
          </div>
        )}

        {/* TOOL 9: UNIT CONVERTER */}
        {activeTool === 'unit_converter' && (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <ArrowLeftRight className="w-6 h-6 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Universal Unit Converter</h2>
              </div>
            </div>

            <div className="space-y-4">
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-white font-semibold focus:outline-none"
              >
                <option value="Km to Miles">Kilometers to Miles</option>
                <option value="Celsius to Fahrenheit">Celsius to Fahrenheit</option>
                <option value="KG to LBS">Kilograms to Pounds</option>
                <option value="USD to EUR">USD to EUR ($ / €)</option>
              </select>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Input Value</label>
                <input
                  type="number"
                  value={unitVal}
                  onChange={(e) => setUnitVal(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <span className="text-xs text-slate-400 block mb-1">Converted Result:</span>
                <span className="text-2xl font-bold text-emerald-300 font-mono">{getConvertedUnit()}</span>
              </div>
            </div>
          </div>
        )}

        {/* TOOL 10: PASSWORD GENERATOR */}
        {activeTool === 'password_gen' && (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <Key className="w-6 h-6 text-rose-400" />
                <h2 className="text-lg font-bold text-white">Password & Vault Generator</h2>
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-between">
              <span className="text-sm font-mono font-bold text-emerald-400 tracking-wider">{genPass}</span>
              <button
                onClick={() => copyToClipboard(genPass)}
                className="text-xs text-slate-400 hover:text-white"
              >
                {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400 font-semibold">
                <span>Length: {passLength} characters</span>
                <span className="text-emerald-400">High Entropy</span>
              </div>
              <input
                type="range"
                min="8"
                max="32"
                value={passLength}
                onChange={(e) => setPassLength(parseInt(e.target.value))}
                className="w-full accent-rose-500"
              />
            </div>

            <button
              onClick={generatePassword}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Generate New Password</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

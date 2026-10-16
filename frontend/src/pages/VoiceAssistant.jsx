import React, { useState, useEffect } from 'react';
import JarvesRobot from '../components/JarvesRobot';
import { apiSendVoiceCommand, apiGetSettings, apiUpdateSettings } from '../services/api';
import {
  speakText,
  isVoiceMuted,
  setVoiceMuted,
  getVoiceGender,
  setVoiceGender,
  getVoiceSpeed,
  getLoadedVoices,
  cleanTextForSpeech,
  stopSpeech,
} from '../services/voiceService';
import { useData } from '../context/DataContext';
import MarkdownRenderer from '../components/MarkdownRenderer';
import {
  Mic as LuMic,
  Volume2 as LuVolume2,
  VolumeX as LuVolumeX,
  Sparkles as LuSparkles,
  User as LuUser,
  Send as LuSend,
  AlertCircle as LuAlertCircle,
  Square as LuSquare,
} from 'lucide-react';

export default function VoiceAssistant() {
  const { refreshData } = useData();
  const [orbState, setOrbState] = useState('idle'); // idle, listening, thinking, speaking
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [voiceGender, setVoiceGenderState] = useState(() => getVoiceGender());
  const [muted, setMuted] = useState(() => isVoiceMuted());
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [recognitionInstance, setRecognitionInstance] = useState(null);

  useEffect(() => {
    // Pre-warm voices asynchronously on mount so voices are cached immediately
    getLoadedVoices().catch(() => {});

    // Sync persisted preferences from backend if available
    async function syncBackendSettings() {
      try {
        const s = await apiGetSettings();
        if (s?.voiceGender) {
          setVoiceGenderState(s.voiceGender);
          setVoiceGender(s.voiceGender);
        }
        if (s?.voiceMuted !== undefined) {
          setMuted(s.voiceMuted);
          setVoiceMuted(s.voiceMuted);
        }
      } catch {}
    }
    syncBackendSettings();

    const handleVoiceChange = (e) => {
      if (e.detail?.gender) {
        setVoiceGenderState(e.detail.gender);
      }
    };
    const handleMuteChange = (e) => {
      if (e.detail?.muted !== undefined) {
        setMuted(e.detail.muted);
      }
    };

    window.addEventListener('astra_voice_gender_changed', handleVoiceChange);
    window.addEventListener('astra_voice_muted_changed', handleMuteChange);

    return () => {
      stopSpeech();
      window.removeEventListener('astra_voice_gender_changed', handleVoiceChange);
      window.removeEventListener('astra_voice_muted_changed', handleMuteChange);
    };
  }, []);

  const sampleCommands = [
    "Plan my day",
    "Create a task to finish DBMS assignment tomorrow at 6 PM",
    "Show my pending tasks",
    "Mark my DBMS assignment as completed",
    "What is the weather in Kolhapur?",
    "Open Notepad",
    "Open Calculator",
    "Open Chrome",
    "Open Visual Studio Code",
    "Open YouTube in Chrome",
    "Open my Downloads folder"
  ];

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    setVoiceMuted(nextMuted);
    if (nextMuted) {
      stopSpeech();
    }
    apiUpdateSettings({ voiceMuted: nextMuted }).catch(() => {});
  };

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    setMousePos({
      x: clientX / innerWidth,
      y: clientY / innerHeight
    });
  };

  const handleVoiceGenderChange = (gender) => {
    setVoiceGenderState(gender);
    setVoiceGender(gender);
    apiUpdateSettings({ voiceGender: gender }).catch(() => {});
  };

  const stopActiveSpeechOrListening = () => {
    stopSpeech();
    if (recognitionInstance) {
      try {
        recognitionInstance.abort();
      } catch (err) {
        // Ignore abort errors
      }
    }
    setOrbState('idle');
  };

  const handleRobotClick = async () => {
    if (orbState === 'speaking' || orbState === 'listening') {
      stopActiveSpeechOrListening();
      return;
    }

    if (orbState === 'idle') {
      setErrorMsg('');
      setOrbState('listening');
      setTranscript('');
      setResponse('');

      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = async (event) => {
          const spokenText = event.results[0]?.[0]?.transcript;
          if (spokenText && spokenText.trim()) {
            setTranscript(spokenText);
            processVoiceQuery(spokenText);
          } else {
            setOrbState('idle');
          }
        };

        recognition.onerror = (event) => {
          console.warn('Speech recognition event error:', event?.error);
          setOrbState('idle');
          if (event.error === 'not-allowed') {
            setErrorMsg('Microphone access was denied. Please check your browser microphone permissions or type your command below.');
          } else if (event.error === 'no-speech') {
            setErrorMsg('No speech was detected. Click the robot to try again or type your command below.');
          } else {
            setErrorMsg(`Speech recognition ended (${event.error || 'unknown'}). You can also type commands below.`);
          }
        };

        recognition.onend = () => {
          // If we are still in listening state when ended without a result
          setOrbState((prev) => (prev === 'listening' ? 'idle' : prev));
        };

        setRecognitionInstance(recognition);
        try {
          recognition.start();
        } catch (err) {
          console.error('Failed to start speech recognition:', err);
          setOrbState('idle');
          setErrorMsg('Failed to initialize microphone. Please type your command below.');
        }
      } else {
        setOrbState('idle');
        setErrorMsg('Speech recognition is not supported in this browser. Please use Google Chrome, Edge, or type your command below.');
      }
    }
  };

  const processVoiceQuery = async (queryText) => {
    const text = (queryText || '').trim();
    if (!text) return;

    setErrorMsg('');
    setTranscript(text);
    setOrbState('thinking');

    try {
      const res = await apiSendVoiceCommand(text);
      const fullReply = typeof res === 'string' ? res : (res?.reply || "Command executed successfully.");
      const spokenSummary = (typeof res === 'object' && res?.spoken_summary)
        ? res.spoken_summary
        : cleanTextForSpeech(fullReply) || "Command executed successfully.";

      // Display the complete plan / response in UI
      setResponse(fullReply);
      setOrbState('speaking');

      // Refresh data so any newly created/modified tasks, reminders, etc. appear in UI
      if (typeof refreshData === 'function') {
        refreshData();
      }

      // Speak concise summary using selected voice gender and speed
      speakText(spokenSummary, voiceGender, getVoiceSpeed(), () => {
        setOrbState('idle');
      });
    } catch (e) {
      console.error('Error processing voice command:', e);
      const rawErr = e.message || "I encountered an error executing that voice command.";
      const errDetail = cleanTextForSpeech(rawErr) || "I encountered an error executing that voice command.";
      setErrorMsg(errDetail);
      setResponse(errDetail);
      setOrbState('idle');
      speakText(errDetail, voiceGender, getVoiceSpeed(), () => {
        setOrbState('idle');
      });
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const query = manualInput;
    setManualInput('');
    processVoiceQuery(query);
  };

  return (
    <div onMouseMove={handleMouseMove} className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <LuMic className="w-6 h-6 text-purple-500" />
            <span>ASTRA Voice Assistant</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Interactive AI Robot Character with multi-voice synthesis (Female & Male voices)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mute Toggle Button */}
          <button
            onClick={toggleMute}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              muted
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}
            title={muted ? 'Unmute ASTRA Voice' : 'Mute ASTRA Voice'}
          >
            {muted ? <LuVolumeX className="w-4 h-4" /> : <LuVolume2 className="w-4 h-4 animate-pulse" />}
            <span>{muted ? 'Muted' : 'Sound On'}</span>
          </button>

          {/* Voice Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <span className="px-2 text-slate-400 font-semibold">Voice:</span>
            {['female', 'male', 'system'].map((g) => (
              <button
                key={g}
                onClick={() => handleVoiceGenderChange(g)}
                className={`px-3 py-1 rounded-lg font-semibold uppercase text-[10px] tracking-wider transition-all ${
                  voiceGender === g
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Central Robot Container */}
      <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-8 relative overflow-hidden flex flex-col items-center">
        <button
          onClick={handleRobotClick}
          className="focus:outline-none transition-transform hover:scale-[1.02] cursor-pointer"
          title="Click robot to toggle voice input"
        >
          <JarvesRobot state={orbState} cursorPosition={mousePos} />
        </button>

        {/* Status indicator button */}
        <div className="mt-4 flex items-center gap-2">
          {orbState === 'idle' && (
            <button
              onClick={handleRobotClick}
              className="px-4 py-2 rounded-full bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <LuMic className="w-3.5 h-3.5" />
              <span>Click robot or here to speak</span>
            </button>
          )}
          {orbState === 'listening' && (
            <button
              onClick={stopActiveSpeechOrListening}
              className="px-4 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer animate-pulse"
            >
              <LuSquare className="w-3.5 h-3.5 fill-current" />
              <span>Listening... Click to cancel</span>
            </button>
          )}
          {orbState === 'thinking' && (
            <div className="px-4 py-2 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-semibold flex items-center gap-2">
              <LuSparkles className="w-3.5 h-3.5 animate-spin" />
              <span>Processing command...</span>
            </div>
          )}
          {orbState === 'speaking' && (
            <button
              onClick={stopActiveSpeechOrListening}
              className="px-4 py-2 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
            >
              <LuSquare className="w-3.5 h-3.5 fill-current" />
              <span>Speaking... Click to stop</span>
            </button>
          )}
        </div>

        {/* Live Speech Transcript & AI Response & Errors */}
        <div className="mt-6 w-full max-w-xl space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-start gap-2.5 text-amber-600 dark:text-amber-400">
              <LuAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {transcript && (
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs">
              <span className="font-bold text-purple-400 uppercase tracking-wider block mb-1">Spoken Input:</span>
              <p className="text-slate-800 dark:text-slate-200 font-medium">"{transcript}"</p>
            </div>
          )}

          {response && (
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs space-y-2">
              <span className="font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                <LuSparkles className="w-3.5 h-3.5" />
                ASTRA Response ({voiceGender} voice):
              </span>
              <div className="text-slate-800 dark:text-slate-200 leading-relaxed">
                <MarkdownRenderer content={response} />
              </div>
            </div>
          )}

          {/* Fallback Text Command Input Form */}
          <form onSubmit={handleManualSubmit} className="pt-2 flex items-center gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Or type a voice command (e.g. 'Open Notepad', 'What is the weather in Kolhapur?')"
              className="flex-1 px-4 py-2.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!manualInput.trim() || orbState === 'thinking'}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LuSend className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>

          {/* Quick Command Pills */}
          <div className="pt-1">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Try saying or clicking:</p>
            <div className="flex flex-wrap gap-1.5">
              {sampleCommands.map((cmd, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => processVoiceQuery(cmd)}
                  className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-100 dark:bg-slate-800/80 hover:bg-purple-600/10 hover:text-purple-500 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 transition-colors text-left"
                >
                  "{cmd}"
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

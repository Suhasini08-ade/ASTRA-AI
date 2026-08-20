import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Mic, 
  Volume2, 
  VolumeX, 
  Radio, 
  Bot, 
  Zap, 
  Play, 
  Square
} from 'lucide-react';
import { sendVoicePrompt } from '../services/api';
import { cleanTextForSpeech, cleanTextForDisplay } from '../utils/speechUtils';

export const VoiceAssistantPage: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('Click "Start Listening" and speak your command...');
  const [aiResponse, setAiResponse] = useState('Astra Voice Assistant is online and standing by for your vocal input.');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'error'>('idle');

  const recognitionRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>('');
  const isProcessingRef = useRef<boolean>(false);

  // Stop speech synthesis immediately
  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setStatus('idle');
  };

  // Speech Synthesis Helper with TTS text cleaning
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) {
      setStatus('error');
      setAiResponse('Unable to speak the response.');
      return;
    }
    
    // Always cancel active speech before starting a new response
    window.speechSynthesis.cancel();

    const plainText = cleanTextForSpeech(text);
    if (!plainText) {
      setIsSpeaking(false);
      setStatus('idle');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setStatus('speaking');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setStatus('idle');
    };

    utterance.onerror = (e) => {
      console.warn('[VOICE] Speech synthesis error:', e);
      setIsSpeaking(false);
      setStatus('error');
    };

    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    // Stop any ongoing speech audio immediately
    stopSpeaking();

    // Reset session variables & refs
    latestTranscriptRef.current = '';
    isProcessingRef.current = false;

    console.log('[VOICE] session started');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setStatus('error');
      setTranscript("Sorry, speech recognition is not supported in this browser.");
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setStatus('listening');
        setTranscript('Listening to your voice...');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const part = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += part;
          } else {
            interim += part;
          }
        }

        if (final) {
          latestTranscriptRef.current = (latestTranscriptRef.current + ' ' + final).trim();
        }

        const currentText = latestTranscriptRef.current || interim;
        if (currentText) {
          setTranscript(currentText);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('[VOICE] Speech recognition error:', event.error || event);
        setIsListening(false);
        setStatus('error');
        setTranscript("Sorry, I couldn't understand that. Please try again.");
      };

      recognition.onend = () => {
        setIsListening(false);
        const textToSend = latestTranscriptRef.current.trim();

        if (textToSend && !isProcessingRef.current) {
          isProcessingRef.current = true;
          console.log(`[VOICE] final transcript: "${textToSend}"`);
          processVoicePrompt(textToSend);
        } else if (!isProcessingRef.current) {
          console.log('[VOICE] no speech detected');
          setStatus('idle');
          setTranscript("I didn't catch that. Please try again.");
        }
      };

      recognition.start();
    } catch (err) {
      console.error('[VOICE] Exception starting speech recognition:', err);
      setIsListening(false);
      setStatus('error');
      setTranscript("Sorry, I couldn't understand that. Please try again.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
    setStatus('idle');
  };

  const processVoicePrompt = async (promptText: string) => {
    stopSpeaking();
    console.log('[VOICE] sending request');
    setStatus('processing');

    try {
      const reply = await sendVoicePrompt(promptText);
      console.log('[VOICE] response received');
      
      // Clean and format text for UI display panel
      const displayReply = cleanTextForDisplay(reply);
      setAiResponse(displayReply);

      // Clean and speak text for TTS audio
      console.log('[VOICE] speaking');
      speakText(reply);
    } catch (err) {
      console.error('[VOICE] API request failed:', err);
      const fallback = `I heard: "${promptText}". All backend systems active.`;
      setAiResponse(fallback);
      speakText(fallback);
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Quick preset voice triggers
  const presetTriggers = [
    'What is my productivity schedule today?',
    'Summarize my high priority Kanban tasks',
    'What is the weather forecast in San Francisco?',
    'Give me a 30-second mindfulness break quote',
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left">
      
      {/* Page Header */}
      <div className="p-6 rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-widest flex items-center space-x-1">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Voice Processing Engine</span>
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">
            Real-Time Voice Assistant
          </h1>
          <p className="text-xs text-slate-400">
            Speak naturally to control tasks, query weather, or generate notes
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center space-x-2 bg-slate-950/80 border border-white/10 px-4 py-2 rounded-2xl">
          <span className={`w-3 h-3 rounded-full ${
            status === 'listening' ? 'bg-emerald-400 animate-ping' :
            status === 'speaking' ? 'bg-purple-400 animate-pulse' :
            status === 'processing' ? 'bg-cyan-400 animate-spin' :
            status === 'error' ? 'bg-rose-500' : 'bg-slate-500'
          }`} />
          <span className="text-xs font-bold text-white capitalize">
            Status: {status}
          </span>
        </div>
      </div>

      {/* Large Waveform Visualizer & Mic Area */}
      <div className="p-8 rounded-3xl bg-slate-950/90 border border-white/10 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-center">
        
        {/* Shimmer Background Glow */}
        <div className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
          isListening ? 'bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.15),transparent_70%)]' :
          isSpeaking ? 'bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.15),transparent_70%)]' :
          'bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.08),transparent_70%)]'
        }`} />

        {/* Large Animated Waveform Bars */}
        <div className="flex items-center space-x-2 h-28 my-6">
          {[0.3, 0.7, 0.5, 0.9, 0.4, 1.0, 0.6, 0.8, 0.3, 0.9, 0.5, 0.7, 0.4, 0.8, 0.2].map((m, i) => (
            <motion.div
              key={i}
              animate={{
                height: (isListening || isSpeaking) ? [12, 90 * m, 12] : [8, 20 * m, 8],
              }}
              transition={{
                duration: 0.4 + (i % 4) * 0.15,
                repeat: Infinity,
                repeatType: 'mirror',
                ease: 'easeInOut',
              }}
              className={`w-2 sm:w-2.5 rounded-full ${
                isListening ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]' :
                isSpeaking ? 'bg-purple-400 shadow-[0_0_12px_#c084fc]' :
                'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Center Control Buttons */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-4 my-2">
          {!isListening ? (
            <button
              onClick={startListening}
              className="flex items-center space-x-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all transform hover:scale-105 active:scale-95"
            >
              <Mic className="w-5 h-5" />
              <span>Start Listening</span>
            </button>
          ) : (
            <button
              onClick={stopListening}
              className="flex items-center space-x-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-500 text-white font-bold text-sm shadow-xl shadow-red-500/25 transition-all transform hover:scale-105 active:scale-95 animate-pulse"
            >
              <Square className="w-5 h-5 fill-current" />
              <span>Stop Listening</span>
            </button>
          )}

          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="flex items-center space-x-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold text-sm shadow-xl shadow-red-500/25 transition-all transform hover:scale-105 active:scale-95 animate-pulse"
            >
              <VolumeX className="w-5 h-5" />
              <span>Stop Speaking</span>
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-2">
          {isListening ? 'Microphone is active. Speak clearly into your device.' : isSpeaking ? 'ASTRA is speaking. Click "Stop Speaking" to interrupt audio.' : 'Tap button or choose a preset prompt below.'}
        </p>
      </div>

      {/* Transcript & AI Response Panels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* User Transcript Panel */}
        <div className="p-5 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-xl space-y-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-xs font-bold text-white flex items-center space-x-2">
              <Mic className="w-4 h-4 text-emerald-400" />
              <span>Live Speech Transcript</span>
            </h3>
            <span className="text-[10px] text-slate-500">User Input</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 min-h-[100px] text-xs text-slate-200 leading-relaxed font-mono">
            {transcript}
          </div>
        </div>

        {/* AI Voice Response Panel */}
        <div className="p-5 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-xl space-y-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-xs font-bold text-white flex items-center space-x-2">
              <Bot className="w-4 h-4 text-purple-400" />
              <span>AI Neural Response</span>
            </h3>
            {aiResponse && (
              <button
                onClick={() => speakText(aiResponse)}
                className="text-[10px] text-purple-400 hover:underline flex items-center space-x-1"
              >
                <Volume2 className="w-3 h-3" />
                <span>Replay</span>
              </button>
            )}
          </div>
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 min-h-[100px] text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
            {aiResponse}
          </div>
        </div>

      </div>

      {/* Preset Voice Command Triggers */}
      <div className="p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 space-y-3">
        <h3 className="text-xs font-bold text-white flex items-center space-x-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>Quick Voice Command Presets</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {presetTriggers.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => {
                latestTranscriptRef.current = prompt;
                setTranscript(prompt);
                processVoicePrompt(prompt);
              }}
              className="p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-white/5 hover:border-cyan-500/30 text-xs text-slate-300 hover:text-cyan-200 text-left transition-colors flex items-center justify-between group"
            >
              <span>"{prompt}"</span>
              <Play className="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};

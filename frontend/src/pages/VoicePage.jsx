import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { apiSendVoiceCommand } from '../services/api';
import { cleanVoiceResponse } from '../utils/voiceResponse';

export default function VoicePage() {
  const { showError, showSuccess, showInfo } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingDestructiveCommand, setPendingDestructiveCommand] = useState(null);
  const recognitionRef = useRef(null);

  const [transcript, setTranscript] = useState([]);

  useEffect(() => {
    // Initialize Web Speech API SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const userSpeech = lastResult[0].transcript;
          handleUserVoiceInput(userSpeech);
        }
      };

      recognition.onerror = (err) => {
        console.warn('SpeechRecognition error:', err);
        setIsListening(false);
        if (showError) showError('Speech recognition error: ' + (err.error || 'Unknown error'));
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const voiceText = cleanVoiceResponse(text);
      if (!voiceText) return;
      const utterance = new SpeechSynthesisUtterance(voiceText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const sendVoiceCommand = async (inputText) => {
    setIsProcessing(true);
    try {
      const res = await apiSendVoiceCommand(inputText);
      const rawReply = res?.data?.reply || res?.reply;
      const reply = cleanVoiceResponse(rawReply || '');
      if (!reply) throw new Error('Astra returned an empty response. Please try again.');
      setTranscript((prev) => [...prev, { id: Date.now() + 1, speaker: 'Astra Voice', text: reply }]);
      speakText(reply);
    } catch (e) {
      const errorReply = `I could not process that voice command. ${cleanVoiceResponse(e.message || 'Please try again.')}`;
      setTranscript((prev) => [...prev, { id: Date.now() + 1, speaker: 'Astra Voice', text: errorReply }]);
      speakText(errorReply);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUserVoiceInput = async (inputText) => {
    if (!inputText || !inputText.trim()) return;

    setTranscript((prev) => [
      ...prev,
      { id: Date.now(), speaker: 'You', text: inputText },
    ]);

    if (pendingDestructiveCommand) {
      if (/\b(?:yes|confirm|do it|delete it|go ahead)\b/i.test(inputText)) {
        const command = pendingDestructiveCommand;
        setPendingDestructiveCommand(null);
        await sendVoiceCommand(command);
        return;
      }
      if (/\b(?:no|cancel|stop|don't)\b/i.test(inputText)) {
        setPendingDestructiveCommand(null);
        const reply = 'Okay, I will not delete that task.';
        setTranscript((prev) => [...prev, { id: Date.now() + 1, speaker: 'Astra Voice', text: reply }]);
        speakText(reply);
        return;
      }
      const reply = 'Please say yes to confirm deletion or no to cancel.';
      setTranscript((prev) => [...prev, { id: Date.now() + 1, speaker: 'Astra Voice', text: reply }]);
      speakText(reply);
      return;
    }

    if (/\b(?:delete|remove|erase)\b.*\b(?:task|todo)\b/i.test(inputText)) {
      setPendingDestructiveCommand(inputText);
      const reply = 'This will permanently delete a task. Say yes to confirm or no to cancel.';
      setTranscript((prev) => [...prev, { id: Date.now() + 1, speaker: 'Astra Voice', text: reply }]);
      speakText(reply);
      return;
    }
    await sendVoiceCommand(inputText);
  };

  const startListening = () => {
    // Stop any current speaking synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        if (showInfo) showInfo('Microphone listening active...');
      } catch (e) {
        // Recognition already started or failed to start
        setIsListening(true);
      }
    } else {
      if (showError) showError('Web Speech API is not supported in this browser.');
    }
  };

  const stopListening = () => {
    setIsListening(false);
    setIsSpeaking(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignored
      }
    }
    if (showInfo) showInfo('Voice Assistant stopped.');
  };

  const retryVoice = () => {
    stopListening();
    const lastAstraMsg = [...transcript].reverse().find((item) => item.speaker === 'Astra Voice');
    const textToReplay = lastAstraMsg?.text;
    
    if (showSuccess) showSuccess('Retrying voice audio response playback...');
    if (textToReplay) speakText(textToReplay);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-6rem)] flex flex-col items-center justify-between py-6">
      {/* Top Header */}
      <div className="text-center">
        <span
          className={`font-label text-xs uppercase tracking-widest font-bold px-3.5 py-1 rounded-full ${
            isListening
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : isSpeaking
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'bg-primary-fixed dark:bg-blue-950/60 text-primary dark:text-blue-400'
          }`}
        >
          {isListening ? 'Microphone Active' : isSpeaking ? 'Speaking Response' : 'Voice Mode Standby'}
        </span>
        <h2 className="font-headline text-3xl font-extrabold text-on-surface dark:text-slate-100 mt-3">
          Astra Neural Voice AI
        </h2>
        <p className="font-body text-sm text-on-surface-variant dark:text-slate-400 mt-1">
          Connected to Python FastAPI microservice engine
        </p>
      </div>

      {/* Central Pulsing Orb Section */}
      <div className="relative my-auto flex flex-col items-center justify-center">
        {/* Pulsing Orb */}
        <div
          className={`w-60 h-60 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-[0_0_80px_rgba(37,99,235,0.5)] transition-all duration-500 ${
            isListening || isSpeaking ? 'voice-orb scale-105 ring-8 ring-blue-400/30' : 'scale-95 opacity-80'
          }`}
        >
          <div className="w-44 h-44 rounded-full bg-surface dark:bg-slate-900/90 flex flex-col items-center justify-center text-center p-4 backdrop-blur-md">
            <span
              className={`material-symbols-outlined text-6xl mb-2 ${
                isSpeaking ? 'text-emerald-500 animate-pulse' : 'text-primary dark:text-blue-400'
              }`}
            >
              {isSpeaking ? 'volume_up' : isListening ? 'mic' : 'graphic_eq'}
            </span>
            <span className="font-label text-xs font-semibold text-on-surface dark:text-slate-200">
              {isProcessing
                ? 'Processing...'
                : isSpeaking
                ? 'Speaking...'
                : isListening
                ? 'Listening...'
                : 'Standby'}
            </span>
          </div>
        </div>

        {/* Audio Waveform Bar Visualization */}
        <div className="flex items-center gap-1.5 mt-8 h-10">
          {[40, 75, 30, 90, 60, 100, 45, 80, 50, 95, 35, 70].map((height, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-full transition-all duration-300 ${
                isSpeaking
                  ? 'bg-emerald-500'
                  : isListening
                  ? 'bg-primary dark:bg-blue-400'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
              style={{
                height: isListening || isSpeaking ? `${Math.max(12, (height * Math.random()).toFixed(0))}px` : '6px',
              }}
            />
          ))}
        </div>
      </div>

      {/* Live Transcript Box & Voice Control Toolbar */}
      <div className="w-full max-w-xl bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-2xl p-5 shadow-sm text-center space-y-4">
        <p className="text-xs text-on-surface-variant dark:text-slate-400 font-semibold uppercase tracking-wider">
          Voice Transcript & Response Display
        </p>

        <div className="space-y-2 max-h-28 overflow-y-auto pr-1 text-left">
          {transcript.map((item) => (
            <div
              key={item.id}
              className={`p-2.5 rounded-xl text-xs font-body ${
                item.speaker === 'You'
                  ? 'bg-primary/10 text-primary dark:text-blue-300 font-medium'
                  : 'bg-surface-container-low dark:bg-slate-700/50 text-on-surface dark:text-slate-200'
              }`}
            >
              <strong className="block text-[10px] uppercase font-bold text-on-surface-variant dark:text-slate-400 mb-0.5">
                {item.speaker}
              </strong>
              "{item.text}"
            </div>
          ))}
        </div>

        {/* Explicit Voice Controls: Listen / Stop / Retry */}
        <div className="flex items-center justify-center gap-3 pt-3 border-t border-outline-variant/30 dark:border-slate-700">
          <button
            onClick={startListening}
            disabled={isListening || isProcessing}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-md ${
              isListening
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-primary text-white hover:bg-blue-700 disabled:opacity-50'
            }`}
          >
            <span className="material-symbols-outlined text-base">mic</span>
            <span>Listen</span>
          </button>

          <button
            onClick={stopListening}
            className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-md"
          >
            <span className="material-symbols-outlined text-base">stop</span>
            <span>Stop</span>
          </button>

          <button
            onClick={retryVoice}
            className="px-5 py-2.5 bg-surface-container-high dark:bg-slate-700 text-on-surface dark:text-slate-200 hover:bg-surface-container-highest rounded-xl font-semibold text-xs flex items-center gap-2 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-base">replay</span>
            <span>Retry Audio</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Voice Synthesis Service with Multiple Voice Options & Global Mute Support

export function getAvailableVoices() {
  if (!('speechSynthesis' in window)) return [];

  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));

  const categorised = {
    female: englishVoices.filter(v => 
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('zira') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('victoria') ||
      v.name.toLowerCase().includes('karen') ||
      v.name.toLowerCase().includes('google us english')
    ),
    male: englishVoices.filter(v => 
      v.name.toLowerCase().includes('male') ||
      v.name.toLowerCase().includes('david') ||
      v.name.toLowerCase().includes('alex') ||
      v.name.toLowerCase().includes('guy') ||
      v.name.toLowerCase().includes('daniel') ||
      v.name.toLowerCase().includes('george')
    ),
    all: englishVoices.length > 0 ? englishVoices : voices
  };

  return categorised;
}

export function isVoiceMuted() {
  return (localStorage.getItem('astra_voice_muted') || localStorage.getItem('jarves_voice_muted')) === 'true';
}

export function setVoiceMuted(muted) {
  localStorage.setItem('astra_voice_muted', muted ? 'true' : 'false');
  localStorage.setItem('jarves_voice_muted', muted ? 'true' : 'false');
}

export function cleanTextForSpeech(text) {
  if (!text || typeof text !== 'string') return '';

  let clean = text;

  // 1. Remove fenced code blocks (```...```)
  clean = clean.replace(/```[\s\S]*?```/g, ' [code omitted] ');

  // 2. Remove inline code (`...`)
  clean = clean.replace(/`([^`]+)`/g, '$1');

  // 3. Remove raw JSON objects and arrays
  clean = clean.replace(/\{[^{}]*\}/g, '');

  // 4. Remove Markdown links [text](url) -> keep text only
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 5. Remove standalone URLs
  clean = clean.replace(/https?:\/\/\S+/g, '');

  // 6. Remove HTML tags
  clean = clean.replace(/<[^>]+>/g, '');

  // 7. Remove markdown headers, bold, italics, strikethrough, blockquotes
  clean = clean.replace(/^#+\s+/gm, '');
  clean = clean.replace(/[*_~]{1,3}/g, '');
  clean = clean.replace(/^>\s+/gm, '');
  clean = clean.replace(/^[-*+]\s+/gm, '');
  clean = clean.replace(/^\d+\.\s+/gm, '');

  // 8. Convert any remaining ISO datetimes into human-readable text
  clean = clean.replace(/\b(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\b/g, (_match, y, m, d, hh, mm) => {
    try {
      const date = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), parseInt(hh, 10), parseInt(mm, 10)));
      if (isNaN(date.getTime())) return '';
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = date.toDateString() === tomorrow.toDateString();
      
      let dayPart = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      if (isToday) dayPart = 'today';
      else if (isTomorrow) dayPart = 'tomorrow';

      const hours = parseInt(hh, 10);
      const mins = parseInt(mm, 10);
      if (hours === 0 && mins === 0) {
        return dayPart;
      }
      const period = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      const minStr = mins > 0 ? `:${mins.toString().padStart(2, '0')}` : '';
      return `${dayPart} at ${h12}${minStr} ${period}`;
    } catch {
      return '';
    }
  });

  // 9. Remove raw timezone offsets, midnight timestamps, and '0000'
  clean = clean.replace(/[+-]\d{2}:\d{2}\b/g, '');
  clean = clean.replace(/\b0000\b/g, '');
  clean = clean.replace(/\b00:00(?::00)?\b/g, '');

  // 10. Remove raw MongoDB ObjectIds (24 hex chars) and UUIDs
  clean = clean.replace(/\b[0-9a-fA-F]{24}\b/g, '');
  clean = clean.replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, '');
  clean = clean.replace(/\b_?id\s*:\s*\S+/gi, '');

  // 11. Remove markdown table separators and pipes
  clean = clean.replace(/\|/g, ', ');
  clean = clean.replace(/[-:]{3,}/g, '');

  // 12. Normalize multiple whitespace, clean dangling prepositions, and clean newlines
  clean = clean.replace(/\b(for|at|on|due)\s*[.,!]/gi, '.');
  clean = clean.replace(/\n+/g, '. ').replace(/\s{2,}/g, ' ').trim();
  clean = clean.replace(/\s+([.,!?])/g, '$1');

  // 13. Trim excessively long spoken output to reasonable spoken length
  if (clean.length > 500) {
    const truncated = clean.slice(0, 500);
    const lastPeriod = truncated.lastIndexOf('.');
    clean = (lastPeriod > 200 ? truncated.slice(0, lastPeriod + 1) : truncated) + ' That is all.';
  }

  return clean;
}

export function speakText(text, gender = 'female', rate = 1.0, onEndCallback) {
  if (isVoiceMuted()) {
    // If voice is muted, skip audio speech synthesis and invoke completion callback
    if (onEndCallback) setTimeout(onEndCallback, 1500);
    return;
  }

  if (!('speechSynthesis' in window)) {
    if (onEndCallback) setTimeout(onEndCallback, 2500);
    return;
  }

  window.speechSynthesis.cancel(); // Stop any active speech

  const cleanText = cleanTextForSpeech(text);
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = parseFloat(rate) || 1.0;

  const voices = window.speechSynthesis.getVoices();
  const lowerGender = gender.toLowerCase();

  let targetVoice = null;

  if (lowerGender === 'female') {
    targetVoice = voices.find(v => 
      v.lang.startsWith('en') && (
        v.name.toLowerCase().includes('zira') ||
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('victoria') ||
        v.name.toLowerCase().includes('google us english')
      )
    );
  } else if (lowerGender === 'male') {
    targetVoice = voices.find(v => 
      v.lang.startsWith('en') && (
        v.name.toLowerCase().includes('david') ||
        v.name.toLowerCase().includes('alex') ||
        v.name.toLowerCase().includes('male') ||
        v.name.toLowerCase().includes('guy') ||
        v.name.toLowerCase().includes('daniel')
      )
    );
  }

  if (!targetVoice) {
    targetVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
  }

  if (targetVoice) {
    utterance.voice = targetVoice;
  }

  if (onEndCallback) {
    utterance.onend = onEndCallback;
    utterance.onerror = onEndCallback;
  }

  window.speechSynthesis.speak(utterance);
}

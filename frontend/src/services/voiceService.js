// Voice Synthesis Service with Asynchronous Voice Loading, Accurate Voice Matching & Persistent Preference

// LocalStorage Keys for Cross-Component & Cross-Session Persistence
export const VOICE_GENDER_STORAGE_KEY = 'astra_voice_gender';
export const LEGACY_VOICE_GENDER_KEY = 'jarves_voice_gender';
export const VOICE_MUTED_STORAGE_KEY = 'astra_voice_muted';
export const LEGACY_VOICE_MUTED_KEY = 'jarves_voice_muted';
export const VOICE_SPEED_STORAGE_KEY = 'astra_voice_speed';

/**
 * Retrieve active voice gender preference.
 * Defaults to 'female' if not explicitly configured.
 */
export function getVoiceGender() {
  if (typeof window === 'undefined' || !window.localStorage) return 'female';
  try {
    const stored =
      localStorage.getItem(VOICE_GENDER_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_VOICE_GENDER_KEY);
    if (stored && ['female', 'male', 'system'].includes(stored.toLowerCase().trim())) {
      return stored.toLowerCase().trim();
    }
  } catch (err) {
    console.warn('Error reading voice gender preference:', err);
  }
  return 'female';
}

/**
 * Persist voice gender preference and notify all components.
 */
export function setVoiceGender(gender) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const val = (gender || 'female').toLowerCase().trim();
  const normalized = ['female', 'male', 'system'].includes(val) ? val : 'female';
  try {
    localStorage.setItem(VOICE_GENDER_STORAGE_KEY, normalized);
    localStorage.setItem(LEGACY_VOICE_GENDER_KEY, normalized);
  } catch (err) {
    console.warn('Error saving voice gender preference:', err);
  }
  clearVoiceCache();
  if (typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(
        new CustomEvent('astra_voice_gender_changed', { detail: { gender: normalized } })
      );
    } catch {}
  }
}

/**
 * Check if spoken voice output is muted.
 */
export function isVoiceMuted() {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return (
      (localStorage.getItem(VOICE_MUTED_STORAGE_KEY) ||
        localStorage.getItem(LEGACY_VOICE_MUTED_KEY)) === 'true'
    );
  } catch {
    return false;
  }
}

/**
 * Persist voice mute setting, stop ongoing speech if muted, and notify components.
 */
export function setVoiceMuted(muted) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const str = muted ? 'true' : 'false';
  try {
    localStorage.setItem(VOICE_MUTED_STORAGE_KEY, str);
    localStorage.setItem(LEGACY_VOICE_MUTED_KEY, str);
  } catch (err) {
    console.warn('Error saving voice mute setting:', err);
  }
  if (muted) {
    stopSpeech();
  }
  if (typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(
        new CustomEvent('astra_voice_muted_changed', { detail: { muted: !!muted } })
      );
    } catch {}
  }
}

/**
 * Retrieve voice speech rate.
 */
export function getVoiceSpeed() {
  if (typeof window === 'undefined' || !window.localStorage) return 1.0;
  try {
    const s = localStorage.getItem(VOICE_SPEED_STORAGE_KEY);
    const parsed = parseFloat(s);
    if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
      return parsed;
    }
  } catch {}
  return 1.0;
}

/**
 * Save voice speech rate.
 */
export function setVoiceSpeed(speed) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(VOICE_SPEED_STORAGE_KEY, String(speed));
  } catch {}
}

// ---------------------------------------------------------------------------
// Asynchronous Speech Synthesis Voice Loading
// ---------------------------------------------------------------------------

let voiceLoadPromise = null;
let cachedVoiceList = [];

/**
 * Returns a Promise that resolves with the list of SpeechSynthesis voices.
 * Crucial fix: In Chrome/Edge/Safari, getVoices() returns [] on initial load
 * until the asynchronous 'voiceschanged' event fires. Waiting for this ensures
 * the first and all subsequent commands match the exact same voice.
 */
export function getLoadedVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }

  try {
    const immediate = window.speechSynthesis.getVoices();
    if (immediate && immediate.length > 0) {
      cachedVoiceList = immediate;
      return Promise.resolve(immediate);
    }
  } catch (err) {
    console.warn('SpeechSynthesis getVoices error:', err);
  }

  if (cachedVoiceList && cachedVoiceList.length > 0) {
    return Promise.resolve(cachedVoiceList);
  }

  if (voiceLoadPromise) {
    return voiceLoadPromise;
  }

  voiceLoadPromise = new Promise((resolve) => {
    let resolved = false;

    const cleanup = () => {
      if (typeof window.speechSynthesis.removeEventListener === 'function') {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      }
    };

    const onVoicesChanged = () => {
      if (resolved) return;
      try {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          resolved = true;
          cachedVoiceList = v;
          cleanup();
          voiceLoadPromise = null;
          resolve(v);
        }
      } catch {
        resolved = true;
        cleanup();
        voiceLoadPromise = null;
        resolve([]);
      }
    };

    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    } else if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = onVoicesChanged;
    }

    // Safety timeout in case voiceschanged never fires (e.g. Firefox or mocked environment)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        voiceLoadPromise = null;
        try {
          const fallback = window.speechSynthesis.getVoices() || [];
          cachedVoiceList = fallback;
          resolve(fallback);
        } catch {
          resolve([]);
        }
      }
    }, 300);
  });

  return voiceLoadPromise;
}

// ---------------------------------------------------------------------------
// Speech Synthesis Voice Matching & Fallback Logic
// ---------------------------------------------------------------------------

/**
 * Checks if a voice matches female characteristics.
 * Uses exact regex word boundaries and accounts for known system voice names.
 */
export function isFemaleVoice(voice) {
  if (!voice) return false;
  const name = (voice.name || '').toLowerCase();
  const uri = (voice.voiceURI || '').toLowerCase();
  const combined = `${name} ${uri}`;

  const femalePatterns = [
    /\bfemale\b/i,
    /\bwoman\b/i,
    /\bzira\b/i,
    /\bsamantha\b/i,
    /\bvictoria\b/i,
    /\bkaren\b/i,
    /\bjenny\b/i,
    /\baria\b/i,
    /\bhazel\b/i,
    /\bsusan\b/i,
    /\bcatherine\b/i,
    /\bfiona\b/i,
    /\bmoira\b/i,
    /\btessa\b/i,
    /\bveena\b/i,
    /google us english/i,
    /google uk english female/i,
  ];

  return femalePatterns.some((pattern) => pattern.test(combined));
}

/**
 * Checks if a voice matches male characteristics.
 * Explicitly guards against "female" or "woman" substring contamination.
 */
export function isMaleVoice(voice) {
  if (!voice) return false;
  const name = (voice.name || '').toLowerCase();
  const uri = (voice.voiceURI || '').toLowerCase();
  const combined = `${name} ${uri}`;

  // If the voice explicitly indicates female/woman, it is NOT male
  if (/\bfemale\b/i.test(combined) || /\bwoman\b/i.test(combined)) {
    return false;
  }

  const malePatterns = [
    /\bmale\b/i,
    /\bman\b/i,
    /\bdavid\b/i,
    /\balex\b/i,
    /\bguy\b/i,
    /\bdaniel\b/i,
    /\bgeorge\b/i,
    /\bmark\b/i,
    /\bfred\b/i,
    /\boliver\b/i,
    /\btom\b/i,
    /\brishi\b/i,
    /google uk english male/i,
  ];

  return malePatterns.some((pattern) => pattern.test(combined));
}

// Resolved voice cache to ensure subsequent commands use the identical voice
const resolvedVoiceCache = {
  female: null,
  male: null,
  system: null,
};

export function clearVoiceCache() {
  resolvedVoiceCache.female = null;
  resolvedVoiceCache.male = null;
  resolvedVoiceCache.system = null;
}

/**
 * Deterministically finds the best matching voice for a given gender preference.
 * Preference options: 'female', 'male', 'system'.
 */
export function findVoiceForGender(gender = 'female', voices = []) {
  if (!voices || voices.length === 0) return null;

  const target = (gender || 'female').toLowerCase().trim();

  // Return cached match if it is still valid in the provided voices list
  if (resolvedVoiceCache[target]) {
    const cached = resolvedVoiceCache[target];
    const stillPresent = voices.find(
      (v) =>
        v === cached ||
        (v.voiceURI && cached.voiceURI && v.voiceURI === cached.voiceURI) ||
        (v.name && cached.name && v.name === cached.name)
    );
    if (stillPresent) return stillPresent;
  }

  const englishVoices = voices.filter(
    (v) => v.lang && v.lang.toLowerCase().startsWith('en')
  );
  const candidatePool = englishVoices.length > 0 ? englishVoices : voices;

  let selected = null;

  if (target === 'female') {
    // 1. English voice matching female patterns
    selected = candidatePool.find((v) => isFemaleVoice(v));
    // 2. Any language voice matching female patterns
    if (!selected) {
      selected = voices.find((v) => isFemaleVoice(v));
    }
    // 3. Fallback: English voice not identified as male
    if (!selected) {
      selected = candidatePool.find((v) => !isMaleVoice(v));
    }
    // 4. Default / first voice
    if (!selected) {
      selected = candidatePool.find((v) => v.default) || candidatePool[0] || voices[0];
    }
  } else if (target === 'male') {
    // 1. English voice matching male patterns
    selected = candidatePool.find((v) => isMaleVoice(v));
    // 2. Any language voice matching male patterns
    if (!selected) {
      selected = voices.find((v) => isMaleVoice(v));
    }
    // 3. Fallback: English voice not identified as female
    if (!selected) {
      selected = candidatePool.find((v) => !isFemaleVoice(v));
    }
    // 4. Default / first voice
    if (!selected) {
      selected = candidatePool.find((v) => v.default) || candidatePool[0] || voices[0];
    }
  } else if (target === 'system') {
    // 1. English default voice
    selected = candidatePool.find((v) => v.default);
    // 2. Any default voice
    if (!selected) {
      selected = voices.find((v) => v.default);
    }
    // 3. First English voice or first available voice
    if (!selected) {
      selected = candidatePool[0] || voices[0];
    }
  } else {
    selected = candidatePool.find((v) => v.default) || candidatePool[0] || voices[0];
  }

  if (selected && ['female', 'male', 'system'].includes(target)) {
    resolvedVoiceCache[target] = selected;
  }

  return selected;
}

/**
 * Returns available voices categorized by gender for UI reference.
 */
export function getAvailableVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { female: [], male: [], all: [] };
  }

  const voices = window.speechSynthesis.getVoices() || [];
  const englishVoices = voices.filter(
    (v) => v.lang && v.lang.toLowerCase().startsWith('en')
  );
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  return {
    female: pool.filter((v) => isFemaleVoice(v)),
    male: pool.filter((v) => isMaleVoice(v)),
    all: pool,
  };
}

// ---------------------------------------------------------------------------
// Spoken Text Sanitization
// ---------------------------------------------------------------------------

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
  clean = clean.replace(
    /\b(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\b/g,
    (_match, y, m, d, hh, mm) => {
      try {
        const date = new Date(
          Date.UTC(
            parseInt(y, 10),
            parseInt(m, 10) - 1,
            parseInt(d, 10),
            parseInt(hh, 10),
            parseInt(mm, 10)
          )
        );
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
    }
  );

  // 9. Remove raw timezone offsets, midnight timestamps, and '0000'
  clean = clean.replace(/[+-]\d{2}:\d{2}\b/g, '');
  clean = clean.replace(/\b0000\b/g, '');
  clean = clean.replace(/\b00:00(?::00)?\b/g, '');

  // 10. Remove raw MongoDB ObjectIds (24 hex chars) and UUIDs
  clean = clean.replace(/\b[0-9a-fA-F]{24}\b/g, '');
  clean = clean.replace(
    /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
    ''
  );
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
    clean =
      (lastPeriod > 200 ? truncated.slice(0, lastPeriod + 1) : truncated) +
      ' That is all.';
  }

  return clean;
}

// ---------------------------------------------------------------------------
// Speech Synthesis Execution & Consecutive Commands Handling
// ---------------------------------------------------------------------------

let activeUtterance = null;

/**
 * Safely stops active or pending speech synthesis.
 */
export function stopSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
    activeUtterance = null;
  }
}

/**
 * Speaks text using the user's selected voice setting.
 *
 * Guarantees:
 * - Always loads voices asynchronously before speaking so the first command never switches voice.
 * - Always uses the selected voice preference ('female', 'male', or 'system') stored in settings.
 * - All consecutive commands speak with the exact same voice.
 * - Retains utterance reference to prevent Chrome garbage-collection dropouts.
 * - Resolves both via Promise and optional onEndCallback for full backwards compatibility.
 */
export async function speakText(text, gender = null, rate = null, onEndCallback = null) {
  if (isVoiceMuted()) {
    if (typeof onEndCallback === 'function') {
      setTimeout(onEndCallback, 1000);
    }
    return null;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (typeof onEndCallback === 'function') {
      setTimeout(onEndCallback, 1500);
    }
    return null;
  }

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    if (typeof onEndCallback === 'function') {
      onEndCallback();
    }
    return null;
  }

  // Ensure preference defaults to currently selected UI setting if not explicitly passed
  const activeGender = (gender || getVoiceGender() || 'female').toLowerCase().trim();
  const activeRate = parseFloat(rate || getVoiceSpeed() || 1.0) || 1.0;

  // Await asynchronous voice loading to guarantee first command does not pick arbitrary fallback
  const voices = await getLoadedVoices();
  const targetVoice = findVoiceForGender(activeGender, voices);

  // Safely stop any previous speech before starting next consecutive speech
  try {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {}

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = activeRate;

  if (targetVoice) {
    utterance.voice = targetVoice;
    utterance.lang = targetVoice.lang || 'en-US';
  } else {
    utterance.lang = 'en-US';
  }

  // Preserve module-level reference to guard against Chrome GC bug on long/consecutive utterances
  activeUtterance = utterance;

  return new Promise((resolve) => {
    let completed = false;

    const onComplete = (err) => {
      if (completed) return;
      completed = true;
      if (activeUtterance === utterance) {
        activeUtterance = null;
      }
      if (typeof onEndCallback === 'function') {
        try {
          onEndCallback(err);
        } catch (cbErr) {
          console.warn('onEndCallback exception:', cbErr);
        }
      }
      resolve();
    };

    utterance.onend = () => onComplete();
    utterance.onerror = (event) => {
      // Browsers fire error 'interrupted' or 'canceled' when consecutive commands cancel previous speech
      onComplete(event);
    };

    try {
      window.speechSynthesis.speak(utterance);
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (err) {
      console.warn('speechSynthesis.speak error:', err);
      onComplete(err);
    }
  });
}

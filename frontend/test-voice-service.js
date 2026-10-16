import assert from 'node:assert';
import {
  isFemaleVoice,
  isMaleVoice,
  findVoiceForGender,
  clearVoiceCache,
  getVoiceGender,
  setVoiceGender,
  isVoiceMuted,
  setVoiceMuted,
  getVoiceSpeed,
  setVoiceSpeed,
  cleanTextForSpeech,
  getLoadedVoices,
  speakText,
} from './src/services/voiceService.js';

// Setup Mock Window and LocalStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, val) => {
      store[key] = String(val);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

const mockVoices = [
  { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US', voiceURI: 'urn:david', default: false },
  { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US', voiceURI: 'urn:zira', default: false },
  { name: 'Microsoft Mark - English (United States)', lang: 'en-US', voiceURI: 'urn:mark', default: false },
  { name: 'Microsoft Jenny Online (Natural) - English (United States)', lang: 'en-US', voiceURI: 'urn:jenny', default: false },
  { name: 'Microsoft Guy Online (Natural) - English (United States)', lang: 'en-US', voiceURI: 'urn:guy', default: false },
  { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English', default: true },
  { name: 'Microsoft Server Speech Text to Speech Voice (en-US, Zira, Female)', lang: 'en-US', voiceURI: 'urn:server:zira', default: false },
  { name: 'Alex', lang: 'en-US', voiceURI: 'com.apple.speech.synthesis.voice.Alex', default: false },
  { name: 'Samantha', lang: 'en-US', voiceURI: 'com.apple.speech.synthesis.voice.Samantha', default: false },
];

let spokenUtterances = [];
let voicesEventHandlers = [];
let voicesLoadedAsync = false;

const mockSpeechSynthesis = {
  speaking: false,
  pending: false,
  paused: false,
  cancel() {
    this.speaking = false;
    this.pending = false;
  },
  resume() {
    this.paused = false;
  },
  speak(utterance) {
    this.speaking = true;
    spokenUtterances.push(utterance);
    setTimeout(() => {
      this.speaking = false;
      if (utterance.onend) utterance.onend();
    }, 10);
  },
  getVoices() {
    if (!voicesLoadedAsync) return [];
    return mockVoices;
  },
  addEventListener(event, handler) {
    if (event === 'voiceschanged') {
      voicesEventHandlers.push(handler);
    }
  },
  removeEventListener(event, handler) {
    if (event === 'voiceschanged') {
      voicesEventHandlers = voicesEventHandlers.filter((h) => h !== handler);
    }
  },
};

class MockSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.voice = null;
    this.rate = 1.0;
    this.lang = 'en-US';
    this.onend = null;
    this.onerror = null;
  }
}

globalThis.window = {
  localStorage: mockLocalStorage,
  speechSynthesis: mockSpeechSynthesis,
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.localStorage = mockLocalStorage;
globalThis.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

async function runTests() {
  console.log('--- STARTING VOICE SERVICE TEST SUITE ---');

  // Test 1: Gender regex classification and substring bug immunity
  console.log('1. Testing voice gender classification...');
  assert.strictEqual(isFemaleVoice(mockVoices[1]), true, 'Zira should be female');
  assert.strictEqual(isMaleVoice(mockVoices[1]), false, 'Zira should NOT be male');

  assert.strictEqual(isMaleVoice(mockVoices[0]), true, 'David should be male');
  assert.strictEqual(isFemaleVoice(mockVoices[0]), false, 'David should NOT be female');

  // CRITICAL SUBSTRING TEST: Voice containing 'Female' should NEVER be classified as male
  assert.strictEqual(isFemaleVoice(mockVoices[6]), true, 'Zira Female should be female');
  assert.strictEqual(isMaleVoice(mockVoices[6]), false, 'Zira Female must NOT match male despite "male" substring in "female"');

  assert.strictEqual(isFemaleVoice(mockVoices[5]), true, 'Google US English should be female');
  assert.strictEqual(isMaleVoice(mockVoices[4]), true, 'Guy Online should be male');
  console.log('   ✓ Voice gender classification passed.');

  // Test 2: findVoiceForGender matching
  console.log('2. Testing findVoiceForGender matching and fallback logic...');
  clearVoiceCache();
  const femaleVoice = findVoiceForGender('female', mockVoices);
  assert.ok(femaleVoice, 'Female voice must be resolved');
  assert.ok(isFemaleVoice(femaleVoice), `Resolved voice must be female, got: ${femaleVoice.name}`);

  clearVoiceCache();
  const maleVoice = findVoiceForGender('male', mockVoices);
  assert.ok(maleVoice, 'Male voice must be resolved');
  assert.ok(isMaleVoice(maleVoice), `Resolved voice must be male, got: ${maleVoice.name}`);

  clearVoiceCache();
  const systemVoice = findVoiceForGender('system', mockVoices);
  assert.ok(systemVoice, 'System voice must be resolved');
  assert.strictEqual(systemVoice.default, true, 'System voice should pick default voice');
  console.log('   ✓ Voice matching logic passed.');

  // Test 3: Preference persistence across localStorage and getters/setters
  console.log('3. Testing preference persistence...');
  mockLocalStorage.clear();
  assert.strictEqual(getVoiceGender(), 'female', 'Default gender should be female');

  setVoiceGender('male');
  assert.strictEqual(getVoiceGender(), 'male', 'Gender should persist as male');
  assert.strictEqual(mockLocalStorage.getItem('astra_voice_gender'), 'male');
  assert.strictEqual(mockLocalStorage.getItem('jarves_voice_gender'), 'male');

  setVoiceGender('system');
  assert.strictEqual(getVoiceGender(), 'system', 'Gender should persist as system');

  assert.strictEqual(isVoiceMuted(), false, 'Default muted should be false');
  setVoiceMuted(true);
  assert.strictEqual(isVoiceMuted(), true, 'Muted should persist as true');
  setVoiceMuted(false);
  assert.strictEqual(isVoiceMuted(), false, 'Muted should persist as false');

  setVoiceSpeed('1.2');
  assert.strictEqual(getVoiceSpeed(), 1.2, 'Speed should persist as 1.2');
  console.log('   ✓ Preference persistence passed.');

  // Test 4: Asynchronous voice loading
  console.log('4. Testing asynchronous voice loading (first command vs subsequent commands)...');
  voicesLoadedAsync = false;
  clearVoiceCache();
  setVoiceGender('female');

  // Trigger getLoadedVoices when getVoices() is empty initially
  const loadPromise = getLoadedVoices();

  // Simulate browser firing voiceschanged after 50ms
  setTimeout(() => {
    voicesLoadedAsync = true;
    for (const h of voicesEventHandlers) {
      h();
    }
  }, 50);

  const loaded = await loadPromise;
  assert.strictEqual(loaded.length, mockVoices.length, 'Loaded voices should contain all mock voices');
  console.log('   ✓ Asynchronous voice loading resolved successfully.');

  // Test 5: First and all subsequent consecutive commands speak with the exact same voice
  console.log('5. Testing consecutive commands voice consistency...');
  spokenUtterances = [];
  setVoiceGender('female');

  // Command 1
  await speakText('Command 1: Hello from ASTRA', 'female');
  assert.strictEqual(spokenUtterances.length, 1);
  const firstVoice = spokenUtterances[0].voice;
  assert.ok(firstVoice, 'Command 1 must have voice set');
  console.log(`   Command 1 used voice: ${firstVoice.name}`);

  // Consecutive Command 2
  await speakText('Command 2: What is my schedule today?', 'female');
  assert.strictEqual(spokenUtterances.length, 2);
  const secondVoice = spokenUtterances[1].voice;
  assert.strictEqual(secondVoice, firstVoice, 'Command 2 MUST use the EXACT same voice as Command 1');
  console.log(`   Command 2 used voice: ${secondVoice.name}`);

  // Consecutive Command 3
  await speakText('Command 3: Create a task for DBMS', 'female');
  assert.strictEqual(spokenUtterances.length, 3);
  const thirdVoice = spokenUtterances[2].voice;
  assert.strictEqual(thirdVoice, firstVoice, 'Command 3 MUST use the EXACT same voice as Command 1');
  console.log(`   Command 3 used voice: ${thirdVoice.name}`);

  // Consecutive Command 4
  await speakText('Command 4: Turn off the lights', 'female');
  assert.strictEqual(spokenUtterances.length, 4);
  const fourthVoice = spokenUtterances[3].voice;
  assert.strictEqual(fourthVoice, firstVoice, 'Command 4 MUST use the EXACT same voice as Command 1');
  console.log(`   Command 4 used voice: ${fourthVoice.name}`);

  // Test 6: Switching preference in settings and verifying subsequent consecutive commands switch & stay
  console.log('6. Testing preference switch to Male and consecutive commands...');
  setVoiceGender('male');
  assert.strictEqual(getVoiceGender(), 'male');

  // Command 5 with male voice
  await speakText('Command 5: Now switch to male voice');
  assert.strictEqual(spokenUtterances.length, 5);
  const fifthVoice = spokenUtterances[4].voice;
  assert.ok(isMaleVoice(fifthVoice), `Command 5 must be male voice, got: ${fifthVoice.name}`);
  assert.notStrictEqual(fifthVoice, firstVoice, 'Command 5 voice must be different from previous female voice');
  console.log(`   Command 5 used male voice: ${fifthVoice.name}`);

  // Command 6 (consecutive with male)
  await speakText('Command 6: Another command with male voice');
  assert.strictEqual(spokenUtterances.length, 6);
  const sixthVoice = spokenUtterances[5].voice;
  assert.strictEqual(sixthVoice, fifthVoice, 'Command 6 must use the EXACT same male voice as Command 5');
  console.log(`   Command 6 used male voice: ${sixthVoice.name}`);

  // Command 7 (consecutive with male)
  await speakText('Command 7: Third command with male voice');
  assert.strictEqual(spokenUtterances.length, 7);
  const seventhVoice = spokenUtterances[6].voice;
  assert.strictEqual(seventhVoice, fifthVoice, 'Command 7 must use the EXACT same male voice as Command 5');
  console.log(`   Command 7 used male voice: ${seventhVoice.name}`);

  // Test 7: Mute setting skips speech cleanly
  console.log('7. Testing mute functionality...');
  setVoiceMuted(true);
  let callbackInvoked = false;
  await speakText('This should be muted', null, null, () => {
    callbackInvoked = true;
  });
  assert.strictEqual(spokenUtterances.length, 7, 'Muted speech should not append to speech queue');
  console.log('   ✓ Mute functionality passed.');

  // Test 8: cleanTextForSpeech retains all cleanup rules
  console.log('8. Testing cleanTextForSpeech sanitization...');
  const dirty = '# Heading\n```code block```\nCheck out [link](https://example.com) 2026-10-17T09:00:00Z ObjectId: 651234567890123456789012';
  const cleaned = cleanTextForSpeech(dirty);
  assert.ok(!cleaned.includes('```'), 'Code block removed');
  assert.ok(!cleaned.includes('https://'), 'URL removed');
  assert.ok(!cleaned.includes('651234567890123456789012'), 'ObjectId removed');
  console.log('   ✓ cleanTextForSpeech sanitization passed.');

  console.log('\n=========================================');
  console.log('ALL VOICE SERVICE TESTS PASSED SUCCESSFULLY!');
  console.log('=========================================');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});

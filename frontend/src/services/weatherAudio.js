// Web Audio API ambient sound generator for weather effects (zero external files required)

class WeatherAudioEngine {
  constructor() {
    this.ctx = null;
    this.currentMode = null;
    this.gainNode = null;
    this.isPlaying = false;
    this.activeNodes = [];
    this.intervalId = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.2, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.activeNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch (e) {
        // already stopped
      }
    });
    this.activeNodes = [];
    this.isPlaying = false;
    this.currentMode = null;
  }

  setVolume(val) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime, 0.1);
    }
  }

  play(mode = 'sunny') {
    this.init();
    if (this.isPlaying && this.currentMode === mode) return;
    this.stop();
    this.isPlaying = true;
    this.currentMode = mode;

    switch (mode) {
      case 'rain':
      case 'monsoon':
        this.playRain(false);
        break;
      case 'thunderstorm':
        this.playRain(true);
        break;
      case 'sunny':
      case 'summer':
        this.playSunny();
        break;
      case 'snow':
      case 'winter':
        this.playWinter();
        break;
      case 'autumn':
        this.playWind();
        break;
      case 'spring':
        this.playSpring();
        break;
      case 'cloudy':
      default:
        this.playCloudy();
        break;
    }
  }

  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink/Brownish noise filter for gentle sound
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    return buffer;
  }

  playRain(withThunder = false) {
    if (!this.ctx) return;
    const noiseBuffer = this.createNoiseBuffer();
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Filter to simulate rain frequency
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

    const rainGain = this.ctx.createGain();
    rainGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(rainGain);
    rainGain.connect(this.gainNode);
    noise.start();
    this.activeNodes.push(noise, filter, rainGain);

    if (withThunder) {
      this.intervalId = setInterval(() => {
        if (Math.random() > 0.45) {
          this.triggerThunder();
        }
      }, 7000);
    }
  }

  triggerThunder() {
    if (!this.ctx || !this.isPlaying) return;
    const osc = this.ctx.createOscillator();
    const tGain = this.ctx.createGain();
    osc.type = 'sine';
    const now = this.ctx.currentTime;

    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 1.8);

    tGain.gain.setValueAtTime(0.01, now);
    tGain.gain.linearRampToValueAtTime(0.3, now + 0.15);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    osc.connect(tGain);
    tGain.connect(this.gainNode);
    osc.start(now);
    osc.stop(now + 2.5);
  }

  playSunny() {
    if (!this.ctx) return;
    // Warm gentle harmonic chord with occasional soft bird chirps
    const freqs = [220, 277.18, 329.63, 440];
    freqs.forEach(f => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.015, this.ctx.currentTime);
      osc.connect(gain);
      gain.connect(this.gainNode);
      osc.start();
      this.activeNodes.push(osc, gain);
    });

    // Random soft bird chirp
    this.intervalId = setInterval(() => {
      if (Math.random() > 0.5 && this.isPlaying) {
        this.triggerBirdChirp();
      }
    }, 4000);
  }

  triggerBirdChirp() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const chirpGain = this.ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 2400 + Math.random() * 800;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq + 600, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(baseFreq - 200, now + 0.18);

    chirpGain.gain.setValueAtTime(0.001, now);
    chirpGain.gain.linearRampToValueAtTime(0.04, now + 0.04);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(chirpGain);
    chirpGain.connect(this.gainNode);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playWinter() {
    if (!this.ctx) return;
    // Soft high ambient whistling wind
    const noiseBuffer = this.createNoiseBuffer();
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);
    filter.Q.setValueAtTime(4, this.ctx.currentTime);

    const winGain = this.ctx.createGain();
    winGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(winGain);
    winGain.connect(this.gainNode);
    noise.start();
    this.activeNodes.push(noise, filter, winGain);
  }

  playWind() {
    if (!this.ctx) return;
    // Gusty wind for autumn
    const noiseBuffer = this.createNoiseBuffer();
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.gainNode);
    noise.start();
    this.activeNodes.push(noise, filter, gain);
  }

  playSpring() {
    this.playSunny();
  }

  playCloudy() {
    this.playWinter();
  }
}

export const weatherAudio = new WeatherAudioEngine();

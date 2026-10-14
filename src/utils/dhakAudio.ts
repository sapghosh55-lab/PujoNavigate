// ----------------------------------------------------------------------------
// Authentic Bengali Dhak & Kashor Ghonta Synthesizer using Web Audio API
// Zero network assets, zero latency, pure synthesized rhythmic celebration!
// ----------------------------------------------------------------------------

class DhakSynthesizer {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private intervalId: number | null = null;
  private step: number = 0;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Deep Bass Dhak Strike ("Dha")
  private playDhakBass(time: number, accent: boolean = false) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const startFreq = accent ? 135 : 115;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.18);

    const initialVolume = accent ? 0.8 : 0.55;
    gain.gain.setValueAtTime(initialVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.24);
  }

  // Snappy Stick Rim Hit ("Ta / Ka")
  private playDhakRim(time: number) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(time);
  }

  // Kashor Ghonta Bronze Bell Chime ("Ting")
  private playKashor(time: number) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(2640, time);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(3960, time);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.48);
    osc2.stop(time + 0.48);
  }

  // Rhythmic 16-step iconic Durga Puja Dhak Bol
  // Step pattern:
  // 0: Dha (Accent) + Kashor
  // 2: Dha
  // 4: Ta
  // 6: Dha
  // 8: Dha (Accent) + Kashor
  // 10: Ta
  // 12: Dha
  // 14: Ta + Ta
  private tick = () => {
    if (!this.ctx || !this.isPlaying) return;
    const now = this.ctx.currentTime;
    const s = this.step % 16;

    if (s === 0) {
      this.playDhakBass(now, true);
      this.playKashor(now);
    } else if (s === 2) {
      this.playDhakBass(now);
    } else if (s === 4) {
      this.playDhakRim(now);
    } else if (s === 6) {
      this.playDhakBass(now);
    } else if (s === 8) {
      this.playDhakBass(now, true);
      this.playKashor(now);
    } else if (s === 10) {
      this.playDhakRim(now);
    } else if (s === 12) {
      this.playDhakBass(now);
    } else if (s === 14) {
      this.playDhakRim(now);
    } else if (s === 15) {
      this.playDhakRim(now + 0.05);
    }

    this.step++;
  };

  public toggle(): boolean {
    this.initContext();
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public start() {
    this.initContext();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.step = 0;
    // 16th note at ~125 BPM
    const intervalMs = (60 / 125 / 4) * 1000;
    this.intervalId = window.setInterval(this.tick, intervalMs);
  }

  public stop() {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const dhakPlayer = new DhakSynthesizer();

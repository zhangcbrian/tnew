export class SciaticaSound {
  private ctx: AudioContext | null = null;

  play() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const duration = 0.8;

    // Distortion curve
    const shaper = ctx.createWaveShaper();
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = (Math.PI + 20) * x / (Math.PI + 20 * Math.abs(x));
    }
    shaper.curve = curve;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.5, now);
    masterGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    shaper.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Oscillator 1: sawtooth 60→30 Hz
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(60, now);
    osc1.frequency.linearRampToValueAtTime(30, now + duration);
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.4, now);
    osc1.connect(gain1);
    gain1.connect(shaper);
    osc1.start(now);
    osc1.stop(now + duration);

    // Oscillator 2: sine 40→20 Hz
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(40, now);
    osc2.frequency.linearRampToValueAtTime(20, now + duration);
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.6, now);
    osc2.connect(gain2);
    gain2.connect(shaper);
    osc2.start(now);
    osc2.stop(now + duration);
  }
}

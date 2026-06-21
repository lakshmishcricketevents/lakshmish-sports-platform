/**
 * Web Audio API based Sound Synthesizer for Kabaddi Match Events.
 * Synthesizes all ticking, alert, buzzer, and crowd ambience sounds locally.
 */

export class KabaddiAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volumeLevel: 'mute' | 'low' | 'medium' | 'high' = 'mute';

  // Ambience nodes
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceInterval: NodeJS.Timeout | null = null;
  private isAmbiencePlaying: boolean = false;

  constructor() {
    // AudioContext is initialized lazily on the first user interaction / audio trigger
  }

  private init() {
    if (typeof window === 'undefined') return;
    if (this.ctx) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.updateMasterVolume();
    } catch (e) {
      console.warn('Failed to initialize AudioContext:', e);
    }
  }

  public setVolume(level: 'mute' | 'low' | 'medium' | 'high') {
    this.volumeLevel = level;
    this.init();
    this.updateMasterVolume();
  }

  public resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.warn('Failed to resume AudioContext:', e));
    }
  }

  private updateMasterVolume() {
    if (!this.masterGain) return;

    let gainValue = 0;
    switch (this.volumeLevel) {
      case 'mute':
        gainValue = 0;
        break;
      case 'low':
        gainValue = 0.08;
        break;
      case 'medium':
        gainValue = 0.25;
        break;
      case 'high':
        gainValue = 0.55;
        break;
    }
    this.masterGain.gain.setValueAtTime(gainValue, this.ctx!.currentTime);
  }

  /**
   * Plays a tick sound.
   * If secondsRemaining is <= 10, plays with increasing pitch (frequency) and urgency.
   */
  public playTick(secondsRemaining: number) {
    this.resume();
    if (!this.ctx || !this.masterGain || this.volumeLevel === 'mute') return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(this.masterGain);

      // Silent from 30 to 11 seconds.
      // Last 10 seconds only: Increasing urgency effect
      if (secondsRemaining > 10 || secondsRemaining <= 0) return;

      // Pitch increases from 650Hz (at 10s) up to 1350Hz (at 1s)
      const urgencyIndex = 10 - secondsRemaining; // 0 to 9
      const frequency = 650 + urgencyIndex * 80;
      const duration = 0.08 - urgencyIndex * 0.003; // Get slightly snappier (80ms to 53ms)

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, now);
      
      // Envelopes
      gainNode.gain.setValueAtTime(0.25 + (urgencyIndex * 0.02), now); // slightly louder at the end
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch (e) {
      console.warn('Error playing tick:', e);
    }
  }

  /**
   * Plays a professional Kabaddi dual-tone buzzer horn.
   */
  public playBuzzer() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.volumeLevel === 'mute') return;

    try {
      const now = this.ctx.currentTime;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);
      filter.connect(this.masterGain);

      // Synthesize a dual-sawtooth horn
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();
      
      const gainNode = this.ctx.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      osc3.connect(gainNode);
      gainNode.connect(filter);

      // Low frequency horn mix (A2 + E3 + A3 approximation)
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(110, now); // A2

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(165, now); // E3

      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(220, now); // A3

      gainNode.gain.setValueAtTime(0.45, now);
      // Holds solid for 1.8 seconds, then decays
      gainNode.gain.setValueAtTime(0.45, now + 1.6);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);

      osc1.stop(now + 2.1);
      osc2.stop(now + 2.1);
      osc3.stop(now + 2.1);
    } catch (e) {
      console.warn('Error playing buzzer:', e);
    }
  }

  /**
   * Plays a Do Or Die warning alert sound (two-tone pitch swoops).
   */
  public playDoOrDieAlert() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.volumeLevel === 'mute') return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc.type = 'sawtooth';
      // Pitch swoop warning siren (e.g. 260Hz -> 520Hz)
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(520, now + 0.35);
      osc.frequency.setValueAtTime(260, now + 0.4);
      osc.frequency.linearRampToValueAtTime(520, now + 0.75);

      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.7);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.start(now);
      osc.stop(now + 0.9);
    } catch (e) {
      console.warn('Error playing Do-or-Die alert:', e);
    }
  }

  /**
   * Plays a victory/celebration chime arpeggio for Super Raid / Super Tackle events.
   */
  public playCelebrationChord() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.volumeLevel === 'mute') return;

    try {
      const now = this.ctx.currentTime;
      
      // Play a fast pentatonic ascending arpeggio (C4, E4, G4, A4, C5, E5)
      const notes = [261.63, 329.63, 392.00, 440.00, 523.25, 659.25];
      
      notes.forEach((freq, idx) => {
        const noteTime = now + idx * 0.08;
        const osc = this.ctx!.createOscillator();
        const gainNode = this.ctx!.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.masterGain!);

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        gainNode.gain.setValueAtTime(0.18, noteTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);

        osc.start(noteTime);
        osc.stop(noteTime + 0.45);
      });
    } catch (e) {
      console.warn('Error playing celebration chord:', e);
    }
  }

  /**
   * Starts synthesizing stadium crowd background rumble/noise.
   */
  public startAmbience() {
    this.resume();
    if (this.isAmbiencePlaying) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    try {
      this.isAmbiencePlaying = true;
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Generate pinkish/brownish noise values
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise filter approximation
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Compensate for loss of volume in filter
      }

      this.ambienceSource = this.ctx.createBufferSource();
      this.ambienceSource.buffer = noiseBuffer;
      this.ambienceSource.loop = true;

      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(280, this.ctx.currentTime); // low rumble
      lowpass.Q.setValueAtTime(1.5, this.ctx.currentTime);

      this.ambienceGain = this.ctx.createGain();
      // Set very low default volume for ambient noise
      const defaultAmbienceGain = this.volumeLevel === 'mute' ? 0 : 0.02;
      this.ambienceGain.gain.setValueAtTime(defaultAmbienceGain, this.ctx.currentTime);

      this.ambienceSource.connect(lowpass);
      lowpass.connect(this.ambienceGain);
      this.ambienceGain.connect(this.masterGain);

      this.ambienceSource.start(0);

      // Slowly modulate volume to sound like stadium crowd swells
      this.ambienceInterval = setInterval(() => {
        if (!this.ctx || !this.ambienceGain || this.volumeLevel === 'mute') return;
        try {
          // Modulate ambience gain between 0.015 and 0.045
          const swell = 0.015 + Math.random() * 0.03;
          this.ambienceGain.gain.linearRampToValueAtTime(swell, this.ctx.currentTime + 1.2);
        } catch (err) {
          // Ignore
        }
      }, 1500);

    } catch (e) {
      console.warn('Error starting ambience noise:', e);
      this.isAmbiencePlaying = false;
    }
  }

  /**
   * Stops stadium crowd background noise.
   */
  public stopAmbience() {
    this.isAmbiencePlaying = false;
    if (this.ambienceInterval) {
      clearInterval(this.ambienceInterval);
      this.ambienceInterval = null;
    }

    try {
      if (this.ambienceSource) {
        this.ambienceSource.stop();
        this.ambienceSource.disconnect();
        this.ambienceSource = null;
      }
      if (this.ambienceGain) {
        this.ambienceGain.disconnect();
        this.ambienceGain = null;
      }
    } catch (e) {
      // Already stopped
    }
  }
}

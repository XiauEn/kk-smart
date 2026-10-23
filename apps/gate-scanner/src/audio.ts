export type GateSound = "success" | "denied" | "alarm";

/** Synthesised locally: no downloads, network dependency, or stored credentials. */
export class GateAudio {
  private context: AudioContext | null = null;
  private active = new Set<OscillatorNode>();
  private muted = false;
  private welcomeTimer: ReturnType<typeof setTimeout> | undefined;

  async unlock(): Promise<boolean> {
    if (this.muted) return false;
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
      return this.context.state === "running";
    } catch {
      return false;
    }
  }

  setMuted(value: boolean) {
    this.muted = value;
    if (value) this.stop();
  }

  private stop() {
    clearTimeout(this.welcomeTimer);
    this.welcomeTimer = undefined;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this.active.forEach((osc) => osc.stop());
    this.active.clear();
  }

  play(kind: GateSound) {
    const ctx = this.context;
    if (this.muted || !ctx || ctx.state !== "running") return;
    this.stop();
    const start = ctx.currentTime + 0.01;
    const tone = (
      frequency: number,
      offset: number,
      duration: number,
      volume: number,
      type: OscillatorType = "sine",
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      const at = start + offset;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(volume, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      this.active.add(osc);
      osc.onended = () => {
        this.active.delete(osc);
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(at);
      osc.stop(at + duration + 0.02);
      return osc;
    };
    if (kind === "success") {
      tone(880, 0, 0.55, 0.16);
      tone(1320, 0.12, 0.65, 0.1);
      this.welcomeTimer = setTimeout(() => {
        this.welcomeTimer = undefined;
        if (
          this.muted ||
          typeof speechSynthesis === "undefined" ||
          typeof SpeechSynthesisUtterance === "undefined"
        )
          return;
        const welcome = new SpeechSynthesisUtterance("Welcome to KK67");
        welcome.lang = "en-GB";
        welcome.rate = 0.95;
        welcome.volume = 1;
        speechSynthesis.speak(welcome);
      }, 850);
    } else if (kind === "denied") {
      // Mid-range square tones remain clear on small laptop/tablet speakers.
      tone(520, 0, 0.28, 0.2, "square");
      tone(390, 0.36, 0.32, 0.2, "square");
    } else {
      // Smooth rising/falling "ouuu" siren, five seconds long.
      const osc = tone(420, 0, 5, 0.2, "triangle");
      for (let i = 0; i < 5; i++) {
        osc.frequency.exponentialRampToValueAtTime(1050, start + i + 0.5);
        osc.frequency.exponentialRampToValueAtTime(420, start + i + 1);
      }
    }
  }

  dispose() {
    this.stop();
    void this.context?.close();
    this.context = null;
  }
}

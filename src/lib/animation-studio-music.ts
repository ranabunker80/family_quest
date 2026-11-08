// Estudio de Animación — música de fondo (8 temas generados con ElevenLabs, en /public).
// Suena por la bocina y entra al video, pero no mueve la boca (no pasa por el analizador de voz).

export const MUSIC = [
  { id: "feliz", label: "Feliz", emoji: "😄" },
  { id: "triste", label: "Triste", emoji: "😢" },
  { id: "drama", label: "Drama", emoji: "🎭" },
  { id: "accion", label: "Acción", emoji: "💥" },
  { id: "aventura", label: "Aventura", emoji: "🗺️" },
  { id: "misterio", label: "Misterio", emoji: "👻" },
  { id: "chistoso", label: "Chistoso", emoji: "🤪" },
  { id: "fiesta", label: "Fiesta", emoji: "🏆" },
] as const;

export const MUSIC_VOLUMES = [
  { level: 0.25, label: "Bajito", emoji: "🔈" },
  { level: 0.5, label: "Medio", emoji: "🔉" },
  { level: 0.85, label: "Fuerte", emoji: "🔊" },
] as const;

export const musicInfo = (id?: string) => MUSIC.find((m) => m.id === id);

const DUCK = 0.35; // cuánto queda la música mientras alguien habla

export class MusicPlayer {
  private ctx: AudioContext;
  private out: GainNode;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private current: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private volume = 0.5;
  private ducked = false;
  private wanted: string | null = null;

  constructor(ctx: AudioContext, outputs: AudioNode[]) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    outputs.forEach((o) => this.out.connect(o));
    this.apply();
  }

  get playing() {
    return this.current?.id ?? null;
  }

  private load(id: string): Promise<AudioBuffer> {
    let p = this.buffers.get(id);
    if (!p) {
      p = fetch(`/audio/animation-music/${id}.mp3`)
        .then((r) => r.arrayBuffer())
        .then((b) => this.ctx.decodeAudioData(b));
      this.buffers.set(id, p);
      p.catch(() => this.buffers.delete(id));
    }
    return p;
  }

  private apply() {
    const target = this.volume * (this.ducked ? DUCK : 1);
    this.out.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
  }

  setVolume(v: number) {
    this.volume = v;
    this.apply();
  }

  // Baja la música mientras alguien habla
  duck(on: boolean) {
    if (on === this.ducked) return;
    this.ducked = on;
    this.apply();
  }

  // Cambia de tema con un desvanecido corto; null = sin música
  async play(id: string | null) {
    this.wanted = id;
    if (this.current?.id === id) return;
    this.fadeOut();
    if (!id) return;
    let buf: AudioBuffer;
    try {
      buf = await this.load(id);
    } catch {
      return;
    }
    if (this.wanted !== id || this.current?.id === id) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.15);
    gain.connect(this.out);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(gain);
    src.start();
    this.current = { id, src, gain };
  }

  private fadeOut() {
    const c = this.current;
    if (!c) return;
    this.current = null;
    c.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
    setTimeout(() => {
      try {
        c.src.stop();
      } catch {
        /* ya había parado */
      }
      c.gain.disconnect();
    }, 700);
  }

  stop() {
    this.wanted = null;
    this.fadeOut();
  }
}

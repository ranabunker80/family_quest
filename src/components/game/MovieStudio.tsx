"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MOVES,
  REST_POSE,
  VOICES,
  VOICE_MAX_SECONDS,
  SPEEDS,
  MAX_TRACKS,
  MOVIE_LENGTHS,
  MIN_CLIP_SECONDS,
  clipX,
  customMoveId,
  moveInfo,
  movePose,
  type CharClip,
  type CustomBackground,
  type CustomGif,
  type CustomMove,
  type FxClip,
  type Movie,
  type MovieTrack,
  type MusicClip,
  type SavedCharacter,
} from "@/lib/animation-studio-data";
import {
  STAGE_W,
  STAGE_H,
  GROUND_Y,
  CHAR_SCALE,
  FEET_Y,
  HIP,
  drawCharacter,
  drawScene,
  loudness,
  prepareCharacter,
  type CharacterRuntime,
} from "@/lib/animation-studio-render";
import { DEFAULT_EFFECT_SIZE, EFFECTS, drawEffect, effectDone, effectInfo, type GifAnim } from "@/lib/animation-studio-effects";

// Los efectos de una sola vez (explosión) ocupan solo lo que duran
const onceLength = (kind: string) => {
  const once = EFFECTS.find((e) => e.id === kind)?.once;
  return once ? Math.ceil(once * 10) / 10 + 0.1 : null;
};
import { MUSIC, MUSIC_VOLUMES, MusicPlayer, musicInfo } from "@/lib/animation-studio-music";
import { SceneButtons, EffectButtons } from "@/components/game/StoryStudio";

const btn = "min-h-[56px] rounded-2xl font-bold transition-all active:scale-95";
const SCALE = 0.6; // tamaño de los personajes en la película
const HIP_Y = GROUND_Y - (FEET_Y - HIP[1]) * SCALE;
const K = SCALE / CHAR_SCALE;
const snap = (t: number) => Math.round(t * 10) / 10;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AnyClip = CharClip | FxClip | MusicClip;

interface Kit {
  ctx: AudioContext;
  out: GainNode; // voces → bocina y película
  dest: MediaStreamAudioDestinationNode;
  music: MusicPlayer;
}

interface VoiceNode {
  trackId: string;
  src: AudioBufferSourceNode;
  an: AnalyserNode;
  from: number;
  to: number;
}

interface Props {
  movie: Movie;
  characters: SavedCharacter[];
  backgrounds: CustomBackground[];
  bgImages: Map<string, HTMLImageElement>;
  customMoves: CustomMove[];
  gifs: CustomGif[];
  gifAnims: Map<string, GifAnim>;
  onAddGif: (file: File) => Promise<string | null>;
  onRemoveGif: (id: string) => void;
  onSave: (movie: Movie) => void;
  onAddBackground: (file: File) => Promise<string | null>;
  onRemoveBackground: (id: string) => void;
  onExit: () => void;
}

// La franja que manda en el segundo t (si se enciman, la que empezó después)
function activeClip<T extends AnyClip>(clips: T[], t: number): T | null {
  let best: T | null = null;
  for (const c of clips) if (c.start <= t && t < c.end && (!best || c.start >= best.start)) best = c;
  return best;
}

export default function MovieStudio({
  movie: initial,
  characters,
  backgrounds,
  bgImages,
  customMoves,
  gifs,
  gifAnims,
  onAddGif,
  onRemoveGif,
  onSave,
  onAddBackground,
  onRemoveBackground,
  onExit,
}: Props) {
  const [movie, setMovie] = useState<Movie>(initial);
  const [sel, setSel] = useState<{ track: string; clip: string } | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [filming, setFilming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [recClip, setRecClip] = useState<string | null>(null);
  const [micLeft, setMicLeft] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState("webm");
  const [notice, setNotice] = useState<string | null>(null);
  const [musicVol, setMusicVol] = useState<number>(MUSIC_VOLUMES[1].level);
  const [, setReady] = useState(0);
  // Al arrastrar en el escenario: dónde empieza o dónde termina de caminar
  const [walkEnd, setWalkEnd] = useState<"start" | "end">("start");
  const walkEndRef = useRef(walkEnd);
  walkEndRef.current = walkEnd;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const movieRef = useRef(movie);
  const selRef = useRef(sel);
  const timeRef = useRef(0);
  const playRef = useRef<{ from: number; t0: number; done: () => void } | null>(null);
  const runtimesRef = useRef<Map<string, CharacterRuntime>>(new Map());
  const kitRef = useRef<Kit | null>(null);
  const buffersRef = useRef<WeakMap<Blob, AudioBuffer>>(new WeakMap());
  const voicesRef = useRef<VoiceNode[]>([]);
  const micRef = useRef<{ stream: MediaStream; analyser: AnalyserNode; rec: MediaRecorder; trackId: string } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const customMovesRef = useRef(customMoves);
  const gifAnimsRef = useRef(gifAnims);
  const stageDragRef = useRef<{ id: number; x0: number; y0: number; cx: number; cy: number } | null>(null);
  const clipDragRef = useRef<{
    id: number;
    mode: "move" | "start" | "end";
    track: string;
    clip: string;
    x0: number;
    width: number;
    start: number;
    end: number;
  } | null>(null);

  movieRef.current = movie;
  selRef.current = sel;
  customMovesRef.current = customMoves;
  gifAnimsRef.current = gifAnims;

  const charById = useCallback((id: string) => characters.find((c) => c.id === id), [characters]);

  // Guardar: update = cambia y guarda; live = solo cambia (mientras arrastran)
  const live = (fn: (m: Movie) => Movie) => {
    const next = fn(movieRef.current);
    movieRef.current = next;
    setMovie(next);
  };
  const update = (fn: (m: Movie) => Movie) => {
    live((m) => ({ ...fn(m), updatedAt: Date.now() }));
    onSave(movieRef.current);
  };

  const mapClip = (trackId: string, clipId: string, fn: (c: AnyClip) => AnyClip, save = true) =>
    (save ? update : live)((m) => ({
      ...m,
      tracks: m.tracks.map((t) =>
        t.id !== trackId ? t : ({ ...t, clips: (t.clips as AnyClip[]).map((c) => (c.id === clipId ? fn(c) : c)) } as MovieTrack)
      ),
    }));

  const selected = (() => {
    if (!sel) return null;
    const track = movie.tracks.find((t) => t.id === sel.track);
    const clip = (track?.clips as AnyClip[] | undefined)?.find((c) => c.id === sel.clip);
    return track && clip ? { track, clip } : null;
  })();

  // Preparar a los personajes
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const t of movie.tracks) {
        if (t.type !== "char" || runtimesRef.current.has(t.charId)) continue;
        const c = characters.find((ch) => ch.id === t.charId);
        if (!c) continue;
        const { runtime } = await prepareCharacter(c);
        if (!alive) return;
        runtimesRef.current.set(t.charId, runtime);
        setReady((v) => v + 1);
      }
    })();
    return () => {
      alive = false;
    };
  }, [movie.tracks, characters]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // ---------- Audio ----------
  const kit = () => {
    if (!kitRef.current) {
      const ctx = new AudioContext();
      const out = ctx.createGain();
      const dest = ctx.createMediaStreamDestination();
      out.connect(ctx.destination);
      out.connect(dest);
      kitRef.current = { ctx, out, dest, music: new MusicPlayer(ctx, [ctx.destination, dest]) };
      kitRef.current.music.setVolume(musicVol);
    }
    if (kitRef.current.ctx.state === "suspended") kitRef.current.ctx.resume();
    return kitRef.current;
  };

  const decode = async (blob: Blob): Promise<AudioBuffer | null> => {
    const cached = buffersRef.current.get(blob);
    if (cached) return cached;
    try {
      const buf = await kit().ctx.decodeAudioData(await blob.arrayBuffer());
      buffersRef.current.set(blob, buf);
      return buf;
    } catch {
      return null;
    }
  };

  const stopVoices = () => {
    voicesRef.current.forEach((v) => {
      try {
        v.src.stop();
      } catch {
        /* ya había terminado */
      }
    });
    voicesRef.current = [];
  };

  // ---------- Reproducir ----------
  const pause = () => {
    const p = playRef.current;
    playRef.current = null;
    stopVoices();
    kitRef.current?.music.stop();
    setPlaying(false);
    p?.done();
  };

  const play = async (from = timeRef.current): Promise<void> => {
    const m = movieRef.current;
    if (from >= m.length - 0.05) from = 0;
    const k = kit();
    stopVoices();
    // las voces se programan todas de una vez, con su hora exacta
    for (const t of m.tracks) {
      if (t.type !== "char") continue;
      for (const c of t.clips) {
        if (!c.voice) continue;
        const buf = await decode(c.voice);
        if (!buf) continue;
        const dur = buf.duration / c.rate;
        if (c.start + dur <= from) continue;
        const src = k.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = c.rate;
        const an = k.ctx.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        an.connect(k.out);
        const wait = c.start - from;
        if (wait >= 0) src.start(k.ctx.currentTime + wait);
        else src.start(0, -wait * c.rate);
        voicesRef.current.push({ trackId: t.id, src, an, from: c.start, to: c.start + dur });
      }
    }
    timeRef.current = from;
    setPlaying(true);
    await new Promise<void>((done) => {
      playRef.current = { from, t0: performance.now(), done };
    });
  };

  // ---------- Micrófono por franja ----------
  const stopMic = () => {
    if (micRef.current?.rec.state === "recording") micRef.current.rec.stop();
  };

  const recordClip = async (trackId: string, clipId: string) => {
    if (micRef.current || typeof MediaRecorder === "undefined") return;
    pause();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setNotice("No se pudo usar el micrófono. Pide permiso a papá o mamá.");
      return;
    }
    const k = kit();
    const analyser = k.ctx.createAnalyser();
    analyser.fftSize = 1024;
    k.ctx.createMediaStreamSource(stream).connect(analyser); // sin bocina: no hay eco
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      micRef.current = null;
      setRecClip(null);
      setMicLeft(null);
      if (!chunks.length) return;
      const voice = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
      const buf = await decode(voice);
      // si la voz dura más que la franja, la franja crece
      mapClip(trackId, clipId, (c) => {
        const cc = c as CharClip;
        const need = buf ? cc.start + buf.duration / cc.rate + 0.2 : cc.end;
        return { ...cc, voice, end: snap(Math.min(movieRef.current.length, Math.max(cc.end, need))) };
      });
    };
    micRef.current = { stream, analyser, rec, trackId };
    rec.start();
    setRecClip(clipId);
    setMicLeft(VOICE_MAX_SECONDS);
  };

  useEffect(() => {
    if (micLeft === null) return;
    if (micLeft <= 0) {
      stopMic();
      return;
    }
    const t = setTimeout(() => setMicLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [micLeft]);

  // ---------- Película ----------
  const film = async () => {
    const canvas = canvasRef.current;
    if (!canvas || recorderRef.current) return;
    if (typeof MediaRecorder === "undefined") {
      setNotice("Esta tablet no permite grabar video 😕");
      return;
    }
    setSel(null);
    const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    const mime = types.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const stream = canvas.captureStream(30);
    stream.addTrack(kit().dest.stream.getAudioTracks()[0]);
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const type = rec.mimeType || mime || "video/webm";
      setVideoExt(type.includes("mp4") ? "mp4" : "webm");
      setVideoUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(new Blob(chunks, { type }));
      });
      recorderRef.current = null;
      setFilming(false);
    };
    recorderRef.current = rec;
    setFilming(true);
    timeRef.current = 0;
    setTime(0);
    rec.start();
    await sleep(300);
    await play(0);
    await sleep(500);
    if (rec.state === "recording") rec.stop();
  };

  // Al salir: soltar todo
  useEffect(
    () => () => {
      playRef.current = null;
      voicesRef.current.forEach((v) => {
        try {
          v.src.stop();
        } catch {
          /* nada */
        }
      });
      if (micRef.current?.rec.state === "recording") micRef.current.rec.stop();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      kitRef.current?.ctx.close();
    },
    []
  );

  // ---------- Escenario ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const start = performance.now();
    const mouths = new Map<string, number>();
    const levelBuf = new Float32Array(1024);
    let frame = 0;
    let lastUi = 0;

    const loop = () => {
      const now = performance.now();
      const wall = (now - start) / 1000;
      const m = movieRef.current;
      const p = playRef.current;
      if (p) {
        const t = p.from + (now - p.t0) / 1000;
        timeRef.current = Math.min(m.length, t);
        if (t >= m.length) pause();
      }
      const T = timeRef.current;
      const isPlaying = !!playRef.current;
      if (now - lastUi > 100) {
        lastUi = now;
        setTime(T);
      }
      const s = selRef.current;

      // música: la franja que toca ahora; baja cuando alguien habla
      const k = kitRef.current;
      if (k && isPlaying) {
        let tune: string | null = null;
        for (const t of m.tracks) if (t.type === "music") tune = activeClip(t.clips, T)?.music ?? tune;
        k.music.play(tune);
        k.music.duck(voicesRef.current.some((v) => v.from <= T && T < v.to));
      }

      drawScene(ctx, m.scene, wall, bgImages);
      // personajes
      for (const t of m.tracks) {
        if (t.type !== "char") continue;
        const rt = runtimesRef.current.get(t.charId);
        if (!rt) continue;
        let clip = activeClip(t.clips, T);
        let ghost = false;
        if (!clip && !isPlaying && s?.track === t.id) {
          clip = t.clips.find((c) => c.id === s.clip) ?? null;
          ghost = true;
        }
        if (!clip) continue;
        const isSel = !isPlaying && s?.clip === clip.id;
        // el elegido se ve donde lo están acomodando (inicio o final del camino)
        const cx = isSel && clip.x2 !== undefined ? (walkEndRef.current === "end" ? clip.x2 : clip.x) : ghost ? clip.x : clipX(clip, T);
        if (isSel && clip.x2 !== undefined) {
          const other = walkEndRef.current === "end" ? clip.x : clip.x2;
          ctx.save();
          ctx.globalAlpha = 0.25;
          drawCharacter(ctx, rt.caches, { ...REST_POSE, scaleX: clip.flip ? -1 : 1 }, other, HIP_Y, SCALE, rt.mouth, 0, rt.joints);
          ctx.restore();
          ctx.save();
          ctx.setLineDash([14, 10]);
          ctx.lineWidth = 6;
          ctx.strokeStyle = "rgba(255,255,255,0.8)";
          ctx.beginPath();
          ctx.moveTo(clip.x, GROUND_Y - 6);
          ctx.lineTo(clip.x2, GROUND_Y - 6);
          ctx.stroke();
          ctx.setLineDash([]);
          const dir = Math.sign(clip.x2 - clip.x) || 1;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath();
          ctx.moveTo(clip.x2 + dir * 18, GROUND_Y - 6);
          ctx.lineTo(clip.x2 - dir * 6, GROUND_Y - 22);
          ctx.lineTo(clip.x2 - dir * 6, GROUND_Y + 10);
          ctx.fill();
          ctx.restore();
        }
        const pose = ghost ? { ...REST_POSE } : movePose(clip.move, (T - clip.start) * clip.speed, customMovesRef.current);
        pose.x *= K;
        pose.y *= K;
        if (clip.flip) pose.scaleX *= -1;
        let level = 0;
        if (micRef.current?.trackId === t.id) level = loudness(micRef.current.analyser, levelBuf);
        else
          for (const v of voicesRef.current)
            if (v.trackId === t.id && v.from <= T && T < v.to) level = Math.max(level, loudness(v.an, levelBuf));
        const prev = mouths.get(t.id) ?? 0;
        const open = prev + (level - prev) * (level > prev ? 0.6 : 0.25);
        mouths.set(t.id, open);
        ctx.globalAlpha = ghost ? 0.35 : 1;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.ellipse(cx + pose.x, GROUND_Y + 4, 70 * K * Math.max(0.4, 1 + pose.y / 300), 12 * K, 0, 0, Math.PI * 2);
        ctx.fill();
        drawCharacter(ctx, rt.caches, pose, cx, HIP_Y, SCALE, rt.mouth, open, rt.joints);
        ctx.globalAlpha = 1;
        if (isSel) {
          ctx.save();
          ctx.setLineDash([10, 8]);
          ctx.lineWidth = 4;
          ctx.strokeStyle = "#c4b5fd";
          ctx.beginPath();
          ctx.ellipse(cx, GROUND_Y + 4, 85, 18, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      // efectos
      for (const t of m.tracks) {
        if (t.type !== "fx") continue;
        for (const c of t.clips) {
          const isSel = !isPlaying && s?.clip === c.id;
          const on = c.start <= T && T < c.end;
          if (on && !effectDone(c.kind, T - c.start)) drawEffect(ctx, c.kind, c.x, c.y, c.size, T - c.start, gifAnimsRef.current);
          else if (isSel) drawEffect(ctx, c.kind, c.x, c.y, c.size, wall % 2.2, gifAnimsRef.current);
          if (isSel) {
            ctx.save();
            ctx.setLineDash([10, 8]);
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(255,255,255,0.85)";
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.size * 0.55, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
      const title = m.title.trim();
      if (title) {
        ctx.font = "bold 34px system-ui, sans-serif";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.fillStyle = "#fff";
        ctx.strokeText(`🎞️ ${title}`, 24, 20);
        ctx.fillText(`🎞️ ${title}`, 24, 20);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // pause solo usa refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgImages]);

  // Arrastrar en el escenario al personaje o efecto elegido
  const onStagePointer = (e: React.PointerEvent<HTMLCanvasElement>, kind: "down" | "move" | "up") => {
    if (playRef.current || !selected || selected.track.type === "music") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * STAGE_W;
    const y = ((e.clientY - r.top) / r.height) * STAGE_H;
    const c = selected.clip as CharClip & FxClip;
    if (kind === "down") {
      e.currentTarget.setPointerCapture(e.pointerId);
      const endX = selected.track.type === "char" && c.x2 !== undefined && walkEndRef.current === "end";
      stageDragRef.current = { id: e.pointerId, x0: x, y0: y, cx: endX ? c.x2! : c.x, cy: c.y ?? 0 };
      return;
    }
    const d = stageDragRef.current;
    if (!d || d.id !== e.pointerId) return;
    if (kind === "up") {
      stageDragRef.current = null;
      onSave(movieRef.current);
      return;
    }
    const nx = Math.round(Math.max(40, Math.min(STAGE_W - 40, d.cx + x - d.x0)));
    const ny = Math.round(Math.max(20, Math.min(STAGE_H - 20, d.cy + y - d.y0)));
    const endX = selected.track.type === "char" && c.x2 !== undefined && walkEndRef.current === "end";
    mapClip(selected.track.id, c.id, (cl) => (selected.track.type === "fx" ? { ...cl, x: nx, y: ny } : endX ? { ...cl, x2: nx } : { ...cl, x: nx }), false);
  };

  // ---------- Pistas y franjas ----------
  const newClip = (track: MovieTrack, at: number): AnyClip => {
    const len = movieRef.current.length;
    const dur = track.type === "music" ? 8 : 3;
    const start = snap(Math.max(0, Math.min(len - MIN_CLIP_SECONDS, at)));
    const end = snap(Math.min(len, start + dur));
    const id = `${Date.now()}`;
    const last = (track.clips as AnyClip[])[track.clips.length - 1];
    if (track.type === "char") {
      const l = last as CharClip | undefined;
      return { id, start, end, move: l?.move ?? "idle", speed: l?.speed ?? 1, x: l?.x2 ?? l?.x ?? STAGE_W / 2, flip: l?.flip ?? false, rate: 1 };
    }
    if (track.type === "fx") {
      const l = last as FxClip | undefined;
      const kind = l?.kind ?? "boom";
      const once = onceLength(kind);
      return { id, start, end: once ? snap(Math.min(len, start + once)) : end, kind, x: l?.x ?? STAGE_W / 2, y: l?.y ?? GROUND_Y - 180, size: l?.size ?? DEFAULT_EFFECT_SIZE };
    }
    return { id, start, end, music: (last as MusicClip | undefined)?.music ?? "feliz" };
  };

  const addTrack = (track: MovieTrack) => {
    if (movieRef.current.tracks.length >= MAX_TRACKS) {
      setNotice(`Máximo ${MAX_TRACKS} pistas. Borra una para agregar otra.`);
      return;
    }
    const clip = newClip(track, track.type === "music" ? 0 : timeRef.current);
    const full = { ...track, clips: [clip] } as MovieTrack;
    update((m) => ({ ...m, tracks: [...m.tracks, full] }));
    setSel({ track: full.id, clip: clip.id });
  };

  const addCharTrack = (charId: string) => {
    setPicking(false);
    const n = movieRef.current.tracks.filter((t) => t.type === "char").length;
    const base: MovieTrack = { id: `t${Date.now()}`, type: "char", charId, clips: [] };
    if (movieRef.current.tracks.length >= MAX_TRACKS) return addTrack(base);
    const clip = { ...(newClip(base, timeRef.current) as CharClip), x: [300, 660, 480, 180, 780][n % 5] };
    update((m) => ({ ...m, tracks: [...m.tracks, { ...base, clips: [clip] }] }));
    setSel({ track: base.id, clip: clip.id });
  };

  const addClipAt = (trackId: string, at: number) => {
    const track = movieRef.current.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const clip = newClip(track, at);
    update((m) => ({
      ...m,
      tracks: m.tracks.map((t) => (t.id === trackId ? ({ ...t, clips: [...(t.clips as AnyClip[]), clip] } as MovieTrack) : t)),
    }));
    setSel({ track: trackId, clip: clip.id });
  };

  const deleteClip = (trackId: string, clipId: string) => {
    update((m) => ({
      ...m,
      tracks: m.tracks
        .map((t) => (t.id === trackId ? ({ ...t, clips: (t.clips as AnyClip[]).filter((c) => c.id !== clipId) } as MovieTrack) : t))
        .filter((t) => t.clips.length > 0),
    }));
    setSel(null);
  };

  const deleteTrack = (trackId: string) => {
    update((m) => ({ ...m, tracks: m.tracks.filter((t) => t.id !== trackId) }));
    if (selRef.current?.track === trackId) setSel(null);
  };

  const onClipPointer = (
    e: React.PointerEvent<HTMLDivElement>,
    kind: "down" | "move" | "up",
    track: MovieTrack,
    clip: AnyClip,
    mode: "move" | "start" | "end" = "move"
  ) => {
    e.stopPropagation();
    if (kind === "down") {
      if (playRef.current) pause();
      const lane = (e.currentTarget.closest("[data-lane]") as HTMLElement).getBoundingClientRect();
      // la franja entera recibe el arrastre (también si empezó en una orilla)
      ((e.currentTarget.closest("[data-clip]") as HTMLElement | null) ?? e.currentTarget).setPointerCapture(e.pointerId);
      clipDragRef.current = { id: e.pointerId, mode, track: track.id, clip: clip.id, x0: e.clientX, width: lane.width, start: clip.start, end: clip.end };
      setSel({ track: track.id, clip: clip.id });
      return;
    }
    const d = clipDragRef.current;
    if (!d || d.id !== e.pointerId) return;
    if (kind === "up") {
      clipDragRef.current = null;
      onSave(movieRef.current);
      return;
    }
    const len = movieRef.current.length;
    const dt = ((e.clientX - d.x0) / d.width) * len;
    let start = d.start, end = d.end;
    if (d.mode === "move") {
      const dur = d.end - d.start;
      start = snap(Math.max(0, Math.min(len - dur, d.start + dt)));
      end = snap(start + dur);
    } else if (d.mode === "start") start = snap(Math.max(0, Math.min(d.end - MIN_CLIP_SECONDS, d.start + dt)));
    else end = snap(Math.min(len, Math.max(d.start + MIN_CLIP_SECONDS, d.end + dt)));
    mapClip(d.track, d.clip, (c) => ({ ...c, start, end }), false);
  };

  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = snap(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * movieRef.current.length);
    if (playRef.current) pause();
    timeRef.current = t;
    setTime(t);
  };

  const setLength = () => {
    const i = MOVIE_LENGTHS.indexOf(movie.length);
    const length = MOVIE_LENGTHS[(i + 1) % MOVIE_LENGTHS.length];
    update((m) => ({
      ...m,
      length,
      // lo que quede fuera se recorta (y lo que ya no cabe se va)
      tracks: m.tracks
        .map((t) => ({ ...t, clips: (t.clips as AnyClip[]).filter((c) => c.start < length - MIN_CLIP_SECONDS / 2).map((c) => ({ ...c, end: Math.min(c.end, length) })) }) as MovieTrack)
        .filter((t) => t.clips.length > 0),
    }));
    if (timeRef.current > length) {
      timeRef.current = 0;
      setTime(0);
    }
  };

  const busy = filming || recClip !== null;
  const len = movie.length;
  const pct = (t: number) => `${(t / len) * 100}%`;
  const ticks = Array.from({ length: Math.floor(len / (len > 30 ? 5 : len > 10 ? 2 : 1)) + 1 }, (_, i) => i * (len > 30 ? 5 : len > 10 ? 2 : 1));
  const moveIds = [...MOVES.map((m) => m.id as string), ...customMoves.map((m) => customMoveId(m.id))];

  const trackHead = (t: MovieTrack) => {
    if (t.type === "char") {
      const c = charById(t.charId);
      return (
        <>
          {c?.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.thumb} alt="" className="h-10 w-8 object-contain rounded bg-[#fffdf7] shrink-0" />
          ) : (
            <span className="text-xl">❓</span>
          )}
          <span className="truncate text-xs">{c?.name || "Sin nombre"}</span>
        </>
      );
    }
    return (
      <>
        <span className="text-xl">{t.type === "fx" ? "✨" : "🎵"}</span>
        <span className="truncate text-xs">{t.type === "fx" ? "Efectos" : "Música"}</span>
      </>
    );
  };

  const clipLabel = (t: MovieTrack, c: AnyClip) => {
    if (t.type === "char") {
      const cc = c as CharClip;
      return `${moveInfo(cc.move, customMoves).emoji}${cc.voice ? "🎤" : ""}`;
    }
    if (t.type === "fx") return effectInfo((c as FxClip).kind).emoji;
    const mi = musicInfo((c as MusicClip).music);
    return `${mi?.emoji ?? "🎵"} ${mi?.label ?? ""}`;
  };

  const clipColor = (t: MovieTrack) =>
    t.type === "char" ? "bg-violet-500 border-violet-200" : t.type === "fx" ? "bg-orange-400 border-orange-100" : "bg-sky-400 border-sky-100";

  return (
    <div className="h-full flex flex-col gap-2 min-h-0 overflow-y-auto md:overflow-hidden">
      {/* Arriba: escenario + panel */}
      <div className="md:flex-1 md:min-h-0 flex flex-col md:flex-row gap-3">
        <div className="shrink-0 h-[38vh] md:h-auto md:flex-1 md:min-h-0 min-w-0 flex items-center justify-center relative">
          <canvas
            ref={canvasRef}
            width={STAGE_W}
            height={STAGE_H}
            onPointerDown={(e) => onStagePointer(e, "down")}
            onPointerMove={(e) => onStagePointer(e, "move")}
            onPointerUp={(e) => onStagePointer(e, "up")}
            onPointerCancel={(e) => onStagePointer(e, "up")}
            className="max-w-full max-h-full rounded-3xl shadow-2xl touch-none"
            style={{ touchAction: "none" }}
          />
          {filming && (
            <div className="absolute top-3 right-3 bg-red-600 text-white font-black rounded-full px-4 py-2 animate-pulse">⏺ Grabando</div>
          )}
        </div>

        <div className="md:w-72 shrink-0 flex flex-col gap-2 md:overflow-y-auto md:min-h-0 pr-1">
          {selected && selected.track.type === "char" && (() => {
            const c = selected.clip as CharClip;
            const vc = VOICES.find((v) => v.rate === c.rate) ?? VOICES[0];
            return (
              <div className="bg-violet-500/10 border-2 border-violet-400/50 rounded-2xl p-2 flex flex-col gap-2">
                <div className="text-violet-100 font-bold text-sm">
                  🎭 {charById(selected.track.charId)?.name || "Personaje"} · {c.start.toFixed(1)}–{c.end.toFixed(1)} s
                </div>
                <p className="text-[11px] text-violet-100/80">
                  {c.x2 === undefined
                    ? "Arrastra al personaje en el escenario para cambiarlo de lugar."
                    : walkEnd === "start"
                      ? "Arrastra al personaje a donde EMPIEZA a caminar."
                      : "Arrastra al personaje a donde LLEGA al final de la franja."}
                </p>
                {c.x2 === undefined ? (
                  <button
                    onClick={() => {
                      setWalkEnd("end");
                      mapClip(selected.track.id, c.id, (cl) => {
                        const x = (cl as CharClip).x;
                        return { ...cl, x2: x < STAGE_W / 2 ? Math.min(STAGE_W - 80, x + 320) : Math.max(80, x - 320) };
                      });
                    }}
                    className={`${btn} bg-emerald-500/80 text-white`}
                  >
                    🚶‍➡️ Que camine a otro lugar
                  </button>
                ) : (
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                    <button
                      onClick={() => setWalkEnd("start")}
                      className={`min-h-[48px] rounded-xl text-sm font-bold active:scale-95 ${walkEnd === "start" ? "bg-emerald-400 text-slate-900" : "bg-white/10 text-white"}`}
                    >
                      🟢 Empieza
                    </button>
                    <button
                      onClick={() => setWalkEnd("end")}
                      className={`min-h-[48px] rounded-xl text-sm font-bold active:scale-95 ${walkEnd === "end" ? "bg-emerald-400 text-slate-900" : "bg-white/10 text-white"}`}
                    >
                      🏁 Llega
                    </button>
                    <button
                      onClick={() => mapClip(selected.track.id, c.id, (cl) => ({ ...cl, x2: undefined }))}
                      className="min-h-[48px] w-12 rounded-xl bg-white/10 text-white active:scale-95"
                      aria-label="Que no camine"
                      title="Que se quede en su lugar"
                    >
                      🧍
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-1.5">
                  {moveIds.map((id) => {
                    const mi = moveInfo(id, customMoves);
                    return (
                      <button
                        key={id}
                        onClick={() => mapClip(selected.track.id, c.id, (cl) => ({ ...cl, move: id }))}
                        className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center active:scale-95 ${c.move === id ? "bg-violet-500 text-white" : "bg-white/10 text-white"}`}
                      >
                        <span className="text-lg leading-none">{mi.emoji}</span>
                        <span className="text-[9px] leading-tight truncate max-w-full px-0.5">{mi.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {SPEEDS.map((sp) => (
                    <button
                      key={sp.rate}
                      onClick={() => mapClip(selected.track.id, c.id, (cl) => ({ ...cl, speed: sp.rate }))}
                      className={`min-h-[44px] rounded-xl text-lg active:scale-95 ${c.speed === sp.rate ? "bg-sky-400" : "bg-white/10"}`}
                      title={sp.label}
                    >
                      {sp.emoji}
                    </button>
                  ))}
                  <button
                    onClick={() => mapClip(selected.track.id, c.id, (cl) => ({ ...cl, flip: !(cl as CharClip).flip }))}
                    className={`min-h-[44px] rounded-xl text-lg active:scale-95 ${c.flip ? "bg-white/30" : "bg-white/10"}`}
                    aria-label="Voltear"
                  >
                    🪞
                  </button>
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
                  {recClip === c.id ? (
                    <button onClick={stopMic} className={`${btn} bg-rose-600 text-white animate-pulse`}>⏹ Listo ({micLeft}s)</button>
                  ) : (
                    <button disabled={busy} onClick={() => recordClip(selected.track.id, c.id)} className={`${btn} bg-rose-500 text-white disabled:opacity-40`}>
                      🎤 {c.voice ? "Otra vez" : "Su voz"}
                    </button>
                  )}
                  {c.voice && (
                    <button
                      onClick={() => mapClip(selected.track.id, c.id, (cl) => ({ ...cl, rate: VOICES[(VOICES.findIndex((v) => v.rate === (cl as CharClip).rate) + 1) % VOICES.length].rate }))}
                      className={`${btn} w-14 bg-white/10 text-xl`}
                      title={vc.label}
                    >
                      {vc.emoji}
                    </button>
                  )}
                  {c.voice && (
                    <button
                      onClick={() => mapClip(selected.track.id, c.id, (cl) => ({ ...cl, voice: undefined }))}
                      className={`${btn} w-14 bg-white/10 text-white`}
                      aria-label="Borrar voz"
                    >
                      🔇
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
          {selected && selected.track.type === "fx" && (() => {
            const c = selected.clip as FxClip;
            return (
              <div className="bg-orange-400/10 border-2 border-orange-400/50 rounded-2xl p-2 flex flex-col gap-2">
                <div className="text-orange-100 font-bold text-sm">
                  {effectInfo(c.kind).emoji} {effectInfo(c.kind).label} · {c.start.toFixed(1)}–{c.end.toFixed(1)} s
                </div>
                <p className="text-[11px] text-orange-100/80">Arrástralo en el escenario. Toca otro efecto para cambiarlo.</p>
                <EffectButtons
                  onPick={(kind) =>
                    mapClip(selected.track.id, c.id, (cl) => {
                      const once = onceLength(kind);
                      const wasOnce = onceLength((cl as FxClip).kind);
                      const end = once
                        ? snap(Math.min(movieRef.current.length, cl.start + once))
                        : wasOnce
                          ? snap(Math.min(movieRef.current.length, cl.start + 3))
                          : cl.end;
                      return { ...cl, kind, end };
                    })
                  }
                  gifs={gifs}
                  gifAnims={gifAnims}
                  onAddGif={onAddGif}
                  onRemoveGif={onRemoveGif}
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={() => mapClip(selected.track.id, c.id, (cl) => ({ ...cl, size: Math.min(600, Math.round((cl as FxClip).size * 1.2)) }))} className={`${btn} bg-white/10 text-white`}>➕ Grande</button>
                  <button onClick={() => mapClip(selected.track.id, c.id, (cl) => ({ ...cl, size: Math.max(60, Math.round((cl as FxClip).size / 1.2)) }))} className={`${btn} bg-white/10 text-white`}>➖ Chico</button>
                </div>
              </div>
            );
          })()}
          {selected && selected.track.type === "music" && (() => {
            const c = selected.clip as MusicClip;
            return (
              <div className="bg-sky-400/10 border-2 border-sky-400/50 rounded-2xl p-2 flex flex-col gap-2">
                <div className="text-sky-100 font-bold text-sm">🎵 Música · {c.start.toFixed(1)}–{c.end.toFixed(1)} s</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {MUSIC.map((mu) => (
                    <button
                      key={mu.id}
                      onClick={() => mapClip(selected.track.id, c.id, (cl) => ({ ...cl, music: mu.id }))}
                      className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center active:scale-95 ${c.music === mu.id ? "bg-sky-400 text-slate-900" : "bg-white/10 text-white"}`}
                    >
                      <span className="text-lg leading-none">{mu.emoji}</span>
                      <span className="text-[9px] leading-tight">{mu.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
          {selected ? (
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <button disabled={busy} onClick={() => deleteClip(selected.track.id, selected.clip.id)} className={`${btn} bg-white/10 text-white text-sm disabled:opacity-40`}>
                🗑️ Borrar franja
              </button>
              <button onClick={() => setSel(null)} className={`${btn} bg-white/20 text-white`}>✅ Listo</button>
            </div>
          ) : (
            <>
              <input
                value={movie.title}
                onChange={(e) => update((m) => ({ ...m, title: e.target.value.slice(0, 40) }))}
                placeholder="Título de tu película"
                className="min-h-[56px] rounded-2xl bg-white/10 border border-white/20 px-4 text-white placeholder:text-white/40 text-lg shrink-0"
              />
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <button disabled={busy} onClick={() => setPicking(true)} className={`${btn} bg-violet-500 text-white text-sm leading-tight disabled:opacity-40`}>
                  ➕ 🎭<br />Personaje
                </button>
                <button
                  disabled={busy}
                  onClick={() => addTrack({ id: `t${Date.now()}`, type: "fx", clips: [] })}
                  className={`${btn} bg-orange-400 text-slate-900 text-sm leading-tight disabled:opacity-40`}
                >
                  ➕ ✨<br />Efectos
                </button>
                <button
                  disabled={busy}
                  onClick={() => addTrack({ id: `t${Date.now()}`, type: "music", clips: [] })}
                  className={`${btn} bg-sky-400 text-slate-900 text-sm leading-tight disabled:opacity-40`}
                >
                  ➕ 🎵<br />Música
                </button>
              </div>
              <div className="shrink-0">
                <SceneButtons
                  scene={movie.scene}
                  onChange={(scene) => update((m) => ({ ...m, scene }))}
                  backgrounds={backgrounds}
                  onAdd={onAddBackground}
                  onRemove={onRemoveBackground}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 shrink-0">
                <button disabled={busy || playing} onClick={setLength} className={`${btn} bg-white/10 text-white text-sm disabled:opacity-40`}>
                  🕒 Dura {movie.length} s
                </button>
                <button
                  onClick={() => {
                    const i = MUSIC_VOLUMES.findIndex((v) => v.level === musicVol);
                    const next = MUSIC_VOLUMES[(i + 1) % MUSIC_VOLUMES.length].level;
                    setMusicVol(next);
                    kitRef.current?.music.setVolume(next);
                  }}
                  className={`${btn} bg-white/10 text-white text-sm`}
                >
                  {MUSIC_VOLUMES.find((v) => v.level === musicVol)?.emoji} Música
                </button>
              </div>
              <button disabled={busy || movie.tracks.length === 0} onClick={film} className={`${btn} shrink-0 bg-red-500 text-white text-lg disabled:opacity-40`}>
                ⏺ Grabar película
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  pause();
                  onExit();
                }}
                className={`${btn} shrink-0 bg-white/5 text-white/70 text-sm disabled:opacity-40`}
              >
                ← Volver
              </button>
            </>
          )}
          {notice && <div className="bg-amber-400 text-slate-900 font-bold rounded-2xl p-3 text-center shrink-0">{notice}</div>}
        </div>
      </div>

      {/* Abajo: línea de tiempo */}
      <div className="shrink-0 md:h-[36%] md:min-h-[190px] bg-black/30 border border-white/10 rounded-2xl p-2 flex flex-col gap-1.5 min-h-0">
        <div className="flex items-center gap-2 shrink-0">
          {playing && !filming ? (
            <button onClick={pause} className="min-h-[48px] w-14 rounded-xl bg-white text-slate-900 text-xl font-bold active:scale-95">⏸</button>
          ) : (
            <button disabled={busy || movie.tracks.length === 0} onClick={() => play()} className="min-h-[48px] w-14 rounded-xl bg-white text-slate-900 text-xl font-bold active:scale-95 disabled:opacity-40">▶️</button>
          )}
          <button
            disabled={busy}
            onClick={() => {
              pause();
              timeRef.current = 0;
              setTime(0);
            }}
            className="min-h-[48px] w-12 rounded-xl bg-white/10 text-white active:scale-95 disabled:opacity-40"
            aria-label="Al principio"
          >
            ⏮
          </button>
          <span className="text-white font-mono font-bold whitespace-nowrap">{time.toFixed(1)} / {len} s</span>
          <span className="text-white/50 text-xs hidden sm:block flex-1 truncate">
            {movie.tracks.length === 0
              ? "Agrega un personaje, efectos o música. Cada franja dice cuándo sale."
              : "Toca una pista vacía para agregar una franja. Arrastra las franjas o sus orillas."}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 pr-1">
          {/* regla */}
          <div className="flex gap-1.5 shrink-0">
            <div className="w-24 shrink-0" />
            <div
              data-lane
              className="relative flex-1 h-7 rounded-md bg-white/10 touch-none cursor-pointer"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                scrub(e);
              }}
              onPointerMove={(e) => e.buttons && scrub(e)}
            >
              {ticks.map((t) => (
                <span key={t} className="absolute top-0 h-full border-l border-white/30 text-[10px] text-white/70 pl-0.5" style={{ left: pct(t) }}>
                  {t}
                </span>
              ))}
              <div className="absolute -top-0.5 h-8 w-1 bg-red-500 rounded" style={{ left: pct(time) }} />
            </div>
          </div>
          {movie.tracks.map((t) => (
            <div key={t.id} className="flex gap-1.5 shrink-0">
              <div className="w-24 shrink-0 h-11 rounded-lg bg-white/5 flex items-center gap-1 px-1 text-white">
                {trackHead(t)}
                <button disabled={busy} onClick={() => deleteTrack(t.id)} className="ml-auto text-xs opacity-60 w-6 h-10 shrink-0 disabled:opacity-20" aria-label="Borrar pista">
                  ✖️
                </button>
              </div>
              <div
                data-lane
                className="relative flex-1 h-11 rounded-lg bg-white/5 touch-none"
                style={{ touchAction: "none" }}
                onPointerDown={(e) => {
                  if (e.target !== e.currentTarget || busy) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  addClipAt(t.id, ((e.clientX - r.left) / r.width) * len);
                }}
              >
                {(t.clips as AnyClip[]).map((c) => (
                  <div
                    key={c.id}
                    data-clip
                    onPointerDown={(e) => onClipPointer(e, "down", t, c)}
                    onPointerMove={(e) => onClipPointer(e, "move", t, c)}
                    onPointerUp={(e) => onClipPointer(e, "up", t, c)}
                    onPointerCancel={(e) => onClipPointer(e, "up", t, c)}
                    className={`absolute top-1 bottom-1 rounded-md border-2 ${clipColor(t)} ${
                      sel?.clip === c.id ? "ring-4 ring-white z-10" : "opacity-90"
                    } flex items-center justify-center overflow-hidden text-sm font-bold text-slate-900 select-none`}
                    style={{ left: pct(c.start), width: pct(c.end - c.start) }}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-4 bg-black/20 cursor-ew-resize"
                      onPointerDown={(e) => onClipPointer(e, "down", t, c, "start")}
                    />
                    <span className="truncate px-4 pointer-events-none">{clipLabel(t, c)}</span>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-4 bg-black/20 cursor-ew-resize"
                      onPointerDown={(e) => onClipPointer(e, "down", t, c, "end")}
                    />
                  </div>
                ))}
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 pointer-events-none" style={{ left: pct(time) }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {picking && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 p-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            <h3 className="text-2xl font-black text-white text-center">¿Quién sale en tu película?</h3>
            <p className="text-white/70 text-center">Puedes poner al mismo personaje en varias pistas.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addCharTrack(c.id)}
                  className="bg-white/5 border-2 border-white/10 hover:border-violet-400 rounded-2xl p-2 flex flex-col gap-2 active:scale-95 transition-all"
                >
                  {c.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumb} alt="" className="w-full aspect-[200/260] object-contain rounded-xl bg-[#fffdf7]" />
                  ) : (
                    <div className="w-full aspect-[200/260] rounded-xl bg-white/10 flex items-center justify-center text-5xl">🎨</div>
                  )}
                  <span className="text-white font-bold truncate">{c.name || "Sin nombre"}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPicking(false)} className={`${btn} bg-white/10 text-white`}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {videoUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 max-w-2xl w-full flex flex-col gap-4">
            <h3 className="text-2xl font-black text-white text-center">🎬 ¡Tu película!</h3>
            <video src={videoUrl} controls autoPlay playsInline className="w-full rounded-2xl bg-black" />
            <div className="flex gap-3">
              <a
                href={videoUrl}
                download={`${(movie.title.trim() || "mi-pelicula").replace(/[^\w-]+/g, "-")}.${videoExt}`}
                className={`${btn} flex-1 bg-violet-500 text-white flex items-center justify-center`}
              >
                💾 Guardar en la tablet
              </a>
              <button
                onClick={() => {
                  URL.revokeObjectURL(videoUrl);
                  setVideoUrl(null);
                }}
                className={`${btn} flex-1 bg-white/10 text-white`}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

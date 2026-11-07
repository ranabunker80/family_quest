"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MOVES,
  SCENES,
  REST_POSE,
  VOICES,
  VOICE_MAX_SECONDS,
  MAX_CAST,
  SILENT_LINE_SECONDS,
  poseFor,
  type CustomBackground,
  type MoveId,
  type Pose,
  type SavedCharacter,
  type Story,
  type StoryLine,
} from "@/lib/animation-studio-data";
import {
  STAGE_W,
  STAGE_H,
  GROUND_Y,
  CHAR_SCALE,
  FEET_Y,
  HIP,
  blendPose,
  castLayout,
  drawCharacter,
  drawScene,
  loudness,
  prepareCharacter,
  type CharacterRuntime,
} from "@/lib/animation-studio-render";

const btn = "min-h-[56px] rounded-2xl font-bold transition-all active:scale-95";

// ---------- Botones de escenario (prehechos + fondos propios) ----------
export function SceneButtons({
  scene,
  onChange,
  backgrounds,
  onAdd,
  onRemove,
}: {
  scene: string;
  onChange: (scene: string) => void;
  backgrounds: CustomBackground[];
  onAdd: (file: File) => Promise<string | null>;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const custom = scene.startsWith("bg:") ? scene.slice(3) : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-5 gap-2">
        {SCENES.map((s) => (
          <button
            key={s.id}
            aria-label={s.label}
            onClick={() => onChange(s.id)}
            className={`${btn} text-2xl ${scene === s.id ? "bg-white text-slate-900" : "bg-white/10"}`}
          >
            {s.emoji}
          </button>
        ))}
        {backgrounds.map((b) => (
          <button
            key={b.id}
            aria-label="Mi fondo"
            onClick={() => onChange(`bg:${b.id}`)}
            className={`min-h-[56px] rounded-2xl overflow-hidden border-4 transition-all active:scale-95 ${
              custom === b.id ? "border-white" : "border-transparent"
            }`}
            style={{ backgroundImage: `url(${b.src})`, backgroundSize: "cover", backgroundPosition: "center" }}
          />
        ))}
        <button
          aria-label="Poner mi fondo"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={`${btn} bg-amber-400 text-slate-900 text-xl disabled:opacity-40`}
        >
          {busy ? "⏳" : "📷"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          const id = await onAdd(file);
          setBusy(false);
          if (id) onChange(`bg:${id}`);
        }}
      />
      {custom && (
        <button
          onClick={() => {
            onRemove(custom);
            onChange("park");
          }}
          className={`${btn} bg-white/5 text-white/70 text-sm`}
        >
          🗑️ Quitar este fondo
        </button>
      )}
    </div>
  );
}

// ---------- Historias ----------
interface Props {
  story: Story;
  characters: SavedCharacter[];
  backgrounds: CustomBackground[];
  bgImages: Map<string, HTMLImageElement>;
  onSave: (story: Story) => void;
  onAddBackground: (file: File) => Promise<string | null>;
  onRemoveBackground: (id: string) => void;
  onExit: () => void;
}

interface Kit {
  ctx: AudioContext;
  analyser: AnalyserNode;
  dest: MediaStreamAudioDestinationNode;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function StoryStudio({
  story: initial,
  characters,
  backgrounds,
  bgImages,
  onSave,
  onAddBackground,
  onRemoveBackground,
  onExit,
}: Props) {
  const [story, setStory] = useState<Story>(initial);
  const [picking, setPicking] = useState(false);
  const [recordingLine, setRecordingLine] = useState<string | null>(null);
  const [micLeft, setMicLeft] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState<number | null>(null);
  const [filming, setFilming] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState("webm");
  const [notice, setNotice] = useState<string | null>(null);
  const [, setReady] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storyRef = useRef(story);
  const runtimesRef = useRef<Map<string, CharacterRuntime>>(new Map());
  const kitRef = useRef<Kit | null>(null);
  const buffersRef = useRef<WeakMap<Blob, AudioBuffer>>(new WeakMap());
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const micRef = useRef<{ stream: MediaStream; analyser: AnalyserNode; rec: MediaRecorder; lineId: string } | null>(null);
  const playingRef = useRef(false);
  const playIndexRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  storyRef.current = story;
  playIndexRef.current = playIndex;

  const charById = useCallback((id: string) => characters.find((c) => c.id === id), [characters]);

  const update = (fn: (s: Story) => Story) => {
    const next = { ...fn(storyRef.current), updatedAt: Date.now() };
    storyRef.current = next;
    setStory(next);
    onSave(next);
  };

  // Preparar a los personajes del reparto
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const id of story.cast) {
        if (runtimesRef.current.has(id)) continue;
        const c = characters.find((ch) => ch.id === id);
        if (!c) continue;
        const { runtime } = await prepareCharacter(c);
        if (!alive) return;
        runtimesRef.current.set(id, runtime);
        setReady((v) => v + 1);
      }
    })();
    return () => {
      alive = false;
    };
  }, [story.cast, characters]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // ---------- Audio ----------
  const kit = () => {
    if (!kitRef.current) {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      const dest = ctx.createMediaStreamDestination();
      analyser.connect(ctx.destination);
      analyser.connect(dest);
      kitRef.current = { ctx, analyser, dest };
    }
    if (kitRef.current.ctx.state === "suspended") kitRef.current.ctx.resume();
    return kitRef.current;
  };

  const stopSound = () => {
    try {
      sourceRef.current?.stop();
    } catch {
      /* ya había terminado */
    }
    sourceRef.current = null;
  };

  // Reproduce la voz de un turno; regresa cuántos segundos dura
  const playLineVoice = async (line: StoryLine): Promise<number> => {
    if (!line.voice) return SILENT_LINE_SECONDS;
    const k = kit();
    let buf = buffersRef.current.get(line.voice);
    if (!buf) {
      try {
        buf = await k.ctx.decodeAudioData(await line.voice.arrayBuffer());
        buffersRef.current.set(line.voice, buf);
      } catch {
        return SILENT_LINE_SECONDS;
      }
    }
    stopSound();
    const src = k.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = line.rate;
    src.connect(k.analyser);
    sourceRef.current = src;
    src.start();
    return buf.duration / line.rate;
  };

  const stopPlaying = () => {
    playingRef.current = false;
    stopSound();
    setPlaying(false);
    setPlayIndex(null);
  };

  // Reproduce los turnos [from, to)
  const play = async (from = 0, to = storyRef.current.lines.length): Promise<void> => {
    const lines = storyRef.current.lines.slice(from, to).filter((l) => storyRef.current.cast.includes(l.charId));
    if (!lines.length) {
      setNotice("Agrega un turno para que alguien hable 🎤");
      return;
    }
    stopSound();
    playingRef.current = true;
    setPlaying(true);
    for (const line of lines) {
      if (!playingRef.current) break;
      setPlayIndex(storyRef.current.lines.findIndex((l) => l.id === line.id));
      const secs = await playLineVoice(line);
      const until = performance.now() + secs * 1000 + 400;
      while (playingRef.current && performance.now() < until) await sleep(80);
    }
    stopPlaying();
  };

  // ---------- Micrófono por turno ----------
  const stopMic = () => {
    if (micRef.current?.rec.state === "recording") micRef.current.rec.stop();
  };

  const recordLine = async (lineId: string) => {
    if (micRef.current || typeof MediaRecorder === "undefined") return;
    stopPlaying();
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
    const mime = types.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      micRef.current = null;
      setRecordingLine(null);
      setMicLeft(null);
      if (!chunks.length) return;
      const voice = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
      update((s) => ({ ...s, lines: s.lines.map((l) => (l.id === lineId ? { ...l, voice } : l)) }));
    };
    micRef.current = { stream, analyser, rec, lineId };
    rec.start();
    setRecordingLine(lineId);
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
    rec.start();
    await sleep(500);
    await play();
    await sleep(600);
    if (rec.state === "recording") rec.stop();
  };

  // Al salir: soltar todo
  useEffect(
    () => () => {
      playingRef.current = false;
      try {
        sourceRef.current?.stop();
      } catch {
        /* nada */
      }
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
    const current = new Map<string, Pose>();
    const mouths = new Map<string, number>();
    const levelBuf = new Float32Array(1024);
    let frame = 0;

    const loop = () => {
      const t = (performance.now() - start) / 1000;
      const s = storyRef.current;
      const idx = playIndexRef.current;
      const line = playingRef.current && idx !== null ? s.lines[idx] : null;
      const micLine = micRef.current ? s.lines.find((l) => l.id === micRef.current!.lineId) : null;
      drawScene(ctx, s.scene, t, bgImages);
      const { xs, scale } = castLayout(s.cast.length);
      const k = scale / CHAR_SCALE;
      const hipY = GROUND_Y - (FEET_Y - HIP[1]) * scale;
      s.cast.forEach((id, i) => {
        const rt = runtimesRef.current.get(id);
        if (!rt) return;
        const speaking = line?.charId === id;
        const move: MoveId = speaking ? line!.move : "idle";
        const target = poseFor(move, t + i * 0.7);
        target.x *= k;
        target.y *= k;
        if (s.flips[i]) target.scaleX *= -1;
        const pose = blendPose(current.get(id) ?? { ...REST_POSE }, target, 0.5);
        current.set(id, pose);
        // la boca: del que habla ahora, o del que está grabando su voz
        let level = 0;
        if (micLine?.charId === id && micRef.current) level = loudness(micRef.current.analyser, levelBuf);
        else if (speaking && sourceRef.current && kitRef.current) level = loudness(kitRef.current.analyser, levelBuf);
        const prev = mouths.get(id) ?? 0;
        const open = prev + (level - prev) * (level > prev ? 0.6 : 0.25);
        mouths.set(id, open);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.ellipse(xs[i] + pose.x, GROUND_Y + 4, 70 * k * Math.max(0.4, 1 + pose.y / 300), 12 * k, 0, 0, Math.PI * 2);
        ctx.fill();
        drawCharacter(ctx, rt.caches, pose, xs[i], hipY, scale, rt.mouth, open);
      });
      // título y quién habla
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.fillStyle = "#fff";
      const title = s.title.trim();
      if (title) {
        ctx.font = "bold 34px system-ui, sans-serif";
        ctx.strokeText(`📖 ${title}`, 24, 20);
        ctx.fillText(`📖 ${title}`, 24, 20);
      }
      const speaker = line ? runtimesRef.current.get(line.charId)?.name.trim() : "";
      if (speaker) {
        ctx.font = "bold 30px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.strokeText(`🗣️ ${speaker}`, STAGE_W / 2, STAGE_H - 12);
        ctx.fillText(`🗣️ ${speaker}`, STAGE_W / 2, STAGE_H - 12);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [bgImages]);

  // ---------- Reparto y turnos ----------
  const addToCast = (id: string) => {
    setPicking(false);
    update((s) => (s.cast.includes(id) || s.cast.length >= MAX_CAST ? s : { ...s, cast: [...s.cast, id], flips: [...s.flips, false] }));
  };

  const removeFromCast = (i: number) => {
    update((s) => {
      const gone = s.cast[i];
      const cast = s.cast.filter((_, j) => j !== i);
      const flips = s.flips.filter((_, j) => j !== i);
      // sus turnos pasan al primero que quede
      const lines = s.lines.map((l) => (l.charId === gone ? { ...l, charId: cast[0] ?? "" } : l));
      return { ...s, cast, flips, lines };
    });
  };

  const addLine = () => {
    update((s) => {
      if (!s.cast.length) return s;
      const last = s.lines[s.lines.length - 1];
      const next = last ? s.cast[(s.cast.indexOf(last.charId) + 1) % s.cast.length] : s.cast[0];
      const line: StoryLine = { id: `${Date.now()}`, charId: next ?? s.cast[0], move: "idle", rate: 1 };
      return { ...s, lines: [...s.lines, line] };
    });
  };

  const editLine = (id: string, fn: (l: StoryLine) => StoryLine) =>
    update((s) => ({ ...s, lines: s.lines.map((l) => (l.id === id ? fn(l) : l)) }));

  const moveLineUp = (i: number) =>
    update((s) => {
      if (i === 0) return s;
      const lines = [...s.lines];
      [lines[i - 1], lines[i]] = [lines[i], lines[i - 1]];
      return { ...s, lines };
    });

  const cycle = <T,>(list: readonly T[], cur: T) => list[(list.indexOf(cur) + 1) % list.length];

  const busy = playing || filming || recordingLine !== null;

  return (
    <div className="h-full flex flex-col md:flex-row gap-3 min-h-0 overflow-y-auto md:overflow-hidden">
      {/* Escenario + turnos */}
      <div className="md:flex-1 min-w-0 md:min-h-0 flex flex-col gap-3">
        <div className="shrink-0 h-[40vh] md:h-auto md:flex-[3] md:min-h-0 flex items-center justify-center relative">
          <canvas ref={canvasRef} width={STAGE_W} height={STAGE_H} className="max-w-full max-h-full rounded-3xl shadow-2xl" />
          {filming && (
            <div className="absolute top-3 right-3 bg-red-600 text-white font-black rounded-full px-4 py-2 animate-pulse">⏺ Grabando</div>
          )}
        </div>
        <div className="md:flex-[2] md:min-h-0 md:overflow-y-auto flex flex-col gap-2 pr-1">
          {story.lines.length === 0 && (
            <div className="bg-white/5 rounded-2xl p-4 text-white/70 text-center">
              {story.cast.length
                ? "Toca «➕ Agregar turno»: elige quién habla, qué hace y graba su voz 🎤"
                : "Primero agrega a tus personajes →"}
            </div>
          )}
          {story.lines.map((line, i) => {
            const c = charById(line.charId);
            const mv = MOVES.find((m) => m.id === line.move)!;
            const vc = VOICES.find((v) => v.rate === line.rate) ?? VOICES[0];
            const rec = recordingLine === line.id;
            return (
              <div
                key={line.id}
                className={`flex items-center gap-2 rounded-2xl p-1.5 border-2 ${
                  playIndex === i ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/5"
                }`}
              >
                <span className="w-7 text-center text-white/60 font-bold">{i + 1}</span>
                <button
                  disabled={busy}
                  onClick={() => editLine(line.id, (l) => ({ ...l, charId: cycle(story.cast, l.charId) }))}
                  className={`${btn} flex-1 min-w-0 flex items-center gap-2 px-2 bg-white/10 text-white text-left`}
                  title="Quién habla"
                >
                  {c?.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumb} alt="" className="h-11 w-9 object-contain rounded-lg bg-[#fffdf7] shrink-0" />
                  ) : (
                    <span className="text-2xl">❓</span>
                  )}
                  <span className="truncate">{c?.name || "Sin nombre"}</span>
                </button>
                <button
                  disabled={busy}
                  onClick={() => editLine(line.id, (l) => ({ ...l, move: cycle(MOVES.map((m) => m.id), l.move) }))}
                  className={`${btn} w-20 flex flex-col items-center justify-center bg-white/10 text-white`}
                  title="Qué hace"
                >
                  <span className="text-xl">{mv.emoji}</span>
                  <span className="text-[10px]">{mv.label}</span>
                </button>
                {rec ? (
                  <button onClick={stopMic} className={`${btn} w-20 bg-rose-600 text-white animate-pulse`}>
                    ⏹ {micLeft}s
                  </button>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => recordLine(line.id)}
                    className={`${btn} w-20 ${line.voice ? "bg-white/10 text-white" : "bg-rose-500 text-white"}`}
                    title="Grabar voz"
                  >
                    🎤{line.voice ? "🔁" : ""}
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => editLine(line.id, (l) => ({ ...l, rate: cycle(VOICES.map((v) => v.rate), l.rate) }))}
                  className={`${btn} w-14 bg-white/10 text-white text-xl`}
                  title={vc.label}
                >
                  {vc.emoji}
                </button>
                <button
                  disabled={busy}
                  onClick={() => play(i, i + 1)}
                  className={`${btn} w-14 bg-white/10 text-white text-xl`}
                  aria-label="Escuchar este turno"
                >
                  ▶️
                </button>
                <button
                  disabled={busy || i === 0}
                  onClick={() => moveLineUp(i)}
                  className={`${btn} w-12 bg-white/10 text-white disabled:opacity-30`}
                  aria-label="Subir turno"
                >
                  ⬆️
                </button>
                <button
                  disabled={busy}
                  onClick={() => update((s) => ({ ...s, lines: s.lines.filter((l) => l.id !== line.id) }))}
                  className={`${btn} w-12 bg-white/10 text-white`}
                  aria-label="Borrar turno"
                >
                  🗑️
                </button>
              </div>
            );
          })}
          {story.cast.length > 0 && (
            <button disabled={busy} onClick={addLine} className={`${btn} shrink-0 bg-white/15 text-white disabled:opacity-40`}>
              ➕ Agregar turno
            </button>
          )}
        </div>
      </div>

      {/* Panel */}
      <div className="md:w-64 shrink-0 flex flex-col gap-3 md:overflow-y-auto">
        <input
          value={story.title}
          onChange={(e) => update((s) => ({ ...s, title: e.target.value.slice(0, 40) }))}
          placeholder="Título de tu historia"
          className="min-h-[56px] rounded-2xl bg-white/10 border border-white/20 px-4 text-white placeholder:text-white/40 text-lg shrink-0"
        />
        <div className="bg-white/5 border border-white/10 rounded-2xl p-2 flex flex-col gap-2 shrink-0">
          <div className="text-white/80 font-bold text-sm px-1">🎭 Personajes ({story.cast.length}/{MAX_CAST})</div>
          {story.cast.map((id, i) => {
            const c = charById(id);
            return (
              <div key={id} className="flex items-center gap-2">
                {c?.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumb} alt="" className="h-14 w-11 object-contain rounded-lg bg-[#fffdf7]" />
                ) : (
                  <span className="text-2xl">❓</span>
                )}
                <span className="flex-1 truncate text-white font-bold">{c?.name || "Sin nombre"}</span>
                <button
                  disabled={busy}
                  aria-label="Voltear"
                  onClick={() => update((s) => ({ ...s, flips: s.flips.map((f, j) => (j === i ? !f : f)) }))}
                  className={`${btn} w-12 bg-white/10 text-white`}
                >
                  🪞
                </button>
                <button
                  disabled={busy}
                  aria-label="Quitar personaje"
                  onClick={() => removeFromCast(i)}
                  className={`${btn} w-12 bg-white/10 text-white`}
                >
                  ✖️
                </button>
              </div>
            );
          })}
          {story.cast.length < MAX_CAST && (
            <button disabled={busy} onClick={() => setPicking(true)} className={`${btn} bg-violet-500 text-white disabled:opacity-40`}>
              ➕ Agregar personaje
            </button>
          )}
        </div>
        <div className="shrink-0">
          <SceneButtons
            scene={story.scene}
            onChange={(scene) => update((s) => ({ ...s, scene }))}
            backgrounds={backgrounds}
            onAdd={onAddBackground}
            onRemove={onRemoveBackground}
          />
        </div>
        {playing && !filming ? (
          <button onClick={stopPlaying} className={`${btn} shrink-0 bg-white/20 text-white text-lg`}>
            ⏹ Parar
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => play()}
            className={`${btn} shrink-0 bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white text-lg disabled:opacity-40`}
          >
            ▶️ Ver la historia
          </button>
        )}
        <button
          disabled={busy}
          onClick={film}
          className={`${btn} shrink-0 bg-red-500 text-white text-lg disabled:opacity-40`}
        >
          ⏺ Grabar película
        </button>
        <button
          disabled={filming || recordingLine !== null}
          onClick={() => {
            stopPlaying();
            onExit();
          }}
          className={`${btn} shrink-0 bg-white/5 text-white/70 text-sm`}
        >
          ← Volver
        </button>
        {notice && <div className="bg-amber-400 text-slate-900 font-bold rounded-2xl p-3 text-center">{notice}</div>}
      </div>

      {picking && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 p-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            <h3 className="text-2xl font-black text-white text-center">¿Quién sale en tu historia?</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {characters
                .filter((c) => !story.cast.includes(c.id))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => addToCast(c.id)}
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
            {characters.every((c) => story.cast.includes(c.id)) && (
              <p className="text-white/70 text-center">Ya están todos tus personajes. Crea otro en «Mis personajes».</p>
            )}
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
                download={`${(story.title.trim() || "mi-historia").replace(/[^\w-]+/g, "-")}.${videoExt}`}
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

"use client";

// Animación por fotogramas con varios personajes a la vez:
// acomodan a todos con sus puntitos, toman la foto (fotograma), los mueven un poquito, otra foto…
// Al reproducir, todos pasan suave de un fotograma al siguiente, así pueden interactuar entre ellos.
import { useState, useRef, useEffect, useCallback } from "react";
import {
  REST_POSE,
  POSE_KEYS,
  FRAME_SECS,
  MAX_FRAMES,
  MAX_FRAME_CAST,
  type CustomBackground,
  type FrameAnim,
  type FrameShot,
  type PartId,
  type Pose,
  type SavedCharacter,
} from "@/lib/animation-studio-data";
import {
  STAGE_W,
  STAGE_H,
  GROUND_Y,
  FEET_Y,
  HIP,
  dragPuppet,
  drawCharacter,
  drawScene,
  prepareCharacter,
  puppetHandles,
  puppetTips,
  type CharacterRuntime,
  type PuppetTips,
} from "@/lib/animation-studio-render";
import { MUSIC, MusicPlayer } from "@/lib/animation-studio-music";
import { SceneButtons } from "@/components/game/StoryStudio";

const btn = "min-h-[56px] rounded-2xl font-bold transition-all active:scale-95";
const SCALE = 0.55; // caben hasta 4 personajes
const HIP_X = STAGE_W / 2;
const HIP_Y = GROUND_Y - (FEET_Y - HIP[1]) * SCALE;
const GRAB_RADIUS = 60;
const PICK_RADIUS = 150; // tocar cerca de otro personaje lo elige
const LOOP_PAUSE = 0.6; // segundos quieto en el último fotograma antes de repetir
const SLOT_X = [-250, 250, -85, 85];
const CAST_COLORS = ["#f472b6", "#38bdf8", "#facc15", "#4ade80"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Handle = PartId | "move";

const HANDLE_STYLE: Record<Handle, { color: string; label: string }> = {
  armL: { color: "#ef4444", label: "✋" },
  armR: { color: "#ef4444", label: "✋" },
  legL: { color: "#3b82f6", label: "🦶" },
  legR: { color: "#3b82f6", label: "🦶" },
  head: { color: "#facc15", label: "🙂" },
  body: { color: "#22c55e", label: "👕" },
  move: { color: "#ffffff", label: "✥" },
};

// Pose guardada: [x, y, body, head, armL, armR, legL, legR, flip, hidden]
const FLIP = POSE_KEYS.length;
const HIDDEN = POSE_KEYS.length + 1;

const restArr = (slot: number): number[] => {
  const p = { ...REST_POSE, x: SLOT_X[slot % SLOT_X.length] };
  return [...POSE_KEYS.map((k) => p[k]), slot % 2 === 1 ? 1 : 0, 0];
};

const toPose = (a: number[]): Pose => {
  const p: Pose = { ...REST_POSE };
  POSE_KEYS.forEach((k, i) => {
    p[k] = a[i];
  });
  return p;
};

const fromPose = (p: Pose, a: number[]): number[] => [...POSE_KEYS.map((k) => p[k]), a[FLIP], a[HIDDEN]];

// Momento en que llega cada fotograma
const frameTimes = (frames: FrameShot[]) => {
  const ts = [0];
  for (let i = 1; i < frames.length; i++) ts.push(ts[i - 1] + frames[i].secs);
  return ts;
};

// Dónde está cada personaje en el segundo t de la animación (y qué tan visible)
function poseAt(frames: FrameShot[], ts: number[], ci: number, t: number): { pose: Pose; flip: boolean; alpha: number } | null {
  let i = 0;
  while (i + 1 < frames.length && ts[i + 1] <= t) i++;
  const a = frames[i].poses[ci];
  const b = frames[Math.min(i + 1, frames.length - 1)].poses[ci];
  if (!a || !b) return null;
  const span = i + 1 < frames.length ? ts[i + 1] - ts[i] : 0;
  const k = span > 0 ? Math.max(0, Math.min(1, (t - ts[i]) / span)) : 0;
  const ha = a[HIDDEN] === 1, hb = b[HIDDEN] === 1;
  if (ha && hb) return null;
  // aparece o desaparece: se queda en su lugar y se desvanece
  if (ha || hb) {
    const src = ha ? b : a;
    return { pose: toPose(src), flip: src[FLIP] === 1, alpha: ha ? k : 1 - k };
  }
  const mix = a.slice(0, POSE_KEYS.length).map((v, j) => v + (b[j] - v) * k);
  return { pose: toPose(mix), flip: (k < 0.5 ? a : b)[FLIP] === 1, alpha: 1 };
}

interface Props {
  anim: FrameAnim;
  characters: SavedCharacter[];
  backgrounds: CustomBackground[];
  bgImages: Map<string, HTMLImageElement>;
  startPicking?: boolean;
  onSave: (anim: FrameAnim) => void;
  onAddBackground: (file: File) => Promise<string | null>;
  onRemoveBackground: (id: string) => void;
  onExit: () => void;
}

export default function FrameStudio({ anim: initial, characters, backgrounds, bgImages, startPicking, onSave, onAddBackground, onRemoveBackground, onExit }: Props) {
  const [anim, setAnim] = useState<FrameAnim>(initial);
  const [cur, setCur] = useState(0);
  const [selChar, setSelChar] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playIdx, setPlayIdx] = useState(0);
  const [filming, setFilming] = useState(false);
  const [picking, setPicking] = useState(!!startPicking && initial.cast.length === 0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState("webm");
  const [notice, setNotice] = useState<string | null>(null);
  const [, setReady] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(anim);
  const curRef = useRef(cur);
  const selRef = useRef(selChar);
  const runtimesRef = useRef<Map<string, CharacterRuntime>>(new Map());
  const tipsRef = useRef<Map<string, PuppetTips>>(new Map());
  const dragsRef = useRef<Map<number, { ci: number; h: Handle; f0: [number, number]; a0: number[] }>>(new Map());
  const playRef = useRef<{ t0: number; once: boolean; done?: () => void } | null>(null);
  const kitRef = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode; music: MusicPlayer } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const thumbsRef = useRef<Map<string, { key: string; url: string }>>(new Map());
  const [, setThumbTick] = useState(0);

  animRef.current = anim;
  curRef.current = cur;
  selRef.current = selChar;

  const charById = useCallback((id: string) => characters.find((c) => c.id === id), [characters]);

  // live = solo cambia (mientras arrastran); update = cambia y guarda
  const live = (fn: (a: FrameAnim) => FrameAnim) => {
    const next = fn(animRef.current);
    animRef.current = next;
    setAnim(next);
  };
  const update = (fn: (a: FrameAnim) => FrameAnim) => {
    live((a) => ({ ...fn(a), updatedAt: Date.now() }));
    onSave(animRef.current);
  };

  const setPoseArr = (fi: number, ci: number, arr: number[], save: boolean) =>
    (save ? update : live)((a) => ({
      ...a,
      frames: a.frames.map((f, i) => (i !== fi ? f : { ...f, poses: f.poses.map((p, j) => (j === ci ? arr : p)) })),
    }));

  // Preparar a los personajes
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const id of anim.cast) {
        if (runtimesRef.current.has(id)) continue;
        const c = characters.find((ch) => ch.id === id);
        if (!c) continue;
        const { runtime } = await prepareCharacter(c);
        if (!alive) return;
        runtimesRef.current.set(id, runtime);
        tipsRef.current.set(id, puppetTips(runtime.caches, runtime.joints));
        setReady((v) => v + 1);
      }
    })();
    return () => {
      alive = false;
    };
  }, [anim.cast, characters]);

  // Audio (solo la música)
  const kit = () => {
    if (!kitRef.current) {
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      kitRef.current = { ctx, dest, music: new MusicPlayer(ctx, [ctx.destination, dest]) };
      kitRef.current.music.setVolume(0.5);
    }
    if (kitRef.current.ctx.state === "suspended") kitRef.current.ctx.resume();
    return kitRef.current;
  };

  const stop = useCallback(() => {
    const p = playRef.current;
    playRef.current = null;
    setPlaying(false);
    kitRef.current?.music.play(null);
    p?.done?.();
  }, []);

  const play = (once = false) =>
    new Promise<void>((done) => {
      if (animRef.current.frames.length < 2) return done();
      dragsRef.current.clear();
      const k = kit();
      k.music.play(animRef.current.music ?? null);
      playRef.current = { t0: performance.now(), once, done };
      setPlaying(true);
    });

  // ---------- Escenario ----------
  const handlesOf = (ci: number, arr: number[]) => {
    const id = animRef.current.cast[ci];
    const tips = tipsRef.current.get(id);
    const rt = runtimesRef.current.get(id);
    if (!tips || !rt) return null;
    const pose = toPose(arr);
    const hs = puppetHandles(tips, pose, HIP_X, HIP_Y, SCALE, rt.joints);
    if (arr[FLIP] === 1) {
      const cx = HIP_X + pose.x;
      (Object.keys(hs) as Handle[]).forEach((h) => {
        hs[h] = [2 * cx - hs[h][0], hs[h][1]];
      });
    }
    return hs;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const start = performance.now();
    let frame = 0;
    let lastUi = 0;

    const drawOne = (ci: number, pose: Pose, flip: boolean, alpha: number) => {
      const rt = runtimesRef.current.get(animRef.current.cast[ci]);
      if (!rt) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(HIP_X + pose.x, GROUND_Y + 4, 60 * Math.max(0.4, 1 + pose.y / 300), 10, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCharacter(ctx, rt.caches, { ...pose, scaleX: flip ? -1 : 1 }, HIP_X, HIP_Y, SCALE, rt.mouth, 0, rt.joints);
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      const now = performance.now();
      const a = animRef.current;
      const ts = frameTimes(a.frames);
      const total = ts[ts.length - 1];
      drawScene(ctx, a.scene, (now - start) / 1000, bgImages);
      const p = playRef.current;
      if (p) {
        let t = (now - p.t0) / 1000;
        if (p.once && t >= total + LOOP_PAUSE) {
          stop();
          t = total;
        }
        t = t % (total + LOOP_PAUSE);
        a.cast.forEach((_, ci) => {
          const at = poseAt(a.frames, ts, ci, t);
          if (at) drawOne(ci, at.pose, at.flip, at.alpha);
        });
        if (now - lastUi > 100) {
          lastUi = now;
          let i = 0;
          while (i + 1 < ts.length && ts[i + 1] <= t) i++;
          setPlayIdx(i);
        }
      } else {
        const fi = Math.min(curRef.current, a.frames.length - 1);
        const shot = a.frames[fi];
        // fantasma del fotograma anterior, para ver cuánto se movieron
        if (fi > 0) {
          a.frames[fi - 1].poses.forEach((arr, ci) => {
            if (arr && arr[HIDDEN] !== 1) drawOne(ci, toPose(arr), arr[FLIP] === 1, 0.25);
          });
        }
        shot?.poses.forEach((arr, ci) => {
          if (!arr) return;
          if (arr[HIDDEN] === 1) {
            if (ci === selRef.current) drawOne(ci, toPose(arr), arr[FLIP] === 1, 0.2);
            return;
          }
          drawOne(ci, toPose(arr), arr[FLIP] === 1, 1);
        });
        // etiqueta de color sobre cada personaje y puntitos del elegido
        shot?.poses.forEach((arr, ci) => {
          if (!arr) return;
          const hs = handlesOf(ci, arr);
          if (!hs) return;
          const top = Math.min(hs.head[1], hs.armL[1], hs.armR[1]) - 46;
          ctx.beginPath();
          ctx.arc(hs.move[0], Math.max(24, top), 16, 0, Math.PI * 2);
          ctx.fillStyle = CAST_COLORS[ci % CAST_COLORS.length];
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#111827";
          ctx.stroke();
          ctx.fillStyle = "#111827";
          ctx.font = "bold 18px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(ci + 1), hs.move[0], Math.max(24, top) + 1);
          if (ci !== selRef.current || arr[HIDDEN] === 1) return;
          const active = [...dragsRef.current.values()].filter((d) => d.ci === ci).map((d) => d.h);
          (Object.keys(hs) as Handle[]).forEach((h) => {
            const [hx, hy] = hs[h];
            ctx.beginPath();
            ctx.arc(hx, hy, active.includes(h) ? 26 : 21, 0, Math.PI * 2);
            ctx.fillStyle = HANDLE_STYLE[h].color;
            ctx.globalAlpha = 0.85;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 4;
            ctx.strokeStyle = h === "move" ? "#111827" : "#ffffff";
            ctx.stroke();
            ctx.font = h === "move" ? "bold 24px system-ui, sans-serif" : "19px sans-serif";
            ctx.fillStyle = "#111827";
            ctx.fillText(HANDLE_STYLE[h].label, hx, hy + 1);
          });
        });
      }
      const title = a.title.trim();
      if (title && p) {
        ctx.font = "bold 34px system-ui, sans-serif";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.fillStyle = "#fff";
        ctx.strokeText(`📸 ${title}`, 24, 20);
        ctx.fillText(`📸 ${title}`, 24, 20);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // handlesOf y stop solo leen refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgImages]);

  // Miniaturas de los fotogramas (solo se vuelven a pintar las que cambiaron)
  useEffect(() => {
    const t = setTimeout(() => {
      let changed = false;
      const a = animRef.current;
      for (const f of a.frames) {
        const key = `${a.scene}|${a.cast.join(",")}|${JSON.stringify(f.poses)}|${runtimesRef.current.size}`;
        if (thumbsRef.current.get(f.id)?.key === key) continue;
        const c = document.createElement("canvas");
        c.width = 192;
        c.height = 120;
        const ctx = c.getContext("2d")!;
        ctx.scale(c.width / STAGE_W, c.height / STAGE_H);
        drawScene(ctx, a.scene, 0, bgImages);
        f.poses.forEach((arr, ci) => {
          const rt = runtimesRef.current.get(a.cast[ci]);
          if (!arr || !rt || arr[HIDDEN] === 1) return;
          drawCharacter(ctx, rt.caches, { ...toPose(arr), scaleX: arr[FLIP] === 1 ? -1 : 1 }, HIP_X, HIP_Y, SCALE, rt.mouth, 0, rt.joints);
        });
        thumbsRef.current.set(f.id, { key, url: c.toDataURL("image/jpeg", 0.7) });
        changed = true;
      }
      if (changed) setThumbTick((v) => v + 1);
    }, 250);
    return () => clearTimeout(t);
  });

  const toStage = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * STAGE_W, ((e.clientY - r.top) / r.height) * STAGE_H];
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (playRef.current) return;
    const pt = toStage(e);
    const shot = animRef.current.frames[curRef.current];
    if (!shot) return;
    const busy = (ci: number, h: Handle) => [...dragsRef.current.values()].some((d) => d.ci === ci && d.h === h);
    // primero los puntitos del elegido; luego, tocar cerca de otro personaje lo elige y lo mueve
    let best: { ci: number; h: Handle; d: number } | null = null;
    const sel = selRef.current;
    const hsSel = shot.poses[sel] && shot.poses[sel]![HIDDEN] !== 1 ? handlesOf(sel, shot.poses[sel]!) : null;
    if (hsSel)
      (Object.keys(hsSel) as Handle[]).forEach((h) => {
        const d = Math.hypot(hsSel[h][0] - pt[0], hsSel[h][1] - pt[1]);
        if (d < GRAB_RADIUS && !busy(sel, h) && (!best || d < best.d)) best = { ci: sel, h, d };
      });
    if (!best)
      shot.poses.forEach((arr, ci) => {
        if (!arr || arr[HIDDEN] === 1 || ci === sel) return;
        const hs = handlesOf(ci, arr);
        if (!hs) return;
        const d = Math.min(...(Object.values(hs) as [number, number][]).map(([x, y]) => Math.hypot(x - pt[0], y - pt[1])));
        if (d < PICK_RADIUS && !busy(ci, "move") && (!best || d < best.d)) best = { ci, h: "move", d };
      });
    if (!best) return;
    const b = best as { ci: number; h: Handle; d: number };
    if (b.ci !== sel) setSelChar(b.ci);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragsRef.current.set(e.pointerId, { ci: b.ci, h: b.h, f0: pt, a0: shot.poses[b.ci]! });
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragsRef.current.get(e.pointerId);
    if (!d) return;
    const fi = curRef.current;
    const arr = animRef.current.frames[fi]?.poses[d.ci];
    const id = animRef.current.cast[d.ci];
    const tips = tipsRef.current.get(id);
    const rt = runtimesRef.current.get(id);
    if (!arr || !tips || !rt) return;
    const pt = toStage(e);
    const pose = toPose(arr);
    let next: Pose;
    if (d.h === "move") {
      next = {
        ...pose,
        x: Math.max(-430, Math.min(430, d.a0[0] + pt[0] - d.f0[0])),
        y: Math.max(-320, Math.min(40, d.a0[1] + pt[1] - d.f0[1])),
      };
    } else {
      // volteado: el dedo se refleja para mover el puntito correcto
      const finger: [number, number] = arr[FLIP] === 1 ? [2 * (HIP_X + pose.x) - pt[0], pt[1]] : pt;
      next = dragPuppet(pose, d.h, finger, tips, HIP_X, HIP_Y, SCALE, rt.joints);
    }
    setPoseArr(fi, d.ci, fromPose(next, arr), false);
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragsRef.current.delete(e.pointerId)) return;
    onSave(animRef.current);
  };

  // ---------- Fotogramas ----------
  const newFrame = () => {
    const a = animRef.current;
    if (a.frames.length >= MAX_FRAMES) {
      setNotice(`Máximo ${MAX_FRAMES} fotogramas.`);
      return;
    }
    const src = a.frames[cur];
    const copy: FrameShot = { id: `${Date.now()}`, secs: src.secs, poses: src.poses.map((p) => (p ? [...p] : p)) };
    update((x) => ({ ...x, frames: [...x.frames.slice(0, cur + 1), copy, ...x.frames.slice(cur + 1)] }));
    setCur(cur + 1);
  };

  const deleteFrame = () => {
    if (anim.frames.length <= 1) return;
    update((x) => ({ ...x, frames: x.frames.filter((_, i) => i !== cur) }));
    setCur(Math.max(0, cur - 1));
  };

  const setSecs = (secs: number, all = false) =>
    update((x) => ({ ...x, frames: x.frames.map((f, i) => (all || i === cur ? { ...f, secs } : f)) }));

  // ---------- Personajes ----------
  const addChar = (id: string) => {
    const a = animRef.current;
    if (a.cast.length >= MAX_FRAME_CAST) return;
    if (a.cast.length + 1 >= MAX_FRAME_CAST) setPicking(false);
    const slot = a.cast.length;
    update((x) => ({
      ...x,
      cast: [...x.cast, id],
      frames: (x.frames.length ? x.frames : [{ id: `${Date.now()}`, secs: 0.5, poses: [] }]).map((f) => ({ ...f, poses: [...f.poses, restArr(slot)] })),
    }));
    setSelChar(slot);
  };

  const removeChar = (ci: number) => {
    update((x) => ({ ...x, cast: x.cast.filter((_, i) => i !== ci), frames: x.frames.map((f) => ({ ...f, poses: f.poses.filter((_, i) => i !== ci) })) }));
    setSelChar(0);
  };

  const toggle = (ci: number, idx: number) => {
    const arr = anim.frames[cur]?.poses[ci];
    if (!arr) return;
    const next = [...arr];
    next[idx] = arr[idx] === 1 ? 0 : 1;
    setPoseArr(cur, ci, next, true);
  };

  // ---------- Video ----------
  const film = async () => {
    const canvas = canvasRef.current;
    if (!canvas || recorderRef.current || anim.frames.length < 2) return;
    if (typeof MediaRecorder === "undefined") {
      setNotice("Esta tablet no permite grabar video 😕");
      return;
    }
    const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    const mime = types.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const stream = canvas.captureStream(30);
    if (anim.music) stream.addTrack(kit().dest.stream.getAudioTracks()[0]);
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
    await sleep(300);
    await play(true);
    await sleep(300);
    if (rec.state === "recording") rec.stop();
  };

  useEffect(
    () => () => {
      playRef.current = null;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      kitRef.current?.ctx.close();
    },
    []
  );

  const frames = anim.frames;
  const shot = frames[Math.min(cur, frames.length - 1)];
  const selArr = shot?.poses[selChar];
  const total = frameTimes(frames)[frames.length - 1] ?? 0;
  const shown = playing ? playIdx : cur;

  return (
    <div className="h-full flex flex-col gap-2 min-h-0 overflow-y-auto md:overflow-hidden">
      <div className="md:flex-1 md:min-h-0 flex flex-col md:flex-row gap-3">
        <div className="md:flex-1 min-w-0 md:min-h-0 flex flex-col gap-1">
          <p className="text-white/80 text-sm font-bold text-center shrink-0">
            {anim.cast.length === 0
              ? "Agrega a los personajes que van a salir en tu animación."
              : playing
                ? "▶️ Así se ve tu animación"
                : "Acomoda a cada personaje con sus puntitos. Luego toca «➕ Nuevo fotograma» y muévelos un poquito."}
          </p>
          <div className="shrink-0 h-[40vh] md:h-auto md:flex-1 md:min-h-0 flex items-center justify-center relative">
            <canvas
              ref={canvasRef}
              width={STAGE_W}
              height={STAGE_H}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="max-w-full max-h-full rounded-3xl shadow-2xl touch-none"
              style={{ touchAction: "none" }}
            />
            {filming && <div className="absolute top-3 right-3 bg-red-600 text-white font-black rounded-full px-4 py-2 animate-pulse">⏺ Grabando</div>}
          </div>
        </div>

        <div className="md:w-72 shrink-0 flex flex-col gap-2 md:overflow-y-auto md:min-h-0 pr-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={playing || anim.cast.length === 0}
              onClick={newFrame}
              className={`${btn} col-span-2 bg-amber-400 text-slate-900 text-lg disabled:opacity-40`}
            >
              ➕ Nuevo fotograma
            </button>
            <button
              disabled={frames.length < 2 || filming}
              onClick={() => (playing ? stop() : play())}
              className={`${btn} bg-white text-slate-900 disabled:opacity-30`}
            >
              {playing ? "⏹ Parar" : "▶️ Ver"}
            </button>
            <button
              disabled={playing || frames.length <= 1}
              onClick={deleteFrame}
              className={`${btn} bg-white/10 text-white text-sm disabled:opacity-30`}
            >
              🗑️ Borrar este
            </button>
          </div>

          <div className="bg-white/5 rounded-2xl p-2 flex flex-col gap-1.5">
            <div className="text-white/80 text-xs font-bold">
              ⏱ Qué tan rápido llega al fotograma {cur + 1}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {FRAME_SECS.map((s) => (
                <button
                  key={s.secs}
                  disabled={playing}
                  onClick={() => setSecs(s.secs)}
                  title={s.label}
                  className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center active:scale-95 ${shot?.secs === s.secs ? "bg-sky-400 text-slate-900" : "bg-white/10 text-white"}`}
                >
                  <span className="text-lg leading-none">{s.emoji}</span>
                  <span className="text-[9px] leading-tight">{s.secs} s</span>
                </button>
              ))}
            </div>
            <button disabled={playing} onClick={() => shot && setSecs(shot.secs, true)} className="text-xs text-sky-200 underline self-end min-h-[32px]">
              Usar esta velocidad en todos
            </button>
          </div>

          <div className="bg-white/5 rounded-2xl p-2 flex flex-col gap-2">
            <div className="text-white/80 text-xs font-bold">🎭 Personajes (toca uno para moverlo)</div>
            {anim.cast.map((id, ci) => {
              const c = charById(id);
              const arr = shot?.poses[ci];
              return (
                <div
                  key={`${id}-${ci}`}
                  className={`flex items-center gap-1.5 rounded-xl p-1 border-2 ${ci === selChar ? "border-white bg-white/10" : "border-transparent"}`}
                >
                  <button onClick={() => setSelChar(ci)} className="flex items-center gap-1.5 flex-1 min-w-0 min-h-[48px]">
                    <span className="w-6 h-6 rounded-full text-xs font-black text-slate-900 flex items-center justify-center shrink-0" style={{ background: CAST_COLORS[ci % CAST_COLORS.length] }}>
                      {ci + 1}
                    </span>
                    {c?.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumb} alt="" className="h-11 w-9 object-contain rounded bg-[#fffdf7] shrink-0" />
                    ) : (
                      <span className="text-xl">❓</span>
                    )}
                    <span className="truncate text-white text-sm">{c?.name || "Sin nombre"}</span>
                  </button>
                  <button disabled={playing} onClick={() => toggle(ci, FLIP)} aria-label="Voltear" title="Voltear" className={`w-11 min-h-[44px] rounded-xl text-lg active:scale-95 ${arr?.[FLIP] === 1 ? "bg-white/30" : "bg-white/10"}`}>
                    🪞
                  </button>
                  <button
                    disabled={playing}
                    onClick={() => toggle(ci, HIDDEN)}
                    aria-label={arr?.[HIDDEN] === 1 ? "Que salga" : "Que no salga"}
                    title={arr?.[HIDDEN] === 1 ? "No sale en este fotograma" : "Sale en este fotograma"}
                    className={`w-11 min-h-[44px] rounded-xl text-lg active:scale-95 ${arr?.[HIDDEN] === 1 ? "bg-rose-500/60" : "bg-white/10"}`}
                  >
                    {arr?.[HIDDEN] === 1 ? "🙈" : "👀"}
                  </button>
                  <button disabled={playing} onClick={() => removeChar(ci)} aria-label="Quitar personaje" className="w-9 min-h-[44px] rounded-xl bg-white/5 text-white/60 active:scale-95">
                    ✖️
                  </button>
                </div>
              );
            })}
            {anim.cast.length < MAX_FRAME_CAST && (
              <button disabled={playing} onClick={() => setPicking(true)} className={`${btn} bg-violet-500 text-white`}>
                ➕ Agregar personaje
              </button>
            )}
            {selArr && <p className="text-[11px] text-white/50">🙈 = no sale en este fotograma (para que entre o salga de la escena).</p>}
          </div>

          <input
            value={anim.title}
            onChange={(e) => update((x) => ({ ...x, title: e.target.value.slice(0, 30) }))}
            maxLength={30}
            placeholder="Nombre de tu animación"
            className="min-h-[56px] rounded-2xl bg-white/10 border border-white/20 px-4 text-white placeholder:text-white/40"
          />
          <SceneButtons scene={anim.scene} onChange={(scene) => update((x) => ({ ...x, scene }))} backgrounds={backgrounds} onAdd={onAddBackground} onRemove={onRemoveBackground} />
          <div className="grid grid-cols-5 gap-1.5">
            <button
              onClick={() => update((x) => ({ ...x, music: undefined }))}
              className={`min-h-[48px] rounded-xl text-lg active:scale-95 ${!anim.music ? "bg-white text-slate-900" : "bg-white/10"}`}
              title="Sin música"
            >
              🔇
            </button>
            {MUSIC.map((m) => (
              <button
                key={m.id}
                onClick={() => update((x) => ({ ...x, music: m.id }))}
                className={`min-h-[48px] rounded-xl text-lg active:scale-95 ${anim.music === m.id ? "bg-white text-slate-900" : "bg-white/10"}`}
                title={m.label}
              >
                {m.emoji}
              </button>
            ))}
          </div>
          <button
            disabled={frames.length < 2 || playing || filming}
            onClick={film}
            className={`${btn} bg-gradient-to-r from-rose-500 to-orange-500 text-white disabled:opacity-40`}
          >
            ⏺ Grabar video
          </button>
          <button onClick={onExit} className={`${btn} bg-white/5 text-white/70 text-sm`}>
            ← Volver
          </button>
        </div>
      </div>

      {/* Tira de fotogramas */}
      <div className="shrink-0 bg-black/30 rounded-2xl p-2">
        <div className="flex items-center justify-between text-white/70 text-xs font-bold px-1 mb-1">
          <span>📸 Fotograma {shown + 1} de {frames.length}</span>
          <span>{total.toFixed(1)} s</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {frames.map((f, i) => {
            const th = thumbsRef.current.get(f.id);
            return (
              <button
                key={f.id}
                disabled={playing}
                onClick={() => setCur(i)}
                className={`shrink-0 w-24 rounded-xl overflow-hidden border-4 transition-all ${i === shown ? "border-amber-400" : "border-transparent opacity-80"}`}
              >
                {th ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={th.url} alt={`Fotograma ${i + 1}`} className="w-full aspect-[8/5] object-cover bg-slate-800" />
                ) : (
                  <div className="w-full aspect-[8/5] bg-slate-800" />
                )}
                <div className="bg-slate-900 text-white text-[10px] font-bold py-0.5">
                  {i + 1}
                  {i > 0 && <span className="text-white/50"> · {f.secs} s</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {picking && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 max-w-2xl w-full flex flex-col gap-4 max-h-full overflow-y-auto">
            <h3 className="text-xl font-black text-white text-center">¿Quién sale en tu animación?</h3>
            <p className="text-white/60 text-sm text-center">
              Toca a cada uno que quieras (hasta {MAX_FRAME_CAST}). Van {anim.cast.length}.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addChar(c.id)}
                  className={`relative rounded-2xl p-2 flex flex-col gap-1 active:scale-95 border-2 ${anim.cast.includes(c.id) ? "bg-emerald-500/20 border-emerald-400" : "bg-white/5 border-white/10"}`}
                >
                  {anim.cast.includes(c.id) && (
                    <span className="absolute top-1 right-1 bg-emerald-400 text-slate-900 font-black rounded-full w-7 h-7 flex items-center justify-center text-sm">
                      {anim.cast.filter((x) => x === c.id).length > 1 ? `×${anim.cast.filter((x) => x === c.id).length}` : "✓"}
                    </span>
                  )}
                  {c.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumb} alt="" className="w-full aspect-[200/260] object-contain rounded-xl bg-[#fffdf7]" />
                  ) : (
                    <div className="w-full aspect-[200/260] rounded-xl bg-white/10 flex items-center justify-center text-4xl">🎨</div>
                  )}
                  <span className="text-white text-sm font-bold truncate">{c.name || "Sin nombre"}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPicking(false)} className={`${btn} ${anim.cast.length ? "bg-amber-400 text-slate-900" : "bg-white/10 text-white"}`}>
              {anim.cast.length ? "✅ Listo, a animar" : "Cancelar"}
            </button>
          </div>
        </div>
      )}

      {notice && (
        <button onClick={() => setNotice(null)} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-amber-400 text-slate-900 font-bold rounded-2xl px-5 py-3">
          {notice}
        </button>
      )}

      {videoUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 max-w-2xl w-full flex flex-col gap-4">
            <h3 className="text-2xl font-black text-white text-center">🎬 ¡Tu animación!</h3>
            <video src={videoUrl} controls autoPlay playsInline className="w-full rounded-2xl bg-black" />
            <div className="flex gap-3">
              <a
                href={videoUrl}
                download={`${(anim.title.trim() || "mi-animacion").replace(/[^\w-]+/g, "-")}.${videoExt}`}
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

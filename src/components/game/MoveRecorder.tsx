"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  REST_POSE,
  POSE_KEYS,
  MOVE_MAX_SECONDS,
  KEYFRAME_SECONDS,
  CUSTOM_MOVE_EMOJIS,
  customPoseAt,
  poseToFrame,
  type CustomMove,
  type Joints,
  type Mouth,
  type PartId,
  type Pose,
} from "@/lib/animation-studio-data";
import {
  STAGE_W,
  STAGE_H,
  GROUND_Y,
  CHAR_SCALE,
  FEET_Y,
  HIP,
  blendPose,
  dragPuppet,
  drawCharacter,
  drawScene,
  puppetHandles,
  puppetTips,
  type Caches,
} from "@/lib/animation-studio-render";

const btn = "min-h-[56px] rounded-2xl font-bold transition-all active:scale-95";
const HIP_X = STAGE_W / 2;
const HIP_Y = GROUND_Y - (FEET_Y - HIP[1]) * CHAR_SCALE;
const GRAB_RADIUS = 70;

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

const framePose = (f: number[]): Pose => {
  const p: Pose = { ...REST_POSE };
  POSE_KEYS.forEach((k, i) => {
    p[k] = f[i + 1];
  });
  return p;
};

interface Props {
  caches: Caches;
  mouth: Mouth | null;
  joints?: Joints;
  scene: string;
  bgImages: Map<string, HTMLImageElement>;
  onSave: (m: CustomMove) => void;
  onClose: () => void;
}

export default function MoveRecorder({ caches, mouth, joints, scene, bgImages, onSave, onClose }: Props) {
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [segments, setSegments] = useState<number[]>([]); // cuántos cuadros agregó cada pedazo
  const [seconds, setSeconds] = useState(0);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(CUSTOM_MOVE_EMOJIS[0]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<Pose>({ ...REST_POSE });
  const framesRef = useRef<number[][]>([]);
  const recRef = useRef<{ start: number; base: number; last: number } | null>(null);
  const playRef = useRef<number | null>(null);
  const dragsRef = useRef<Map<number, Handle>>(new Map());
  const tips = useMemo(() => puppetTips(caches, joints), [caches, joints]);

  const lastT = () => {
    const f = framesRef.current;
    return f.length ? f[f.length - 1][0] : 0;
  };

  const stopRecording = () => {
    const r = recRef.current;
    if (!r) return;
    recRef.current = null;
    const t = r.base + (performance.now() - r.start) / 1000;
    const f = framesRef.current;
    f.push(poseToFrame(Math.min(MOVE_MAX_SECONDS, t), poseRef.current));
    // Sin los ratos quietos del principio y del final (antes de mover y antes de tocar «Detener»)
    const same = (a: number[], b: number[]) => a.every((v, i) => i === 0 || Math.abs(v - b[i]) < 0.002);
    let first = r.last;
    while (first + 1 < f.length - 1 && same(f[first + 1], f[r.last])) first++;
    if (first > r.last) {
      const shift = f[first][0] - f[r.last][0];
      f.splice(r.last + 1, first - r.last);
      for (let i = r.last + 1; i < f.length; i++) f[i][0] -= shift;
    }
    let last = f.length - 1;
    while (last - 1 > r.last && same(f[last - 1], f[f.length - 1])) last--;
    if (last < f.length - 1) {
      const end = Math.min(f[f.length - 1][0], f[last][0] + 0.3);
      f.splice(last + 1);
      f.push([end, ...f[last].slice(1)]);
    }
    const added = f.length - r.last;
    setSegments((s) => [...s, added]);
    setSeconds(lastT());
    setRecording(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const start = performance.now();
    let shown: Pose = { ...REST_POSE };
    let frame = 0;
    let shownQuarter = -1;
    const loop = () => {
      const now = performance.now();
      const t = (now - start) / 1000;
      const r = recRef.current;
      if (r) {
        const rt = r.base + (now - r.start) / 1000;
        const f = framesRef.current;
        if (rt - f[f.length - 1][0] >= 1 / 30) f.push(poseToFrame(rt, poseRef.current));
        if (rt >= MOVE_MAX_SECONDS) stopRecording();
        else if (Math.floor(rt * 4) !== shownQuarter) {
          shownQuarter = Math.floor(rt * 4);
          setSeconds(rt);
        }
      }
      drawScene(ctx, scene, t, bgImages);
      const play = playRef.current;
      if (play !== null) {
        const target = customPoseAt({ id: "", name: "", emoji: "", frames: framesRef.current }, (now - play) / 1000);
        shown = blendPose(shown, target, 0.6);
      } else {
        shown = poseRef.current;
        // fantasma del último cuadro guardado, para animar por fotogramas
        const f = framesRef.current;
        if (!r && f.length) {
          ctx.globalAlpha = 0.28;
          drawCharacter(ctx, caches, framePose(f[f.length - 1]), HIP_X, HIP_Y, CHAR_SCALE, mouth, 0, joints);
          ctx.globalAlpha = 1;
        }
      }
      drawCharacter(ctx, caches, shown, HIP_X, HIP_Y, CHAR_SCALE, mouth, 0, joints);
      if (play === null) {
        const hs = puppetHandles(tips, shown, HIP_X, HIP_Y, CHAR_SCALE, joints);
        (Object.keys(hs) as Handle[]).forEach((h) => {
          const [hx, hy] = hs[h];
          const active = [...dragsRef.current.values()].includes(h);
          ctx.beginPath();
          ctx.arc(hx, hy, active ? 30 : 24, 0, Math.PI * 2);
          ctx.fillStyle = HANDLE_STYLE[h].color;
          ctx.globalAlpha = 0.85;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.lineWidth = 4;
          ctx.strokeStyle = h === "move" ? "#111827" : "#ffffff";
          ctx.stroke();
          ctx.font = h === "move" ? "bold 28px system-ui, sans-serif" : "22px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#111827";
          ctx.fillText(HANDLE_STYLE[h].label, hx, hy + 1);
        });
      }
      if (r) {
        ctx.fillStyle = "#dc2626";
        ctx.beginPath();
        ctx.arc(40, 40, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // stopRecording y lastT solo leen refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caches, mouth, joints, scene, bgImages, tips]);

  const toStage = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * STAGE_W, ((e.clientY - r.top) / r.height) * STAGE_H];
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (playRef.current !== null) return;
    const pt = toStage(e);
    const hs = puppetHandles(tips, poseRef.current, HIP_X, HIP_Y, CHAR_SCALE, joints);
    let best: Handle | null = null;
    let bestD = GRAB_RADIUS;
    (Object.keys(hs) as Handle[]).forEach((h) => {
      const d = Math.hypot(hs[h][0] - pt[0], hs[h][1] - pt[1]);
      if (d < bestD && ![...dragsRef.current.values()].includes(h)) {
        best = h;
        bestD = d;
      }
    });
    if (!best) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragsRef.current.set(e.pointerId, best);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const h = dragsRef.current.get(e.pointerId);
    if (!h) return;
    poseRef.current = dragPuppet(poseRef.current, h, toStage(e), tips, HIP_X, HIP_Y, CHAR_SCALE, joints);
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragsRef.current.delete(e.pointerId);
  };

  const startRecording = () => {
    if (lastT() >= MOVE_MAX_SECONDS) return;
    const f = framesRef.current;
    const base = f.length ? lastT() + 0.25 : 0;
    recRef.current = { start: performance.now(), base, last: f.length };
    f.push(poseToFrame(base, poseRef.current));
    setRecording(true);
  };

  const addKeyframe = () => {
    const f = framesRef.current;
    const t = f.length ? lastT() + KEYFRAME_SECONDS : 0;
    if (t > MOVE_MAX_SECONDS) return;
    f.push(poseToFrame(t, poseRef.current));
    setSegments((s) => [...s, 1]);
    setSeconds(t);
  };

  const undoSegment = () => {
    const n = segments[segments.length - 1];
    if (!n) return;
    framesRef.current.splice(framesRef.current.length - n);
    const f = framesRef.current;
    poseRef.current = f.length ? framePose(f[f.length - 1]) : { ...REST_POSE };
    setSegments((s) => s.slice(0, -1));
    setSeconds(lastT());
  };

  const togglePlay = () => {
    if (playRef.current !== null) {
      playRef.current = null;
      setPlaying(false);
      return;
    }
    playRef.current = performance.now();
    setPlaying(true);
  };

  const save = () => {
    if (framesRef.current.length < 2) return;
    onSave({
      id: `${Date.now()}`,
      name: name.trim().slice(0, 18) || "Mi movimiento",
      emoji: icon,
      frames: framesRef.current.map((f) => f.map((v) => Math.round(v * 1000) / 1000)),
    });
  };

  const full = seconds >= MOVE_MAX_SECONDS - 0.05;
  const canSave = framesRef.current.length >= 2 && !recording;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col md:flex-row gap-3 p-3 overflow-y-auto">
      <div className="md:flex-1 min-w-0 md:min-h-0 flex flex-col gap-2">
        <div className="text-white font-bold text-center">
          {recording
            ? "⏺ Grabando… mueve los puntitos. Cuando acabes, toca «Detener»."
            : "Arrastra los puntitos: ✋ manos, 🦶 pies, 🙂 cabeza, 👕 cuerpo y ✥ para moverlo todo."}
        </div>
        <div className="shrink-0 h-[50vh] md:h-auto md:flex-1 md:min-h-0 flex items-center justify-center">
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
        </div>
      </div>
      <div className="md:w-64 shrink-0 flex flex-col gap-3">
        {recording ? (
          <button onClick={stopRecording} className={`${btn} bg-red-700 text-white text-lg animate-pulse`}>
            ⏹ Detener movimiento
          </button>
        ) : (
          <button
            disabled={playing || full}
            onClick={startRecording}
            className={`${btn} bg-red-500 text-white text-lg disabled:opacity-40`}
          >
            ⏺ Grabar movimiento
          </button>
        )}
        <button
          disabled={recording || playing || full}
          onClick={addKeyframe}
          className={`${btn} bg-amber-400 text-slate-900 disabled:opacity-40`}
        >
          📸 Guardar esta pose (fotograma)
        </button>
        <div className="bg-white/5 rounded-2xl p-3 text-white/80 text-sm text-center">
          {segments.length === 0
            ? "Graba moviendo los puntitos, o acomódalo y guarda poses una por una."
            : `${segments.length} ${segments.length === 1 ? "pedazo" : "pedazos"} · ${seconds.toFixed(1)} de ${MOVE_MAX_SECONDS} s`}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={recording || framesRef.current.length < 2}
            onClick={togglePlay}
            className={`${btn} bg-white text-slate-900 disabled:opacity-30`}
          >
            {playing ? "⏹ Parar" : "▶️ Ver"}
          </button>
          <button
            disabled={recording || playing || segments.length === 0}
            onClick={undoSegment}
            className={`${btn} bg-white/10 text-white text-sm disabled:opacity-30`}
          >
            ↩️ Quitar el último
          </button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={18}
          placeholder="Nombre del movimiento"
          className="min-h-[56px] rounded-2xl bg-white/10 border border-white/20 px-4 text-white placeholder:text-white/40 text-lg"
        />
        <div className="grid grid-cols-4 gap-2">
          {CUSTOM_MOVE_EMOJIS.map((em) => (
            <button
              key={em}
              onClick={() => setIcon(em)}
              className={`${btn} text-2xl ${icon === em ? "bg-violet-500" : "bg-white/10"}`}
            >
              {em}
            </button>
          ))}
        </div>
        <button
          disabled={!canSave}
          onClick={save}
          className={`${btn} bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white text-lg disabled:opacity-30`}
        >
          ✅ Guardar movimiento
        </button>
        <button onClick={onClose} className={`${btn} bg-white/5 text-white/70 text-sm`}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

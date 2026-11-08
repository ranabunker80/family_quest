"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import StoryStudio, { SceneButtons, EffectButtons } from "@/components/game/StoryStudio";
import MoveRecorder from "@/components/game/MoveRecorder";
import { MUSIC, MUSIC_VOLUMES, MusicPlayer } from "@/lib/animation-studio-music";
import { DEFAULT_EFFECT_SIZE, decodeGif, drawEffect, effectDone, effectInfo, type GifAnim } from "@/lib/animation-studio-effects";
import {
  CHAR_W,
  CHAR_H,
  PARTS,
  DRAW_ORDER,
  BRUSH_COLORS,
  BRUSH_SIZES,
  MOVES,
  REST_POSE,
  emptyParts,
  poseFor,
  movePose,
  customMoveId,
  SPEEDS,
  MAX_CUSTOM_MOVES,
  MAX_GIFS,
  GIF_MAX_BYTES,
  type CustomMove,
  type CustomGif,
  type Joints,
  MOUTH_STYLES,
  DEFAULT_MOUTH,
  VOICES,
  VOICE_MAX_SECONDS,
  type PartId,
  type Stroke,
  type CharacterParts,
  type SavedCharacter,
  type PartImage,
  type PartImages,
  type Mouth,
  type Pose,
  type CustomBackground,
  type Story,
  MAX_BACKGROUNDS,
  MAX_STORIES,
} from "@/lib/animation-studio-data";
import {
  CHAR_SCALE,
  type Caches,
  FEET_Y,
  GROUND_Y,
  HIP,
  type LoadedImages,
  OTHER_SIDE,
  PART_BY_ID,
  RES,
  STAGE_H,
  STAGE_W,
  blendPose,
  buildCaches,
  drawCharacter,
  drawMouth,
  drawScene,
  fileToCanvas,
  fitInGuide,
  loadCharacters,
  idbGet,
  idbPut,
  photoToBackground,
  loadImage,
  loudness,
  makeCutout,
  makeThumbnail,
  pivotOf,
  renderPart,
  storeCharacters,
  strokeSegment,
} from "@/lib/animation-studio-render";

type Phase = "gallery" | "draw" | "stage" | "story";

interface Props {
  storageKey: string;
  previewMode?: boolean;
}

const MAX_SAVED = 12;
const RECORD_SECONDS = 10;
const MEDIAPIPE_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.33/wasm";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// Efecto puesto en el escenario de un personaje (no se guarda; sale en el video)
interface LiveEffect {
  id: string;
  kind: string;
  x: number;
  y: number;
  size: number;
  born: number;
}

const JOINT_COLORS: Record<PartId, string> = {
  head: "#facc15", body: "#22c55e", armL: "#ef4444", armR: "#ef4444", legL: "#3b82f6", legR: "#3b82f6",
};

// ---------- Modo espejo: pose del niño → pose del personaje ----------
interface MirrorState {
  baseline: number | null;
}

type Landmark = { x: number; y: number; visibility?: number };

interface PoseDetector {
  detectForVideo(video: HTMLVideoElement, ts: number): { landmarks?: Landmark[][] };
  close?: () => void;
}

function poseFromLandmarks(lm: Landmark[], aspect: number, st: MirrorState): Pose | null {
  // x en espejo: lo que el niño ve a su izquierda es la izquierda de la pantalla
  const P = (i: number) => ({ x: (1 - lm[i].x) * aspect, y: lm[i].y, v: lm[i].visibility ?? 1 });
  const ok = (...pts: { v: number }[]) => pts.every((p) => p.v > 0.4);
  const down = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.atan2(-(b.x - a.x), b.y - a.y);

  const sL = P(11), sR = P(12);
  if (!ok(sL, sR)) return null;
  const hL = P(23), hR = P(24);
  const hipsOk = ok(hL, hR);
  const midS = { x: (sL.x + sR.x) / 2, y: (sL.y + sR.y) / 2 };

  const p: Pose = { ...REST_POSE };
  if (hipsOk) {
    const midH = { x: (hL.x + hR.x) / 2, y: (hL.y + hR.y) / 2 };
    p.body = Math.atan2(midS.x - midH.x, -(midS.y - midH.y));
    p.x = Math.max(-380, Math.min(380, (midH.x / aspect - 0.5) * 900));
    if (st.baseline === null) st.baseline = midH.y;
    st.baseline += (midH.y - st.baseline) * (midH.y > st.baseline ? 0.3 : 0.01);
    p.y = Math.max(-260, Math.min(0, (midH.y - st.baseline) * 700));
    const leg = (hip: typeof hL, knee: number, ankle: number) => {
      const a = P(ankle), k = P(knee);
      if (ok(a)) return down(hip, a);
      if (ok(k)) return down(hip, k);
      return 0;
    };
    p.legL = leg(hL, 25, 27);
    p.legR = leg(hR, 26, 28);
  } else {
    p.x = Math.max(-380, Math.min(380, (midS.x / aspect - 0.5) * 900));
  }

  const arm = (shoulder: typeof sL, elbow: number, wrist: number, rest: number) => {
    const w = P(wrist), e = P(elbow);
    if (ok(w)) return down(shoulder, w) - p.body;
    if (ok(e)) return down(shoulder, e) - p.body;
    return rest;
  };
  p.armL = arm(sL, 13, 15, REST_POSE.armL);
  p.armR = arm(sR, 14, 16, REST_POSE.armR);

  const eL = P(7), eR = P(8);
  if (ok(eL, eR)) p.head = Math.max(-0.7, Math.min(0.7, Math.atan2(eR.y - eL.y, eR.x - eL.x) - p.body));
  return p;
}

// ============================================================
export default function AnimationStudioEngine({ storageKey, previewMode = false }: Props) {
  const [phase, setPhase] = useState<Phase>("gallery");
  const [characters, setCharacters] = useState<SavedCharacter[]>([]);
  const [backgrounds, setBackgrounds] = useState<CustomBackground[]>([]);
  const [bgImages, setBgImages] = useState<Map<string, HTMLImageElement>>(() => new Map());
  const [stories, setStories] = useState<Story[]>([]);
  const [openStory, setOpenStory] = useState<Story | null>(null);
  const [deleteStoryAsk, setDeleteStoryAsk] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [activePart, setActivePart] = useState<PartId>("head");
  const [color, setColor] = useState(BRUSH_COLORS[0]);
  const [size, setSize] = useState(BRUSH_SIZES[1].size);
  const [erasing, setErasing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [move, setMove] = useState<string>("dance");
  const [speed, setSpeed] = useState(1);
  const [music, setMusic] = useState<string | null>(null);
  const [musicVol, setMusicVol] = useState<number>(MUSIC_VOLUMES[1].level);
  const [customMoves, setCustomMoves] = useState<CustomMove[]>([]);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [deleteMoveAsk, setDeleteMoveAsk] = useState(false);
  const [gifs, setGifs] = useState<CustomGif[]>([]);
  const [gifAnims, setGifAnims] = useState<Map<string, GifAnim>>(() => new Map());
  const [stageFx, setStageFx] = useState<LiveEffect[]>([]);
  const [editingJoints, setEditingJoints] = useState(false);
  const [testingJoints, setTestingJoints] = useState(false);
  const [scene, setScene] = useState<string>("park");
  const [mirror, setMirror] = useState(false);
  const [mirrorStatus, setMirrorStatus] = useState<"off" | "loading" | "noone" | "ok" | "error">("off");
  const [recordLeft, setRecordLeft] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState("webm");
  const [deleteAsk, setDeleteAsk] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tool, setTool] = useState<"draw" | "move">("draw");
  const [cutSource, setCutSource] = useState<HTMLCanvasElement | null>(null);
  const [lastPhoto, setLastPhoto] = useState<HTMLCanvasElement | null>(null);
  const [, setImageVersion] = useState(0);
  const [editingMouth, setEditingMouth] = useState(false);
  const [hasMouth, setHasMouth] = useState(false);
  const [hasVoice, setHasVoice] = useState(false);
  const [voiceLeft, setVoiceLeft] = useState<number | null>(null);
  const [voiceRate, setVoiceRate] = useState(1);
  const [talking, setTalking] = useState(false);

  const partsRef = useRef<CharacterParts>(emptyParts());
  const cachesRef = useRef<Caches | null>(null);
  const undoRef = useRef<PartId[]>([]);
  const imagesRef = useRef<LoadedImages>({});
  const mouthRef = useRef<Mouth | null>(null);
  const jointsRef = useRef<Joints>({});
  const jointDragRef = useRef<{ id: number; part: PartId } | null>(null);
  const customMovesRef = useRef<CustomMove[]>([]);
  const gifAnimsRef = useRef<Map<string, GifAnim>>(new Map());
  const stageFxRef = useRef<LiveEffect[]>([]);
  const fxDragRef = useRef<{ id: number; fx: string; dx: number; dy: number } | null>(null);
  const voiceRef = useRef<Blob | null>(null);
  const voiceBufferRef = useRef<AudioBuffer | null>(null);
  const audioRef = useRef<{
    ctx: AudioContext;
    analyser: AnalyserNode;
    dest: MediaStreamAudioDestinationNode;
    music: MusicPlayer;
  } | null>(null);
  const micRef = useRef<{ stream: MediaStream; analyser: AnalyserNode; rec: MediaRecorder } | null>(null);
  const playingRef = useRef<AudioBufferSourceNode | null>(null);
  const mouthDragRef = useRef<{ id: number; start: [number, number]; m: Mouth } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gestureRef = useRef<{
    pointers: Map<number, [number, number]>;
    start: { p: PartImage; pts: [number, number][] } | null;
  }>({ pointers: new Map(), start: null });
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const stageCanvasRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseDetector | null>(null);
  const mirrorStateRef = useRef<MirrorState>({ baseline: null });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const moveRef = useRef(move);
  const speedRef = useRef(speed);
  const bgImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const sceneRef = useRef(scene);
  const mirrorRef = useRef(mirror);
  const nameRef = useRef(name);

  moveRef.current = move;
  speedRef.current = speed;
  customMovesRef.current = customMoves;
  gifAnimsRef.current = gifAnims;
  stageFxRef.current = stageFx;
  sceneRef.current = scene;
  bgImagesRef.current = bgImages;
  mirrorRef.current = mirror;
  nameRef.current = name;

  useEffect(() => {
    let alive = true;
    loadCharacters(storageKey).then((list) => alive && setCharacters(list));
    idbGet<CustomBackground[]>(`${storageKey}:backgrounds`, []).then((list) => alive && setBackgrounds(list));
    idbGet<Story[]>(`${storageKey}:stories`, []).then((list) => alive && setStories(list));
    idbGet<CustomMove[]>(`${storageKey}:moves`, []).then((list) => alive && setCustomMoves(list));
    idbGet<CustomGif[]>(`${storageKey}:gifs`, []).then((list) => alive && setGifs(list));
    return () => {
      alive = false;
    };
  }, [storageKey]);

  // Fondos propios: cargar las imágenes que falten
  useEffect(() => {
    let alive = true;
    const missing = backgrounds.filter((b) => !bgImages.has(b.id));
    if (!missing.length) return;
    Promise.all(missing.map(async (b) => [b.id, await loadImage(b.src)] as const)).then((loaded) => {
      if (!alive) return;
      setBgImages((prev) => {
        const next = new Map(prev);
        loaded.forEach(([id, img]) => next.set(id, img));
        return next;
      });
    });
    return () => {
      alive = false;
    };
  }, [backgrounds, bgImages]);

  const addBackground = async (file: File): Promise<string | null> => {
    try {
      const src = await photoToBackground(file);
      const entry: CustomBackground = { id: `${Date.now()}`, src };
      const list = [entry, ...backgrounds].slice(0, MAX_BACKGROUNDS);
      setBackgrounds(list);
      if (!(await idbPut(`${storageKey}:backgrounds`, list))) setNotice("No se pudo guardar el fondo en esta tablet.");
      return entry.id;
    } catch {
      setNotice("No pude abrir esa foto 😕 Intenta con otra.");
      return null;
    }
  };

  // GIFs propios: separarlos en cuadros una vez
  useEffect(() => {
    let alive = true;
    const missing = gifs.filter((g) => !gifAnims.has(g.id));
    if (!missing.length) return;
    (async () => {
      const done: [string, GifAnim][] = [];
      for (const g of missing) {
        try {
          done.push([g.id, await decodeGif(g.blob)]);
        } catch {
          /* un GIF dañado no impide el resto */
        }
      }
      if (!alive || !done.length) return;
      setGifAnims((prev) => {
        const next = new Map(prev);
        done.forEach(([id, a]) => next.set(id, a));
        return next;
      });
    })();
    return () => {
      alive = false;
    };
  }, [gifs, gifAnims]);

  const addGif = async (file: File): Promise<string | null> => {
    if (file.size > GIF_MAX_BYTES) {
      setNotice("Ese GIF está muy pesado 😕 Busca uno más chico.");
      return null;
    }
    try {
      const anim = await decodeGif(file);
      const entry: CustomGif = { id: `${Date.now()}`, blob: file };
      setGifAnims((prev) => new Map(prev).set(entry.id, anim));
      const list = [entry, ...gifs].slice(0, MAX_GIFS);
      setGifs(list);
      if (!(await idbPut(`${storageKey}:gifs`, list))) setNotice("No se pudo guardar el GIF en esta tablet.");
      return entry.id;
    } catch {
      setNotice("No pude abrir ese GIF 😕 Intenta con otro.");
      return null;
    }
  };

  const removeGif = (id: string) => {
    const list = gifs.filter((g) => g.id !== id);
    setGifs(list);
    idbPut(`${storageKey}:gifs`, list);
    setStageFx((fx) => fx.filter((f) => f.kind !== `gif:${id}`));
  };

  // ---------- Movimientos inventados ----------
  const saveCustomMove = (m: CustomMove) => {
    const list = [m, ...customMoves].slice(0, MAX_CUSTOM_MOVES);
    setCustomMoves(list);
    idbPut(`${storageKey}:moves`, list).then((ok) => {
      if (!ok) setNotice("No se pudo guardar el movimiento en esta tablet.");
    });
    setRecorderOpen(false);
    setMirror(false);
    setMove(customMoveId(m.id));
  };

  const deleteCustomMove = (key: string) => {
    const list = customMoves.filter((m) => customMoveId(m.id) !== key);
    setCustomMoves(list);
    idbPut(`${storageKey}:moves`, list);
    setDeleteMoveAsk(false);
    setMove("dance");
  };

  // ---------- Efectos en el escenario ----------
  const addStageFx = (kind: string) => {
    const n = stageFxRef.current.length;
    const fx: LiveEffect = {
      id: `${Date.now()}-${Math.random()}`,
      kind,
      x: Math.min(STAGE_W - 80, STAGE_W / 2 + 140 + n * 60),
      y: GROUND_Y - 260 - n * 30,
      size: DEFAULT_EFFECT_SIZE,
      born: performance.now(),
    };
    setStageFx((list) => [...list, fx]);
  };

  const removeBackground = (id: string) => {
    const list = backgrounds.filter((b) => b.id !== id);
    setBackgrounds(list);
    idbPut(`${storageKey}:backgrounds`, list);
  };

  // ---------- Historias ----------
  const saveStory = (story: Story) => {
    setStories((prev) => {
      const list = [story, ...prev.filter((st) => st.id !== story.id)].slice(0, MAX_STORIES);
      idbPut(`${storageKey}:stories`, list);
      return list;
    });
  };

  const newStory = () => {
    const story: Story = {
      id: `${Date.now()}`,
      title: "",
      scene: "park",
      cast: [],
      flips: [],
      lines: [],
      updatedAt: Date.now(),
    };
    saveStory(story);
    setOpenStory(story);
    setPhase("story");
  };

  const deleteStory = (id: string) => {
    setStories((prev) => {
      const list = prev.filter((st) => st.id !== id);
      idbPut(`${storageKey}:stories`, list);
      return list;
    });
    setDeleteStoryAsk(null);
  };

  const rerender = useCallback((part: PartId) => {
    if (cachesRef.current) renderPart(cachesRef.current[part], partsRef.current[part], imagesRef.current[part]);
  }, []);

  // ---------- Vista de dibujo ----------
  const redrawDrawView = useCallback(() => {
    const canvas = drawCanvasRef.current;
    const caches = cachesRef.current;
    if (!canvas || !caches) return;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, CHAR_W, CHAR_H);
    for (const p of PARTS) {
      const active = p.id === activePart;
      ctx.save();
      ctx.setLineDash(active ? [10, 6] : [6, 8]);
      ctx.lineWidth = active ? 3 : 1.5;
      ctx.strokeStyle = active ? "#a855f7" : "#d1d5db";
      ctx.fillStyle = active ? "rgba(168,85,247,0.08)" : "transparent";
      ctx.beginPath();
      if (p.guide.kind === "circle") ctx.arc(p.guide.cx, p.guide.cy, p.guide.r, 0, Math.PI * 2);
      else ctx.roundRect(p.guide.x, p.guide.y, p.guide.w, p.guide.h, 18);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    for (const p of PARTS) {
      ctx.globalAlpha = p.id === activePart ? 1 : 0.55;
      ctx.drawImage(caches[p.id], 0, 0, CHAR_W, CHAR_H);
    }
    ctx.globalAlpha = 1;
    const m = mouthRef.current;
    if (m) {
      // la boca va pegada a la cabeza (sin giro en la vista de dibujo)
      drawMouth(ctx, m, editingMouth ? 0.45 : 0.15);
      if (editingMouth) {
        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#f59e0b";
        ctx.strokeRect(m.x - m.w * 0.75, m.y - m.w * 0.6, m.w * 1.5, m.w * 1.2);
        ctx.restore();
      }
    }
    const img = imagesRef.current[activePart];
    if (img && tool === "move") {
      ctx.save();
      ctx.translate(img.p.x, img.p.y);
      ctx.rotate(img.p.rot);
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#f59e0b";
      ctx.strokeRect(-img.p.w / 2, -img.p.h / 2, img.p.w, img.p.h);
      ctx.restore();
    }
    if (editingJoints) {
      // Todos los puntos: el niño los arrastra a donde se dobla cada parte
      for (const p of PARTS) {
        const [jx, jy] = pivotOf(p.id, jointsRef.current);
        ctx.beginPath();
        ctx.arc(jx, jy, 16, 0, Math.PI * 2);
        ctx.fillStyle = JOINT_COLORS[p.id];
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.emoji, jx, jy - 28);
      }
      return;
    }
    // Articulación de la parte activa: "aquí se dobla"
    const [jx, jy] = pivotOf(activePart, jointsRef.current);
    ctx.fillStyle = "#a855f7";
    ctx.beginPath();
    ctx.arc(jx, jy, 7, 0, Math.PI * 2);
    ctx.fill();
  }, [activePart, tool, editingMouth, editingJoints]);

  // «Probar»: el personaje baila un ratito en la hoja con sus puntos nuevos
  useEffect(() => {
    if (!testingJoints || phase !== "draw") return;
    const canvas = drawCanvasRef.current;
    const caches = cachesRef.current;
    if (!canvas || !caches) return;
    const ctx = canvas.getContext("2d")!;
    const start = performance.now();
    let frame = 0;
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      if (t > 3) {
        setTestingJoints(false);
        return;
      }
      ctx.setTransform(RES, 0, 0, RES, 0, 0);
      ctx.fillStyle = "#fffdf7";
      ctx.fillRect(0, 0, CHAR_W, CHAR_H);
      const pose = poseFor(t < 1.5 ? "dance" : "karate", t);
      pose.x = 0;
      pose.y *= 0.4;
      drawCharacter(ctx, caches, pose, HIP[0], HIP[1], 1, mouthRef.current, 0, jointsRef.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      redrawDrawView();
    };
  }, [testingJoints, phase, redrawDrawView]);

  useEffect(() => {
    if (phase === "draw") redrawDrawView();
  }, [phase, redrawDrawView]);

  const toCharCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [
      Math.round(((e.clientX - rect.left) / rect.width) * CHAR_W),
      Math.round(((e.clientY - rect.top) / rect.height) * CHAR_H),
    ];
  };

  // Mover / agrandar / girar la foto: 1 dedo arrastra, 2 dedos pellizcan y giran
  const resetGesture = () => {
    const g = gestureRef.current;
    const img = imagesRef.current[activePart];
    g.start = img ? { p: { ...img.p }, pts: [...g.pointers.values()] } : null;
  };

  const onMovePointer = (e: React.PointerEvent<HTMLCanvasElement>, kind: "down" | "move" | "up") => {
    const g = gestureRef.current;
    const img = imagesRef.current[activePart];
    if (!img) return;
    const pt = toCharCoords(e) as [number, number];
    if (kind === "down") {
      e.currentTarget.setPointerCapture(e.pointerId);
      g.pointers.set(e.pointerId, pt);
      resetGesture();
      return;
    }
    if (kind === "up") {
      g.pointers.delete(e.pointerId);
      resetGesture();
      return;
    }
    if (!g.pointers.has(e.pointerId) || !g.start) return;
    g.pointers.set(e.pointerId, pt);
    const now = [...g.pointers.values()];
    const s = g.start;
    if (now.length === 1 && s.pts.length === 1) {
      img.p.x = s.p.x + now[0][0] - s.pts[0][0];
      img.p.y = s.p.y + now[0][1] - s.pts[0][1];
    } else if (now.length >= 2 && s.pts.length >= 2) {
      const dist = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ang = (a: [number, number], b: [number, number]) => Math.atan2(b[1] - a[1], b[0] - a[0]);
      const k = Math.max(0.2, Math.min(5, dist(now[0], now[1]) / Math.max(1, dist(s.pts[0], s.pts[1]))));
      img.p.w = s.p.w * k;
      img.p.h = s.p.h * k;
      img.p.rot = s.p.rot + ang(now[0], now[1]) - ang(s.pts[0], s.pts[1]);
      img.p.x = s.p.x + (now[0][0] + now[1][0]) / 2 - (s.pts[0][0] + s.pts[1][0]) / 2;
      img.p.y = s.p.y + (now[0][1] + now[1][1]) / 2 - (s.pts[0][1] + s.pts[1][1]) / 2;
    }
    rerender(activePart);
    redrawDrawView();
  };

  const onMouthPointer = (e: React.PointerEvent<HTMLCanvasElement>, kind: "down" | "move" | "up") => {
    const m = mouthRef.current;
    if (!m) return;
    const pt = toCharCoords(e) as [number, number];
    if (kind === "down") {
      e.currentTarget.setPointerCapture(e.pointerId);
      mouthDragRef.current = { id: e.pointerId, start: pt, m: { ...m } };
      return;
    }
    const drag = mouthDragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    if (kind === "up") {
      mouthDragRef.current = null;
      return;
    }
    m.x = drag.m.x + pt[0] - drag.start[0];
    m.y = drag.m.y + pt[1] - drag.start[1];
    redrawDrawView();
  };

  const onJointPointer = (e: React.PointerEvent<HTMLCanvasElement>, kind: "down" | "move" | "up") => {
    const pt = toCharCoords(e) as [number, number];
    if (kind === "down") {
      let best: PartId | null = null;
      let bestD = 45;
      for (const p of PARTS) {
        const [jx, jy] = pivotOf(p.id, jointsRef.current);
        const d = Math.hypot(jx - pt[0], jy - pt[1]);
        if (d < bestD) {
          best = p.id;
          bestD = d;
        }
      }
      if (!best) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      jointDragRef.current = { id: e.pointerId, part: best };
      return;
    }
    const drag = jointDragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    if (kind === "up") {
      jointDragRef.current = null;
      return;
    }
    jointsRef.current[drag.part] = [
      Math.max(0, Math.min(CHAR_W, pt[0])),
      Math.max(0, Math.min(CHAR_H, pt[1])),
    ];
    redrawDrawView();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!cachesRef.current || testingJoints) return;
    if (editingJoints) return onJointPointer(e, "down");
    if (editingMouth) return onMouthPointer(e, "down");
    if (tool === "move") return onMovePointer(e, "down");
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toCharCoords(e);
    const stroke: Stroke = { color: erasing ? "erase" : color, size: erasing ? size + 10 : size, pts: [x, y] };
    currentStrokeRef.current = stroke;
    partsRef.current[activePart].push(stroke);
    undoRef.current.push(activePart);
    setCanUndo(true);
    const cctx = cachesRef.current[activePart].getContext("2d")!;
    cctx.setTransform(RES, 0, 0, RES, 0, 0);
    strokeSegment(cctx, stroke, 0);
    redrawDrawView();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingJoints) return onJointPointer(e, "move");
    if (editingMouth) return onMouthPointer(e, "move");
    if (tool === "move") return onMovePointer(e, "move");
    const stroke = currentStrokeRef.current;
    if (!stroke || !cachesRef.current) return;
    const [x, y] = toCharCoords(e);
    const n = stroke.pts.length;
    if (Math.abs(stroke.pts[n - 2] - x) + Math.abs(stroke.pts[n - 1] - y) < 2) return;
    stroke.pts.push(x, y);
    const cctx = cachesRef.current[activePart].getContext("2d")!;
    cctx.setTransform(RES, 0, 0, RES, 0, 0);
    strokeSegment(cctx, stroke, n);
    redrawDrawView();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingJoints) return onJointPointer(e, "up");
    if (editingMouth) return onMouthPointer(e, "up");
    if (tool === "move") return onMovePointer(e, "up");
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    // Un punto solo ya quedó como círculo; nada más que hacer
    if (stroke && stroke.pts.length === 2 && cachesRef.current) redrawDrawView();
  };

  const undo = () => {
    const part = undoRef.current.pop();
    if (part && cachesRef.current) {
      partsRef.current[part].pop();
      rerender(part);
      redrawDrawView();
    }
    setCanUndo(undoRef.current.length > 0);
  };

  const clearPart = () => {
    if (!cachesRef.current) return;
    partsRef.current[activePart] = [];
    undoRef.current = undoRef.current.filter((p) => p !== activePart);
    setCanUndo(undoRef.current.length > 0);
    rerender(activePart);
    redrawDrawView();
  };

  // ---------- Fotos ----------
  const onPhotoChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const c = await fileToCanvas(file);
      setLastPhoto(c);
      setCutSource(c);
    } catch {
      setNotice("No pude abrir esa foto 😕 Intenta con otra.");
    }
  };

  const placeCutout = async (dataUrl: string) => {
    setCutSource(null);
    const el = await loadImage(dataUrl);
    imagesRef.current[activePart] = { p: { src: dataUrl, ...fitInGuide(activePart, el.width, el.height) }, el };
    rerender(activePart);
    setTool("move");
    setImageVersion((v) => v + 1);
    redrawDrawView();
  };

  const adjustImage = (fn: (p: PartImage) => void) => {
    const img = imagesRef.current[activePart];
    if (!img) return;
    fn(img.p);
    rerender(activePart);
    redrawDrawView();
  };

  const removeImage = () => {
    delete imagesRef.current[activePart];
    rerender(activePart);
    setTool("draw");
    setImageVersion((v) => v + 1);
    redrawDrawView();
  };

  const copyToOtherSide = () => {
    const other = OTHER_SIDE[activePart];
    const img = imagesRef.current[activePart];
    if (!other || !img) return;
    const [px] = PART_BY_ID[activePart].pivot;
    const [ox] = PART_BY_ID[other].pivot;
    imagesRef.current[other] = {
      el: img.el,
      p: { ...img.p, x: ox + (px - img.p.x), rot: -img.p.rot, flip: !img.p.flip },
    };
    const j = jointsRef.current[activePart];
    if (j) jointsRef.current[other] = [ox + (px - j[0]), j[1]];
    rerender(other);
    setImageVersion((v) => v + 1);
    setActivePart(other);
  };

  // ---------- Boca ----------
  const openMouthEditor = () => {
    if (!mouthRef.current) {
      // Centrada en la cabeza (en su foto si tiene), un poco abajo
      const head = imagesRef.current.head?.p;
      mouthRef.current = head
        ? { ...DEFAULT_MOUTH, x: head.x, y: head.y + head.h * 0.22, w: Math.max(30, head.w * 0.35) }
        : { ...DEFAULT_MOUTH };
      setHasMouth(true);
    }
    setActivePart("head");
    setEditingJoints(false);
    setEditingMouth(true);
  };

  const adjustMouth = (fn: (m: Mouth) => void) => {
    if (!mouthRef.current) return;
    fn(mouthRef.current);
    setImageVersion((v) => v + 1);
    redrawDrawView();
  };

  const removeMouth = () => {
    mouthRef.current = null;
    setHasMouth(false);
    setEditingMouth(false);
  };

  // ---------- Navegación ----------
  const startNew = () => {
    partsRef.current = emptyParts();
    imagesRef.current = {};
    mouthRef.current = null;
    jointsRef.current = {};
    voiceRef.current = null;
    voiceBufferRef.current = null;
    setHasMouth(false);
    setEditingJoints(false);
    setHasVoice(false);
    setEditingMouth(false);
    cachesRef.current = buildCaches(partsRef.current);
    setTool("draw");
    undoRef.current = [];
    setCanUndo(false);
    setEditingId(null);
    setName("");
    setActivePart("head");
    setErasing(false);
    setPhase("draw");
  };

  const openCharacter = async (c: SavedCharacter, to: Phase) => {
    partsRef.current = structuredClone(c.parts);
    const loaded: LoadedImages = {};
    await Promise.all(
      Object.entries(c.images ?? {}).map(async ([id, p]) => {
        try {
          loaded[id as PartId] = { p: { ...p }, el: await loadImage(p.src) };
        } catch {
          /* una foto dañada no impide abrir el resto */
        }
      })
    );
    imagesRef.current = loaded;
    mouthRef.current = c.mouth ? { ...c.mouth } : null;
    jointsRef.current = structuredClone(c.joints ?? {});
    setEditingJoints(false);
    voiceRef.current = c.voice ?? null;
    voiceBufferRef.current = null;
    setHasMouth(!!c.mouth);
    setHasVoice(!!c.voice);
    setEditingMouth(false);
    cachesRef.current = buildCaches(partsRef.current, loaded);
    setTool("draw");
    undoRef.current = [];
    setCanUndo(false);
    setEditingId(c.id);
    setName(c.name);
    setActivePart("head");
    setPhase(to);
  };

  const partDone = (id: PartId) => partsRef.current[id].length > 0 || !!imagesRef.current[id];
  const hasDrawing = () => PARTS.some((p) => partDone(p.id));

  const saveCurrent = (): boolean => {
    if (!cachesRef.current || !hasDrawing()) return false;
    const id = editingId ?? `${Date.now()}`;
    const entry: SavedCharacter = {
      id,
      name: name.trim().slice(0, 24),
      parts: structuredClone(partsRef.current),
      updatedAt: Date.now(),
    };
    const images: PartImages = {};
    for (const [pid, img] of Object.entries(imagesRef.current)) if (img) images[pid as PartId] = { ...img.p };
    entry.images = images;
    entry.mouth = mouthRef.current ?? undefined;
    entry.voice = voiceRef.current ?? undefined;
    entry.joints = Object.keys(jointsRef.current).length ? structuredClone(jointsRef.current) : undefined;
    entry.thumb = makeThumbnail(cachesRef.current, mouthRef.current, entry.joints);
    const list = [entry, ...characters.filter((c) => c.id !== id)].slice(0, MAX_SAVED);
    setCharacters(list);
    setEditingId(id);
    storeCharacters(storageKey, list).then((ok) => {
      if (!ok) setNotice("No se pudo guardar en esta tablet, pero puedes seguir jugando.");
    });
    return true;
  };

  const goToStage = () => {
    if (!hasDrawing()) {
      setNotice("¡Primero dibuja tu personaje! Empieza por la cabeza 🙂");
      return;
    }
    saveCurrent();
    setPhase("stage");
  };

  const deleteCharacter = (id: string) => {
    const list = characters.filter((c) => c.id !== id);
    storeCharacters(storageKey, list);
    setCharacters(list);
    setDeleteAsk(null);
  };

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // ---------- Cámara (modo espejo) ----------
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const loadLandmarker = useCallback(async (): Promise<PoseDetector> => {
    if (landmarkerRef.current) return landmarkerRef.current;
    // @ts-expect-error -- dynamic import for code-splitting, types resolve at runtime
    const vision = await import("@mediapipe/tasks-vision");
    const { PoseLandmarker, FilesetResolver } = vision;
    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
    const make = (delegate?: "GPU") =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, ...(delegate ? { delegate } : {}) },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    let detector: PoseDetector;
    try {
      detector = await make("GPU");
    } catch {
      detector = await make();
    }
    landmarkerRef.current = detector;
    return detector;
  }, []);

  useEffect(() => {
    if (!mirror || phase !== "stage") return;
    let cancelled = false;
    setMirrorStatus("loading");
    mirrorStateRef.current = { baseline: null };
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        await loadLandmarker();
        if (!cancelled) setMirrorStatus("noone");
      } catch (err) {
        console.error("Mirror mode error:", err);
        if (!cancelled) setMirrorStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
      setMirrorStatus("off");
    };
  }, [mirror, phase, loadLandmarker, stopCamera]);

  // ---------- Escenario: ciclo de animación ----------
  useEffect(() => {
    if (phase !== "stage") return;
    const canvas = stageCanvasRef.current;
    const caches = cachesRef.current;
    if (!canvas || !caches) return;
    const ctx = canvas.getContext("2d")!;
    const start = performance.now();
    let current: Pose = { ...REST_POSE };
    let lastVideoTime = -1;
    let mirrorTarget: Pose | null = null;
    let seen = false;
    let frame = 0;
    let mouthOpen = 0;
    const levelBuf = new Float32Array(1024);
    // tiempo del movimiento: avanza más rápido o más lento según la velocidad, sin brincos al cambiarla
    let moveT = 0;
    let last = start;

    const loop = () => {
      const now0 = performance.now();
      const t = (now0 - start) / 1000;
      moveT += ((now0 - last) / 1000) * speedRef.current;
      last = now0;
      let target: Pose;
      if (mirrorRef.current) {
        const video = videoRef.current;
        const lmk = landmarkerRef.current;
        if (video && lmk && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          try {
            const res = lmk.detectForVideo(video, performance.now());
            const lm = res?.landmarks?.[0];
            const aspect = video.videoWidth / Math.max(1, video.videoHeight);
            mirrorTarget = lm ? poseFromLandmarks(lm, aspect, mirrorStateRef.current) : null;
            const nowSeen = !!mirrorTarget;
            if (nowSeen !== seen) {
              seen = nowSeen;
              setMirrorStatus(nowSeen ? "ok" : "noone");
            }
          } catch {
            /* un cuadro perdido no importa */
          }
        }
        target = mirrorTarget ?? poseFor("idle", t);
        current = blendPose(current, target, 0.45);
      } else {
        seen = false;
        mirrorTarget = null;
        target = movePose(moveRef.current, moveT, customMovesRef.current);
        current = blendPose(current, target, 0.5);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawScene(ctx, sceneRef.current, t, bgImagesRef.current);
      // sombra
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      const shadowW = 70 * Math.max(0.4, 1 + current.y / 300);
      ctx.ellipse(STAGE_W / 2 + current.x, GROUND_Y + 4, shadowW, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      const an = micRef.current?.analyser ?? (playingRef.current ? audioRef.current?.analyser : null);
      audioRef.current?.music.duck(!!micRef.current || !!playingRef.current);
      const level = an ? loudness(an, levelBuf) : 0;
      mouthOpen += (level - mouthOpen) * (level > mouthOpen ? 0.6 : 0.25);
      drawCharacter(
        ctx, caches, current, STAGE_W / 2, GROUND_Y - (FEET_Y - HIP[1]) * CHAR_SCALE, CHAR_SCALE,
        mouthRef.current, mouthOpen, jointsRef.current
      );
      // efectos: los de una sola vez se quitan solos al acabar
      const now = performance.now();
      let finished = false;
      for (const fx of stageFxRef.current) {
        const age = (now - fx.born) / 1000;
        if (effectDone(fx.kind, age)) finished = true;
        else drawEffect(ctx, fx.kind, fx.x, fx.y, fx.size, age, gifAnimsRef.current);
      }
      if (finished) {
        const alive = stageFxRef.current.filter((fx) => !effectDone(fx.kind, (now - fx.born) / 1000));
        stageFxRef.current = alive;
        setStageFx(alive);
      }
      const label = nameRef.current.trim();
      if (label) {
        ctx.font = "bold 34px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.strokeText(`⭐ ${label}`, 24, 20);
        ctx.fillStyle = "#fff";
        ctx.fillText(`⭐ ${label}`, 24, 20);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  // ---------- Voz ----------
  const ensureAudio = () => {
    if (!audioRef.current) {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      const dest = ctx.createMediaStreamDestination();
      analyser.connect(ctx.destination);
      analyser.connect(dest);
      // la música va a la bocina y al video, pero no al analizador (no mueve la boca)
      audioRef.current = { ctx, analyser, dest, music: new MusicPlayer(ctx, [ctx.destination, dest]) };
    }
    if (audioRef.current.ctx.state === "suspended") audioRef.current.ctx.resume();
    return audioRef.current;
  };

  const stopTalking = () => {
    try {
      playingRef.current?.stop();
    } catch {
      /* ya había terminado */
    }
    playingRef.current = null;
    setTalking(false);
  };

  // Reproduce su voz; regresa cuántos segundos dura
  const playVoice = async (): Promise<number> => {
    const blob = voiceRef.current;
    if (!blob) return 0;
    const a = ensureAudio();
    try {
      if (!voiceBufferRef.current) voiceBufferRef.current = await a.ctx.decodeAudioData(await blob.arrayBuffer());
    } catch {
      setNotice("No pude reproducir la grabación 😕 Grábala otra vez.");
      return 0;
    }
    stopTalking();
    const src = a.ctx.createBufferSource();
    src.buffer = voiceBufferRef.current;
    src.playbackRate.value = voiceRate;
    src.connect(a.analyser);
    src.onended = () => {
      if (playingRef.current === src) {
        playingRef.current = null;
        setTalking(false);
      }
    };
    playingRef.current = src;
    setTalking(true);
    src.start();
    return voiceBufferRef.current.duration / voiceRate;
  };

  const stopVoiceRecording = () => {
    if (micRef.current?.rec.state === "recording") micRef.current.rec.stop();
  };

  const startVoiceRecording = async () => {
    if (micRef.current || typeof MediaRecorder === "undefined") return;
    stopTalking();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setNotice("No se pudo usar el micrófono. Pide permiso a papá o mamá.");
      return;
    }
    const a = ensureAudio();
    // El micrófono mueve la boca mientras graba, pero no suena por la bocina (sin eco)
    const analyser = a.ctx.createAnalyser();
    analyser.fftSize = 1024;
    a.ctx.createMediaStreamSource(stream).connect(analyser);
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    const mime = types.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      micRef.current = null;
      setVoiceLeft(null);
      if (!chunks.length) return;
      voiceRef.current = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
      voiceBufferRef.current = null;
      setHasVoice(true);
      saveCurrent();
    };
    micRef.current = { stream, analyser, rec };
    rec.start();
    setVoiceLeft(VOICE_MAX_SECONDS);
  };

  const deleteVoice = () => {
    stopTalking();
    voiceRef.current = null;
    voiceBufferRef.current = null;
    setHasVoice(false);
    saveCurrent();
  };

  useEffect(() => {
    if (voiceLeft === null) return;
    if (voiceLeft <= 0) {
      stopVoiceRecording();
      return;
    }
    const t = setTimeout(() => setVoiceLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [voiceLeft]);

  // ---------- Grabar video ----------
  const startRecording = async () => {
    const canvas = stageCanvasRef.current;
    if (!canvas || recorderRef.current || typeof MediaRecorder === "undefined") {
      if (typeof MediaRecorder === "undefined") setNotice("Esta tablet no permite grabar video 😕");
      return;
    }
    const withVoice = !!voiceRef.current;
    const withAudio = withVoice || !!music;
    const types = withAudio
      ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    const mime = types.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const stream = canvas.captureStream(30);
    if (withAudio) stream.addTrack(ensureAudio().dest.stream.getAudioTracks()[0]);
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const type = rec.mimeType || mime || "video/webm";
      const blob = new Blob(chunks, { type });
      setVideoExt(type.includes("mp4") ? "mp4" : "webm");
      setVideoUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      recorderRef.current = null;
      setRecordLeft(null);
    };
    recorderRef.current = rec;
    rec.start();
    setRecordLeft(RECORD_SECONDS);
    if (withVoice) {
      // Con voz: el video dura lo que dura la voz + 1 s
      const secs = await playVoice();
      if (secs > 0) setRecordLeft(Math.min(VOICE_MAX_SECONDS + 5, Math.ceil(secs) + 1));
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  useEffect(() => {
    if (recordLeft === null) return;
    if (recordLeft <= 0) {
      stopRecording();
      return;
    }
    const t = setTimeout(() => setRecordLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [recordLeft]);

  // Al salir del escenario: soltar cámara y grabación
  useEffect(() => {
    if (phase === "stage") return;
    stopRecording();
    stopVoiceRecording();
    stopTalking();
    setMirror(false);
    setStageFx([]);
    setMusic(null);
    audioRef.current?.music.stop();
  }, [phase]);

  useEffect(() => () => {
    stopCamera();
    landmarkerRef.current?.close?.();
  }, [stopCamera]);

  // Arrastrar un efecto con el dedo en el escenario
  const onStagePointer = (e: React.PointerEvent<HTMLCanvasElement>, kind: "down" | "move" | "up") => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * STAGE_W;
    const y = ((e.clientY - r.top) / r.height) * STAGE_H;
    if (kind === "down") {
      const hit = [...stageFxRef.current].reverse().find((f) => Math.hypot(f.x - x, f.y - y) < f.size * 0.6);
      if (!hit) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      fxDragRef.current = { id: e.pointerId, fx: hit.id, dx: hit.x - x, dy: hit.y - y };
      return;
    }
    const drag = fxDragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    if (kind === "up") {
      fxDragRef.current = null;
      setStageFx([...stageFxRef.current]);
      return;
    }
    const fx = stageFxRef.current.find((f) => f.id === drag.fx);
    if (fx) {
      fx.x = x + drag.dx;
      fx.y = y + drag.dy;
    }
  };

  // ============================================================
  const btn = "min-h-[56px] rounded-2xl font-bold transition-all active:scale-95";

  if (phase === "story" && openStory) {
    return (
      <StoryStudio
        key={openStory.id}
        story={openStory}
        characters={characters}
        backgrounds={backgrounds}
        bgImages={bgImages}
        customMoves={customMoves}
        gifs={gifs}
        gifAnims={gifAnims}
        onAddGif={addGif}
        onRemoveGif={removeGif}
        onSave={saveStory}
        onAddBackground={addBackground}
        onRemoveBackground={removeBackground}
        onExit={() => {
          setOpenStory(null);
          setPhase("gallery");
        }}
      />
    );
  }

  if (phase === "gallery") {
    return (
      <div className="h-full flex flex-col gap-4 overflow-y-auto">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center shrink-0">
          <div className="text-6xl mb-2">🎬</div>
          <h1 className="text-3xl font-black text-white mb-1">Estudio de Animación</h1>
          <p className="text-gray-300">
            Dibuja tu personaje, ponlo a bailar… ¡o haz que copie tus movimientos con la cámara!
          </p>
          {previewMode && (
            <p className="text-amber-300 text-sm mt-2">👀 Modo papás: lo que dibujes aquí se guarda solo en este aparato.</p>
          )}
        </div>
        <button onClick={startNew} className={`${btn} shrink-0 bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white text-2xl py-5 shadow-lg`}>
          ✏️ Crear personaje nuevo
        </button>
        {characters.length > 0 && (
          <div className="shrink-0">
            <h2 className="text-lg font-bold text-white/80 mb-3">Mis personajes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {characters.map((c) => (
                <div key={c.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-2">
                  {c.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumb} alt={c.name || "Personaje"} className="w-full aspect-[200/260] object-contain rounded-xl bg-[#fffdf7]" />
                  ) : (
                    <div className="w-full aspect-[200/260] rounded-xl bg-white/10 flex items-center justify-center text-5xl">🎨</div>
                  )}
                  <div className="text-white font-bold truncate text-center">{c.name || "Sin nombre"}</div>
                  {deleteAsk === c.id ? (
                    <div className="flex gap-2">
                      <button onClick={() => deleteCharacter(c.id)} className={`${btn} flex-1 bg-red-500 text-white text-sm`}>Sí, borrar</button>
                      <button onClick={() => setDeleteAsk(null)} className={`${btn} flex-1 bg-white/10 text-white text-sm`}>No</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => openCharacter(c, "stage")} className={`${btn} flex-1 bg-violet-500 text-white`}>▶️</button>
                      <button onClick={() => openCharacter(c, "draw")} className={`${btn} flex-1 bg-white/10 text-white`}>✏️</button>
                      <button onClick={() => setDeleteAsk(c.id)} className={`${btn} w-14 bg-white/10 text-white`}>🗑️</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="shrink-0">
          <h2 className="text-lg font-bold text-white/80 mb-3">📚 Mis historias</h2>
          {characters.length === 0 ? (
            <p className="text-white/60 bg-white/5 rounded-2xl p-4">
              Crea por lo menos un personaje y luego júntalos en una historia con sus voces.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                onClick={newStory}
                className={`${btn} bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 text-xl min-h-[120px]`}
              >
                ➕ Nueva historia
              </button>
              {stories.map((st) => (
                <div key={st.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-2">
                  <div className="text-white font-bold truncate">📖 {st.title || "Sin título"}</div>
                  <div className="flex gap-1 h-14">
                    {st.cast.map((id) => {
                      const c = characters.find((ch) => ch.id === id);
                      return c?.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={id} src={c.thumb} alt="" className="h-14 w-11 object-contain rounded-lg bg-[#fffdf7]" />
                      ) : null;
                    })}
                    <span className="text-white/50 text-sm self-end ml-auto">
                      {st.lines.length} {st.lines.length === 1 ? "turno" : "turnos"}
                    </span>
                  </div>
                  {deleteStoryAsk === st.id ? (
                    <div className="flex gap-2">
                      <button onClick={() => deleteStory(st.id)} className={`${btn} flex-1 bg-red-500 text-white text-sm`}>Sí, borrar</button>
                      <button onClick={() => setDeleteStoryAsk(null)} className={`${btn} flex-1 bg-white/10 text-white text-sm`}>No</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setOpenStory(st);
                          setPhase("story");
                        }}
                        className={`${btn} flex-1 bg-violet-500 text-white`}
                      >
                        ▶️ Abrir
                      </button>
                      <button onClick={() => setDeleteStoryAsk(st.id)} className={`${btn} w-14 bg-white/10 text-white`}>🗑️</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {notice && <div className="shrink-0 bg-amber-400 text-slate-900 font-bold rounded-2xl p-3 text-center">{notice}</div>}
      </div>
    );
  }

  if (phase === "draw") {
    const part = PART_BY_ID[activePart];
    const stepIndex = DRAW_ORDER.indexOf(activePart);
    const nextPart = DRAW_ORDER[stepIndex + 1];
    const activeImage = imagesRef.current[activePart];
    return (
      <div className="h-full flex flex-col md:flex-row gap-3 min-h-0 overflow-y-auto md:overflow-hidden">
        {/* Partes */}
        <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible shrink-0">
          {DRAW_ORDER.map((id, i) => {
            const p = PART_BY_ID[id];
            const done = partDone(id);
            const side = id.endsWith("L") ? " ⬅️" : id.endsWith("R") ? " ➡️" : "";
            return (
              <button
                key={id}
                onClick={() => {
                  setActivePart(id);
                  setEditingMouth(false);
                  setEditingJoints(false);
                }}
                className={`${btn} px-3 text-left whitespace-nowrap border-2 ${
                  id === activePart && !editingMouth && !editingJoints ? "bg-violet-500 border-violet-300 text-white" : "bg-white/5 border-white/10 text-white/80"
                }`}
              >
                <span className="text-2xl mr-1">{p.emoji}</span>
                {i + 1}. {p.label}
                {side} {done && "✅"}
              </button>
            );
          })}
          <button
            onClick={openMouthEditor}
            className={`${btn} px-3 text-left whitespace-nowrap border-2 ${
              editingMouth ? "bg-violet-500 border-violet-300 text-white" : "bg-white/5 border-white/10 text-white/80"
            }`}
          >
            <span className="text-2xl mr-1">👄</span>
            7. Boca que habla {hasMouth && "✅"}
          </button>
          <button
            onClick={() => {
              setEditingMouth(false);
              setEditingJoints(true);
            }}
            className={`${btn} px-3 text-left whitespace-nowrap border-2 ${
              editingJoints ? "bg-violet-500 border-violet-300 text-white" : "bg-white/5 border-white/10 text-white/80"
            }`}
          >
            <span className="text-2xl mr-1">🔴</span>
            8. Dónde se dobla {Object.keys(jointsRef.current).length > 0 && "✅"}
          </button>
        </div>

        {/* Lienzo */}
        <div className="shrink-0 h-[65vh] md:h-auto md:shrink md:flex-1 md:min-h-0 min-w-0 flex flex-col items-center gap-2">
          <div className="text-white text-center font-bold">
            {editingJoints ? (
              <>🔴 Arrastra cada punto a donde se dobla: hombros ✋, cuello 🙂, cadera 👕 y piernas 🦶.</>
            ) : editingMouth ? (
              <>👄 Arrastra la boca a su lugar en la cara. En el escenario grabas tu voz y la boca se mueve.</>
            ) : tool === "move" && activeImage ? (
              <>✋ Arrastra la foto con un dedo. Con dos dedos la haces más grande o la giras.</>
            ) : (
              <>
                {activePart === "head" || activePart.startsWith("leg") ? "La" : "El"} {part.emoji}{" "}
                <span className="text-violet-300">{part.label.toLowerCase()}</span>
                {activePart.endsWith("L") && " de este lado ⬅️"}
                {activePart.endsWith("R") && " de este lado ➡️"}: tómale foto a tu dibujo o dibújalo dentro de la guía morada. El punto es donde se dobla.
              </>
            )}
          </div>
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <canvas
              ref={drawCanvasRef}
              width={CHAR_W * RES}
              height={CHAR_H * RES}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={`max-w-full max-h-full rounded-3xl shadow-2xl touch-none ${tool === "move" ? "cursor-move" : "cursor-crosshair"}`}
              style={{ touchAction: "none" }}
            />
          </div>
        </div>

        {/* Herramientas */}
        <div className="md:w-60 shrink-0 flex flex-col gap-3 md:min-h-0">
          <div className="flex flex-col gap-3 md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChosen} />
          {editingJoints && (
            <div className="bg-violet-400/10 border border-violet-400/30 rounded-2xl p-2 flex flex-col gap-2">
              <p className="text-sm text-violet-100">
                Cada parte gira alrededor de su punto. Ponlo en el hombro, el cuello o la cadera de tu dibujo.
              </p>
              <button
                disabled={testingJoints}
                onClick={() => setTestingJoints(true)}
                className={`${btn} bg-violet-500 text-white disabled:opacity-40`}
              >
                🤸 Probar
              </button>
              <button
                onClick={() => {
                  jointsRef.current = {};
                  setImageVersion((v) => v + 1);
                  redrawDrawView();
                }}
                className={`${btn} bg-white/10 text-white text-sm`}
              >
                ↺ Como estaban
              </button>
              <button onClick={() => setEditingJoints(false)} className={`${btn} bg-white/10 text-white text-sm`}>
                ✅ Listo con los puntos
              </button>
            </div>
          )}
          {editingMouth && (
            <div className="bg-rose-400/10 border border-rose-400/30 rounded-2xl p-2 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {MOUTH_STYLES.map((ms) => (
                  <button
                    key={ms.id}
                    onClick={() => adjustMouth((m) => { m.style = ms.id; })}
                    className={`${btn} flex flex-col items-center justify-center py-1 ${
                      mouthRef.current?.style === ms.id ? "bg-rose-400 text-slate-900" : "bg-white/10 text-white"
                    }`}
                  >
                    <span className="text-2xl">{ms.emoji}</span>
                    <span className="text-xs">{ms.label}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button aria-label="Boca más grande" onClick={() => adjustMouth((m) => { m.w = Math.min(200, m.w * 1.12); })} className={`${btn} bg-white/10 text-white text-xl`}>➕</button>
                <button aria-label="Boca más chica" onClick={() => adjustMouth((m) => { m.w = Math.max(16, m.w / 1.12); })} className={`${btn} bg-white/10 text-white text-xl`}>➖</button>
                <button aria-label="Quitar boca" onClick={removeMouth} className={`${btn} bg-white/10 text-white text-xl`}>🗑️</button>
              </div>
              <button onClick={() => setEditingMouth(false)} className={`${btn} bg-white/10 text-white text-sm`}>
                ✅ Listo con la boca
              </button>
            </div>
          )}
          {!editingMouth && !editingJoints && (<>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`${btn} bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 text-lg`}
          >
            📷 Foto de mi dibujo
          </button>
          {lastPhoto && (
            <button onClick={() => setCutSource(lastPhoto)} className={`${btn} bg-amber-400/20 text-amber-200 text-sm`}>
              ✂️ Recortar otra parte de la misma foto
            </button>
          )}
          {activeImage && (
            <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-2 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setTool("move")} className={`${btn} ${tool === "move" ? "bg-amber-400 text-slate-900" : "bg-white/10 text-white"}`}>
                  ✋ Mover
                </button>
                <button onClick={() => setTool("draw")} className={`${btn} ${tool === "draw" ? "bg-amber-400 text-slate-900" : "bg-white/10 text-white"}`}>
                  ✏️ Pintar
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button aria-label="Más grande" onClick={() => adjustImage((p) => { p.w *= 1.1; p.h *= 1.1; })} className={`${btn} bg-white/10 text-white text-xl`}>➕</button>
                <button aria-label="Más chica" onClick={() => adjustImage((p) => { p.w /= 1.1; p.h /= 1.1; })} className={`${btn} bg-white/10 text-white text-xl`}>➖</button>
                <button aria-label="Voltear" onClick={() => adjustImage((p) => { p.flip = !p.flip; })} className={`${btn} bg-white/10 text-white text-xl`}>🪞</button>
                <button aria-label="Girar a la izquierda" onClick={() => adjustImage((p) => { p.rot -= Math.PI / 12; })} className={`${btn} bg-white/10 text-white text-xl`}>↺</button>
                <button aria-label="Girar a la derecha" onClick={() => adjustImage((p) => { p.rot += Math.PI / 12; })} className={`${btn} bg-white/10 text-white text-xl`}>↻</button>
                <button aria-label="Quitar foto" onClick={removeImage} className={`${btn} bg-white/10 text-white text-xl`}>🗑️</button>
              </div>
              {OTHER_SIDE[activePart] && (
                <button onClick={copyToOtherSide} className={`${btn} bg-white/10 text-white text-sm`}>
                  👯 Copiar {activePart.startsWith("arm") ? "al otro brazo" : "a la otra pierna"}
                </button>
              )}
            </div>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Nombre de tu personaje"
            className="min-h-[56px] rounded-2xl bg-white/10 border border-white/20 px-4 text-white placeholder:text-white/40 text-lg"
          />
          <div className="grid grid-cols-6 md:grid-cols-4 gap-2">
            {BRUSH_COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => {
                  setColor(c);
                  setErasing(false);
                  setTool("draw");
                }}
                className={`h-14 rounded-full border-4 transition-transform active:scale-90 ${
                  !erasing && color === c ? "border-white scale-110" : "border-white/20"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {BRUSH_SIZES.map((b) => (
              <button
                key={b.size}
                onClick={() => setSize(b.size)}
                className={`${btn} flex flex-col items-center justify-center text-xs ${size === b.size ? "bg-white text-slate-900" : "bg-white/10 text-white"}`}
              >
                <span className="rounded-full bg-current" style={{ width: Math.min(28, b.size), height: Math.min(28, b.size) }} />
                {b.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setErasing((v) => !v)} className={`${btn} ${erasing ? "bg-amber-400 text-slate-900" : "bg-white/10 text-white"}`}>
              🧽
            </button>
            <button onClick={undo} disabled={!canUndo} className={`${btn} bg-white/10 text-white disabled:opacity-30`}>
              ↩️
            </button>
            <button onClick={clearPart} className={`${btn} bg-white/10 text-white`}>
              🗑️
            </button>
          </div>
          </>)}
          </div>
          {nextPart && !editingMouth && !editingJoints ? (
            <button onClick={() => setActivePart(nextPart)} className={`${btn} bg-white/15 text-white text-lg`}>
              Siguiente: {PART_BY_ID[nextPart].emoji} {PART_BY_ID[nextPart].label} →
            </button>
          ) : null}
          <button onClick={goToStage} className={`${btn} bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white text-xl py-4 shadow-lg`}>
            ▶️ ¡Darle vida!
          </button>
          <button onClick={() => setPhase("gallery")} className={`${btn} bg-white/5 text-white/70 text-sm`}>
            ← Mis personajes
          </button>
          {notice && <div className="bg-amber-400 text-slate-900 font-bold rounded-2xl p-3 text-center">{notice}</div>}
        </div>

        {cutSource && (
          <PhotoCutter
            source={cutSource}
            partName={`${part.emoji} ${part.label.toLowerCase()}${activePart.endsWith("L") ? " ⬅️" : activePart.endsWith("R") ? " ➡️" : ""}`}
            onCancel={() => setCutSource(null)}
            onDone={placeCutout}
          />
        )}
      </div>
    );
  }

  // ---------- Escenario ----------
  return (
    <div className="h-full flex flex-col md:flex-row gap-3 min-h-0 overflow-y-auto md:overflow-hidden">
      <div className="shrink-0 h-[45vh] md:h-auto md:shrink md:flex-1 md:min-h-0 min-w-0 flex items-center justify-center relative">
        <canvas
          ref={stageCanvasRef}
          width={STAGE_W}
          height={STAGE_H}
          onPointerDown={(e) => onStagePointer(e, "down")}
          onPointerMove={(e) => onStagePointer(e, "move")}
          onPointerUp={(e) => onStagePointer(e, "up")}
          onPointerCancel={(e) => onStagePointer(e, "up")}
          className="max-w-full max-h-full rounded-3xl shadow-2xl touch-none"
          style={{ touchAction: "none" }}
        />
        {recordLeft !== null && (
          <div className="absolute top-3 right-3 bg-red-600 text-white font-black rounded-full px-4 py-2 animate-pulse">
            ⏺ {recordLeft}s
          </div>
        )}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute bottom-3 right-3 w-32 rounded-xl border-2 border-white/60 shadow-lg ${mirror ? "" : "hidden"}`}
          style={{ transform: "scaleX(-1)" }}
        />
        {mirror && mirrorStatus !== "ok" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 text-white font-bold rounded-2xl px-4 py-2 text-center">
            {mirrorStatus === "loading" && "📷 Prendiendo la cámara…"}
            {mirrorStatus === "noone" && "🙋 ¡No te veo! Aléjate para que se vea todo tu cuerpo"}
            {mirrorStatus === "error" && "😕 No se pudo usar la cámara. Pide permiso a papá o mamá."}
          </div>
        )}
      </div>

      <div className="md:w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">
        <button
          onClick={() => setMirror((v) => !v)}
          className={`${btn} text-lg border-2 ${mirror ? "bg-emerald-500 border-emerald-300 text-white" : "bg-white/10 border-white/10 text-white"}`}
        >
          🪞 Modo espejo {mirror ? "ON" : "OFF"}
        </button>
        <div className={`grid grid-cols-4 md:grid-cols-3 gap-2 ${mirror ? "opacity-30 pointer-events-none" : ""}`}>
          {MOVES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMove(m.id)}
              className={`${btn} flex flex-col items-center justify-center py-1 ${move === m.id ? "bg-violet-500 text-white" : "bg-white/10 text-white"}`}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-xs">{m.label}</span>
            </button>
          ))}
          {customMoves.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMove(customMoveId(m.id));
                setDeleteMoveAsk(false);
              }}
              className={`${btn} flex flex-col items-center justify-center py-1 border-2 border-dashed ${
                move === customMoveId(m.id) ? "bg-violet-500 text-white border-violet-200" : "bg-white/10 text-white border-violet-400/50"
              }`}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-xs truncate max-w-full px-1">{m.name}</span>
            </button>
          ))}
        </div>
        <div className={`grid grid-cols-4 gap-2 ${mirror ? "opacity-30 pointer-events-none" : ""}`}>
          {SPEEDS.map((sp) => (
            <button
              key={sp.rate}
              onClick={() => setSpeed(sp.rate)}
              className={`${btn} flex flex-col items-center justify-center py-1 ${speed === sp.rate ? "bg-sky-400 text-slate-900" : "bg-white/10 text-white"}`}
            >
              <span className="text-xl">{sp.emoji}</span>
              <span className="text-[10px] leading-tight">{sp.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setMirror(false);
            setRecorderOpen(true);
          }}
          className={`${btn} bg-gradient-to-r from-violet-500 to-indigo-500 text-white`}
        >
          🎬 Inventar un movimiento
        </button>
        {move.startsWith("my:") && !mirror && (
          deleteMoveAsk ? (
            <div className="flex gap-2">
              <button onClick={() => deleteCustomMove(move)} className={`${btn} flex-1 bg-red-500 text-white text-sm`}>Sí, borrar</button>
              <button onClick={() => setDeleteMoveAsk(false)} className={`${btn} flex-1 bg-white/10 text-white text-sm`}>No</button>
            </div>
          ) : (
            <button onClick={() => setDeleteMoveAsk(true)} className={`${btn} min-h-[44px] bg-white/5 text-white/70 text-sm`}>
              🗑️ Borrar este movimiento
            </button>
          )
        )}
        <div className="bg-orange-400/10 border border-orange-400/30 rounded-2xl p-2 flex flex-col gap-2">
          <div className="text-orange-100 font-bold text-sm px-1">✨ Efectos (arrástralos con el dedo)</div>
          <EffectButtons onPick={addStageFx} gifs={gifs} gifAnims={gifAnims} onAddGif={addGif} onRemoveGif={removeGif} />
          {stageFx.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {stageFx.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStageFx((list) => list.filter((x) => x.id !== f.id))}
                  className="min-h-[44px] rounded-xl bg-white/10 text-white px-3 font-bold active:scale-95"
                  aria-label="Quitar efecto"
                >
                  {effectInfo(f.kind).emoji} ⏹
                </button>
              ))}
            </div>
          )}
        </div>
        <SceneButtons
          scene={scene}
          onChange={setScene}
          backgrounds={backgrounds}
          onAdd={addBackground}
          onRemove={removeBackground}
        />
        <div className="bg-sky-400/10 border border-sky-400/30 rounded-2xl p-2 flex flex-col gap-2">
          <div className="text-sky-100 font-bold text-sm px-1">🎵 Música</div>
          <div className="grid grid-cols-3 gap-2">
            {MUSIC.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  const next = music === m.id ? null : m.id;
                  setMusic(next);
                  const a = ensureAudio();
                  a.music.setVolume(musicVol);
                  a.music.play(next);
                }}
                className={`${btn} flex flex-col items-center justify-center py-1 ${music === m.id ? "bg-sky-400 text-slate-900" : "bg-white/10 text-white"}`}
              >
                <span className="text-xl">{m.emoji}</span>
                <span className="text-[10px] leading-tight">{m.label}</span>
              </button>
            ))}
            <button
              onClick={() => {
                const i = MUSIC_VOLUMES.findIndex((v) => v.level === musicVol);
                const next = MUSIC_VOLUMES[(i + 1) % MUSIC_VOLUMES.length].level;
                setMusicVol(next);
                audioRef.current?.music.setVolume(next);
              }}
              className={`${btn} flex flex-col items-center justify-center py-1 bg-white/10 text-white`}
              aria-label="Volumen de la música"
            >
              <span className="text-xl">{MUSIC_VOLUMES.find((v) => v.level === musicVol)?.emoji}</span>
              <span className="text-[10px] leading-tight">{MUSIC_VOLUMES.find((v) => v.level === musicVol)?.label}</span>
            </button>
          </div>
          {music && <p className="text-[11px] text-sky-100/80 text-center">Toca otra vez el tema para quitarlo. Se oye bajito cuando hablan.</p>}
        </div>
        <div className="bg-rose-400/10 border border-rose-400/30 rounded-2xl p-2 flex flex-col gap-2">
          {voiceLeft !== null ? (
            <button onClick={stopVoiceRecording} className={`${btn} bg-rose-600 text-white animate-pulse`}>
              ⏹ Listo ({voiceLeft}s)
            </button>
          ) : (
            <button onClick={startVoiceRecording} className={`${btn} bg-rose-500 text-white`}>
              🎤 {hasVoice ? "Grabar otra vez" : "Grabar mi voz"}
            </button>
          )}
          {hasVoice && voiceLeft === null && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setVoiceRate(v.rate);
                      stopTalking();
                    }}
                    className={`${btn} flex flex-col items-center justify-center py-1 ${
                      voiceRate === v.rate ? "bg-rose-400 text-slate-900" : "bg-white/10 text-white"
                    }`}
                  >
                    <span className="text-xl">{v.emoji}</span>
                    <span className="text-[11px]">{v.label}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                {talking ? (
                  <button onClick={stopTalking} className={`${btn} bg-white/20 text-white`}>⏹ Callar</button>
                ) : (
                  <button onClick={() => playVoice()} className={`${btn} bg-white text-slate-900`}>▶️ ¡Que hable!</button>
                )}
                <button aria-label="Borrar voz" onClick={deleteVoice} className={`${btn} w-14 bg-white/10 text-white`}>🗑️</button>
              </div>
            </>
          )}
          {!hasMouth && (
            <p className="text-xs text-rose-200 text-center">Para que mueva la boca, ponle una en ✏️ Cambiar dibujo → 👄</p>
          )}
        </div>
        {recordLeft === null ? (
          <button onClick={startRecording} className={`${btn} bg-red-500 text-white text-lg`}>
            ⏺ Grabar video {hasVoice ? "con voz" : `(${RECORD_SECONDS}s)`}
          </button>
        ) : (
          <button onClick={stopRecording} className={`${btn} bg-red-700 text-white text-lg`}>
            ⏹ Parar
          </button>
        )}
        <button onClick={() => setPhase("draw")} className={`${btn} bg-white/10 text-white`}>
          ✏️ Cambiar dibujo
        </button>
        <button onClick={() => setPhase("gallery")} className={`${btn} bg-white/5 text-white/70 text-sm`}>
          ← Mis personajes
        </button>
        {notice && <div className="bg-amber-400 text-slate-900 font-bold rounded-2xl p-3 text-center">{notice}</div>}
      </div>

      {recorderOpen && cachesRef.current && (
        <MoveRecorder
          caches={cachesRef.current}
          mouth={mouthRef.current}
          joints={jointsRef.current}
          scene={scene}
          bgImages={bgImages}
          onSave={saveCustomMove}
          onClose={() => setRecorderOpen(false)}
        />
      )}

      {videoUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 max-w-2xl w-full flex flex-col gap-4">
            <h3 className="text-2xl font-black text-white text-center">🎬 ¡Tu película!</h3>
            <video src={videoUrl} controls autoPlay loop playsInline className="w-full rounded-2xl bg-black" />
            <div className="flex gap-3">
              <a
                href={videoUrl}
                download={`${(name.trim() || "mi-personaje").replace(/[^\w-]+/g, "-")}.${videoExt}`}
                className={`${btn} flex-1 bg-violet-500 text-white flex items-center justify-center`}
              >
                💾 Guardar en la tablet
              </a>
              <button
                onClick={() => {
                  URL.revokeObjectURL(videoUrl);
                  setVideoUrl(null);
                }} className={`${btn} flex-1 bg-white/10 text-white`}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Recortar una foto con el dedo ----------
function PhotoCutter({
  source,
  partName,
  onCancel,
  onDone,
}: {
  source: HTMLCanvasElement;
  partName: string;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lassoRef = useRef<number[]>([]);
  const drawingRef = useRef(false);
  const [lasso, setLasso] = useState<number[] | null>(null); // contorno ya cerrado
  const [removePaper, setRemovePaper] = useState(true);
  const closed = lasso !== null;
  const preview = useMemo(
    () => (lasso ? makeCutout(source, lasso, removePaper) : null),
    [lasso, removePaper, source]
  );

  const paint = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(source, 0, 0);
    const pts = lassoRef.current;
    if (pts.length < 4) return;
    const path = new Path2D();
    path.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
    if (closed) {
      path.closePath();
      const dim = new Path2D();
      dim.rect(0, 0, c.width, c.height);
      dim.addPath(path);
      ctx.fillStyle = "rgba(15,23,42,0.65)";
      ctx.fill(dim, "evenodd");
    }
    const lw = Math.max(4, c.width / 150);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = lw + 4;
    ctx.strokeStyle = "#0f172a";
    ctx.stroke(path);
    ctx.lineWidth = lw;
    ctx.strokeStyle = "#facc15";
    ctx.stroke(path);
  }, [source, closed]);

  useEffect(() => {
    paint();
  }, [paint]);

  const toPhoto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * source.width, ((e.clientY - r.top) / r.height) * source.height];
  };

  const btn = "min-h-[56px] rounded-2xl font-bold transition-all active:scale-95 px-4";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col md:flex-row gap-3 p-4 overflow-y-auto">
      <div className="flex-1 min-h-[50vh] md:min-h-0 min-w-0 flex flex-col gap-2">
        <div className="text-white font-bold text-center text-lg">
          ✂️ Con el dedo, dibuja una línea alrededor de {partName}
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={source.width}
            height={source.height}
            className="max-w-full max-h-full rounded-2xl touch-none"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drawingRef.current = true;
              lassoRef.current = toPhoto(e);
              setLasso(null);
              paint();
            }}
            onPointerMove={(e) => {
              if (!drawingRef.current) return;
              const [x, y] = toPhoto(e);
              const p = lassoRef.current;
              if (Math.hypot(p[p.length - 2] - x, p[p.length - 1] - y) < source.width / 200) return;
              p.push(x, y);
              paint();
            }}
            onPointerUp={() => {
              drawingRef.current = false;
              if (lassoRef.current.length >= 6) setLasso([...lassoRef.current]);
              else lassoRef.current = [];
              paint();
            }}
          />
        </div>
      </div>
      <div className="md:w-64 shrink-0 flex flex-col gap-3">
        {preview ? (
          <div className="rounded-2xl p-2 flex items-center justify-center bg-[repeating-conic-gradient(#e5e7eb_0_25%,#ffffff_0_50%)] bg-[length:20px_20px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Recorte" className="max-h-48 object-contain" />
          </div>
        ) : (
          <div className="rounded-2xl p-4 bg-white/5 text-white/70 text-sm text-center">
            Aquí vas a ver tu recorte. Si el dibujo ocupa toda la foto, usa «Toda la foto».
          </div>
        )}
        <button
          onClick={() => setRemovePaper((v) => !v)}
          className={`${btn} ${removePaper ? "bg-emerald-500 text-white" : "bg-white/10 text-white"}`}
        >
          {removePaper ? "✅" : "⬜"} Quitar el papel blanco
        </button>
        <button
          disabled={!preview}
          onClick={() => preview && onDone(preview)}
          className={`${btn} bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white text-lg disabled:opacity-30`}
        >
          ✅ Usar este recorte
        </button>
        <button
          onClick={() => {
            const all = makeCutout(source, [], removePaper);
            if (all) onDone(all);
          }}
          className={`${btn} bg-white/10 text-white`}
        >
          🖼️ Toda la foto
        </button>
        <button
          onClick={() => {
            lassoRef.current = [];
            setLasso(null);
            paint();
          }}
          className={`${btn} bg-white/10 text-white`}
        >
          ↩️ Volver a recortar
        </button>
        <button onClick={onCancel} className={`${btn} bg-white/5 text-white/70`}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// Estudio de Animación — datos: partes del personaje, movimientos y escenarios.
// Todo corre en la tablet; los dibujos se guardan solo en el navegador del niño.

export const CHAR_W = 400;
export const CHAR_H = 520;

export type PartId = "legL" | "legR" | "body" | "armL" | "armR" | "head";

export interface PartDef {
  id: PartId;
  label: string;
  emoji: string;
  // Punto de giro (articulación) en coordenadas del personaje
  pivot: [number, number];
  // Guía punteada que se muestra al dibujar
  guide:
    | { kind: "circle"; cx: number; cy: number; r: number }
    | { kind: "rect"; x: number; y: number; w: number; h: number };
}

// Orden = orden de dibujado en el escenario (piernas atrás, cabeza al frente)
export const PARTS: PartDef[] = [
  { id: "legL", label: "Pierna", emoji: "🦵", pivot: [172, 330], guide: { kind: "rect", x: 150, y: 330, w: 44, h: 170 } },
  { id: "legR", label: "Pierna", emoji: "🦵", pivot: [228, 330], guide: { kind: "rect", x: 206, y: 330, w: 44, h: 170 } },
  { id: "body", label: "Cuerpo", emoji: "👕", pivot: [200, 330], guide: { kind: "rect", x: 140, y: 165, w: 120, h: 170 } },
  { id: "armL", label: "Brazo", emoji: "💪", pivot: [132, 185], guide: { kind: "rect", x: 108, y: 175, w: 44, h: 150 } },
  { id: "armR", label: "Brazo", emoji: "💪", pivot: [268, 185], guide: { kind: "rect", x: 248, y: 175, w: 44, h: 150 } },
  { id: "head", label: "Cabeza", emoji: "🙂", pivot: [200, 165], guide: { kind: "circle", cx: 200, cy: 100, r: 70 } },
];

// Orden en que se le pide al niño dibujar
export const DRAW_ORDER: PartId[] = ["head", "body", "armL", "armR", "legL", "legR"];

export interface Stroke {
  color: string; // "erase" = borrador
  size: number;
  pts: number[]; // x0,y0,x1,y1...
}

export type CharacterParts = Record<PartId, Stroke[]>;

// Recorte de una foto (dibujo en papel) usado como parte del personaje.
// x, y = centro en coordenadas del personaje.
export interface PartImage {
  src: string; // PNG data URL, ya recortado y sin el papel
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  flip: boolean;
}

export type PartImages = Partial<Record<PartId, PartImage>>;

// Boca de caricatura que se abre con la voz. x, y = centro en coordenadas del personaje.
export type MouthStyle = "toon" | "smile" | "monster" | "lips";

export interface Mouth {
  style: MouthStyle;
  x: number;
  y: number;
  w: number;
}

export const MOUTH_STYLES: { id: MouthStyle; label: string; emoji: string }[] = [
  { id: "toon", label: "Caricatura", emoji: "😮" },
  { id: "smile", label: "Sonrisa", emoji: "😁" },
  { id: "monster", label: "Monstruo", emoji: "👹" },
  { id: "lips", label: "Labios", emoji: "💋" },
];

export const DEFAULT_MOUTH: Mouth = { style: "toon", x: 200, y: 135, w: 64 };

// Voces chistosas: cambiar la velocidad cambia el tono
export const VOICES = [
  { id: "normal", label: "Mi voz", emoji: "🙂", rate: 1 },
  { id: "squirrel", label: "Ardilla", emoji: "🐿️", rate: 1.45 },
  { id: "monster", label: "Monstruo", emoji: "👹", rate: 0.72 },
] as const;

export const VOICE_MAX_SECONDS = 15;

// Puntos donde se dobla cada parte, puestos por el niño (si no, los de PARTS)
export type Joints = Partial<Record<PartId, [number, number]>>;

// Accesorio pegado a una parte (casco en la cabeza, láser en la mano…): se mueve con ella.
// x, y = centro en coordenadas del personaje sin mover.
export interface CharacterItem {
  id: string;
  kind: string;
  part: PartId;
  x: number;
  y: number;
  size: number;
  rot: number;
  flip: boolean;
  color?: string;
}

export const MAX_ITEMS = 10;

export interface SavedCharacter {
  id: string;
  name: string;
  parts: CharacterParts;
  updatedAt: number;
  thumb?: string;
  images?: PartImages;
  mouth?: Mouth;
  voice?: Blob; // grabación de su voz (se queda en la tablet)
  joints?: Joints;
  items?: CharacterItem[];
}

export function emptyParts(): CharacterParts {
  return { head: [], body: [], armL: [], armR: [], legL: [], legR: [] };
}

export const BRUSH_COLORS = [
  "#111827", "#ffffff", "#ef4444", "#f97316", "#facc15", "#22c55e",
  "#3b82f6", "#a855f7", "#ec4899", "#92400e", "#fcd5b5", "#14b8a6",
];

export const BRUSH_SIZES = [
  { size: 6, label: "Fino" },
  { size: 14, label: "Medio" },
  { size: 32, label: "Gordo" },
];

// ---------- Poses ----------
// Ángulos en radianes. 0 = como lo dibujó el niño.
// Brazos/piernas: positivo gira hacia la izquierda de la pantalla.
export interface Pose {
  x: number;
  y: number;
  rot: number;
  scaleX: number;
  squash: number; // 1 = normal
  body: number;
  head: number;
  armL: number;
  armR: number;
  legL: number;
  legR: number;
}

export const REST_POSE: Pose = {
  x: 0, y: 0, rot: 0, scaleX: 1, squash: 1,
  body: 0, head: 0, armL: 0.15, armR: -0.15, legL: 0, legR: 0,
};

export type MoveId = "idle" | "dance" | "jump" | "walk" | "wave" | "karate" | "spin";

export const MOVES: { id: MoveId; label: string; emoji: string }[] = [
  { id: "dance", label: "Bailar", emoji: "💃" },
  { id: "jump", label: "Saltar", emoji: "🦘" },
  { id: "walk", label: "Caminar", emoji: "🚶" },
  { id: "wave", label: "Saludar", emoji: "👋" },
  { id: "karate", label: "Karate", emoji: "🥋" },
  { id: "spin", label: "Voltereta", emoji: "🤸" },
  { id: "idle", label: "Quieto", emoji: "🧍" },
];

export function poseFor(move: MoveId, t: number): Pose {
  const p: Pose = { ...REST_POSE };
  switch (move) {
    case "idle": {
      p.y = Math.sin(t * 2) * 3;
      p.armL = 0.15 + Math.sin(t * 2) * 0.05;
      p.armR = -0.15 - Math.sin(t * 2) * 0.05;
      p.head = Math.sin(t * 1.3) * 0.05;
      break;
    }
    case "dance": {
      const b = t * 5;
      p.y = -Math.abs(Math.sin(b)) * 22;
      p.body = Math.sin(b) * 0.15;
      p.head = -Math.sin(b) * 0.25;
      p.armL = 1.6 + Math.sin(b * 2) * 0.9;
      p.armR = -1.6 + Math.sin(b * 2) * 0.9;
      p.legL = Math.max(0, Math.sin(b)) * 0.45;
      p.legR = -Math.max(0, -Math.sin(b)) * 0.45;
      break;
    }
    case "jump": {
      const period = 1.3;
      const ph = (t % period) / period;
      if (ph < 0.2) {
        // agacharse
        const c = Math.sin((ph / 0.2) * Math.PI);
        p.squash = 1 - c * 0.12;
        p.armL = 0.15 - c * 0.5;
        p.armR = -0.15 + c * 0.5;
      } else if (ph < 0.85) {
        const air = Math.sin(((ph - 0.2) / 0.65) * Math.PI);
        p.y = -air * 170;
        p.armL = 0.15 + air * 2.6;
        p.armR = -0.15 - air * 2.6;
        p.legL = air * 0.35;
        p.legR = -air * 0.35;
        p.head = -air * 0.1;
      } else {
        const c = Math.sin(((ph - 0.85) / 0.15) * Math.PI);
        p.squash = 1 - c * 0.15;
      }
      break;
    }
    case "walk": {
      const s = t * 6;
      const travel = Math.sin(t * 0.45);
      p.x = travel * 230;
      p.scaleX = Math.cos(t * 0.45) >= 0 ? 1 : -1;
      p.y = -Math.abs(Math.cos(s)) * 8;
      p.legL = Math.sin(s) * 0.5;
      p.legR = -Math.sin(s) * 0.5;
      p.armL = 0.1 - Math.sin(s) * 0.55;
      p.armR = -0.1 - Math.sin(s) * 0.55;
      p.head = Math.sin(s * 2) * 0.04;
      break;
    }
    case "wave": {
      p.armR = -2.7 + Math.sin(t * 9) * 0.45;
      p.armL = 0.2;
      p.head = 0.15 + Math.sin(t * 2) * 0.05;
      p.body = -0.05;
      p.y = Math.sin(t * 2) * 3;
      break;
    }
    case "karate": {
      const period = 1.6;
      const ph = (t % period) / period;
      const hit = (a: number, b: number) =>
        ph >= a && ph < b ? Math.sin(((ph - a) / (b - a)) * Math.PI) : 0;
      const pL = hit(0, 0.25);
      const pR = hit(0.25, 0.5);
      const kick = hit(0.55, 0.9);
      p.armL = 0.6 + pL * 1.0;
      p.armR = -0.6 - pR * 1.0;
      p.legR = -kick * 1.4;
      p.legL = 0.15;
      p.body = kick * 0.2;
      p.y = -kick * 10;
      p.squash = 0.96;
      break;
    }
    case "spin": {
      const period = 1.6;
      const ph = (t % period) / period;
      const air = Math.sin(ph * Math.PI);
      p.y = -air * 150;
      p.rot = ph * Math.PI * 2;
      p.armL = 0.15 + air * 2.2;
      p.armR = -0.15 - air * 2.2;
      p.legL = air * 0.3;
      p.legR = -air * 0.3;
      break;
    }
  }
  return p;
}

// ---------- Movimientos inventados (moviendo los puntitos) ----------
// Cada cuadro: [t, x, y, body, head, armL, armR, legL, legR]
export const POSE_KEYS = ["x", "y", "body", "head", "armL", "armR", "legL", "legR"] as const;

export interface CustomMove {
  id: string;
  name: string;
  emoji: string;
  frames: number[][];
  speed?: number; // velocidad fija que le dejó el niño (1 = como lo grabó)
}

export const MAX_CUSTOM_MOVES = 20;
export const MOVE_MAX_SECONDS = 20;
export const KEYFRAME_SECONDS = 0.5; // un fotograma tarda esto en llegar desde el anterior
export const CUSTOM_MOVE_EMOJIS = ["⭐", "🕺", "🤖", "🦖", "🥷", "🐒", "🦸", "🧟"];

export const customMoveId = (id: string) => `my:${id}`;

// Velocidad de la animación: multiplica el tiempo del movimiento
export const SPEEDS = [
  { rate: 0.5, label: "Lento", emoji: "🐢" },
  { rate: 1, label: "Normal", emoji: "🚶" },
  { rate: 1.7, label: "Rápido", emoji: "⚡" },
  { rate: 2.6, label: "Muy rápido", emoji: "🚀" },
] as const;

export const speedInfo = (rate = 1) => SPEEDS.find((s) => s.rate === rate) ?? SPEEDS[1];

export function poseToFrame(t: number, p: Pose): number[] {
  return [t, ...POSE_KEYS.map((k) => p[k])];
}

// La pose del movimiento inventado en el segundo t (se repite)
export function customPoseAt(m: CustomMove, t: number): Pose {
  const p: Pose = { ...REST_POSE };
  const f = m.frames;
  if (!f.length) return p;
  const total = f[f.length - 1][0];
  const tt = total > 0 ? t % (total + 0.4) : 0;
  let a = f[0], b = f[0];
  if (tt >= total) a = b = f[f.length - 1];
  else {
    for (let i = 1; i < f.length; i++) {
      if (f[i][0] >= tt) {
        a = f[i - 1];
        b = f[i];
        break;
      }
    }
  }
  const span = b[0] - a[0];
  const k = span > 0 ? Math.min(1, Math.max(0, (tt - a[0]) / span)) : 0;
  POSE_KEYS.forEach((key, i) => {
    p[key] = a[i + 1] + (b[i + 1] - a[i + 1]) * k;
  });
  return p;
}

// Movimiento prehecho o inventado ("my:<id>")
export function movePose(move: string, t: number, custom: CustomMove[]): Pose {
  if (move.startsWith("my:")) {
    const m = custom.find((c) => customMoveId(c.id) === move);
    return m ? customPoseAt(m, t * (m.speed ?? 1)) : poseFor("idle", t);
  }
  return poseFor(move as MoveId, t);
}

export function moveInfo(move: string, custom: CustomMove[]): { label: string; emoji: string } {
  if (move.startsWith("my:")) {
    const m = custom.find((c) => customMoveId(c.id) === move);
    return m ? { label: m.name || "Mío", emoji: m.emoji } : { label: "Quieto", emoji: "🧍" };
  }
  return MOVES.find((m) => m.id === move) ?? MOVES[MOVES.length - 1];
}

// ---------- Efectos (fuego, explosión, GIFs propios) ----------
export interface StoryEffect {
  id: string;
  kind: string; // id de EFFECTS o "gif:<id>"
  x: number; // centro, en coordenadas del escenario
  y: number;
  size: number;
  turns: number; // cuántos turnos dura; 0 = hasta el final
}

export interface CustomGif {
  id: string;
  blob: Blob;
}

export const MAX_GIFS = 12;
export const GIF_MAX_BYTES = 6 * 1024 * 1024;
export const EFFECT_TURNS = [1, 2, 3, 0];

// ---------- Escenarios ----------
export type SceneId = "park" | "space" | "beach" | "disco" | "jungle";

export const SCENES: { id: SceneId; label: string; emoji: string }[] = [
  { id: "park", label: "Parque", emoji: "🌳" },
  { id: "space", label: "Espacio", emoji: "🪐" },
  { id: "beach", label: "Playa", emoji: "🏖️" },
  { id: "disco", label: "Disco", emoji: "🪩" },
  { id: "jungle", label: "Selva", emoji: "🌴" },
];

// ---------- Fondos propios e historias ----------
export interface CustomBackground {
  id: string;
  src: string; // JPEG data URL 960×600
}

// Un turno de la historia: quién habla, qué hace y su voz
export interface StoryLine {
  id: string;
  charId: string;
  move: string; // MoveId o "my:<id>"
  rate: number;
  voice?: Blob;
  effects?: StoryEffect[];
  speed?: number; // velocidad del movimiento en este turno
  music?: string; // desde este turno: id de MUSIC o "none"; sin valor = sigue la de antes
}

export interface Story {
  id: string;
  title: string;
  scene: string; // id de escenario o "bg:<id>"
  cast: string[]; // ids de personajes, en orden de izquierda a derecha
  flips: boolean[]; // voltear a cada personaje
  lines: StoryLine[];
  updatedAt: number;
}

export const MAX_CAST = 3;
export const MAX_BACKGROUNDS = 12;
export const MAX_STORIES = 12;
export const SILENT_LINE_SECONDS = 2.5;

// ---------- Película con línea de tiempo ----------
// Cada personaje, efecto o música es una pista con franjas (desde → hasta, en segundos).
// Un personaje solo se ve mientras tiene una franja; varias pistas pueden encimarse.
export interface CharClip {
  id: string;
  start: number;
  end: number;
  move: string;
  speed: number;
  x: number; // centro en el escenario
  flip: boolean;
  voice?: Blob;
  rate: number;
}

export interface FxClip {
  id: string;
  start: number;
  end: number;
  kind: string;
  x: number;
  y: number;
  size: number;
}

export interface MusicClip {
  id: string;
  start: number;
  end: number;
  music: string;
}

export type MovieTrack =
  | { id: string; type: "char"; charId: string; clips: CharClip[] }
  | { id: string; type: "fx"; clips: FxClip[] }
  | { id: string; type: "music"; clips: MusicClip[] };

export interface Movie {
  id: string;
  title: string;
  scene: string;
  length: number; // segundos
  tracks: MovieTrack[];
  updatedAt: number;
}

export const MAX_MOVIES = 12;
export const MAX_TRACKS = 8;
export const MOVIE_LENGTHS = [10, 20, 30, 45, 60];
export const MIN_CLIP_SECONDS = 0.3;

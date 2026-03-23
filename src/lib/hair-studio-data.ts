// Hair Studio — Color palette and game config

export type HairColor = {
  id: string;
  label: string;
  hex: string;
  emoji: string;
};

export type HairStyle = {
  id: string;
  label: string;
  emoji: string;
  overlay: string; // path to PNG overlay (future)
};

export const HAIR_COLORS: HairColor[] = [
  { id: "red", label: "Rojo", hex: "#FF2D2D", emoji: "🔴" },
  { id: "blue", label: "Azul", hex: "#2D7AFF", emoji: "🔵" },
  { id: "pink", label: "Rosa", hex: "#FF69B4", emoji: "🩷" },
  { id: "green", label: "Verde", hex: "#00E676", emoji: "🟢" },
  { id: "purple", label: "Morado", hex: "#AA00FF", emoji: "🟣" },
  { id: "orange", label: "Naranja", hex: "#FF9100", emoji: "🟠" },
  { id: "yellow", label: "Amarillo", hex: "#FFD600", emoji: "🟡" },
  { id: "cyan", label: "Cian", hex: "#00E5FF", emoji: "🩵" },
  { id: "white", label: "Blanco", hex: "#F0F0F0", emoji: "⚪" },
  { id: "rainbow", label: "Arcoiris", hex: "rainbow", emoji: "🌈" },
];

// Blend modes for different effects
export type BlendMode = "multiply" | "overlay" | "soft-light" | "color";

export const BLEND_MODES: { id: BlendMode; label: string }[] = [
  { id: "color", label: "Natural" },
  { id: "overlay", label: "Brillante" },
  { id: "multiply", label: "Intenso" },
  { id: "soft-light", label: "Suave" },
];

// Points config
export const HAIR_STUDIO_POINTS = {
  perPhoto: 5,       // coins per photo saved
  maxPhotos: 10,     // max photos per session (cap coins)
  bonusAllColors: 15, // bonus for trying all colors
};

// MediaPipe segmenter categories
export const HAIR_CATEGORY = 1; // hair = category 1 in multiclass selfie model

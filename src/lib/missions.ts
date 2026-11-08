// Misiones que hay que cumplir antes de jugar un juego (p. ej. aprenderse una frase para la escuela).
// Cada misión se pide una vez al día mientras esté vigente (hasta `until`, inclusive).

export type MissionChunk = { text: string; es: string };

export type PhraseMission = {
  id: string;
  kid: "isaac" | "elias";
  kidName: string;
  game: "animation-studio";
  until: string; // YYYY-MM-DD, hora local
  audioDir: string;
  chunks: MissionChunk[];
};

export const MISSIONS: PhraseMission[] = [
  {
    id: "isaac-fractions-2026-11",
    kid: "isaac",
    kidName: "Isaac",
    game: "animation-studio",
    until: "2026-11-09",
    audioDir: "/audio/mission-isaac",
    chunks: [
      { text: "Today, we are going to learn the secret", es: "Hoy vamos a aprender el secreto" },
      { text: "to adding fractions with different bottom numbers!", es: "para sumar fracciones con diferente número de abajo" },
      { text: "We will find out how to turn different fractions into 'twin fractions'", es: "Vamos a descubrir cómo convertir fracciones diferentes en «fracciones gemelas»" },
      { text: "so they can team up and be added together perfectly.", es: "para que hagan equipo y se sumen perfecto" },
    ],
  },
  {
    id: "elias-visuals-2026-11",
    kid: "elias",
    kidName: "Elías",
    game: "animation-studio",
    until: "2026-11-09",
    audioDir: "/audio/mission-elias",
    chunks: [
      { text: "We are so excited to share everything we discovered", es: "Estamos muy emocionados de compartir todo lo que descubrimos" },
      { text: "and show you how numbers can turn into awesome visuals.", es: "y mostrarles cómo los números se convierten en imágenes increíbles" },
      { text: "Come join us on this journey!", es: "¡Vengan con nosotros en este viaje!" },
    ],
  },
];

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function kidFromProfile(profile: { full_name?: string | null; email?: string | null } | null): PhraseMission["kid"] | null {
  const name = plain(profile?.full_name || "");
  const email = plain(profile?.email || "");
  for (const kid of ["isaac", "elias"] as const) if (name.includes(kid) || email.includes(kid)) return kid;
  return null;
}

export function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function activeMission(kid: PhraseMission["kid"] | null, game: PhraseMission["game"], day = localDay()): PhraseMission | null {
  if (!kid) return null;
  return MISSIONS.find((m) => m.kid === kid && m.game === game && day <= m.until) ?? null;
}

// Palabras para jugar: sin signos, pero mostrando la palabra tal cual
export const missionWords = (text: string) => text.split(/\s+/).filter(Boolean);
export const cleanWord = (w: string) => plain(w).replace(/[^a-z0-9']/g, "").replace(/^'+|'+$/g, "");

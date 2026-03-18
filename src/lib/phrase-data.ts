// Phrase Challenge data — "A season full of color and joy"

export const PHRASE_TEXT = "A season full of color and joy";
export const PHRASE_WORDS = ["A", "season", "full", "of", "color", "and", "joy"] as const;

export const DISTRACTORS = ["winter", "empty", "bright", "spring", "sadness"] as const;

// Words to blank out in Level 2 (always blank the content words, keep structure words visible)
export const BLANK_SETS: number[][] = [
  [1, 4, 6], // season, color, joy
  [2, 4, 6], // full, color, joy
  [1, 2, 6], // season, full, joy
];

// Words to scramble in Level 3 (never scramble "A" or "of" — too short)
export const SCRAMBLE_INDICES = [1, 2, 4, 6]; // season, full, color, joy

export const LEVEL_CONFIG = [
  { id: 1, title: "Escucha y Descubre", emoji: "👂", maxPts: 20, desc: "Ordena las palabras" },
  { id: 2, title: "Completa la Frase", emoji: "✏️", maxPts: 25, desc: "Llena los espacios" },
  { id: 3, title: "Palabras Revueltas", emoji: "🔀", maxPts: 32, desc: "Desenreda las letras" },
  { id: 4, title: "Escribe de Memoria", emoji: "🧠", maxPts: 40, desc: "Escribe toda la frase" },
  { id: 5, title: "El Gran Final", emoji: "🏆", maxPts: 175, desc: "¡Contra reloj!" },
] as const;

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function scrambleWord(word: string): string {
  const letters = word.split("");
  let scrambled: string[];
  do {
    scrambled = shuffleArray(letters);
  } while (scrambled.join("") === word && word.length > 1);
  return scrambled.join("");
}
